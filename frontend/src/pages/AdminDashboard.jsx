import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, matchApi } from '../services/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState(null);
  const [activeTab, setActiveTab] = useState('matches');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Matches state
  const [matches, setMatches] = useState([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [newMatch, setNewMatch] = useState({ home_team: '', away_team: '', match_date: '' });

  // Result state
  const [selectedMatch, setSelectedMatch] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [resultLoading, setResultLoading] = useState(false);

  // Users state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [banLoading, setBanLoading] = useState({});

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Verify admin on mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    setAdminUser(user);
    setLoading(false);
  }, [navigate]);

  // Load data when tab changes
  useEffect(() => {
    setError('');
    setSuccess('');
    if (activeTab === 'matches' || activeTab === 'results') {
      fetchMatches();
    } else if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchMatches = async () => {
    try {
      setMatchLoading(true);
      const res = await matchApi.get('/matches');
      setMatches(res.data.matches || []);
    } catch (err) {
      setError('Error al cargar partidos.');
    } finally {
      setMatchLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await authApi.get('/auth/users');
      setUsers(res.data.users || []);
    } catch (err) {
      setError('Error al cargar usuarios.');
    } finally {
      setUsersLoading(false);
    }
  };

  // === MATCH CRUD ===
  const handleCreateMatch = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!newMatch.home_team || !newMatch.away_team || !newMatch.match_date) {
      setError('Todos los campos del partido son obligatorios.');
      return;
    }
    try {
      setMatchLoading(true);
      await matchApi.post('/matches', newMatch);
      setSuccess(`✅ Partido "${newMatch.home_team} vs ${newMatch.away_team}" creado exitosamente.`);
      setNewMatch({ home_team: '', away_team: '', match_date: '' });
      fetchMatches();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear partido.');
    } finally {
      setMatchLoading(false);
    }
  };

  const handleDeleteMatch = async (matchId, matchName) => {
    if (!window.confirm(`¿Eliminar el partido "${matchName}"? Esta acción no se puede deshacer.`)) return;
    setError(''); setSuccess('');
    try {
      await matchApi.delete(`/matches/${matchId}`);
      setSuccess(`✅ Partido eliminado correctamente.`);
      fetchMatches();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar partido.');
    }
  };

  const handleSetResult = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!selectedMatch || homeScore === '' || awayScore === '') {
      setError('Selecciona un partido e ingresa el marcador.');
      return;
    }
    try {
      setResultLoading(true);
      const res = await matchApi.put('/matches/result', {
        match_id: selectedMatch,
        home_score: parseInt(homeScore),
        away_score: parseInt(awayScore)
      });
      setSuccess(`✅ Resultado registrado. ${res.data.scoringStatus}`);
      setSelectedMatch(''); setHomeScore(''); setAwayScore('');
      fetchMatches();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar resultado.');
    } finally {
      setResultLoading(false);
    }
  };

  // === USER MANAGEMENT ===
  const handleBan = async (userId, userName, isBanned) => {
    const action = isBanned ? 'desbloquear' : 'bloquear';
    if (!window.confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} al usuario "${userName}"?`)) return;
    setError(''); setSuccess('');
    try {
      setBanLoading(prev => ({ ...prev, [userId]: true }));
      if (isBanned) {
        await authApi.put(`/auth/users/${userId}/unban`);
        setSuccess(`✅ Usuario "${userName}" desbloqueado exitosamente.`);
      } else {
        await authApi.put(`/auth/users/${userId}/ban`);
        setSuccess(`✅ Usuario "${userName}" bloqueado exitosamente.`);
      }
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || `Error al ${action} usuario.`);
    } finally {
      setBanLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  const scheduledMatches = matches.filter(m => m.status === 'scheduled');
  const finishedMatches = matches.filter(m => m.status === 'finished');

  return (
    <div className="app-container">
      {/* Admin Navbar */}
      <nav className="navbar" id="admin-navbar" style={{ borderBottom: '1px solid rgba(251,191,36,0.2)', background: 'rgba(10,14,23,0.95)' }}>
        <div className="nav-brand">
          <span style={{ fontSize: '1.2rem' }}>⚙️</span>
          <span style={{ color: 'var(--accent-gold)' }}>Admin</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 400 }}> · PredictScore</span>
        </div>
        <div className="nav-menu">
          <div className="nav-user-badge" style={{ borderColor: 'rgba(251,191,36,0.3)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-gold)', boxShadow: '0 0 8px var(--accent-gold)', display: 'inline-block' }}></span>
            <span style={{ color: 'var(--accent-gold)' }}>👑 {adminUser?.name}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.875rem' }} id="admin-logout-btn">
            Cerrar Sesión
          </button>
        </div>
      </nav>

      <main className="dashboard-container" style={{ padding: '2rem', maxWidth: '1300px', margin: '0 auto', width: '100%' }}>

        {/* Title */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-gold)', letterSpacing: '-0.03em' }}>
            Panel de Administración
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Gestiona partidos, resultados y usuarios de la plataforma.
          </p>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { icon: '⚽', label: 'Partidos Total', value: matches.length, color: 'var(--accent-mint)' },
            { icon: '🟢', label: 'Programados', value: scheduledMatches.length, color: 'var(--accent-green)' },
            { icon: '🏁', label: 'Finalizados', value: finishedMatches.length, color: 'var(--text-secondary)' },
            { icon: '👥', label: 'Usuarios', value: users.length, color: 'var(--accent-gold)' },
            { icon: '🚫', label: 'Baneados', value: users.filter(u => u.is_banned).length, color: 'var(--accent-red)' },
          ].map((stat, i) => (
            <div key={i} className="card" style={{ padding: '1.25rem', textAlign: 'center', animation: `fadeIn ${0.3 + i * 0.1}s ease-out` }}>
              <div style={{ fontSize: '1.5rem' }}>{stat.icon}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: stat.color, marginTop: '0.25rem' }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          {[
            { key: 'matches', icon: '⚽', label: 'Partidos' },
            { key: 'results', icon: '🏁', label: 'Registrar Resultados' },
            { key: 'users', icon: '👥', label: 'Gestión de Usuarios' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center',
                ...(activeTab === tab.key ? { background: 'linear-gradient(135deg,rgba(251,191,36,0.8),rgba(251,191,36,0.5))', color: '#1a0f00' } : {}) }}
              id={`admin-tab-${tab.key}`}
            >
              <span>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error" id="admin-error-box" style={{ marginBottom: '1.5rem' }}>
            <span>⚠️</span><span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success" id="admin-success-box" style={{ marginBottom: '1.5rem' }}>
            <span>✅</span><span>{success}</span>
          </div>
        )}

        {/* ========== TAB: PARTIDOS ========== */}
        {activeTab === 'matches' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* Form crear partido */}
            <div className="card" style={{ animation: 'fadeIn 0.4s ease-out' }}>
              <h3 className="table-title">Nuevo Partido</h3>
              <form onSubmit={handleCreateMatch} id="admin-create-match-form" style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="match-home">Equipo Local</label>
                  <input type="text" id="match-home" className="form-input" placeholder="Ej. Argentina"
                    value={newMatch.home_team}
                    onChange={e => setNewMatch(p => ({ ...p, home_team: e.target.value }))}
                    disabled={matchLoading} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="match-away">Equipo Visitante</label>
                  <input type="text" id="match-away" className="form-input" placeholder="Ej. Brasil"
                    value={newMatch.away_team}
                    onChange={e => setNewMatch(p => ({ ...p, away_team: e.target.value }))}
                    disabled={matchLoading} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="match-date">Fecha y Hora</label>
                  <input type="datetime-local" id="match-date" className="form-input"
                    value={newMatch.match_date}
                    onChange={e => setNewMatch(p => ({ ...p, match_date: e.target.value }))}
                    disabled={matchLoading} required />
                </div>
                <button type="submit" className="btn btn-primary" id="admin-create-match-submit" disabled={matchLoading}
                  style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.9),rgba(251,191,36,0.6))', color: '#1a0f00' }}>
                  {matchLoading ? <div className="spinner"></div> : '⚽ Crear Partido'}
                </button>
              </form>
            </div>

            {/* Lista de partidos */}
            <div className="card" style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <h3 className="table-title">Todos los Partidos</h3>
              {matchLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner"></div></div>
              ) : matches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📭</span>
                  No hay partidos registrados.
                </div>
              ) : (
                <div className="users-table-container" style={{ marginTop: '1rem' }}>
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Partido</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Resultado</th>
                        <th style={{ textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map(match => (
                        <tr key={match.id}>
                          <td>
                            <span style={{ fontWeight: 'bold' }}>{match.home_team}</span>
                            <span style={{ color: 'var(--text-secondary)', margin: '0 0.4rem' }}>vs</span>
                            <span style={{ fontWeight: 'bold' }}>{match.away_team}</span>
                          </td>
                          <td className="text-muted">{new Date(match.match_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td>
                            <span className={`status-badge ${match.status === 'finished' ? 'status-banned' : 'status-active'}`}>
                              {match.status === 'finished' ? '🏁 Finalizado' : '🟢 Programado'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 'bold' }}>
                            {match.status === 'finished' ? `${match.home_score} - ${match.away_score}` : '–'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {match.status !== 'finished' && (
                              <button
                                className="btn btn-red"
                                onClick={() => handleDeleteMatch(match.id, `${match.home_team} vs ${match.away_team}`)}
                              >
                                🗑 Eliminar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== TAB: RESULTADOS ========== */}
        {activeTab === 'results' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* Form registrar resultado */}
            <div className="card" style={{ animation: 'fadeIn 0.4s ease-out' }}>
              <h3 className="table-title">Registrar Marcador Final</h3>
              <p className="text-muted" style={{ marginBottom: '1.25rem' }}>
                Al guardar el resultado, se calcularán automáticamente los puntos de todos los jugadores que hicieron predicciones.
              </p>
              <form onSubmit={handleSetResult} id="admin-set-result-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="result-select-match">Seleccionar Partido</label>
                  <select id="result-select-match" className="form-input"
                    value={selectedMatch} onChange={e => setSelectedMatch(e.target.value)}
                    disabled={resultLoading} required>
                    <option value="">-- Seleccionar partido programado --</option>
                    {scheduledMatches.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.home_team} vs {m.away_team} · {new Date(m.match_date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedMatch && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Goles Local</label>
                      <input type="number" min="0" className="form-input" placeholder="0"
                        style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}
                        value={homeScore} onChange={e => setHomeScore(e.target.value)} required />
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '1.5rem', fontWeight: 'bold', paddingTop: '1.5rem' }}>–</div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Goles Visitante</label>
                      <input type="number" min="0" className="form-input" placeholder="0"
                        style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}
                        value={awayScore} onChange={e => setAwayScore(e.target.value)} required />
                    </div>
                  </div>
                )}
                <button type="submit" className="btn btn-primary" id="admin-set-result-submit"
                  disabled={resultLoading || !selectedMatch}
                  style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.9),rgba(251,191,36,0.6))', color: '#1a0f00' }}>
                  {resultLoading ? <div className="spinner"></div> : '⚡ Guardar Resultado y Calcular Puntos'}
                </button>
              </form>
            </div>

            {/* Partidos finalizados */}
            <div className="card" style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <h3 className="table-title">Partidos Finalizados</h3>
              {finishedMatches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No hay partidos finalizados aún.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  {finishedMatches.map(match => (
                    <div key={match.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 'bold' }}>{match.home_team}</span>
                        <span style={{ color: 'var(--accent-gold)', margin: '0 0.75rem', fontWeight: 800, fontSize: '1.1rem' }}>
                          {match.home_score} – {match.away_score}
                        </span>
                        <span style={{ fontWeight: 'bold' }}>{match.away_team}</span>
                      </div>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {new Date(match.match_date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== TAB: USUARIOS ========== */}
        {activeTab === 'users' && (
          <div className="card" style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="table-title" style={{ margin: 0 }}>Gestión de Usuarios</h3>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{users.length}</strong></span>
                <span>Baneados: <strong style={{ color: 'var(--accent-red)' }}>{users.filter(u => u.is_banned).length}</strong></span>
              </div>
            </div>
            {usersLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner"></div></div>
            ) : users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No hay usuarios registrados.</div>
            ) : (
              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Correo</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Registrado</th>
                      <th style={{ textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} style={user.is_banned ? { opacity: 0.6 } : {}}>
                        <td style={{ fontWeight: 500 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: user.role === 'admin'
                                ? 'linear-gradient(135deg,rgba(251,191,36,0.8),rgba(251,191,36,0.4))'
                                : 'linear-gradient(135deg,var(--accent-green),var(--accent-mint))',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.85rem', fontWeight: 'bold', color: user.role === 'admin' ? '#1a0f00' : '#042f1a',
                              flexShrink: 0
                            }}>
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            {user.name}
                          </div>
                        </td>
                        <td className="text-muted">{user.email}</td>
                        <td>
                          <span className="status-badge" style={user.role === 'admin'
                            ? { background: 'rgba(251,191,36,0.15)', color: 'var(--accent-gold)', border: '1px solid rgba(251,191,36,0.3)' }
                            : { background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                            {user.role === 'admin' ? '👑 Admin' : '👤 Usuario'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${user.is_banned ? 'status-banned' : 'status-active'}`}>
                            {user.is_banned ? '🚫 Baneado' : '✅ Activo'}
                          </span>
                        </td>
                        <td className="text-muted">{new Date(user.created_at).toLocaleDateString()}</td>
                        <td style={{ textAlign: 'right' }}>
                          {user.role !== 'admin' && (
                            <button
                              className={`btn ${user.is_banned ? 'btn-secondary' : 'btn-red'}`}
                              style={user.is_banned
                                ? { width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.825rem', borderRadius: '6px', color: 'var(--accent-mint)', borderColor: 'rgba(16,185,129,0.3)' }
                                : {}}
                              onClick={() => handleBan(user.id, user.name, user.is_banned)}
                              disabled={banLoading[user.id]}
                              id={`btn-ban-${user.id}`}
                            >
                              {banLoading[user.id]
                                ? <div className="spinner" style={{ width: 16, height: 16 }}></div>
                                : user.is_banned ? '🔓 Desbanear' : '🚫 Banear'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
