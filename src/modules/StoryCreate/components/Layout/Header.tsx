import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Header.css';
export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="app-header">
      <Link to="/story-create" className="header-logo">
        <span className="logo-icon">✦</span>
        <svg className="logo-star logo-star-1" viewBox="0 0 18 18"><polygon points="9,1 10.5,6 16,6 11.5,9.5 13,15 9,11.5 5,15 6.5,9.5 2,6 7.5,6" fill="#FFD166" /></svg>
        <svg className="logo-star logo-star-2" viewBox="0 0 12 12"><polygon points="6,1 7,4.5 10.5,4.5 7.5,6.5 8.5,10.5 6,8 3.5,10.5 4.5,6.5 1.5,4.5 5,4.5" fill="#FFB3D0" /></svg>
        <span className="logo-text">AI 伯乐</span>
      </Link>
      {user && (
        <div className="header-user">
          <span className="header-greeting">{user.display_name || user.username}</span>
          <button className="header-channel" onClick={() => navigate('/story-create/channel')}>{user.age_group === '4-7' ? '4-7岁' : '8-12岁'}</button>
          <button className="header-logout" onClick={() => { logout(); navigate('/story-create/login'); }}>退出</button>
        </div>
      )}
    </header>
  );
}
