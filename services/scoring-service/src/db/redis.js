const redis = require('redis');
require('dotenv').config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

const client = redis.createClient({
  url: `redis://${redisHost}:${redisPort}`
});

let isReady = false;

client.on('connect', () => {
  console.log('Scoring Service: Intentando conectar a Redis...');
});

client.on('ready', () => {
  console.log('Scoring Service: Cliente Redis listo y conectado.');
  isReady = true;
});

client.on('error', (err) => {
  console.warn('Scoring Service: Alerta de Redis (El servicio podría no estar corriendo):', err.message);
  isReady = false;
});

client.on('end', () => {
  console.log('Scoring Service: Conexión con Redis finalizada.');
  isReady = false;
});

client.connect().catch((err) => {
  console.warn('Scoring Service: No se pudo conectar a Redis. Se usará solo PostgreSQL.', err.message);
});

module.exports = {
  client,
  isReady: () => isReady,
  
  get: async (key) => {
    if (!isReady) return null;
    try {
      return await client.get(key);
    } catch (err) {
      console.error(`Error al obtener llave '${key}' en Redis:`, err);
      return null;
    }
  },

  set: async (key, value, ttlSeconds = 300) => {
    if (!isReady) return false;
    try {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await client.set(key, stringValue, {
        EX: ttlSeconds
      });
      return true;
    } catch (err) {
      console.error(`Error al guardar llave '${key}' en Redis:`, err);
      return false;
    }
  },

  del: async (key) => {
    if (!isReady) return false;
    try {
      await client.del(key);
      return true;
    } catch (err) {
      console.error(`Error al eliminar llave '${key}' en Redis:`, err);
      return false;
    }
  }
};
