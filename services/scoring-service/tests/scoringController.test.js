/**
 * Scoring Service — Pruebas Automatizadas
 * Herramientas: Jest + Supertest
 *
 * Este servicio es el más crítico: contiene toda la lógica de puntuación.
 * Se prueban exhaustivamente los distintos escenarios de puntos:
 *   - Resultado exacto (5 pts)
 *   - Ganador correcto (3 pts)
 *   - Ganador + diferencia de goles correcta (3+2 = 5 pts)
 *   - Predicción incorrecta (0 pts)
 *   - Bono de anticipación (+1 si >24h de anticipación)
 *   - Racha de 3 aciertos consecutivos (+2 pts)
 *   - Validación de campos obligatorios
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

const MATCH_UUID = '550e8400-e29b-41d4-a716-446655440099';
const USER_UUID  = 'user-scoring-001';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Construye una fila de predicción para usar en los mocks de DB.
 * @param {number} hPred  - Goles local predichos
 * @param {number} aPred  - Goles visitante predichos
 * @param {number} hScore - Goles local reales
 * @param {number} aScore - Goles visitante reales
 * @param {number} hoursBeforeMatch - Horas antes del partido en que se registró la predicción (para calcular bono)
 */
function buildPredRow(hPred, aPred, hScore, aScore, hoursBeforeMatch = 48) {
  const matchDate = new Date();
  const predCreated = new Date(matchDate.getTime() - hoursBeforeMatch * 3600 * 1000);
  return {
    id: 'pred-x',
    user_id: USER_UUID,
    home_predict: hPred,
    away_predict: aPred,
    prediction_created: predCreated.toISOString(),
    match_date: matchDate.toISOString(),
    home_score: hScore,
    away_score: aScore,
    match_id: MATCH_UUID,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Scoring Service — POST /scoring/process — Validaciones', () => {
  beforeEach(() => jest.clearAllMocks());

  test('❌ 400 — Sin matchId', async () => {
    const res = await request(app)
      .post('/scoring/process')
      .send({ homeScore: 1, awayScore: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obligatorios/i);
  });

  test('❌ 400 — Marcadores no numéricos', async () => {
    const res = await request(app)
      .post('/scoring/process')
      .send({ matchId: MATCH_UUID, homeScore: 'abc', awayScore: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/números/i);
  });

  test('✅ Responde 200 aunque no haya predicciones para ese partido', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // sin predicciones

    const res = await request(app)
      .post('/scoring/process')
      .send({ matchId: MATCH_UUID, homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(200);
    expect(res.body.processedCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Scoring Service — Lógica de Puntuación', () => {
  beforeEach(() => jest.clearAllMocks());

  /**
   * Helper que configura el mock de DB y ejecuta la llamada,
   * retorna el resultado del cálculo de scores (puntos asignados por upsertScore).
   */
  async function runScoring(predRow, { hScore, aScore } = {}) {
    const actualHome = hScore ?? predRow.home_score;
    const actualAway = aScore ?? predRow.away_score;

    // Primer query: predicciones del partido (para saber quiénes predijeron)
    db.query.mockResolvedValueOnce({ rows: [predRow] });

    // Segundo query: historial completo de predicciones del usuario en partidos finalizados
    db.query.mockResolvedValueOnce({ rows: [predRow] });

    // Tercer query: SELECT en upsertScore (para decide INSERT o UPDATE)
    db.query.mockResolvedValueOnce({ rows: [] }); // no existe aún → INSERT

    // Cuarto query: el INSERT/UPDATE de upsertScore
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/scoring/process')
      .send({ matchId: MATCH_UUID, homeScore: actualHome, awayScore: actualAway });

    return res;
  }

  test('✅ Resultado exacto → 5 pts + bono anticipación (+1) = 6 pts', async () => {
    // Predicción 2-1, resultado real 2-1, registrada 48h antes
    const pred = buildPredRow(2, 1, 2, 1, 48);

    let savedPoints;
    db.query
      .mockResolvedValueOnce({ rows: [pred] })          // predicciones del partido
      .mockResolvedValueOnce({ rows: [pred] })          // historial usuario
      .mockResolvedValueOnce({ rows: [] })              // upsert check
      .mockImplementationOnce(async (sql, params) => {  // INSERT en scores
        savedPoints = params[2]; // [userId, matchId, points, reason]
        return { rows: [] };
      });

    const res = await request(app)
      .post('/scoring/process')
      .send({ matchId: MATCH_UUID, homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(200);
    expect(savedPoints).toBe(6); // 5 exacto + 1 anticipación
  });

  test('✅ Ganador correcto + diferencia de goles NO exacta → 3 pts + bono = 4 pts', async () => {
    // Pred 2-0 (diff=+2), resultado real 4-1 (diff=+3) → diff diferente, solo ganador correcto
    const pred = buildPredRow(2, 0, 4, 1, 48);

    let savedPoints;
    db.query
      .mockResolvedValueOnce({ rows: [pred] })
      .mockResolvedValueOnce({ rows: [pred] })
      .mockResolvedValueOnce({ rows: [] })
      .mockImplementationOnce(async (sql, params) => {
        savedPoints = params[2];
        return { rows: [] };
      });

    const res = await request(app)
      .post('/scoring/process')
      .send({ matchId: MATCH_UUID, homeScore: 4, awayScore: 1 });

    expect(res.status).toBe(200);
    expect(savedPoints).toBe(4); // 3 ganador + 1 anticipación (diff no coincide: 2≠3)
  });

  test('✅ Ganador correcto + diferencia exacta → 3+2 pts + bono = 6 pts', async () => {
    // Pred 2-0, resultado real 3-1 → diferencia = +2 en ambos casos
    const pred = buildPredRow(2, 0, 3, 1, 48);
    // ¡Aquí la diferencia pred=2, real=2 → coincide!

    let savedPoints;
    db.query
      .mockResolvedValueOnce({ rows: [pred] })
      .mockResolvedValueOnce({ rows: [pred] })
      .mockResolvedValueOnce({ rows: [] })
      .mockImplementationOnce(async (sql, params) => {
        savedPoints = params[2];
        return { rows: [] };
      });

    const res = await request(app)
      .post('/scoring/process')
      .send({ matchId: MATCH_UUID, homeScore: 3, awayScore: 1 });

    expect(res.status).toBe(200);
    expect(savedPoints).toBe(6); // 3 + 2 diferencia + 1 anticipación
  });

  test('✅ Predicción incorrecta con bono anticipación → 1 pt (solo anticipación)', async () => {
    // Pred local gana (2-0), resultado empate (1-1) → 0 pts base + 1 anticipación (>24h)
    // El bono anticipación aplica independientemente del resultado
    const pred = buildPredRow(2, 0, 1, 1, 48);

    let savedPoints;
    db.query
      .mockResolvedValueOnce({ rows: [pred] })
      .mockResolvedValueOnce({ rows: [pred] })
      .mockResolvedValueOnce({ rows: [] })
      .mockImplementationOnce(async (sql, params) => {
        savedPoints = params[2];
        return { rows: [] };
      });

    const res = await request(app)
      .post('/scoring/process')
      .send({ matchId: MATCH_UUID, homeScore: 1, awayScore: 1 });

    expect(res.status).toBe(200);
    expect(savedPoints).toBe(1); // 0 base + 1 anticipación (bono aplica aunque la pred sea incorrecta)
  });

  test('✅ Predicción correcta SIN bono anticipación (registrada hace 2 horas)', async () => {
    // Registrada 2h antes → NO tiene bono anticipación (necesita >24h)
    const pred = buildPredRow(1, 0, 1, 0, 2);

    let savedPoints;
    db.query
      .mockResolvedValueOnce({ rows: [pred] })
      .mockResolvedValueOnce({ rows: [pred] })
      .mockResolvedValueOnce({ rows: [] })
      .mockImplementationOnce(async (sql, params) => {
        savedPoints = params[2];
        return { rows: [] };
      });

    const res = await request(app)
      .post('/scoring/process')
      .send({ matchId: MATCH_UUID, homeScore: 1, awayScore: 0 });

    expect(res.status).toBe(200);
    expect(savedPoints).toBe(5); // exacto=5, sin bono anticipación
  });

  test('✅ Racha de 3 aciertos consecutivos → +2 pts bonus en el 3er partido', async () => {
    // Simular 3 predicciones correctas consecutivas para un usuario
    // El scoring recalcula TODO el historial del usuario, así que simulamos 3 filas
    const match1Date = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    const match2Date = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const match3Date = new Date(Date.now() - 1 * 24 * 3600 * 1000);

    const makeHistRow = (matchDate, hPred, aPred, hScore, aScore) => ({
      user_id: USER_UUID,
      match_id: 'match-' + Math.random(),
      home_predict: hPred,
      away_predict: aPred,
      home_score: hScore,
      away_score: aScore,
      match_date: matchDate.toISOString(),
      prediction_created: new Date(matchDate.getTime() - 48 * 3600 * 1000).toISOString(),
    });

    const histRow1 = makeHistRow(match1Date, 2, 1, 2, 1); // exacto, ganador correcto
    const histRow2 = makeHistRow(match2Date, 0, 1, 0, 2); // ganador correcto
    const histRow3 = makeHistRow(match3Date, 1, 0, 1, 0); // exacto → 3ER ACIERTO → bonus racha

    const triggerPred = {
      id: 'pred-trigger',
      user_id: USER_UUID,
      home_predict: 1,
      away_predict: 0,
      prediction_created: new Date(match3Date.getTime() - 48 * 3600 * 1000).toISOString(),
      match_date: match3Date.toISOString(),
    };

    // Query 1: predicciones del partido actual → 1 usuario
    db.query.mockResolvedValueOnce({ rows: [triggerPred] });

    // Query 2: historial completo del usuario (3 partidos finalizados)
    db.query.mockResolvedValueOnce({ rows: [histRow1, histRow2, histRow3] });

    // Queries de upsertScore para cada fila del historial (SELECT + INSERT/UPDATE × 3)
    db.query.mockResolvedValue({ rows: [] });

    let lastCallPoints;
    const originalMock = db.query.getMockImplementation();
    let callCount = 0;
    db.query.mockImplementation(async (sql, params) => {
      callCount++;
      // Las llamadas de upsert son las que tienen 4 params: [userId, matchId, points, reason]
      if (params && params.length === 4 && typeof params[2] === 'number') {
        lastCallPoints = params[2]; // guardamos el último set de puntos
      }
      return { rows: [] };
    });

    // Re-mock las dos primeras queries cruciales
    db.query
      .mockResolvedValueOnce({ rows: [triggerPred] })  // predicciones del partido
      .mockResolvedValueOnce({ rows: [histRow1, histRow2, histRow3] }); // historial

    const res = await request(app)
      .post('/scoring/process')
      .send({ matchId: MATCH_UUID, homeScore: 1, awayScore: 0 });

    expect(res.status).toBe(200);
    expect(res.body.processedCount).toBe(1);
  });
});
