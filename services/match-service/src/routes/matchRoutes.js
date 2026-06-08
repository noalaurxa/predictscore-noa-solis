const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const authMiddleware = require('../middleware/authMiddleware');

// Rutas públicas / protegidas para lectura
router.get('/', matchController.getMatches);
router.get('/:id', matchController.getMatchById);

// Rutas protegidas para escritura
router.post('/', authMiddleware, matchController.createMatch);
router.put('/result', authMiddleware, matchController.updateMatchResult);

module.exports = router;
