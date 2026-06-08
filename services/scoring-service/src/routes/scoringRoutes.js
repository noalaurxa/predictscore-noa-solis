const express = require('express');
const router = express.Router();
const scoringController = require('../controllers/scoringController');

// Ruta interna para procesar el cálculo de puntuación
router.post('/process', scoringController.processMatchScoring);

module.exports = router;
