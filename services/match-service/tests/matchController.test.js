/**
 * Match Service — Pruebas Automatizadas
 * Herramientas: Jest + Supertest
 * Estrategia: Mocks de DB, Redis y axios (Scoring Service).
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

jest.mock('axios');

// ── Imports ───────────────────────────────────────────────────────────────────
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db/db');
const redis = require('../src/db/redis');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'predictscore_secret';

const makeAdminToken = () =>
  jwt.sign({ id: 'admin-1', email: 'admin@test.com', role: 'admin', name: 'Admin' }, JWT_SECRET, { expiresIn: '1h' });

const makeUserToken = () =>
  jwt.sign({ id: 'user-1', email: 'user@test.com', role: 'user', name: 'User' }, JWT_SECRET, { expiresIn: '1h' });

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const sampleMatch = {
  id: VALID_UUID,
  home_team: 'Argentina',
  away_team: 'Brasil',
  match_date: new Date(Date.now() + 86400000).toISOString(), // mañana
  home_score: null,
  away_score: null,
  status: 'scheduled',
  created_at: new Date().toISOString(),
};

// ─────────────────────────────────────────────────────────────────────────────
describe('Match Service — GET /matches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('✅ Retorna partidos desde PostgreSQL (sin caché)', async () => {
    redis.get.mockResolvedValueOnce(null);
    db.query.mockResolvedValueOnce({ rows: [sampleMatch] });

    const res = await request(app)
      .get('/matches')
      .set('Authorization', `Bearer ${makeUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(1);
    expect(res.body.source).toBe('PostgreSQL Database');
  });

  test('✅ Retorna partidos desde caché Redis', async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify([sampleMatch]));

    const res = await request(app)
      .get('/matches')
      .set('Authorization', `Bearer ${makeUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('Redis Cache');
    expect(db.query).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Match Service — GET /matches/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('✅ Retorna partido específico por ID válido', async () => {
    db.query.mockResolvedValueOnce({ rows: [sampleMatch] });

    const res = await request(app)
      .get(`/matches/${VALID_UUID}`)
      .set('Authorization', `Bearer ${makeUserToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.match.id).toBe(VALID_UUID);
  });

  test('❌ 400 — ID con longitud inválida', async () => {
    const res = await request(app)
      .get('/matches/id-corto')
      .set('Authorization', `Bearer ${makeUserToken()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválido/i);
  });

  test('❌ 404 — Partido no encontrado', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`/matches/${VALID_UUID}`)
      .set('Authorization', `Bearer ${makeUserToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no encontrado/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Match Service — POST /matches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('✅ Admin crea un partido válido', async () => {
    db.query.mockResolvedValueOnce({ rows: [sampleMatch] });

    const res = await request(app)
      .post('/matches')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({
        home_team: 'Argentina',
        away_team: 'Brasil',
        match_date: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.match).toBeDefined();
    expect(res.body.message).toMatch(/creado/i);
  });

  test('❌ 400 — Campos faltantes (sin away_team)', async () => {
    const res = await request(app)
      .post('/matches')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ home_team: 'Argentina', match_date: new Date().toISOString() });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obligatorios/i);
  });

  test('❌ 400 — Fecha con formato inválido', async () => {
    const res = await request(app)
      .post('/matches')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ home_team: 'A', away_team: 'B', match_date: 'no-es-fecha' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fecha/i);
  });

  test('❌ 401 — Usuario sin token no puede crear partido', async () => {
    const res = await request(app)
      .post('/matches')
      .send({ home_team: 'A', away_team: 'B', match_date: new Date().toISOString() });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Match Service — PUT /matches/result', () => {
  beforeEach(() => jest.clearAllMocks());

  test('✅ Admin actualiza resultado y notifica al Scoring Service', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [sampleMatch] }) // partido existe
      .mockResolvedValueOnce({ rows: [{ ...sampleMatch, home_score: 2, away_score: 1, status: 'finished' }] }); // update

    axios.post.mockResolvedValueOnce({ status: 200, data: { message: 'OK' } });

    const res = await request(app)
      .put('/matches/result')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ match_id: VALID_UUID, home_score: 2, away_score: 1 });

    expect(res.status).toBe(200);
    expect(res.body.match.status).toBe('finished');
    expect(res.body.scoringStatus).toMatch(/exitosamente/i);
  });

  test('✅ Resultado guardado aunque Scoring Service no responda', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [sampleMatch] })
      .mockResolvedValueOnce({ rows: [{ ...sampleMatch, home_score: 0, away_score: 0, status: 'finished' }] });

    axios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app)
      .put('/matches/result')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ match_id: VALID_UUID, home_score: 0, away_score: 0 });

    expect(res.status).toBe(200); // El resultado se guardó igual
    expect(res.body.scoringStatus).toMatch(/Advertencia/i);
  });

  test('❌ 400 — Campos faltantes (sin home_score)', async () => {
    const res = await request(app)
      .put('/matches/result')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ match_id: VALID_UUID, away_score: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obligatorios/i);
  });

  test('❌ 400 — Marcadores negativos', async () => {
    const res = await request(app)
      .put('/matches/result')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ match_id: VALID_UUID, home_score: -1, away_score: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no negativos/i);
  });

  test('❌ 404 — Partido no existe', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // partido no encontrado

    const res = await request(app)
      .put('/matches/result')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ match_id: VALID_UUID, home_score: 1, away_score: 0 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no existe/i);
  });
});
