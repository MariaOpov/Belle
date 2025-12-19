import { useState } from 'react';
import './Auth.css';

const BASE_URL = 'http://localhost:5000/api/auth';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/login' : '/register';
    
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Có lỗi xảy ra');
      }

      if (isLogin) {
        // Đăng nhập thành công -> Gọi hàm onLogin ở App.jsx để lưu token
        onLogin(data.token, data.username);
      } else {
        // Đăng ký thành công -> Tự động chuyển sang form đăng nhập
        alert('Đăng ký thành công! Hãy đăng nhập.');
        setIsLogin(true);
        setPassword('');
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <img src="/belle.png" alt="Logo" style={{width: 80, height: 80, borderRadius: '50%', border: '3px solid #007bff', marginBottom: 20}} />
        <div className="auth-title">{isLogin ? 'Welcome Back' : 'Join the Proxies'}</div>
        <div className="auth-subtitle">{isLogin ? 'Login to access Belle AI' : 'Create an account to start chatting'}</div>

        {error && <div className="error-msg">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <input 
            className="auth-input" 
            type="text" 
            placeholder="Username" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required 
          />
          <input 
            className="auth-input" 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          <button className="auth-btn" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <span className="auth-link" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Register' : 'Login'}
          </span>
        </div>
      </div>
    </div>
  );
}