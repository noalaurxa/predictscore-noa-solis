import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Redirigir al dashboard si ya inició sesión
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validaciones básicas de cliente
    if (!name || !email || !password) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register', { name, email, password });
      
      setSuccess('¡Registro exitoso! Redirigiendo al login...');
      
      // Limpiar campos
      setName('');
      setEmail('');
      setPassword('');

      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Ocurrió un error al intentar registrar la cuenta.');
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
          <h2 className="auth-title">Crear Cuenta</h2>
          <p className="auth-subtitle">Regístrate para comenzar a pronosticar</p>
        </div>

        {error && (
          <div className="alert alert-error" id="register-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success" id="register-success">
            <span>✅</span>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} id="register-form">
          <div className="form-group">
            <label className="form-label" htmlFor="register-name-input">Nombre Completo</label>
            <input
              type="text"
              id="register-name-input"
              className="form-input"
              placeholder="Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-email-input">Correo Electrónico</label>
            <input
              type="email"
              id="register-email-input"
              className="form-input"
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-password-input">Contraseña</label>
            <input
              type="password"
              id="register-password-input"
              className="form-input"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            id="register-submit-btn"
            disabled={loading}
          >
            {loading ? <div className="spinner"></div> : 'Registrarse'}
          </button>
        </form>

        <div className="auth-footer">
          ¿Ya tienes una cuenta?{' '}
          <Link to="/login" id="link-to-login">Inicia sesión aquí</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
