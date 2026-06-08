const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Acceso no autorizado. Token faltante.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Acceso no autorizado. Formato del token inválido.' });
  }

  const token = parts[1];
  const jwtSecret = process.env.JWT_SECRET || 'predictscore_secret';

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded; // Adjuntamos los datos decodificados al objeto de request
    next();
  } catch (error) {
    console.error('Error al verificar token JWT:', error.message);
    return res.status(401).json({ error: 'Acceso no autorizado. Token inválido o expirado.' });
  }
};

module.exports = authMiddleware;
