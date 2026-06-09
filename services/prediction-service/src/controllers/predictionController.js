const db = require('../db/db');
const redis = require('../db/redis');
const { v4: uuidv4 } = require('uuid');

// Función auxiliar para generar un código único de 6 caracteres
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 1. Crear una sala de juego
const createRoom = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { name } = req.body;
    const creatorId = req.user.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre de la sala es obligatorio.' });
    }

    await client.query('BEGIN');

    // Generar código único para unirse
    let code = generateRoomCode();
    let codeCheck = await client.query('SELECT id FROM rooms WHERE code = $1', [code]);
    
    // Evitar colisiones de códigos
    while (codeCheck.rows.length > 0) {
      code = generateRoomCode();
      codeCheck = await client.query('SELECT id FROM rooms WHERE code = $1', [code]);
    }

    const roomId = uuidv4();
    // Insertar la sala
    const roomResult = await client.query(
      'INSERT INTO rooms (id, name, code, creator_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [roomId, name.trim(), code, creatorId]
    );

    const newRoom = roomResult.rows[0];

    // Añadir automáticamente al creador como miembro de la sala
    await client.query(
      'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)',
      [roomId, creatorId]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Sala creada exitosamente.',
      room: newRoom
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear sala:', error);
    return res.status(500).json({ error: 'Error interno del servidor al crear la sala.' });
  } finally {
    client.release();
  }
};

// 2. Obtener salas a las que pertenece el usuario autenticado
const getRooms = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT r.id, r.name, r.code, r.creator_id, r.created_at, 
              (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id)::INTEGER as members_count
       FROM rooms r
       INNER JOIN room_members rm ON r.id = rm.room_id
       WHERE rm.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      rooms: result.rows
    });
  } catch (error) {
    console.error('Error al obtener salas:', error);
    return res.status(500).json({ error: 'Error interno del servidor al obtener las salas.' });
  }
};

// 3. Unirse a una sala usando el código
const joinRoom = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code || code.trim() === '') {
      return res.status(400).json({ error: 'El código de la sala es obligatorio.' });
    }

    const formattedCode = code.trim().toUpperCase();

    // Verificar si la sala existe
    const roomResult = await db.query('SELECT * FROM rooms WHERE code = $1', [formattedCode]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada con ese código.' });
    }

    const room = roomResult.rows[0];

    // Verificar si ya es miembro
    const memberCheck = await db.query(
      'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
      [room.id, userId]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Ya eres miembro de esta sala.', room });
    }

    // Insertar miembro
    await db.query(
      'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)',
      [room.id, userId]
    );

    return res.status(200).json({
      message: 'Te has unido a la sala exitosamente.',
      room
    });
  } catch (error) {
    console.error('Error al unirse a la sala:', error);
    return res.status(500).json({ error: 'Error interno del servidor al unirse a la sala.' });
  }
};

// 4. Crear o actualizar una predicción
const createOrUpdatePrediction = async (req, res) => {
  try {
    const { match_id, home_predict, away_predict } = req.body;
    const userId = req.user.id;

    if (match_id === undefined || home_predict === undefined || away_predict === undefined) {
      return res.status(400).json({ error: 'Los campos match_id, home_predict y away_predict son obligatorios.' });
    }

    const hPredict = parseInt(home_predict);
    const aPredict = parseInt(away_predict);

    if (isNaN(hPredict) || hPredict < 0 || isNaN(aPredict) || aPredict < 0) {
      return res.status(400).json({ error: 'Las predicciones de goles deben ser números enteros no negativos.' });
    }

    // Buscar partido y validar su existencia y horario de inicio
    const matchResult = await db.query('SELECT * FROM matches WHERE id = $1', [match_id]);
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'El partido especificado no existe.' });
    }

    const match = matchResult.rows[0];

    // Validar que el partido no haya comenzado
    const matchDate = new Date(match.match_date);
    const currentDate = new Date();

    if (currentDate >= matchDate) {
      return res.status(400).json({ 
        error: 'No se puede registrar o modificar la predicción. El partido ya ha comenzado o finalizado.' 
      });
    }

    // Insertar o actualizar la predicción
    const existing = await db.query(
      'SELECT id FROM predictions WHERE user_id = $1 AND match_id = $2',
      [userId, match_id]
    );

    let prediction;
    if (existing.rows.length > 0) {
      const updateResult = await db.query(
        'UPDATE predictions SET home_predict = $1, away_predict = $2, created_at = NOW() WHERE user_id = $3 AND match_id = $4 RETURNING *',
        [hPredict, aPredict, userId, match_id]
      );
      prediction = updateResult.rows[0];
    } else {
      const predId = uuidv4();
      const insertResult = await db.query(
        'INSERT INTO predictions (id, user_id, match_id, home_predict, away_predict) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [predId, userId, match_id, hPredict, aPredict]
      );
      prediction = insertResult.rows[0];
    }

    return res.status(200).json({
      message: 'Predicción registrada exitosamente.',
      prediction
    });
  } catch (error) {
    console.error('Error al registrar predicción:', error);
    return res.status(500).json({ error: 'Error interno del servidor al registrar predicción.' });
  }
};

// 5. Obtener predicciones del usuario autenticado
const getPredictions = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT p.id, p.match_id, p.home_predict, p.away_predict, p.created_at,
              m.home_team, m.away_team, m.match_date, m.home_score, m.away_score, m.status,
              s.points as earned_points, s.reason as points_reason
       FROM predictions p
       INNER JOIN matches m ON p.match_id = m.id
       LEFT JOIN scores s ON p.match_id = s.match_id AND p.user_id = s.user_id
       WHERE p.user_id = $1
       ORDER BY m.match_date ASC`,
      [userId]
    );

    return res.status(200).json({
      predictions: result.rows
    });
  } catch (error) {
    console.error('Error al obtener predicciones:', error);
    return res.status(500).json({ error: 'Error interno del servidor al obtener predicciones.' });
  }
};

// 6. Obtener Ranking Global (Calculado y Cachado en Redis)
const getRanking = async (req, res) => {
  try {
    const cachedRanking = await redis.get('ranking:all');
    if (cachedRanking) {
      return res.status(200).json({
        ranking: JSON.parse(cachedRanking),
        source: 'Redis Cache'
      });
    }

    const queryResult = await db.query(`
      SELECT u.id, u.name, u.email, COALESCE(SUM(s.points), 0)::INTEGER as total_points
      FROM users u
      LEFT JOIN scores s ON u.id = s.user_id
      WHERE u.is_banned = FALSE AND u.role = 'user'
      GROUP BY u.id, u.name, u.email
      ORDER BY total_points DESC, u.name ASC
    `);

    const ranking = queryResult.rows;

    await redis.set('ranking:all', ranking, 300); // 5 minutos de cache

    return res.status(200).json({
      ranking,
      source: 'PostgreSQL Database'
    });
  } catch (error) {
    console.error('Error al obtener ranking:', error);
    return res.status(500).json({ error: 'Error interno del servidor al obtener ranking.' });
  }
};

module.exports = {
  createRoom,
  getRooms,
  joinRoom,
  createOrUpdatePrediction,
  getPredictions,
  getRanking
};
