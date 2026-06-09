const express = require('express');
const cors = require('cors');
require('dotenv').config();

const scoringRoutes = require('./routes/scoringRoutes');

const app = express();
const PORT = process.env.PORT || 3004;

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
    service: 'PredictScore Scoring Service', 
    status: 'Running',
    endpoints: {
      processScoring: 'POST /scoring/process'
    }
  });
});

// Configuración de las rutas del servicio
app.use('/scoring', scoringRoutes);

// Manejo de rutas inexistentes (404)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint no encontrado.' });
});

// Manejo centralizado de errores
app.use((err, req, res, next) => {
  console.error('Error no controlado en Scoring Service:', err.stack);
  res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor de puntuaciones.' });
});

// Iniciar el servidor solo si se ejecuta directamente (no en tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor de Puntuación (Scoring Service) corriendo en el puerto ${PORT}`);
  });
}

module.exports = app;
