const db = require('../db/db');
const redis = require('../db/redis');

// Auxiliar para hacer upsert seguro en la tabla scores
async function upsertScore(userId, matchId, points, reason) {
  const existingScoreResult = await db.query(
    'SELECT id FROM scores WHERE user_id = $1 AND match_id = $2',
    [userId, matchId]
  );

  if (existingScoreResult.rows.length > 0) {
    await db.query(
      'UPDATE scores SET points = $1, reason = $2, created_at = NOW() WHERE user_id = $3 AND match_id = $4',
      [points, reason, userId, matchId]
    );
  } else {
    await db.query(
      'INSERT INTO scores (user_id, match_id, points, reason) VALUES ($1, $2, $3, $4)',
      [userId, matchId, points, reason]
    );
  }
}

// Procesar el cálculo de puntuaciones para un partido determinado
const processMatchScoring = async (req, res) => {
  try {
    const { matchId, homeScore, awayScore } = req.body;

    if (!matchId || homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({ error: 'Los campos matchId, homeScore y awayScore son obligatorios.' });
    }

    const hScore = parseInt(homeScore);
    const aScore = parseInt(awayScore);

    if (isNaN(hScore) || isNaN(aScore)) {
      return res.status(400).json({ error: 'Los marcadores oficiales deben ser números.' });
    }

    // Obtener todas las predicciones para este partido (incluyendo su fecha de creación y la fecha del partido)
    const predictionsResult = await db.query(
      `SELECT p.id, p.user_id, p.home_predict, p.away_predict, p.created_at as prediction_created, m.match_date 
       FROM predictions p
       INNER JOIN matches m ON p.match_id = m.id
       WHERE p.match_id = $1`,
      [matchId]
    );

    const predictions = predictionsResult.rows;
    console.log(`Scoring Service: Procesando ${predictions.length} predicciones para el partido ${matchId}`);

    // Determinar resultado real
    // 1: Local gana, -1: Visita gana, 0: Empate
    const actualOutcome = hScore > aScore ? 1 : hScore < aScore ? -1 : 0;

    for (const pred of predictions) {
      const userId = pred.user_id;

      // Obtener el historial completo de predicciones del usuario sobre partidos finalizados, ordenados cronológicamente
      // Esto incluye la predicción del partido actual, ya que el estado del partido actual fue actualizado a 'finished' en matches por match-service antes de llamarnos.
      const userPredsResult = await db.query(
        `SELECT p.match_id, p.home_predict, p.away_predict, p.created_at as prediction_created,
                m.match_date, m.home_score, m.away_score
         FROM predictions p
         INNER JOIN matches m ON p.match_id = m.id
         WHERE p.user_id = $1 AND m.status = 'finished'
         ORDER BY m.match_date ASC`,
        [userId]
      );

      let streak = 0;
      for (const userPred of userPredsResult.rows) {
        const uHomePred = userPred.home_predict;
        const uAwayPred = userPred.away_predict;
        const uHomeScore = userPred.home_score;
        const uAwayScore = userPred.away_score;
        const uMatchDate = userPred.match_date;
        const uPredCreated = userPred.prediction_created;

        const uPredOutcome = uHomePred > uAwayPred ? 1 : (uHomePred < uAwayPred ? -1 : 0);
        const uActualOutcome = uHomeScore > uAwayScore ? 1 : (uHomeScore < uAwayScore ? -1 : 0);

        const isWinnerCorrect = uPredOutcome === uActualOutcome;
        if (isWinnerCorrect) {
          streak++;
        } else {
          streak = 0;
        }

        // Calcular puntos base para este partido en el historial
        let points = 0;
        let reasons = [];

        const isExact = uHomePred === uHomeScore && uAwayPred === uAwayScore;
        if (isExact) {
          points = 5;
          reasons.push('Resultado exacto (5 pts)');
        } else if (isWinnerCorrect) {
          points = 3;
          reasons.push(uActualOutcome === 0 ? 'Empate correcto (3 pts)' : 'Ganador correcto (3 pts)');

          // Diferencia de goles correcta (si no es empate y el margen es el mismo)
          if (uActualOutcome !== 0) {
            const predDiff = uHomePred - uAwayPred;
            const actualDiff = uHomeScore - uAwayScore;
            if (predDiff === actualDiff) {
              points += 2;
              reasons.push('Diferencia goles (2 pts)');
            }
          }
        } else {
          points = 0;
          reasons.push('Predicción incorrecta');
        }

        // Calcular bono por anticipación
        const timeDiffMs = new Date(uMatchDate).getTime() - new Date(uPredCreated).getTime();
        const isLastMinute = timeDiffMs < 10 * 60 * 1000;
        const isAnticipated = timeDiffMs > 24 * 60 * 60 * 1000;

        if (isAnticipated && !isLastMinute) {
          points += 1;
          reasons.push('Anticipación (1 pt)');
        }

        // Calcular bono por racha
        if (streak === 3) {
          if (!isLastMinute) {
            points += 2;
            reasons.push('Bonus racha (2 pts)');
          }
          streak = 0; // Se reinicia tras otorgar el bono
        }

        const reasonString = reasons.join(' + ');

        // Guardar/Actualizar la puntuación calculada en la base de datos
        await upsertScore(userId, userPred.match_id, points, reasonString);
      }
    }

    // Invalidar caché del ranking global en Redis
    await redis.del('ranking:all');
    console.log(`Scoring Service: Cálculo finalizado para el partido ${matchId}. Caché de ranking invalidado.`);

    return res.status(200).json({
      message: 'Cálculo de puntuación de predicciones finalizado exitosamente.',
      processedCount: predictions.length
    });
  } catch (error) {
    console.error('Error al procesar puntuación:', error);
    return res.status(500).json({ error: 'Error interno del servidor al procesar puntuación.' });
  }
};

module.exports = {
  processMatchScoring
};
