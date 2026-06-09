const express = require('express');
const cors = require('cors');
require('dotenv').config();

const matchRoutes = require('./routes/matchRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

// Configuración de CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para parsear JSON
app.use(express.json());

// Ruta base informativa
app.get('/', (req, res) => {
  res.status(200).json({ 
    service: 'PredictScore Match Service', 
    status: 'Running',
    endpoints: {
      getMatches: 'GET /matches',
      getMatchById: 'GET /matches/:id',
      createMatch: 'POST /matches',
      updateResult: 'PUT /matches/result'
    }
  });
});

// Configuración de las rutas del servicio
app.use('/matches', matchRoutes);

// Manejo de rutas inexistentes (404)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint no encontrado.' });
});

// Manejo centralizado de errores
app.use((err, req, res, next) => {
  console.error('Error no controlado en Match Service:', err.stack);
  res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor de partidos.' });
});

// Iniciar el servidor solo si se ejecuta directamente (no en tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor de Partidos (Match Service) corriendo en el puerto ${PORT}`);
  });
}

module.exports = app;
