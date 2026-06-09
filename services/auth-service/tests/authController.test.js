/**
 * Auth Service — Pruebas Automatizadas
 * Herramientas: Jest + Supertest
 * Estrategia: Mocks de DB (pg) y Redis para no requerir infraestructura real.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../src/db/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/db/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/db');
const redis = require('../src/db/redis');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ── Helpers ───────────────────────────────────────────────────────────────────
const JWT_SECRET = 'predictscore_secret';

const makeToken = (payload = {}) =>
  jwt.sign({ id: 'user-123', email: 'test@test.com', role: 'user', name: 'Test', ...payload }, JWT_SECRET, { expiresIn: '1h' });

const makeAdminToken = () => makeToken({ role: 'admin' });

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth Service — POST /auth/register', () => {
  beforeEach(() => jest.clearAllMocks());

  test('✅ Registro exitoso del primer usuario (rol admin)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })               // email no existe
      .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // primer usuario
      .mockResolvedValueOnce({                            // insert
        rows: [{ id: 'uuid-1', name: 'Noa', email: 'noa@test.com', role: 'admin', is_banned: false, created_at: new Date() }]
      });

    const res = await request(app).post('/auth/register').send({
      name: 'Noa',
      email: 'noa@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/exitosamente/i);
    expect(res.body.user.role).toBe('admin');
  });

  test('✅ Registro exitoso de usuario normal (no es el primero)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'uuid-2', name: 'Solis', email: 'solis@test.com', role: 'user', is_banned: false, created_at: new Date() }]
      });

    const res = await request(app).post('/auth/register').send({
      name: 'Solis',
      email: 'solis@test.com',
      password: 'pass1234',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
  });

  test('❌ 400 — Campos faltantes (sin email)', async () => {
    const res = await request(app).post('/auth/register').send({ name: 'Noa', password: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obligatorios/i);
  });

  test('❌ 400 — Email con formato inválido', async () => {
    const res = await request(app).post('/auth/register').send({ name: 'Noa', email: 'no-es-email', password: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/correo electrónico es inválido/i);
  });

  test('❌ 400 — Contraseña menor a 6 caracteres', async () => {
    const res = await request(app).post('/auth/register').send({ name: 'Noa', email: 'a@b.com', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6 caracteres/i);
  });

  test('❌ 409 — Email ya registrado', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] }); // email duplicado

    const res = await request(app).post('/auth/register').send({
      name: 'Otro',
      email: 'duplicado@test.com',
      password: 'pass1234',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya se encuentra registrado/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth Service — POST /auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('✅ Login exitoso — retorna JWT y datos de usuario', async () => {
    const hashedPass = await bcrypt.hash('correctpass', 10);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'user-1', name: 'Noa', email: 'noa@test.com', password: hashedPass, role: 'user', is_banned: false, created_at: new Date() }]
    });

    const res = await request(app).post('/auth/login').send({ email: 'noa@test.com', password: 'correctpass' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('noa@test.com');
    expect(res.body.user.password).toBeUndefined(); // No debe exponer la contraseña
  });

  test('❌ 400 — Campos faltantes (sin contraseña)', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obligatorios/i);
  });

  test('❌ 401 — Usuario no existe', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/auth/login').send({ email: 'no@existe.com', password: 'pass123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credenciales inválidas/i);
  });

  test('❌ 401 — Contraseña incorrecta', async () => {
    const hashedPass = await bcrypt.hash('correctpass', 10);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'u1', name: 'N', email: 'n@t.com', password: hashedPass, role: 'user', is_banned: false }]
    });

    const res = await request(app).post('/auth/login').send({ email: 'n@t.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credenciales inválidas/i);
  });

  test('❌ 403 — Usuario baneado', async () => {
    const hashedPass = await bcrypt.hash('pass', 10);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'u2', name: 'B', email: 'b@t.com', password: hashedPass, role: 'user', is_banned: true }]
    });

    const res = await request(app).post('/auth/login').send({ email: 'b@t.com', password: 'pass' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/bloqueado/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth Service — GET /auth/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  test('✅ Retorna perfil del usuario autenticado', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'user-123', name: 'Noa', email: 'noa@test.com', role: 'user', is_banned: false, created_at: new Date() }]
    });

    const res = await request(app)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('noa@test.com');
  });

  test('❌ 401 — Sin token', async () => {
    const res = await request(app).get('/auth/profile');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/token faltante/i);
  });

  test('❌ 401 — Token inválido', async () => {
    const res = await request(app)
      .get('/auth/profile')
      .set('Authorization', 'Bearer token-falso-invalido');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido/i);
  });

  test('❌ 403 — Usuario baneado en tiempo de ejecución', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'user-123', name: 'Noa', email: 'noa@test.com', role: 'user', is_banned: true, created_at: new Date() }]
    });

    const res = await request(app)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/bloqueado/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth Service — GET /auth/users', () => {
  beforeEach(() => jest.clearAllMocks());

  test('✅ Retorna lista de usuarios desde DB (sin caché)', async () => {
    redis.get.mockResolvedValueOnce(null); // no cache
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'u1', name: 'Noa', email: 'noa@test.com', role: 'admin', is_banned: false, created_at: new Date() },
        { id: 'u2', name: 'Solis', email: 'solis@test.com', role: 'user', is_banned: false, created_at: new Date() },
      ]
    });

    const res = await request(app)
      .get('/auth/users')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.source).toBe('PostgreSQL Database');
  });

  test('✅ Retorna lista desde caché Redis', async () => {
    const cachedUsers = JSON.stringify([{ id: 'u1', name: 'Noa', email: 'noa@test.com', role: 'admin', is_banned: false }]);
    redis.get.mockResolvedValueOnce(cachedUsers);

    const res = await request(app)
      .get('/auth/users')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('Redis Cache');
    expect(db.query).not.toHaveBeenCalled(); // No debe consultar DB
  });
});
