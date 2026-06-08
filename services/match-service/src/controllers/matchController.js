const db = require('../db/db');
const redis = require('../db/redis');
const axios = require('axios');
require('dotenv').config();

// 1. Obtener todos los partidos (con caché en Redis)
const getMatches = async (req, res) => {
  try {
    const cachedMatches = await redis.get('matches:all');
    if (cachedMatches) {
      return res.status(200).json({
        matches: JSON.parse(cachedMatches),
        source: 'Redis Cache'
      });
    }

    const result = await db.query(
      'SELECT id, home_team, away_team, match_date, home_score, away_score, status, created_at FROM matches ORDER BY match_date ASC'
    );

    await redis.set('matches:all', result.rows, 300); // Cache por 5 minutos

    return res.status(200).json({
      matches: result.rows,
      source: 'PostgreSQL Database'
    });
  } catch (error) {
    console.error('Error al obtener partidos:', error);
    return res.status(500).json({ error: 'Error interno del servidor al obtener partidos.' });
  }
};

// 2. Obtener un partido específico por ID
const getMatchById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar UUID básico
    if (!id || id.length !== 36) {
      return res.status(400).json({ error: 'ID de partido inválido.' });
    }

    const result = await db.query(
      'SELECT id, home_team, away_team, match_date, home_score, away_score, status, created_at FROM matches WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partido no encontrado.' });
    }

    return res.status(200).json({
      match: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener detalle del partido:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// 3. Crear un nuevo partido
const createMatch = async (req, res) => {
  try {
    const { home_team, away_team, match_date } = req.body;

    if (!home_team || !away_team || !match_date) {
      return res.status(400).json({ error: 'Los campos home_team, away_team y match_date son obligatorios.' });
    }

    const dateParsed = new Date(match_date);
    if (isNaN(dateParsed.getTime())) {
      return res.status(400).json({ error: 'Formato de fecha inválido. Utilice un formato compatible con ISO 8601.' });
    }

    const result = await db.query(
      'INSERT INTO matches (home_team, away_team, match_date, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [home_team.trim(), away_team.trim(), dateParsed, 'scheduled']
    );

    const newMatch = result.rows[0];

    // Invalidar caché
    await redis.del('matches:all');

    return res.status(201).json({
      message: 'Partido creado exitosamente.',
      match: newMatch
    });
  } catch (error) {
    console.error('Error al crear partido:', error);
    return res.status(500).json({ error: 'Error interno del servidor al crear partido.' });
  }
};

// 4. Registrar/actualizar resultado de un partido
const updateMatchResult = async (req, res) => {
  try {
    const { match_id, home_score, away_score } = req.body;

    if (match_id === undefined || home_score === undefined || away_score === undefined) {
      return res.status(400).json({ error: 'Los campos match_id, home_score y away_score son obligatorios.' });
    }

    const hScore = parseInt(home_score);
    const aScore = parseInt(away_score);

    if (isNaN(hScore) || hScore < 0 || isNaN(aScore) || aScore < 0) {
      return res.status(400).json({ error: 'Los marcadores deben ser números enteros no negativos.' });
    }

    // Verificar si el partido existe
    const matchCheck = await db.query('SELECT * FROM matches WHERE id = $1', [match_id]);
    if (matchCheck.rows.length === 0) {
      return res.status(404).json({ error: 'El partido no existe.' });
    }

    // Actualizar el resultado en la base de datos
    const updateResult = await db.query(
      'UPDATE matches SET home_score = $1, away_score = $2, status = $3 WHERE id = $4 RETURNING *',
      [hScore, aScore, 'finished', match_id]
    );

    const updatedMatch = updateResult.rows[0];

    // Invalidar caché de partidos
    await redis.del('matches:all');

    // Notificar al Scoring Service para calcular y guardar puntuaciones
    const scoringUrl = process.env.SCORING_SERVICE_URL || 'http://localhost:3004';
    let scoringNotification = 'No procesado (servicio no disponible)';

    try {
      const response = await axios.post(`${scoringUrl}/scoring/process`, {
        matchId: match_id,
        homeScore: hScore,
        awayScore: aScore
      });

      if (response.status === 200) {
        scoringNotification = 'Puntuaciones calculadas y actualizadas exitosamente por el Scoring Service.';
      }
    } catch (apiError) {
      console.error('Error al comunicar con Scoring Service:', apiError.message);
      scoringNotification = `Advertencia: El resultado se guardó pero no se pudo invocar el cálculo de puntajes (${apiError.message})`;
    }

    return res.status(200).json({
      message: 'Resultado del partido actualizado correctamente.',
      match: updatedMatch,
      scoringStatus: scoringNotification
    });
  } catch (error) {
    console.error('Error al actualizar resultado del partido:', error);
    return res.status(500).json({ error: 'Error interno del servidor al actualizar resultado.' });
  }
};

module.exports = {
  getMatches,
  getMatchById,
  createMatch,
  updateMatchResult
};
