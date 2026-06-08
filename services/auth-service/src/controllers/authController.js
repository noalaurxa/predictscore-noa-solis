const db = require('../db/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const redis = require('../db/redis');
require('dotenv').config();

// Expresión regular para validar formato de correo electrónico
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 1. Registro de usuario
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validación de campos requeridos
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos (name, email, password) son obligatorios.' });
    }

    // Validación de formato de email
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'El formato de correo electrónico es inválido.' });
    }

    // Validación de longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    // Verificar si el email ya existe
    const emailCheckResult = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (emailCheckResult.rows.length > 0) {
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado.' });
    }

    // Generar UUID y encriptar contraseña
    const id = uuidv4();
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Si es el primer usuario, se le otorga el rol de admin para poder probar el baneo fácilmente.
    const countResult = await db.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(countResult.rows[0].count);
    const role = userCount === 0 ? 'admin' : 'user';

    // Guardar usuario en base de datos
    const insertResult = await db.query(
      'INSERT INTO users (id, name, email, password, role, is_banned) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, is_banned, created_at',
      [id, name.trim(), email.toLowerCase().trim(), hashedPassword, role, false]
    );

    const newUser = insertResult.rows[0];

    // Invalidar cachés en Redis
    await redis.del('users:all');
    await redis.del('ranking:all');

    return res.status(201).json({
      message: 'Usuario registrado exitosamente.',
      user: newUser
    });
  } catch (error) {
    console.error('Error en controlador de registro:', error);
    return res.status(500).json({ error: 'Error interno del servidor al registrar el usuario.' });
  }
};

// 2. Inicio de Sesión
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validación de campos requeridos
    if (!email || !password) {
      return res.status(400).json({ error: 'El correo electrónico y la contraseña son obligatorios.' });
    }

    // Buscar usuario en DB
    const searchResult = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (searchResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = searchResult.rows[0];

    // Verificar si el usuario está bloqueado
    if (user.is_banned) {
      return res.status(403).json({ error: 'Acceso denegado. Este usuario se encuentra bloqueado de la plataforma.' });
    }

    // Comparar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generar JWT
    const jwtSecret = process.env.JWT_SECRET || 'predictscore_secret';
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name 
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Retornar respuesta exitosa sin la contraseña
    return res.status(200).json({
      message: 'Sesión iniciada exitosamente.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_banned: user.is_banned,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Error en controlador de login:', error);
    return res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
  }
};

// 3. Obtener Perfil del Usuario Autenticado
const profile = async (req, res) => {
  try {
    const userId = req.user.id;

    const queryResult = await db.query(
      'SELECT id, name, email, role, is_banned, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (queryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = queryResult.rows[0];

    // Si fue bloqueado en tiempo de ejecución
    if (user.is_banned) {
      return res.status(403).json({ error: 'Tu usuario ha sido bloqueado.' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error en controlador de perfil:', error);
    return res.status(500).json({ error: 'Error interno del servidor al obtener el perfil.' });
  }
};

// 4. Obtener todos los usuarios (caching implementado)
const getUsers = async (req, res) => {
  try {
    const cachedUsers = await redis.get('users:all');
    if (cachedUsers) {
      return res.status(200).json({ 
        users: JSON.parse(cachedUsers), 
        source: 'Redis Cache' 
      });
    }

    const queryResult = await db.query(
      'SELECT id, name, email, role, is_banned, created_at FROM users ORDER BY created_at DESC'
    );
    
    await redis.set('users:all', queryResult.rows, 300); // 5 minutos de cache

    return res.status(200).json({ 
      users: queryResult.rows, 
      source: 'PostgreSQL Database' 
    });
  } catch (error) {
    console.error('Error en controlador para obtener usuarios:', error);
    return res.status(500).json({ error: 'Error interno del servidor al obtener la lista de usuarios.' });
  }
};

// 5. Banear / Bloquear usuario
const banUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el usuario existe
    const checkUser = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario a bloquear no encontrado.' });
    }

    // Actualizar estado is_banned a true
    await db.query('UPDATE users SET is_banned = TRUE WHERE id = $1', [id]);

    // Invalidar cachés en Redis
    await redis.del('users:all');
    await redis.del('ranking:all');

    return res.status(200).json({
      message: 'Usuario bloqueado exitosamente.',
      userId: id
    });
  } catch (error) {
    console.error('Error en controlador de baneo:', error);
    return res.status(500).json({ error: 'Error interno del servidor al bloquear al usuario.' });
  }
};

// 6. Obtener Ranking Global (Calculado y Cachado en Redis)
const getRanking = async (req, res) => {
  try {
    // Intentar leer caché de Redis
    const cachedRanking = await redis.get('ranking:all');
    if (cachedRanking) {
      return res.status(200).json({
        ranking: JSON.parse(cachedRanking),
        source: 'Redis Cache'
      });
    }

    // Si no está en caché, calcular ranking sumando puntos de la tabla scores
    const queryResult = await db.query(`
      SELECT u.id, u.name, u.email, COALESCE(SUM(s.points), 0)::INTEGER as total_points
      FROM users u
      LEFT JOIN scores s ON u.id = s.user_id
      WHERE u.is_banned = FALSE
      GROUP BY u.id, u.name, u.email
      ORDER BY total_points DESC, u.name ASC
    `);

    const ranking = queryResult.rows;

    // Guardar en caché de Redis por 5 minutos (300 segundos)
    await redis.set('ranking:all', ranking, 300);

    return res.status(200).json({
      ranking,
      source: 'PostgreSQL Database'
    });
  } catch (error) {
    console.error('Error en controlador de ranking:', error);
    return res.status(500).json({ error: 'Error interno del servidor al calcular el ranking.' });
  }
};

module.exports = {
  register,
  login,
  profile,
  getUsers,
  banUser,
  getRanking
};
