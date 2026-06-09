const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware que verifica JWT Y que el rol sea 'admin'
const adminMiddleware = (req, res, next) => {
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

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error al verificar token JWT (admin):', error.message);
    return res.status(401).json({ error: 'Acceso no autorizado. Token inválido o expirado.' });
  }
};

module.exports = adminMiddleware;
