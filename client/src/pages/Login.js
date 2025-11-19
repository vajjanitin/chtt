import React, { useState } from 'react';
import API, { setAuthToken } from '../api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState('login');
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const cardRef = React.useRef(null);
  const [showHero, setShowHero] = useState(true);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login' ? { username, password } : { username, password, name };
      const res = await API.post(path, payload);
      // decode id from JWT
      let userId = null;
      try {
        const parts = (res.data.token || '').split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          userId = payload.id || payload._id || null;
        }
      } catch (ex) {}
      const user = { token: res.data.token, username: res.data.username, name: res.data.name || null, id: userId };
      localStorage.setItem('user', JSON.stringify(user));
      setAuthToken(user.token);
      onLogin(user);
    } catch (error) {
      console.error('Auth error details:', error);
      const serverMsg = error.response?.data?.message || error.response?.data || error.message;
      setErr(String(serverMsg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className={`hero ${showHero ? 'centered' : 'hidden'}`}>
        <h1 className="hero-title">Connect with people in a fast, fun, and safe way.</h1>
        <p className="hero-sub">Our chatting app gives you smart features, custom themes, and an easy-to-use design that makes every chat enjoyable. With strong privacy and exciting tools, it helps you stay close to the people who matter. Chat your way, anytime and anywhere.</p>
        <div style={{ marginTop: 18 }}>
          <button
            className="btn btn-primary start-btn"
            onClick={() => {
              // hide hero with animation, then show form
              setShowHero(false);
              setTimeout(() => {
                setShowForm(true);
                setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
              }, 350);
            }}
          >
            Start chatting
          </button>
        </div>
      </div>

      <div ref={cardRef} className={`login-card ${showForm ? 'visible' : 'hidden'}`}>
        <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        <form onSubmit={submit} className="login-form">
          <input
            className="input"
            placeholder="username (email)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          {mode === 'register' && (
            <input
              className="input"
              placeholder="Display name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <input
            className="input"
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Create account')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Switch to Register' : 'Switch to Login'}
            </button>
          </div>

          {err && <div className="auth-error"><strong>Error:</strong> {err}</div>}

          <div className="helper">
            <div style={{ fontSize: 13, color: '#6b7280' }}>{mode === 'login' ? 'Sign in to continue' : 'Create a new account'}</div>
            <div style={{ fontSize: 12 }}></div>
          </div>
        </form>
      </div>
    </div>
  );
}
