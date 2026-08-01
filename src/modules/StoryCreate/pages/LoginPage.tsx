import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Shared/Button';
import './LoginPage.css';
import PngIcon from '../components/Shared/PngIcon';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('请填写用户名和密码哦~');
      return;
    }
    setLoading(true);
    try {
      const result = isRegister
        ? await register(username.trim(), password.trim(), displayName.trim() || undefined)
        : await login(username.trim(), password.trim());
      if (result.show_onboarding) {
        sessionStorage.setItem('ai_bole_show_onboarding', 'true');
      } else {
        sessionStorage.removeItem('ai_bole_show_onboarding');
      }
      authLogin(result.token, result.user);
      navigate('/story-create');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('网络出问题了，再试试吧！');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-stars" aria-hidden="true">
        <svg viewBox="0 0 18 18"><polygon points="9,1 10.5,6 16,6 11.5,9.5 13,15 9,11.5 5,15 6.5,9.5 2,6 7.5,6" fill="#FFD166"/></svg>
        <svg viewBox="0 0 14 14"><polygon points="7,1 8,5 12,5 9,8 10,12 7,9 4,12 5,8 2,5 6,5" fill="#FFB3D0"/></svg>
        <svg viewBox="0 0 12 12"><polygon points="6,1 7,4.5 10.5,4.5 7.5,6.5 8.5,10.5 6,8 3.5,10.5 4.5,6.5 1.5,4.5 5,4.5" fill="#CBC4E8"/></svg>
        <svg viewBox="0 0 10 10"><polygon points="5,0 6,3.5 9.5,3.5 6.5,5.5 7.5,9.5 5,7 2.5,9.5 3.5,5.5 .5,3.5 4,3.5" fill="#B8E8DC"/></svg>
      </div>
      <div className="login-card">
        <div className="login-header">
          <span className="login-icon"><PngIcon name="story-book" size={72} /></span>
          
          
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入你的用户名"
              maxLength={20}
            />
          </div>

          {isRegister && (
            <div className="login-field">
              <label>显示名称（可选）</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="让大家怎么称呼你？"
                maxLength={20}
              />
            </div>
          )}

          <div className="login-field">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              maxLength={50}
            />
          </div>

          {error && <p className="login-err">{error}</p>}

          <Button type="submit" variant="primary" size="lg" disabled={loading}>
            {loading ? '请稍候...' : isRegister ? '注册并开始' : '登录'}
          </Button>
        </form>

        <p className="login-toggle">
          {isRegister ? '已经有账号了？' : '还没有账号？'}
          <button onClick={() => { setIsRegister(!isRegister); setError(''); }}>
            {isRegister ? '去登录' : '注册一个'}
          </button>
        </p>
      </div>
    </div>
  );
}
