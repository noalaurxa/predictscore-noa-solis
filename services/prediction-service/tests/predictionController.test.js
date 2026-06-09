/**
 * Prediction Service — Pruebas Automatizadas
 * Herramientas: Jest + Supertest
 * Estrategia: Mocks de DB y Redis. El pool de pg se simula para transacciones.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockRelease = jest.fn();
const mockClientQuery = jest.fn();

jest.mock('../src/db/db', () => ({
  query: mockQuery,
  pool: {
    connect: mockConnect,
  },
}));

jest.mock('../src/db/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
}));

// ── Imports ───────────────────────────────────────────────────────────────────
const request = require('supertest');
const app = require('../src/app');
const redis = require('../src/db/redis');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'predictscore_secret';

const makeToken = (overrides = {}) =>
  jwt.sign({ id: 'user-abc', email: 'user@test.com', role: 'user', name: 'User', ...overrides }, JWT_SECRET, { expiresIn: '1h' });

const MATCH_UUID = '550e8400-e29b-41d4-a716-446655440001';
const ROOM_UUID  = '550e8400-e29b-41d4-a716-446655440002';

const futureDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString(); // 48h en el futuro
const pastDate   = new Date(Date.now() - 3600 * 1000).toISOString();      // hace 1h

// ── Setup del mock de transacciones (pool.connect) ────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockClientQuery.mockReset();
  mockRelease.mockReset();

  // Simular client transaccional para createRoom
  mockConnect.mockResolvedValue({
    query: mockClientQuery,
    release: mockRelease,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Prediction Service — POST /rooms', () => {
  test('✅ Crear sala exitosamente', async () => {
    const newRoom = { id: ROOM_UUID, name: 'Mi Sala', code: 'ABC123', creator_id: 'user-abc', created_at: new Date() };

    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })          // BEGIN
      .mockResolvedValueOnce({ rows: [] })          // verificar colisión de código
      .mockResolvedValueOnce({ rows: [newRoom] })   // INSERT sala
      .mockResolvedValueOnce({ rows: [] })          // INSERT miembro
      .mockResolvedValueOnce({ rows: [] });         // COMMIT

    const res = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'Mi Sala' });

    expect(res.status).toBe(201);
    expect(res.body.room.name).toBe('Mi Sala');
    expect(res.body.room.code).toBe('ABC123');
  });

  test('❌ 400 — Nombre de sala vacío', async () => {
    const res = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obligatorio/i);
  });

  test('❌ 401 — Sin token', async () => {
    const res = await request(app).post('/rooms').send({ name: 'Sala' });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Prediction Service — POST /rooms/join', () => {
  test('✅ Unirse a sala con código válido', async () => {
    const room = { id: ROOM_UUID, name: 'Sala', code: 'XYZ999', creator_id: 'otro-user' };

    mockQuery
      .mockResolvedValueOnce({ rows: [room] })  // sala existe
      .mockResolvedValueOnce({ rows: [] })       // no es miembro aún
      .mockResolvedValueOnce({ rows: [] });      // INSERT miembro

    const res = await request(app)
      .post('/rooms/join')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ code: 'XYZ999' });

    expect(res.status).toBe(200);
    expect(res.body.room.code).toBe('XYZ999');
  });

  test('❌ 400 — Código vacío', async () => {
    const res = await request(app)
      .post('/rooms/join')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ code: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obligatorio/i);
  });

  test('❌ 404 — Sala no encontrada', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // sala no existe

    const res = await request(app)
      .post('/rooms/join')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ code: 'NOEXI' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no encontrada/i);
  });

  test('❌ 409 — Ya es miembro de la sala', async () => {
    const room = { id: ROOM_UUID, name: 'Sala', code: 'EXIST1', creator_id: 'otro' };

    mockQuery
      .mockResolvedValueOnce({ rows: [room] })  // sala existe
      .mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // ya es miembro

    const res = await request(app)
      .post('/rooms/join')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ code: 'EXIST1' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya eres miembro/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Prediction Service — POST /predictions', () => {
  test('✅ Crear nueva predicción (partido en el futuro)', async () => {
    const match = { id: MATCH_UUID, match_date: futureDate, status: 'scheduled' };
    const pred  = { id: 'pred-1', user_id: 'user-abc', match_id: MATCH_UUID, home_predict: 2, away_predict: 1, created_at: new Date() };

    mockQuery
      .mockResolvedValueOnce({ rows: [match] }) // partido existe
      .mockResolvedValueOnce({ rows: [] })       // no existe predicción previa
      .mockResolvedValueOnce({ rows: [pred] });  // INSERT

    const res = await request(app)
      .post('/predictions')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ match_id: MATCH_UUID, home_predict: 2, away_predict: 1 });

    expect(res.status).toBe(200);
    expect(res.body.prediction.home_predict).toBe(2);
    expect(res.body.message).toMatch(/exitosamente/i);
  });

  test('✅ Actualizar predicción existente', async () => {
    const match   = { id: MATCH_UUID, match_date: futureDate, status: 'scheduled' };
    const existing = { id: 'pred-1' };
    const updated  = { id: 'pred-1', user_id: 'user-abc', match_id: MATCH_UUID, home_predict: 3, away_predict: 0, created_at: new Date() };

    mockQuery
      .mockResolvedValueOnce({ rows: [match] })    // partido
      .mockResolvedValueOnce({ rows: [existing] }) // pred existente
      .mockResolvedValueOnce({ rows: [updated] }); // UPDATE

    const res = await request(app)
      .post('/predictions')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ match_id: MATCH_UUID, home_predict: 3, away_predict: 0 });

    expect(res.status).toBe(200);
    expect(res.body.prediction.home_predict).toBe(3);
  });

  test('❌ 400 — Campos faltantes (sin away_predict)', async () => {
    const res = await request(app)
      .post('/predictions')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ match_id: MATCH_UUID, home_predict: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obligatorios/i);
  });

  test('❌ 400 — Predicción con valor negativo', async () => {
    const res = await request(app)
      .post('/predictions')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ match_id: MATCH_UUID, home_predict: -1, away_predict: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no negativos/i);
  });

  test('❌ 404 — Partido no existe', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // partido no existe

    const res = await request(app)
      .post('/predictions')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ match_id: MATCH_UUID, home_predict: 1, away_predict: 0 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no existe/i);
  });

  test('❌ 400 — Partido ya comenzó (fecha pasada)', async () => {
    const match = { id: MATCH_UUID, match_date: pastDate, status: 'scheduled' };
    mockQuery.mockResolvedValueOnce({ rows: [match] });

    const res = await request(app)
      .post('/predictions')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ match_id: MATCH_UUID, home_predict: 1, away_predict: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ya ha comenzado/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Prediction Service — GET /predictions', () => {
  test('✅ Retorna predicciones del usuario autenticado', async () => {
    const preds = [
      { id: 'p1', match_id: MATCH_UUID, home_predict: 2, away_predict: 0, home_team: 'Arg', away_team: 'Bra', match_date: futureDate, status: 'scheduled', earned_points: null }
    ];
    mockQuery.mockResolvedValueOnce({ rows: preds });

    const res = await request(app)
      .get('/predictions')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.predictions).toHaveLength(1);
  });

  test('❌ 401 — Sin token no puede ver predicciones', async () => {
    const res = await request(app).get('/predictions');
    expect(res.status).toBe(401);
  });
});
