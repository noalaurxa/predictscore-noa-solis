import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Si ya tiene un token, redirigir según rol
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (token && user) {
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Por favor, ingresa todos los campos.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });

      const { token, user } = response.data;

      // Guardar JWT y datos de usuario en localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      setSuccess('¡Inicio de sesión exitoso! Redirigiendo...');

      setTimeout(() => {
        // Redirigir según rol
        if (user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }, 800);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Ocurrió un error al intentar iniciar sesión. Verifica tu conexión.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">⚽🏆</div>
          <h2 className="auth-title">PredictScore</h2>
          <p className="auth-subtitle">Inicia sesión para predecir tus resultados</p>
        </div>

        {error && (
          <div className="alert alert-error" id="login-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success" id="login-success">
            <span>✅</span>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} id="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email-input">Correo Electrónico</label>
            <input
              type="email"
              id="email-input"
              className="form-input"
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Contraseña</label>
            <input
              type="password"
              id="password-input"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            id="login-submit-btn"
            disabled={loading}
          >
            {loading ? <div className="spinner"></div> : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="auth-footer">
          ¿No tienes una cuenta?{' '}
          <Link to="/register" id="link-to-register">Regístrate aquí</Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <Link
            to="/admin/register"
            id="link-to-admin-register"
            style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', opacity: 0.6 }}
          >
            🔐 Acceso administrador
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
