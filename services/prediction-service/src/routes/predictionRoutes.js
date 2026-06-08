const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/predictionController');
const authMiddleware = require('../middleware/authMiddleware');

// Rutas protegidas por JWT
router.post('/rooms', authMiddleware, predictionController.createRoom);
router.get('/rooms', authMiddleware, predictionController.getRooms);
router.post('/rooms/join', authMiddleware, predictionController.joinRoom);

router.post('/predictions', authMiddleware, predictionController.createOrUpdatePrediction);
router.get('/predictions', authMiddleware, predictionController.getPredictions);
router.get('/ranking', authMiddleware, predictionController.getRanking);

module.exports = router;
