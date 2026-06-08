const db = require('../db/db');
const redis = require('../db/redis');

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

    // Obtener todas las predicciones para este partido
    const predictionsResult = await db.query(
      'SELECT id, user_id, home_predict, away_predict FROM predictions WHERE match_id = $1',
      [matchId]
    );

    const predictions = predictionsResult.rows;
    console.log(`Scoring Service: Procesando ${predictions.length} predicciones para el partido ${matchId}`);

    // Determinar resultado real
    // 1: Local gana, -1: Visita gana, 0: Empate
    const actualOutcome = hScore > aScore ? 1 : hScore < aScore ? -1 : 0;

    for (const pred of predictions) {
      const predOutcome = pred.home_predict > pred.away_predict ? 1 : pred.home_predict < pred.away_predict ? -1 : 0;
      
      let points = 0;
      let reason = 'Predicción incorrecta';

      if (pred.home_predict === hScore && pred.away_predict === aScore) {
        // Resultado exacto
        points = 5;
        reason = 'Resultado exacto (5 pts)';
      } else if (predOutcome === actualOutcome) {
        // Ganador o empate correcto pero no marcador exacto
        points = 3;
        reason = actualOutcome === 0 ? 'Empate correcto (3 pts)' : 'Ganador correcto (3 pts)';
      }

      // Upsert seguro a nivel de aplicación en la tabla 'scores'
      const existingScoreResult = await db.query(
        'SELECT id FROM scores WHERE user_id = $1 AND match_id = $2',
        [pred.user_id, matchId]
      );

      if (existingScoreResult.rows.length > 0) {
        // Actualizar
        await db.query(
          'UPDATE scores SET points = $1, reason = $2, created_at = NOW() WHERE user_id = $3 AND match_id = $4',
          [points, reason, pred.user_id, matchId]
        );
      } else {
        // Insertar (ID se genera automáticamente con uuid_generate_v4 en PG)
        await db.query(
          'INSERT INTO scores (user_id, match_id, points, reason) VALUES ($1, $2, $3, $4)',
          [pred.user_id, matchId, points, reason]
        );
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
