const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Rutas públicas
router.post('/register', authController.register);
router.post('/login', authController.login);

// Rutas protegidas por JWT
router.get('/profile', authMiddleware, authController.profile);
router.get('/users', authMiddleware, authController.getUsers);

module.exports = router;
