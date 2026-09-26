import { useEffect, useRef, useState } from 'react';
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

  const googleHandled = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const success = params.get('success');
    const name = params.get('name');
    const oauthError = params.get('error');

    // Google login successful
    if (success === '1' && name && !googleHandled.current) {
      googleHandled.current = true;

      const user = {
        name: name,
        method: 'google',
      };

      // Send Google user information to App.jsx
      if (onGoogleLogin) {
        onGoogleLogin(user);
      }

      // Go directly to the dashboard
      navigate('/dashboard', { replace: true });

      return;
    }

    // Handle Google authentication errors
    if (oauthError) {
      if (oauthError === 'oauth_not_configured') {
        setError(
          'Google sign-in is not configured on the backend.'
        );
      } else if (oauthError === 'missing_code') {
        setError(
          'Authentication failed: missing authorization code.'
        );
      } else if (oauthError === 'token_exchange_failed') {
        setError(
          'Authentication failed while connecting to Google.'
        );
      } else if (oauthError === 'no_access_token') {
        setError(
          'Authentication failed: Google did not return an access token.'
        );
      } else if (oauthError === 'fetch_user_failed') {
        setError(
          'Authentication failed while getting your Google account details.'
        );
      } else {
        setError('Google authentication failed.');
      }
    }
  }, [location.search, navigate, onGoogleLogin]);

  const submitForm = (event) => {
    event.preventDefault();

    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    const user = {
      name: email.split('@')[0] || 'User',
      method: 'password',
    };

    if (onLogin) {
      onLogin(user);
    }

    navigate('/dashboard', { replace: true });
  };

  const handleGoogle = () => {
    setError('');
    setStatus('Redirecting to Google...');

    const authBase =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.DEV
        ? 'http://localhost:8000'
        : window.location.origin);

    // Open Google authentication through the backend
    window.location.href = `${authBase}/auth/google/login`;
  };

  return (
    <div className="login-shell">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="login-card"
      >
        <div className="login-brand">
          <div className="brand-mark">VA</div>

          <div>
            <p className="eyebrow">Welcome back</p>
            <h1>Sign in to VisionAssist</h1>
          </div>
        </div>

        <p className="login-description">
          Access camera assistance, object detection, OCR, and
          scene description with a secure sign-in experience.
        </p>

        <button
          className="google-btn"
          type="button"
          onClick={handleGoogle}
        >
          <LogIn size={18} />
          Continue with Google
        </button>

        <div className="divider">
          or sign in with email
        </div>

        {status && (
          <p className="helper-text">
            {status}
          </p>
        )}

        <form
          className="login-form"
          onSubmit={submitForm}
        >
          <label>
            <span>Email</span>

            <div className="input-icon">
              <User size={18} />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </label>

          <label>
            <span>Password</span>

            <div className="input-icon">
              <Lock size={18} />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          </label>

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}

          <button
            className="primary-btn full-width"
            type="submit"
          >
            Sign in
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default Login;