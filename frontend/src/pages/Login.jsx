import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Lock, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

function Login({ onLogin, onGoogleLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success') === '1' && params.get('name')) {
      const name = params.get('name');
      onGoogleLogin({ name, method: 'google' });
      navigate('/', { replace: true });
      return;
    }
    // Handle OAuth errors forwarded from the backend
    if (params.get('error')) {
      const err = params.get('error');
      if (err === 'oauth_not_configured') {
        setError('Google sign-in is not configured on the backend.');
      } else if (err === 'missing_code') {
        setError('Authentication failed: missing authorization code.');
      } else if (err === 'token_exchange_failed') {
        setError('Authentication failed: unable to exchange authorization code.');
      } else if (err === 'no_access_token') {
        setError('Authentication failed: no access token returned by Google.');
      } else if (err === 'fetch_user_failed') {
        setError('Authentication failed: unable to retrieve user information from Google.');
      } else {
        setError('Authentication failed.');
      }
      // keep the user on login page so they can try again
    }
  }, [location.search, navigate, onGoogleLogin]);

  const submitForm = (event) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    onLogin({ name: email.split('@')[0] || 'User', method: 'password' });
    navigate('/');
  };

  const handleGoogle = () => {
    setStatus('Redirecting to Google...');
    const authBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    // Check backend health before redirecting so user gets clear feedback
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    fetch(`${authBase}/api/health`, { signal: controller.signal }).then((r) => {
      clearTimeout(timeout);
      if (r.ok) {
        window.location.href = `${authBase}/auth/google/login`;
      } else {
        setStatus('Unable to reach authentication server.');
        setError('Google sign-in requires the backend to be running. Start the backend or set VITE_API_URL to a reachable backend.');
      }
    }).catch(() => {
      clearTimeout(timeout);
      setStatus('Unable to reach authentication server.');
      setError('Google sign-in requires the backend to be running. Start the backend or set VITE_API_URL to a reachable backend.');
    });
  };

  return (
    <div className="login-shell">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="login-card">
        <div className="login-brand">
          <div className="brand-mark">VA</div>
          <div>
            <p className="eyebrow">Welcome back</p>
            <h1>Sign in to VisionAssist</h1>
          </div>
        </div>

        <p className="login-description">Access camera assistance, object detection, OCR, and scene description with a secure sign-in experience.</p>

        <button className="google-btn" type="button" onClick={handleGoogle}>
          <LogIn size={18} /> Continue with Google
        </button>

        <div className="divider">or sign in with email</div>
        {status && <p className="helper-text">{status}</p>}
        <form className="login-form" onSubmit={submitForm}>
          <label>
            <span>Email</span>
            <div className="input-icon">
              <User size={18} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </label>
          <label>
            <span>Password</span>
            <div className="input-icon">
              <Lock size={18} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
            </div>
          </label>
          {error && <p className="error-message">{error}</p>}
          <button className="primary-btn full-width" type="submit">Sign in</button>
        </form>
      </motion.div>
    </div>
  );
}

export default Login;
