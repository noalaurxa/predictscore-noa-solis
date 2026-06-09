const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/predictionController');
const authMiddleware = require('../middleware/authMiddleware');

// Rutas protegidas por JWT
router.post('/rooms', authMiddleware, predictionController.createRoom);
router.get('/rooms', authMiddleware, predictionController.getRooms);
router.post('/rooms/join', authMiddleware, predictionController.joinRoom);

// Gestión completa de sala (detalle, ranking, predicciones, salir, eliminar)
router.get('/rooms/:roomId', authMiddleware, predictionController.getRoomDetail);
router.get('/rooms/:roomId/ranking', authMiddleware, predictionController.getRoomRanking);
router.get('/rooms/:roomId/predictions/:matchId', authMiddleware, predictionController.getRoomMatchPredictions);
router.post('/rooms/:roomId/leave', authMiddleware, predictionController.leaveRoom);
router.delete('/rooms/:roomId', authMiddleware, predictionController.deleteRoom);

router.post('/predictions', authMiddleware, predictionController.createOrUpdatePrediction);
router.get('/predictions', authMiddleware, predictionController.getPredictions);
router.get('/ranking', authMiddleware, predictionController.getRanking);

module.exports = router;
