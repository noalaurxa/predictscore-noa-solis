import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, matchApi, predictionApi } from '../services/api';
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
  // Room detail panel
  const [selectedRoom, setSelectedRoom] = useState(null);   // room object
  const [roomDetail, setRoomDetail] = useState(null);       // { room, members }
  const [roomRanking, setRoomRanking] = useState([]);
  const [roomDetailLoading, setRoomDetailLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  // Room match configuration
  const [roomMatches, setRoomMatches] = useState([]);       // matches assigned to room
  const [allMatches, setAllMatches] = useState([]);         // all available matches
  const [showAddMatchModal, setShowAddMatchModal] = useState(false);
  const [matchSlots, setMatchSlots] = useState([null]);     // array of selected matchIds (null = empty slot)
  const [matchConfigLoading, setMatchConfigLoading] = useState(false);

  // Matches & Predictions State
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [predictionInputs, setPredictionInputs] = useState({});
  const [predictionLoading, setPredictionLoading] = useState({});
  // Edit mode per match (set of match IDs currently being edited)
  const [editingPredictions, setEditingPredictions] = useState(new Set());
  // Warning modal state
  const [editWarningModal, setEditWarningModal] = useState({ open: false, matchId: null, matchDate: null });

  // Leaderboard State
  const [rankings, setRankings] = useState([]);
  const [rankingSource, setRankingSource] = useState('');



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

  // Open room detail panel
  const handleOpenRoomDetail = async (room) => {
    setSelectedRoom(room);
    setRoomDetail(null);
    setRoomRanking([]);
    setRoomMatches([]);
    setAllMatches([]);
    setMatchSlots([null]);
    setRoomDetailLoading(true);
    try {
      const [detailRes, rankingRes, matchesRes] = await Promise.all([
        predictionApi.get(`/rooms/${room.id}`),
        predictionApi.get(`/rooms/${room.id}/ranking`),
        predictionApi.get(`/rooms/${room.id}/matches`),
      ]);
      setRoomDetail(detailRes.data);
      setRoomRanking(rankingRes.data.ranking || []);
      const assigned = matchesRes.data.roomMatches || [];
      const all = matchesRes.data.allMatches || [];
      setRoomMatches(assigned);
      setAllMatches(all);
      // Pre-fill slots: at least 1 slot, filled with assigned IDs
      const slots = assigned.length > 0 ? assigned.map(m => m.id) : [null];
      setMatchSlots(slots);
    } catch (err) {
      console.error(err);
      setError('Error al cargar el detalle de la sala.');
    } finally {
      setRoomDetailLoading(false);
    }
  };

  const handleCloseRoomDetail = () => {
    setSelectedRoom(null);
    setRoomDetail(null);
    setRoomRanking([]);
    setRoomMatches([]);
    setAllMatches([]);
    setMatchSlots([null]);
    setCopiedCode(false);
    setShowAddMatchModal(false);
  };

  // Add a new empty slot in the add-match modal
  const handleAddSlot = () => setMatchSlots(prev => [...prev, null]);

  // Remove a slot
  const handleRemoveSlot = (idx) => setMatchSlots(prev => prev.filter((_, i) => i !== idx));

  // Change a slot's selected match
  const handleSlotChange = (idx, matchId) => {
    setMatchSlots(prev => prev.map((v, i) => i === idx ? matchId : v));
  };

  // Save all slots: add new ones, remove unchecked ones
  const handleSaveMatchConfig = async () => {
    if (!selectedRoom) return;
    setMatchConfigLoading(true);
    try {
      const newIds = matchSlots.filter(Boolean);
      const currentIds = roomMatches.map(m => m.id);
      // Ids to add (not yet in room)
      const toAdd = newIds.filter(id => !currentIds.includes(id));
      // Ids to remove (were in room but not in new selection)
      const toRemove = currentIds.filter(id => !newIds.includes(id));

      await Promise.all([
        ...toAdd.map(id => predictionApi.post(`/rooms/${selectedRoom.id}/matches`, { matchId: id })),
        ...toRemove.map(id => predictionApi.delete(`/rooms/${selectedRoom.id}/matches/${id}`)),
      ]);

      // Refresh matches and ranking
      const [matchesRes, rankingRes] = await Promise.all([
        predictionApi.get(`/rooms/${selectedRoom.id}/matches`),
        predictionApi.get(`/rooms/${selectedRoom.id}/ranking`),
      ]);
      const assigned = matchesRes.data.roomMatches || [];
      setRoomMatches(assigned);
      setAllMatches(matchesRes.data.allMatches || []);
      setMatchSlots(assigned.length > 0 ? assigned.map(m => m.id) : [null]);
      setRoomRanking(rankingRes.data.ranking || []);
      setShowAddMatchModal(false);
      setSuccess('Partidos de la sala actualizados.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al configurar partidos.');
    } finally {
      setMatchConfigLoading(false);
    }
  };

  // Copy room code to clipboard
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  // Leave room
  const handleLeaveRoom = async (roomId) => {
    if (!window.confirm('¿Estás seguro de que quieres salir de esta sala?')) return;
    try {
      setRoomActionLoading(true);
      await predictionApi.post(`/rooms/${roomId}/leave`);
      setSuccess('Has salido de la sala exitosamente.');
      handleCloseRoomDetail();
      fetchRooms();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al salir de la sala.');
    } finally {
      setRoomActionLoading(false);
    }
  };

  // Delete room (creator only)
  const handleDeleteRoom = async (roomId, roomName) => {
    if (!window.confirm(`¿Eliminar la sala "${roomName}"? Todos los miembros serán expulsados.`)) return;
    try {
      setRoomActionLoading(true);
      const res = await predictionApi.delete(`/rooms/${roomId}`);
      setSuccess(res.data.message);
      handleCloseRoomDetail();
      fetchRooms();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar la sala.');
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
              <div style={{ display: 'flex', gap: '1.5rem', position: 'relative' }}>
                {/* Left column: create/join + room cards */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Action cards row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                    {/* Create room card */}
                    <div className="card">
                      <h3 className="table-title">🏠 Crear Nueva Sala</h3>
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
                          {roomActionLoading ? <div className="spinner"></div> : '+ Crear Sala'}
                        </button>
                      </form>
                    </div>

                    {/* Join room card */}
                    <div className="card">
                      <h3 className="table-title">🔑 Unirse a una Sala</h3>
                      <form onSubmit={handleJoinRoom} style={{ marginTop: '1rem' }} id="join-room-form">
                        <div className="form-group">
                          <label className="form-label" htmlFor="room-code">Código de Invitación</label>
                          <input
                            type="text"
                            id="room-code"
                            className="form-input"
                            placeholder="Ej. ABCDEF"
                            maxLength={6}
                            value={joinRoomCode}
                            onChange={(e) => setJoinRoomCode(e.target.value)}
                            disabled={roomActionLoading}
                            style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'monospace', fontSize: '1.1rem' }}
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-secondary" id="join-room-submit" disabled={roomActionLoading}>
                          {roomActionLoading ? <div className="spinner"></div> : 'Unirse con Código'}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Rooms grid */}
                  <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h3 className="table-title" style={{ margin: 0 }}>Tus Salas</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.6rem', borderRadius: '20px' }}>
                        {rooms.length} sala{rooms.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {roomActionLoading && rooms.length === 0 ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                        <div className="spinner"></div>
                      </div>
                    ) : rooms.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🏟️</span>
                        No perteneces a ninguna sala todavía. ¡Crea una o únete con un código!
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
                        {rooms.map(room => (
                          <div
                            key={room.id}
                            onClick={() => handleOpenRoomDetail(room)}
                            style={{
                              background: selectedRoom?.id === room.id
                                ? 'rgba(16,185,129,0.06)'
                                : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${selectedRoom?.id === room.id ? 'var(--accent-mint)' : 'var(--border-color)'}`,
                              borderRadius: '14px',
                              padding: '1.25rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem'
                            }}
                            id={`room-card-${room.id}`}
                          >
                            {/* Room name + creator badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{room.name}</h4>
                              {room.creator_id === profile?.id && (
                                <span style={{ fontSize: '0.7rem', background: 'rgba(251,191,36,0.12)', color: 'var(--accent-gold)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '4px', padding: '0.15rem 0.4rem', whiteSpace: 'nowrap' }}>👑 Creador</span>
                              )}
                            </div>

                            {/* Invite code */}
                            <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px dashed rgba(251,191,36,0.35)', padding: '0.4rem 0.6rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Código</span>
                              <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold', color: 'var(--accent-gold)', letterSpacing: '0.1em' }}>{room.code}</span>
                            </div>

                            {/* Members count + date */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
                              <span>👥 {room.members_count} miembro{room.members_count !== 1 ? 's' : ''}</span>
                              <span>{new Date(room.created_at).toLocaleDateString()}</span>
                            </div>

                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.7 }}>Click para ver detalles →</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right column: Room detail slide-over panel */}
                {selectedRoom && (
                  <div
                    id="room-detail-panel"
                    style={{
                      width: '360px',
                      flexShrink: 0,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '18px',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem',
                      height: 'fit-content',
                      position: 'sticky',
                      top: '1rem',
                      animation: 'slideIn 0.25s ease-out'
                    }}
                  >
                    {/* Panel header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{selectedRoom.name}</h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {selectedRoom.creator_id === profile?.id ? '👑 Eres el creador' : '👤 Eres miembro'}
                        </p>
                      </div>
                      <button
                        onClick={handleCloseRoomDetail}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem', lineHeight: 1 }}
                        id="close-room-panel-btn"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Invite code + copy button */}
                    <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '12px', padding: '1rem' }}>
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Código de Invitación</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--accent-gold)', letterSpacing: '0.2em', flex: 1 }}>{selectedRoom.code}</span>
                        <button
                          id="copy-room-code-btn"
                          onClick={() => handleCopyCode(selectedRoom.code)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', width: 'auto', minWidth: 'auto' }}
                        >
                          {copiedCode ? '✅ Copiado' : '📋 Copiar'}
                        </button>
                      </div>
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Comparte este código para invitar a otros jugadores.
                      </p>
                    </div>

                    {roomDetailLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                        <div className="spinner"></div>
                      </div>
                    ) : (
                      <>
                        {/* Room Ranking */}
                        <div>
                          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏆 Ranking de la Sala</h4>
                          {roomRanking.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Sin datos de puntuación aún.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {roomRanking.map((member, idx) => {
                                const isMe = member.id === profile?.id;
                                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                                return (
                                  <div
                                    key={member.id}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                                      padding: '0.5rem 0.6rem',
                                      borderRadius: '8px',
                                      background: isMe ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                                      border: `1px solid ${isMe ? 'rgba(16,185,129,0.2)' : 'var(--border-color)'}`
                                    }}
                                  >
                                    <span style={{ fontSize: idx < 3 ? '1.1rem' : '0.85rem', fontWeight: 'bold', width: '24px', textAlign: 'center' }}>{medal}</span>
                                    <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: isMe ? 'bold' : 'normal', color: isMe ? 'var(--accent-mint)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {member.name} {isMe && <span style={{ fontSize: '0.7rem' }}>(Tú)</span>}
                                    </span>
                                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--accent-mint)', whiteSpace: 'nowrap' }}>{member.total_points} pts</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Members list */}
                        {roomDetail?.members && (
                          <div>
                            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👥 Miembros ({roomDetail.members.length})</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                              {roomDetail.members.map(member => (
                                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.3rem' }}>
                                  <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--accent-mint), var(--accent-blue))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.75rem', fontWeight: 'bold', color: '#fff', flexShrink: 0
                                  }}>
                                    {member.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {member.name}
                                      {member.id === selectedRoom.creator_id && <span style={{ fontSize: '0.7rem', marginLeft: '0.3rem' }}>👑</span>}
                                      {member.id === profile?.id && <span style={{ fontSize: '0.7rem', color: 'var(--accent-mint)', marginLeft: '0.3rem' }}>(Tú)</span>}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ⚽ Match configuration (creator only) */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚽ Partidos de la Sala</h4>
                            {selectedRoom.creator_id === profile?.id && (
                              <button
                                id="configure-matches-btn"
                                onClick={() => setShowAddMatchModal(true)}
                                className="btn btn-secondary"
                                style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', width: 'auto' }}
                              >
                                ✏️ Configurar
                              </button>
                            )}
                          </div>
                          {roomMatches.length === 0 ? (
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                              {selectedRoom.creator_id === profile?.id
                                ? '⚙️ Sin partidos configurados. Haz click en "Configurar" para añadir.'
                                : '⚙️ El creador aún no ha configurado partidos para esta sala.'}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {roomMatches.map(match => (
                                <div key={match.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.6rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '8px', fontSize: '0.82rem' }}>
                                  <div>
                                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{match.home_team} vs {match.away_team}</span>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                                      📅 {new Date(match.match_date).toLocaleDateString([], { dateStyle: 'short' })}
                                    </div>
                                  </div>
                                  <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px',
                                    background: match.status === 'finished' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                    color: match.status === 'finished' ? '#f87171' : 'var(--accent-mint)',
                                    border: `1px solid ${match.status === 'finished' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`
                                  }}>{match.status === 'finished' ? 'Finalizado' : 'Activo'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions: leave / delete */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                          {selectedRoom.creator_id === profile?.id ? (
                            <button
                              id="delete-room-btn"
                              onClick={() => handleDeleteRoom(selectedRoom.id, selectedRoom.name)}
                              disabled={roomActionLoading}
                              className="btn"
                              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', width: '100%' }}
                            >
                              🗑️ Eliminar sala
                            </button>
                          ) : (
                            <button
                              id="leave-room-btn"
                              onClick={() => handleLeaveRoom(selectedRoom.id)}
                              disabled={roomActionLoading}
                              className="btn btn-secondary"
                              style={{ width: '100%' }}
                            >
                              🚪 Salir de la sala
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
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
                        const isEditing = editingPredictions.has(match.id);
                        // Is the early bonus still applicable (>24h left)?
                        const hoursUntilMatch = (new Date(match.match_date) - new Date()) / 1000 / 3600;
                        const hasEarlyBonus = hoursUntilMatch > 24;
                        return (
                          <div key={match.id} className="match-card" style={{
                            background: 'var(--bg-secondary)',
                            border: `1px solid ${isEditing ? 'var(--accent-gold)' : 'var(--border-color)'}`,
                            borderRadius: '14px',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            transition: 'border-color 0.3s'
                          }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>📅 {new Date(match.match_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                {hasEarlyBonus && !isExpired && (
                                  <span title="Más de 24h: obtendrás el punto extra anticipado" style={{ fontSize: '0.7rem', background: 'rgba(251,191,36,0.12)', color: 'var(--accent-gold)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '4px', padding: '0.1rem 0.35rem' }}>⭐+1 bonus</span>
                                )}
                                {isExpired ? (
                                  <span className="status-badge status-banned" style={{ background: 'rgba(251, 191, 36, 0.1)', color: 'var(--accent-gold)', borderColor: 'rgba(251, 191, 36, 0.2)' }}>Cerrado</span>
                                ) : (
                                  <span className="status-badge status-active">Abierto</span>
                                )}
                              </div>
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
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  {pred && !isEditing ? 'Predicción guardada:' : pred && isEditing ? 'Editando predicción:' : 'Ingresar Predicción:'}
                                </span>
                                {pred && !isEditing && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-mint)' }}>✔ {pred.home_predict}-{pred.away_predict}</span>
                                )}
                              </div>

                              {/* If saved and NOT editing: show summary + Edit button */}
                              {pred && !isEditing && !isExpired ? (
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                    <span>{pred.home_predict}</span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                                    <span>{pred.away_predict}</span>
                                  </div>
                                  <button
                                    onClick={() => setEditWarningModal({ open: true, matchId: match.id, matchDate: match.match_date })}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                                  >
                                    ✏️ Editar
                                  </button>
                                </div>
                              ) : (
                                /* No saved pred, or actively editing: show inputs + Save/Cancel */
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                                  <input type="number" min="0" className="form-input" style={{ width: '60px', textAlign: 'center', padding: '0.4rem' }} placeholder="L"
                                    value={currentInput.home_predict}
                                    onChange={e => handlePredictionInputChange(match.id, 'home_predict', e.target.value)}
                                    disabled={isExpired || predictionLoading[match.id]}
                                  />
                                  <span>-</span>
                                  <input type="number" min="0" className="form-input" style={{ width: '60px', textAlign: 'center', padding: '0.4rem' }} placeholder="V"
                                    value={currentInput.away_predict}
                                    onChange={e => handlePredictionInputChange(match.id, 'away_predict', e.target.value)}
                                    disabled={isExpired || predictionLoading[match.id]}
                                  />
                                  <button
                                    onClick={() => {
                                      handleSavePrediction(match.id);
                                      setEditingPredictions(prev => { const s = new Set(prev); s.delete(match.id); return s; });
                                    }}
                                    className="btn btn-primary"
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                    disabled={predictionLoading[match.id] || isExpired}
                                  >
                                    {predictionLoading[match.id] ? '...' : 'Guardar'}
                                  </button>
                                  {/* Cancel edit - only show if there was a saved pred */}
                                  {pred && isEditing && (
                                    <button
                                      onClick={() => setEditingPredictions(prev => { const s = new Set(prev); s.delete(match.id); return s; })}
                                      className="btn btn-secondary"
                                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                    >
                                      Cancelar
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Expired: just show saved values read-only */}
                              {isExpired && pred && (
                                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                  Predicción cerrada: {pred.home_predict} - {pred.away_predict}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ADD MATCH MODAL (creator only) ── */}
            {showAddMatchModal && selectedRoom && (
              <div
                id="add-match-modal-overlay"
                style={{
                  position: 'fixed', inset: 0,
                  background: 'rgba(0,0,0,0.72)',
                  backdropFilter: 'blur(5px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1100,
                  animation: 'fadeIn 0.2s ease-out'
                }}
                onClick={(e) => { if (e.target === e.currentTarget) setShowAddMatchModal(false); }}
              >
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '18px',
                  padding: '2rem',
                  maxWidth: '500px',
                  width: '92%',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}>
                  {/* Modal header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>⚽ Configurar Partidos</h3>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Solo los partidos seleccionados contarán puntos para esta sala.</p>
                    </div>
                    <button onClick={() => setShowAddMatchModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                  </div>

                  {/* Match slots */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {matchSlots.map((slotId, idx) => {
                      const otherSelected = matchSlots.filter((_, i) => i !== idx).filter(Boolean);
                      return (
                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '20px', textAlign: 'center' }}>#{idx + 1}</span>
                          <select
                            id={`match-slot-${idx}`}
                            value={slotId || ''}
                            onChange={(e) => handleSlotChange(idx, e.target.value || null)}
                            style={{
                              flex: 1,
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.85rem',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">— Selecciona un partido —</option>
                            {allMatches
                              .filter(m => !otherSelected.includes(m.id))
                              .map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.home_team} vs {m.away_team} · {new Date(m.match_date).toLocaleDateString([], { dateStyle: 'short' })} {m.status === 'finished' ? '✓' : ''}
                                </option>
                              ))}
                          </select>
                          {matchSlots.length > 1 && (
                            <button
                              onClick={() => handleRemoveSlot(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '1rem', padding: '0.3rem', flexShrink: 0 }}
                              title="Quitar partido"
                            >✕</button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add slot button */}
                  <button
                    id="add-match-slot-btn"
                    onClick={handleAddSlot}
                    className="btn btn-secondary"
                    style={{ width: '100%', fontSize: '0.85rem', borderStyle: 'dashed' }}
                    disabled={matchSlots.length >= allMatches.length}
                  >
                    + Añadir otro partido
                  </button>

                  {/* Save / Cancel */}
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ width: 'auto', padding: '0.5rem 1.25rem' }}
                      onClick={() => setShowAddMatchModal(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      id="save-match-config-btn"
                      className="btn btn-primary"
                      style={{ width: 'auto', padding: '0.5rem 1.5rem' }}
                      onClick={handleSaveMatchConfig}
                      disabled={matchConfigLoading || matchSlots.every(s => !s)}
                    >
                      {matchConfigLoading ? '...' : '✅ Guardar configuración'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── EDIT WARNING MODAL ── */}
            {editWarningModal.open && (() => {
              const mDate = new Date(editWarningModal.matchDate);
              const hoursLeft = (mDate - new Date()) / 1000 / 3600;
              const stillEarly = hoursLeft > 24;
              return (
                <div
                  id="edit-prediction-modal-overlay"
                  style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000,
                    animation: 'fadeIn 0.2s ease-out'
                  }}
                  onClick={(e) => { if (e.target === e.currentTarget) setEditWarningModal({ open: false, matchId: null, matchDate: null }); }}
                >
                  <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '18px',
                    padding: '2rem',
                    maxWidth: '420px',
                    width: '90%',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem'
                  }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '2rem', lineHeight: 1 }}>⚠️</span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>¿Editar tu predicción?</h3>
                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          Estás a punto de modificar una predicción ya registrada. Ten en cuenta la siguiente regla:
                        </p>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '10px', padding: '1rem', fontSize: '0.85rem', lineHeight: 1.6 }}>
                      <p style={{ margin: 0, color: 'var(--accent-gold)', fontWeight: 'bold', marginBottom: '0.4rem' }}>⭐ Predicción Anticipada (+1 punto extra)</p>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        Las predicciones registradas con <strong style={{ color: 'var(--text-primary)' }}>más de 24 horas de anticipación</strong> al partido obtienen 1 punto extra.
                        Las de <strong style={{ color: 'var(--text-primary)' }}>último minuto (10 min antes)</strong> solo reciben puntos base.
                      </p>
                    </div>

                    {stillEarly ? (
                      <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.82rem', color: 'var(--accent-mint)' }}>
                        ✅ Aún tienes <strong>{hoursLeft.toFixed(0)}h</strong> hasta el partido. Si guardas ahora, <strong>conservarás el bono anticipado</strong>.
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.82rem', color: '#f87171' }}>
                        ❌ Quedan menos de 24 horas para el partido. Si guardas ahora, <strong>perderás el bono anticipado de +1 punto</strong>.
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ width: 'auto', padding: '0.5rem 1.25rem' }}
                        onClick={() => setEditWarningModal({ open: false, matchId: null, matchDate: null })}
                      >
                        Cancelar
                      </button>
                      <button
                        id="edit-prediction-confirm-btn"
                        className="btn btn-primary"
                        style={{ width: 'auto', padding: '0.5rem 1.25rem', background: stillEarly ? '' : 'linear-gradient(135deg, #ef4444, #b91c1c)' }}
                        onClick={() => {
                          setEditingPredictions(prev => new Set(prev).add(editWarningModal.matchId));
                          setEditWarningModal({ open: false, matchId: null, matchDate: null });
                        }}
                      >
                        Sí, editar predicción
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}


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



          </div>
        )}
      </main>
    </div>
  );
};


export default Dashboard;
