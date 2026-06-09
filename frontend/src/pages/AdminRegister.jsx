import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../services/api';

const AdminRegister = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await authApi.post('/auth/admin/register', { name, email, password, adminKey });
      setSuccess(`Administrador "${response.data.user.name}" creado. Redirigiendo al login...`);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar administrador.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🔐⚙️</div>
          <h2 className="auth-title">Registro Admin</h2>
          <p className="auth-subtitle">Crea una cuenta de administrador con clave secreta</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span><span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <span>✅</span><span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} id="admin-register-form">
          <div className="form-group">
            <label className="form-label" htmlFor="admin-name">Nombre Completo</label>
            <input type="text" id="admin-name" className="form-input" placeholder="Nombre del administrador"
              value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-email">Correo Electrónico</label>
            <input type="email" id="admin-email" className="form-input" placeholder="admin@predictscore.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">Contraseña</label>
            <input type="password" id="admin-password" className="form-input" placeholder="Mínimo 6 caracteres"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-key">
              🔑 Clave Secreta de Admin
            </label>
            <input type="password" id="admin-key" className="form-input"
              placeholder="Clave proporcionada por el sistema"
              value={adminKey} onChange={e => setAdminKey(e.target.value)} required />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
              Por defecto: <code style={{ color: 'var(--accent-gold)' }}>predictscore_admin_2024</code>
            </p>
          </div>

          <button type="submit" className="btn btn-primary" id="admin-register-submit" disabled={loading}>
            {loading ? <div className="spinner"></div> : '⚙️ Crear Cuenta Admin'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login">← Volver al inicio de sesión</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminRegister;
