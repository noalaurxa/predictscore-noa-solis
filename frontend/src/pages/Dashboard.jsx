import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { authApi, matchApi, predictionApi } from '../services/api';
import DashboardAdmin from './DashboardAdmin';
const Dashboard = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Navigation
  const [activeTab, setActiveTab] = useState('profile');

  // Game Rooms State
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [roomActionLoading, setRoomActionLoading] = useState(false);

  // Matches & Predictions State
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [predictionInputs, setPredictionInputs] = useState({});
  const [predictionLoading, setPredictionLoading] = useState({});

  // Leaderboard State
  const [rankings, setRankings] = useState([]);
  const [rankingSource, setRankingSource] = useState('');

  // Admin Mock State
  const [adminHomeTeam, setAdminHomeTeam] = useState('');
  const [adminAwayTeam, setAdminAwayTeam] = useState('');
  const [adminMatchDate, setAdminMatchDate] = useState('');
  const [adminSelectedMatch, setAdminSelectedMatch] = useState('');
  const [adminHomeScore, setAdminHomeScore] = useState('');
  const [adminAwayScore, setAdminAwayScore] = useState('');
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  const navigate = useNavigate();

  // Load profile on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  // Fetch tab-specific data
  useEffect(() => {
    setError('');
    setSuccess('');
    if (activeTab === 'rooms') {
      fetchRooms();
    } else if (activeTab === 'matches') {
      fetchMatchesAndPredictions();
    } else if (activeTab === 'rankings') {
      fetchRankings();
    } else if (activeTab === 'admin') {
      fetchMatchesAndPredictions(); // For selection list
    }
  }, [activeTab]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await authApi.get('/auth/profile');
      setProfile(response.data.user);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 401) {
        handleLogout();
      } else {
        setError('No se pudo establecer comunicación con el servidor de autenticación.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      setRoomActionLoading(true);
      const response = await predictionApi.get('/rooms');
      setRooms(response.data.rooms || []);
    } catch (err) {
      console.error(err);
      setError('Error al cargar las salas de juego.');
    } finally {
      setRoomActionLoading(false);
    }
  };

  const fetchMatchesAndPredictions = async () => {
    try {
      setLoading(true);
      const matchesRes = await matchApi.get('/matches');
      const predictionsRes = await predictionApi.get('/predictions');

      const loadedMatches = matchesRes.data.matches || [];
      const loadedPredictions = predictionsRes.data.predictions || [];

      setMatches(loadedMatches);
      setPredictions(loadedPredictions);

      // Pre-fill prediction inputs
      const inputs = {};
      loadedPredictions.forEach(pred => {
        inputs[pred.match_id] = {
          home_predict: pred.home_predict,
          away_predict: pred.away_predict
        };
      });
      setPredictionInputs(inputs);
    } catch (err) {
      console.error(err);
      setError('Error al obtener datos de partidos y predicciones.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRankings = async () => {
    try {
      setLoading(true);
      const response = await predictionApi.get('/ranking');
      setRankings(response.data.ranking || []);
      setRankingSource(response.data.source || 'Database');
    } catch (err) {
      console.error(err);
      setError('Error al cargar la tabla de posiciones global.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Create Room
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!newRoomName.trim()) return;

    try {
      setRoomActionLoading(true);
      const response = await predictionApi.post('/rooms', { name: newRoomName });
      setSuccess(`Sala "${response.data.room.name}" creada con éxito. Código: ${response.data.room.code}`);
      setNewRoomName('');
      fetchRooms();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al intentar crear la sala.');
    } finally {
      setRoomActionLoading(false);
    }
  };

  // Join Room
  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!joinRoomCode.trim()) return;

    try {
      setRoomActionLoading(true);
      const response = await predictionApi.post('/rooms/join', { code: joinRoomCode });
      setSuccess(`Te has unido a la sala "${response.data.room.name}" con éxito.`);
      setJoinRoomCode('');
      fetchRooms();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al intentar unirse a la sala.');
    } finally {
      setRoomActionLoading(false);
    }
  };

  // Submit Prediction
  const handleSavePrediction = async (matchId) => {
    setError('');
    setSuccess('');
    const input = predictionInputs[matchId];
    if (!input || input.home_predict === undefined || input.away_predict === undefined) {
      setError('Por favor, ingresa los goles para ambos equipos.');
      return;
    }

    try {
      setPredictionLoading(prev => ({ ...prev, [matchId]: true }));
      const response = await predictionApi.post('/predictions', {
        match_id: matchId,
        home_predict: input.home_predict,
        away_predict: input.away_predict
      });
      setSuccess(response.data.message || 'Predicción guardada exitosamente.');
      fetchMatchesAndPredictions();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al guardar la predicción.');
    } finally {
      setPredictionLoading(prev => ({ ...prev, [matchId]: false }));
    }
  };

  const handlePredictionInputChange = (matchId, field, value) => {
    setPredictionInputs(prev => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || { home_predict: 0, away_predict: 0 }),
        [field]: value === '' ? '' : parseInt(value)
      }
    }));
  };

  // Admin: Create Match
  const handleCreateMatch = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!adminHomeTeam || !adminAwayTeam || !adminMatchDate) {
      setError('Todos los campos son obligatorios para crear un partido.');
      return;
    }

    try {
      setAdminActionLoading(true);
      await matchApi.post('/matches', {
        home_team: adminHomeTeam,
        away_team: adminAwayTeam,
        match_date: adminMatchDate
      });
      setSuccess(`Partido creado con éxito: ${adminHomeTeam} vs ${adminAwayTeam}`);
      setAdminHomeTeam('');
      setAdminAwayTeam('');
      setAdminMatchDate('');
      fetchMatchesAndPredictions();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al crear el partido.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Admin: Submit Result
  const handleResolveMatch = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!adminSelectedMatch || adminHomeScore === '' || adminAwayScore === '') {
      setError('Selecciona un partido y especifica el marcador final.');
      return;
    }

    try {
      setAdminActionLoading(true);
      const response = await matchApi.put('/matches/result', {
        match_id: adminSelectedMatch,
        home_score: adminHomeScore,
        away_score: adminAwayScore
      });
      setSuccess(`Marcador registrado con éxito. Detalle del Scoring: ${response.data.scoringStatus}`);
      setAdminSelectedMatch('');
      setAdminHomeScore('');
      setAdminAwayScore('');
      fetchMatchesAndPredictions();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al registrar el resultado del partido.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Helper Stats Calculation
  const totalPoints = predictions.reduce((sum, p) => sum + (p.earned_points || 0), 0);
  const correctPredictionsCount = predictions.filter(p => p.status === 'finished' && p.earned_points > 0).length;

  return (
    <div className="app-container">
      {/* Navbar principal */}
      <nav className="navbar" id="dashboard-navbar">
        <div className="nav-brand">
          ⚽ <span className="brand-accent">PredictScore</span>
        </div>
        <div className="nav-menu">
          {profile && (
            <div className="nav-user-badge">
              <span className="badge-dot"></span>
              <span>{profile.name}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            id="logout-btn"
          >
            Cerrar Sesión
          </button>
        </div>
      </nav>

      {/* Main dashboard content */}
      <main className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}>

        {/* Navigation Tabs */}
        <div className="tabs-navigation" style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('profile')}
            className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            id="tab-profile"
          >
            <span>👤</span> Mi Perfil
          </button>
          <button
            onClick={() => setActiveTab('rooms')}
            className={`btn ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            id="tab-rooms"
          >
            <span>🏠</span> Salas de Juego
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`btn ${activeTab === 'matches' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            id="tab-matches"
          >
            <span>⚽</span> Partidos y Predicciones
          </button>
          <button
            onClick={() => setActiveTab('rankings')}
            className={`btn ${activeTab === 'rankings' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            id="tab-rankings"
          >
            <span>🏆</span> Ranking Global
          </button>
          {profile?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`btn ${activeTab === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
              id="tab-admin"
            >
              <span>⚙️</span> Control de Admin
            </button>
          )}
        </div>

        {/* Success / Error Alerts */}
        {error && (
          <div className="alert alert-error" id="dashboard-error-box">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success" id="dashboard-success-box">
            <span>✅</span>
            <span>{success}</span>
          </div>
        )}

        {/* Tab contents */}
        {loading && activeTab !== 'rooms' ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : (
          <div>
            {/* 1. PROFILE TAB */}
            {activeTab === 'profile' && profile && (
              <div className="dashboard-grid">
                {/* Profile detail card */}
                <div className="card profile-card" style={{ animation: 'fadeIn 0.5s ease-out' }}>
                  <div className="profile-avatar">
                    {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <h3 className="profile-name">{profile.name}</h3>
                  <p className="profile-email">{profile.email}</p>
                  <span className="profile-role-badge">{profile.role}</span>
                  <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
                    ID: {profile.id}
                  </div>
                </div>

                {/* Statistics card */}
                <div className="card" style={{ animation: 'fadeIn 0.6s ease-out' }}>
                  <h3 className="table-title" style={{ marginBottom: '1.5rem' }}>Estadísticas de Juego</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <span style={{ fontSize: '2rem' }}>🏆</span>
                      <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Puntos Totales</h4>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-mint)', marginTop: '0.25rem' }}>{totalPoints} pts</p>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <span style={{ fontSize: '2rem' }}>🔮</span>
                      <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Predicciones</h4>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.25rem' }}>{predictions.length}</p>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <span style={{ fontSize: '2rem' }}>🎯</span>
                      <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Aciertos</h4>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-green)', marginTop: '0.25rem' }}>{correctPredictionsCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. GAME ROOMS TAB */}
            {activeTab === 'rooms' && (
              <div className="dashboard-grid">
                {/* Forms sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Create room card */}
                  <div className="card">
                    <h3 className="table-title">Crear Nueva Sala</h3>
                    <form onSubmit={handleCreateRoom} style={{ marginTop: '1rem' }} id="create-room-form">
                      <div className="form-group">
                        <label className="form-label" htmlFor="room-name">Nombre de la Sala</label>
                        <input
                          type="text"
                          id="room-name"
                          className="form-input"
                          placeholder="Ej. Torneo de Oficina"
                          value={newRoomName}
                          onChange={(e) => setNewRoomName(e.target.value)}
                          disabled={roomActionLoading}
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-primary" id="create-room-submit" disabled={roomActionLoading}>
                        {roomActionLoading ? <div className="spinner"></div> : 'Crear Sala'}
                      </button>
                    </form>
                  </div>

                  {/* Join room card */}
                  <div className="card">
                    <h3 className="table-title">Unirse a una Sala</h3>
                    <form onSubmit={handleJoinRoom} style={{ marginTop: '1rem' }} id="join-room-form">
                      <div className="form-group">
                        <label className="form-label" htmlFor="room-code">Código de la Sala</label>
                        <input
                          type="text"
                          id="room-code"
                          className="form-input"
                          placeholder="Ej. ABCDEF"
                          maxLength={6}
                          value={joinRoomCode}
                          onChange={(e) => setJoinRoomCode(e.target.value)}
                          disabled={roomActionLoading}
                          style={{ textTransform: 'uppercase' }}
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-secondary" id="join-room-submit" disabled={roomActionLoading}>
                        {roomActionLoading ? <div className="spinner"></div> : 'Unirse a Sala'}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Rooms list */}
                <div className="card">
                  <h3 className="table-title">Tus Salas Unidas</h3>
                  {roomActionLoading && rooms.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                      <div className="spinner"></div>
                    </div>
                  ) : rooms.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                      <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🏟️</span>
                      No perteneces a ninguna sala de juego todavía. ¡Crea una o únete a una existente arriba!
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.25rem', marginTop: '1.25rem' }}>
                      {rooms.map(room => (
                        <div
                          key={room.id}
                          className="room-card"
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            transition: 'var(--transition-smooth)'
                          }}
                        >
                          <div>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{room.name}</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                              Creada el: {new Date(room.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          <div style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px dashed var(--accent-gold)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-gold)', display: 'block', letterSpacing: '0.05em' }}>Código de Invitación</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{room.code}</span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>👥 {room.members_count} miembros</span>
                            {room.creator_id === profile?.id ? (
                              <span style={{ color: 'var(--accent-mint)', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Creador 👑</span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Miembro</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. MATCHES AND PREDICTIONS TAB */}
            {activeTab === 'matches' && (
              <div className="card">
                <h3 className="table-title">Partidos y Predicciones</h3>

                {/* Resultados de Partidos Finalizados */}
                {matches.filter(m => m.status === 'finished').length > 0 && (
                  <>
                    <h4 className="section-title" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Resultados de Partidos</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                      {matches.filter(m => m.status === 'finished').map(match => {
                        const pred = predictions.find(p => p.match_id === match.id);
                        return (
                          <div key={match.id} className="match-card" style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '14px',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                          }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>📅 {new Date(match.match_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                              <span className="status-badge status-banned">Finalizado</span>
                            </div>
                            {/* Teams and Score */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0' }}>
                              <div style={{ width: '40%', textAlign: 'right', fontWeight: 'bold' }}>{match.home_team}</div>
                              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>{match.home_score} - {match.away_score}</div>
                              <div style={{ width: '40%', textAlign: 'left', fontWeight: 'bold' }}>{match.away_team}</div>
                            </div>
                            {/* Predicción y Puntos Ganados */}
                            {pred && (
                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Tu Predicción:</span>
                                  <strong style={{ color: 'var(--text-primary)' }}>{pred.home_predict} - {pred.away_predict}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.08)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)', marginTop: '0.5rem' }}>
                                  <span style={{ color: 'var(--accent-mint)', fontWeight: 'bold' }}>Puntos Ganados:</span>
                                  <span style={{ color: 'var(--accent-mint)', fontWeight: 'bold' }} className="status-badge status-active">+{pred.earned_points || 0} pts</span>
                                </div>
                                {pred.points_reason && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    💬 {pred.points_reason}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Predicciones de Partidos Abiertos */}
                {matches.filter(m => m.status !== 'finished').length > 0 && (
                  <div>
                    <h4 className="section-title" style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Predicciones</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                      {matches.filter(m => m.status !== 'finished').map(match => {
                        const isExpired = new Date() >= new Date(match.match_date);
                        const pred = predictions.find(p => p.match_id === match.id);
                        const currentInput = predictionInputs[match.id] || { home_predict: '', away_predict: '' };
                        return (
                          <div key={match.id} className="match-card" style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '14px',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                          }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>📅 {new Date(match.match_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                              {isExpired ? (
                                <span className="status-badge status-banned" style={{ background: 'rgba(251, 191, 36, 0.1)', color: 'var(--accent-gold)', borderColor: 'rgba(251, 191, 36, 0.2)' }}>Cerrado</span>
                              ) : (
                                <span className="status-badge status-active">Abierto</span>
                              )}
                            </div>
                            {/* Teams */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0' }}>
                              <div style={{ width: '40%', textAlign: 'right', fontWeight: 'bold' }}>{match.home_team}</div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>VS</div>
                              <div style={{ width: '40%', textAlign: 'left', fontWeight: 'bold' }}>{match.away_team}</div>
                            </div>
                            {/* Prediction Input */}
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{pred ? 'Editar Predicción:' : 'Ingresar Predicción:'}</span>
                                {pred && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-mint)' }}>✔ Guardada ({pred.home_predict}-{pred.away_predict})</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                                <input type="number" min="0" className="form-input" style={{ width: '60px', textAlign: 'center', padding: '0.4rem' }} placeholder="L"
                                  value={currentInput.home_predict}
                                  onChange={e => handlePredictionInputChange(match.id, 'home_predict', e.target.value)}
                                  disabled={isExpired || adminActionLoading}
                                />
                                <span>-</span>
                                <input type="number" min="0" className="form-input" style={{ width: '60px', textAlign: 'center', padding: '0.4rem' }} placeholder="V"
                                  value={currentInput.away_predict}
                                  onChange={e => handlePredictionInputChange(match.id, 'away_predict', e.target.value)}
                                  disabled={isExpired || adminActionLoading}
                                />
                                <button onClick={() => handleSavePrediction(match.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} disabled={predictionLoading[match.id] || isExpired}>
                                  {predictionLoading[match.id] ? '...' : 'Guardar'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* 4. LEADERBOARD TAB */}
            {activeTab === 'rankings' && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 className="table-title" style={{ margin: 0 }}>Ranking de Jugadores</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                    Origen: {rankingSource}
                  </span>
                </div>
                {rankings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No hay puntuaciones registradas en el ranking global.
                  </div>
                ) : (
                  <div className="users-table-container">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>Puesto</th>
                          <th>Jugador</th>
                          <th>Correo Electrónico</th>
                          <th style={{ textAlign: 'right' }}>Puntuación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankings.map((user, index) => {
                          const rank = index + 1;
                          let rankBadge = `#${rank}`;
                          if (rank === 1) rankBadge = '🥇';
                          else if (rank === 2) rankBadge = '🥈';
                          else if (rank === 3) rankBadge = '🥉';

                          const isCurrentUser = user.id === profile?.id;

                          return (
                            <tr key={user.id} style={isCurrentUser ? { background: 'rgba(16, 185, 129, 0.05)', borderLeft: '4px solid var(--accent-mint)' } : {}}>
                              <td style={{ fontSize: rank <= 3 ? '1.25rem' : '0.95rem', fontWeight: 'bold' }}>
                                {rankBadge}
                              </td>
                              <td style={{ fontWeight: isCurrentUser ? 'bold' : 'normal' }}>
                                {user.name} {isCurrentUser && <span style={{ color: 'var(--accent-mint)', fontSize: '0.8rem', marginLeft: '0.25rem' }}>(Tú)</span>}
                              </td>
                              <td className="text-muted">{user.email}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-mint)', fontSize: '1.1rem' }}>
                                {user.total_points} pts
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 5. ADMIN CONTROLS TAB */}
            {activeTab === 'admin' && profile?.role === 'admin' && (
              <DashboardAdmin
                adminHomeTeam={adminHomeTeam}
                setAdminHomeTeam={setAdminHomeTeam}
                adminAwayTeam={adminAwayTeam}
                setAdminAwayTeam={setAdminAwayTeam}
                adminMatchDate={adminMatchDate}
                setAdminMatchDate={setAdminMatchDate}
                adminActionLoading={adminActionLoading}
                handleCreateMatch={handleCreateMatch}
                matches={matches}
                adminSelectedMatch={adminSelectedMatch}
                setAdminSelectedMatch={setAdminSelectedMatch}
                adminHomeScore={adminHomeScore}
                setAdminHomeScore={setAdminHomeScore}
                adminAwayScore={adminAwayScore}
                setAdminAwayScore={setAdminAwayScore}
                handleResolveMatch={handleResolveMatch}
              />
            )}

          </div>
        )}
      </main>
    </div>
  );
};


export default Dashboard;
