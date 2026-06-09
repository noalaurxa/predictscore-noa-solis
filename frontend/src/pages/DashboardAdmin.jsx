import React from 'react';

const DashboardAdmin = ({
  adminHomeTeam,
  setAdminHomeTeam,
  adminAwayTeam,
  setAdminAwayTeam,
  adminMatchDate,
  setAdminMatchDate,
  adminActionLoading,
  handleCreateMatch,
  matches,
  adminSelectedMatch,
  setAdminSelectedMatch,
  adminHomeScore,
  setAdminHomeScore,
  adminAwayScore,
  setAdminAwayScore,
  handleResolveMatch
}) => {
  return (
    <div className="dashboard-grid">
      {/* Create Match */}
      <div className="card">
        <h3 className="table-title">Registrar Nuevo Partido</h3>
        <form onSubmit={handleCreateMatch} style={{ marginTop: '1rem' }} id="admin-create-match-form">
          <div className="form-group">
            <label className="form-label" htmlFor="admin-home-team">Equipo Local (Home Team)</label>
            <input
              type="text"
              id="admin-home-team"
              className="form-input"
              placeholder="Ej. Real Madrid"
              value={adminHomeTeam}
              onChange={(e) => setAdminHomeTeam(e.target.value)}
              disabled={adminActionLoading}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-away-team">Equipo Visitante (Away Team)</label>
            <input
              type="text"
              id="admin-away-team"
              className="form-input"
              placeholder="Ej. Barcelona"
              value={adminAwayTeam}
              onChange={(e) => setAdminAwayTeam(e.target.value)}
              disabled={adminActionLoading}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-match-date">Fecha y Hora de Inicio</label>
            <input
              type="datetime-local"
              id="admin-match-date"
              className="form-input"
              value={adminMatchDate}
              onChange={(e) => setAdminMatchDate(e.target.value)}
              disabled={adminActionLoading}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" id="admin-create-match-submit" disabled={adminActionLoading}>
            {adminActionLoading ? <div className="spinner"></div> : 'Crear Partido'}
          </button>
        </form>
      </div>

      {/* Resolve Match / Input Results */}
      <div className="card">
        <h3 className="table-title">Registrar Marcador Final</h3>
        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Selecciona un partido y reporta el resultado real para ejecutar el cálculo de puntuaciones de los usuarios.
        </p>
        <form onSubmit={handleResolveMatch} id="admin-resolve-match-form">
          <div className="form-group">
            <label className="form-label" htmlFor="admin-select-match">Seleccionar Partido</label>
            <select
              id="admin-select-match"
              className="form-input"
              value={adminSelectedMatch}
              onChange={(e) => setAdminSelectedMatch(e.target.value)}
              disabled={adminActionLoading}
              required
            >
              <option value="">-- Seleccionar Partido Programado --</option>
              {matches
                .filter(m => m.status === 'scheduled')
                .map(m => (
                  <option key={m.id} value={m.id}>
                    {m.home_team} vs {m.away_team} ({new Date(m.match_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })})
                  </option>
                ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="admin-home-score">Goles Local</label>
              <input
                type="number"
                id="admin-home-score"
                min="0"
                className="form-input"
                placeholder="Goles"
                value={adminHomeScore}
                onChange={(e) => setAdminHomeScore(e.target.value)}
                disabled={adminActionLoading || !adminSelectedMatch}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="admin-away-score">Goles Visitante</label>
              <input
                type="number"
                id="admin-away-score"
                min="0"
                className="form-input"
                placeholder="Goles"
                value={adminAwayScore}
                onChange={(e) => setAdminAwayScore(e.target.value)}
                disabled={adminActionLoading || !adminSelectedMatch}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn btn-red" style={{ width: '100%' }} id="admin-resolve-match-submit" disabled={adminActionLoading || !adminSelectedMatch}>
            {adminActionLoading ? <div className="spinner"></div> : 'Guardar Resultado y Procesar Puntos ⚡'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DashboardAdmin;
