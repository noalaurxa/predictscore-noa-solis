const express = require('express');
const cors = require('cors');
require('dotenv').config();

const predictionRoutes = require('./routes/predictionRoutes');

const app = express();
const PORT = process.env.PORT || 3003;

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
    service: 'PredictScore Prediction Service', 
    status: 'Running',
    endpoints: {
      createRoom: 'POST /rooms',
      getRooms: 'GET /rooms',
      joinRoom: 'POST /rooms/join',
      createPrediction: 'POST /predictions',
      getPredictions: 'GET /predictions',
      getRanking: 'GET /ranking'
    }
  });
});

// Configuración de las rutas del servicio (montadas en la raíz para coincidir con la especificación de endpoints)
app.use('/', predictionRoutes);

// Manejo de rutas inexistentes (404)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint no encontrado.' });
});

// Manejo centralizado de errores
app.use((err, req, res, next) => {
  console.error('Error no controlado en Prediction Service:', err.stack);
  res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor de predicciones.' });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor de Predicciones (Prediction Service) corriendo en el puerto ${PORT}`);
});

module.exports = app;
