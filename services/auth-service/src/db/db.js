const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'predictscore',
});

// Registrar eventos de conexión para monitoreo y debugging
pool.on('connect', () => {
  console.log('Base de datos conectada exitosamente a través del Pool');
});

pool.on('error', (err) => {
  console.error('Error inesperado en el cliente inactivo de la base de datos', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
