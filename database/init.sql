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

-- 2. Tabla de Partidos
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    match_date TIMESTAMP NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'finished'
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Tabla de Salas (Rooms)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Tabla de Miembros de Sala (Room Members)
CREATE TABLE IF NOT EXISTS room_members (
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

-- 5. Tabla de Predicciones
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    home_predict INTEGER NOT NULL,
    away_predict INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, match_id)
);

-- 6. Tabla de Puntuaciones (Requerido para cálculo de rankings)
CREATE TABLE IF NOT EXISTS scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Semillas de Prueba (Contraseña de todas las semillas: '123456')
-- Hash de bcrypt para '123456': $2b$10$7YDAKL5g3no09ragmwBq3.GyQZfs1ri5SmauwvJ/9zDcRLS22XMl.
INSERT INTO users (id, name, email, password, role, is_banned) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Lionel Messi', 'messi@test.com', '$2b$10$7YDAKL5g3no09ragmwBq3.GyQZfs1ri5SmauwvJ/9zDcRLS22XMl.', 'user', false),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Cristiano Ronaldo', 'cr7@test.com', '$2b$10$7YDAKL5g3no09ragmwBq3.GyQZfs1ri5SmauwvJ/9zDcRLS22XMl.', 'user', false),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Neymar Jr', 'neymar@test.com', '$2b$10$7YDAKL5g3no09ragmwBq3.GyQZfs1ri5SmauwvJ/9zDcRLS22XMl.', 'user', false)
ON CONFLICT (email) DO NOTHING;

-- Semillas de Puntuaciones
INSERT INTO scores (id, user_id, points, reason) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 15, 'Resultado exacto (5 pts) + Bonus racha (2 pts) + Anticipación (1 pt)'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 10, 'Ganador correcto (3 pts) + Diferencia goles (2 pts)'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 5, 'Ganador correcto (3 pts)')
ON CONFLICT (id) DO NOTHING;
