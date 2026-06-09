const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Rutas públicas / protegidas para lectura (cualquier usuario autenticado)
router.get('/', matchController.getMatches);
router.get('/:id', matchController.getMatchById);

// Rutas solo para administradores
router.post('/', adminMiddleware, matchController.createMatch);
router.put('/result', adminMiddleware, matchController.updateMatchResult);
router.delete('/:id', adminMiddleware, matchController.deleteMatch);

module.exports = router;
