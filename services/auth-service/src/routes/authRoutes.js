const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Rutas públicas
router.post('/register', authController.register);
router.post('/login', authController.login);

// Registro especial de administrador (requiere adminKey)
router.post('/admin/register', authController.adminRegister);

// Rutas protegidas por JWT (cualquier usuario autenticado)
router.get('/profile', authMiddleware, authController.profile);
router.get('/ranking', authMiddleware, authController.getRanking);

// Rutas solo para administradores
router.get('/users', adminMiddleware, authController.getUsers);
router.put('/users/:id/ban', adminMiddleware, authController.banUser);
router.put('/users/:id/unban', adminMiddleware, authController.unbanUser);

module.exports = router;
