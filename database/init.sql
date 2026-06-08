-- Script de inicialización de la base de datos de PredictScore (Módulo NOA + SOLIS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Tabla de Puntuaciones (Requerido para cálculo de rankings)
CREATE TABLE IF NOT EXISTS scores (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id UUID,
    points INTEGER NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Semillas de Prueba (Contraseña de todas las semillas: '123456')
-- Hash de bcrypt para '123456': $2b$10$gE36y1m/Xh.66VbWJpQoSez9s3.K.O14vT.4/k1Ff1L2F6.Ff496y
INSERT INTO users (id, name, email, password, role, is_banned) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Lionel Messi', 'messi@test.com', '$2b$10$gE36y1m/Xh.66VbWJpQoSez9s3.K.O14vT.4/k1Ff1L2F6.Ff496y', 'user', false),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Cristiano Ronaldo', 'cr7@test.com', '$2b$10$gE36y1m/Xh.66VbWJpQoSez9s3.K.O14vT.4/k1Ff1L2F6.Ff496y', 'user', false),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Neymar Jr', 'neymar@test.com', '$2b$10$gE36y1m/Xh.66VbWJpQoSez9s3.K.O14vT.4/k1Ff1L2F6.Ff496y', 'user', false)
ON CONFLICT (email) DO NOTHING;

-- Semillas de Puntuaciones
INSERT INTO scores (id, user_id, points, reason) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 15, 'Resultado exacto (5 pts) + Bonus racha (2 pts) + Anticipación (1 pt)'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 10, 'Ganador correcto (3 pts) + Diferencia goles (2 pts)'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 5, 'Ganador correcto (3 pts)')
ON CONFLICT (id) DO NOTHING;
