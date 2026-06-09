const db = require('./src/db/db');
const { v4: uuidv4 } = require('uuid');

const userId = '11111111-1111-1111-1111-111111111111';

// SQL script to set up dummy test data
async function test() {
  console.log('--- STARTING SCORING TEST ---');

  try {
    // 1. Clean up old test data if exists
    await db.query('DELETE FROM scores WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM predictions WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.query("DELETE FROM matches WHERE home_team LIKE 'Test%'");

    // 2. Insert test user
    await db.query(
      "INSERT INTO users (id, name, email, password, role) VALUES ($1, 'Test User', 'test@scoring.com', 'dummy', 'user')",
      [userId]
    );

    // 3. Create 4 test matches
    // Match 1: Date tomorrow (so we can control created_at to simulate >24h)
    // Actually, let's set match dates in the past because they need to be finished
    const date1 = new Date('2026-06-01T12:00:00Z');
    const date2 = new Date('2026-06-02T12:00:00Z');
    const date3 = new Date('2026-06-03T12:00:00Z');
    const date4 = new Date('2026-06-04T12:00:00Z');

    const m1 = (await db.query(
      "INSERT INTO matches (home_team, away_team, match_date, home_score, away_score, status) VALUES ('Test A', 'Test B', $1, 2, 1, 'finished') RETURNING id",
      [date1]
    )).rows[0].id;

    const m2 = (await db.query(
      "INSERT INTO matches (home_team, away_team, match_date, home_score, away_score, status) VALUES ('Test C', 'Test D', $1, 2, 0, 'finished') RETURNING id",
      [date2]
    )).rows[0].id;

    const m3 = (await db.query(
      "INSERT INTO matches (home_team, away_team, match_date, home_score, away_score, status) VALUES ('Test E', 'Test F', $1, 1, 0, 'finished') RETURNING id",
      [date3]
    )).rows[0].id;

    const m4 = (await db.query(
      "INSERT INTO matches (home_team, away_team, match_date, home_score, away_score, status) VALUES ('Test G', 'Test H', $1, 2, 1, 'finished') RETURNING id",
      [date4]
    )).rows[0].id;

    // 4. Insert predictions with different created_at to test anticipation
    // Pred 1: Created 2 days before Match 1 (Anticipated >24h)
    const predCreated1 = new Date(date1.getTime() - 48 * 60 * 60 * 1000);
    // Pred 2: Created 12 hours before Match 2 (Normal: not anticipated, not last-minute)
    const predCreated2 = new Date(date2.getTime() - 12 * 60 * 60 * 1000);
    // Pred 3: Created 5 minutes before Match 3 (Last-minute <10m)
    const predCreated3 = new Date(date3.getTime() - 5 * 60 * 1000);
    // Pred 4: Created 2 days before Match 4 (Anticipated >24h)
    const predCreated4 = new Date(date4.getTime() - 48 * 60 * 60 * 1000);

    // Predict 2-1 (Exact match for 2-1)
    await db.query(
      "INSERT INTO predictions (user_id, match_id, home_predict, away_predict, created_at) VALUES ($1, $2, 2, 1, $3)",
      [userId, m1, predCreated1]
    );

    // Predict 3-1 (Winner correct 3-1 vs 2-0, goal difference is also correct: +2 diff)
    await db.query(
      "INSERT INTO predictions (user_id, match_id, home_predict, away_predict, created_at) VALUES ($1, $2, 3, 1, $3)",
      [userId, m2, predCreated2]
    );

    // Predict 1-0 (Exact match for 1-0, but last-minute)
    await db.query(
      "INSERT INTO predictions (user_id, match_id, home_predict, away_predict, created_at) VALUES ($1, $2, 1, 0, $3)",
      [userId, m3, predCreated3]
    );

    // Predict 2-1 (Exact match for 2-1, anticipated)
    await db.query(
      "INSERT INTO predictions (user_id, match_id, home_predict, away_predict, created_at) VALUES ($1, $2, 2, 1, $3)",
      [userId, m4, predCreated4]
    );

    console.log('Test data set up successfully.');

    // 5. Trigger the scoring processing logic by calling the scoring function manually or importing the controller
    // Let's run the exact queries we implemented in the controller
    const scoringController = require('./src/controllers/scoringController');
    
    // We mock req and res to run the function for m4 (which triggers it for all users)
    const req = {
      body: {
        matchId: m4,
        homeScore: 2,
        awayScore: 1
      }
    };
    const res = {
      status: (code) => ({
        json: (data) => {
          console.log(`Response Code: ${code}`, data);
        }
      })
    };

    await scoringController.processMatchScoring(req, res);

    // 6. Verify results in database
    const scoresResult = await db.query(
      `SELECT s.match_id, s.points, s.reason, m.home_team, m.away_team
       FROM scores s
       INNER JOIN matches m ON s.match_id = m.id
       WHERE s.user_id = $1
       ORDER BY m.match_date ASC`,
      [userId]
    );

    console.log('\n--- VERIFICATION RESULTS ---');
    for (const row of scoresResult.rows) {
      console.log(`Match: ${row.home_team} vs ${row.away_team}`);
      console.log(`  Points: ${row.points}`);
      console.log(`  Reason: ${row.reason}`);
    }

    // Clean up
    await db.query('DELETE FROM scores WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM predictions WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    await db.query("DELETE FROM matches WHERE home_team LIKE 'Test%'");
    console.log('Cleanup completed.');

  } catch (err) {
    console.error('Error during test execution:', err);
  } finally {
    await db.pool.end();
  }
}

test();
