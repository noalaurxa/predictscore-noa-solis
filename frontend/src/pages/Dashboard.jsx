import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Dashboard = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/auth/profile');
        setProfile(response.data.user);
      } catch (err) {
        console.error(err);
        if (err.response && err.response.status === 401) {
          // Token inválido o expirado, cerrar sesión
          handleLogout();
        } else if (err.response && err.response.data && err.response.data.error) {
          setError(err.response.data.error);
        } else {
          setError('No se pudo establecer comunicación con el servidor.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

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

      {/* Área del Dashboard */}
      <main className="auth-wrapper" style={{ flex: 1, padding: '2rem' }}>
        <div className="auth-card" style={{ maxWidth: '500px', animation: 'fadeIn 0.5s ease-out' }}>
          <div className="auth-header">
            <div className="auth-logo">⚽🏆</div>
            <h2 className="auth-title">¡Bienvenido, {profile?.name}!</h2>
            <p className="auth-subtitle" style={{ color: 'var(--accent-mint)' }}>Sesión Iniciada de PredictScore</p>
          </div>

          {error && (
            <div className="alert alert-error" id="dashboard-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Tarjeta de bienvenida */}
          <div className="card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usuario</span>
                <p style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-primary)', marginTop: '0.2rem' }}>{profile?.name}</p>
              </div>

              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correo Electrónico</span>
                <p style={{ fontSize: '1.1rem', fontWeight: '500', color: 'var(--text-primary)', marginTop: '0.2rem' }}>{profile?.email}</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ID de Usuario</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--accent-mint)' }}>{profile?.id.substring(0, 8)}...</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: 'white', boxShadow: '0 4px 12px rgba(244, 63, 94, 0.2)' }}
            id="dashboard-logout-submit"
          >
            Cerrar Sesión
          </button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
