const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de CORS
app.use(cors({
  origin: '*', // Permitir todas las conexiones para simplificar las pruebas del proyecto
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para parsear JSON
app.use(express.json());

// Ruta base informativa
app.get('/', (req, res) => {
  res.status(200).json({ 
    service: 'PredictScore Auth Service', 
    status: 'Running',
    endpoints: {
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      profile: 'GET /auth/profile',
      users: 'GET /auth/users',
      ban: 'PUT /auth/ban/:id'
    }
  });
});

// Configuración de las rutas del servicio
app.use('/auth', authRoutes);

// Manejo de rutas inexistentes (404)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint no encontrado.' });
});

// Manejo centralizado de errores
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.stack);
  res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor.' });
});

// Iniciar el servidor solo si se ejecuta directamente (no en tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor de Autenticación corriendo en el puerto ${PORT}`);
  });
}

module.exports = app;
