import { useState, useEffect } from 'react';
import './Settings.css';

const BASE_URL = 'http://localhost:5000/api';

export default function ProfileModal({ isOpen, onClose, token, onUpdateUser }) {
  const [profile, setProfile] = useState({ displayName: '', avatar: '' });
  const [stats, setStats] = useState({ messageCount: 0, conversationCount: 0 });
  const [username, setUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Tải dữ liệu khi mở Modal
  useEffect(() => {
    if (isOpen && token) {
      fetch(`${BASE_URL}/user/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          setProfile(data.profile);
          setStats(data.stats);
          setUsername(data.username);
        });
    }
  }, [isOpen, token]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(profile)
      });
      const data = await res.json();
      onUpdateUser(data.profile); // Cập nhật lại App cha
      onClose();
      alert("Cập nhật Profile thành công!");
    } catch (err) { alert("Lỗi lưu profile"); } 
    finally { setIsSaving(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-box" onClick={e => e.stopPropagation()} style={{textAlign: 'center'}}>
        <div className="settings-header">
          <div className="settings-title">Proxy Profile</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* AVATAR PREVIEW */}
        <img 
          src={profile.avatar || '/default.png'} 
          alt="Avatar" 
          style={{width: 100, height: 100, borderRadius: '50%', border: '3px solid #007bff', objectFit: 'cover', marginBottom: 15}}
          onError={(e) => e.target.src = '/default.png'} // Fallback nếu link ảnh lỗi
        />
        
        <h3 style={{margin: '0 0 5px 0', color: '#fff'}}>{profile.displayName || username}</h3>
        <div style={{color: '#888', fontSize: '0.9rem', marginBottom: 20}}>@{username}</div>

        {/* STATS CARD */}
        <div style={{display: 'flex', gap: 10, marginBottom: 20}}>
          <div style={{flex: 1, background: '#111', padding: 10, borderRadius: 12, border: '1px solid #333'}}>
            <div style={{color: '#007bff', fontSize: '1.5rem', fontWeight: 'bold'}}>{stats.messageCount}</div>
            <div style={{fontSize: '0.8rem', color: '#aaa'}}>Messages Sent</div>
          </div>
          <div style={{flex: 1, background: '#111', padding: 10, borderRadius: 12, border: '1px solid #333'}}>
            <div style={{color: '#2ecc71', fontSize: '1.5rem', fontWeight: 'bold'}}>{stats.conversationCount}</div>
            <div style={{fontSize: '0.8rem', color: '#aaa'}}>Conversations</div>
          </div>
        </div>

        {/* FORM EDIT */}
        <div className="setting-item" style={{textAlign: 'left'}}>
          <label className="setting-label">Display Name</label>
          <input type="text" className="setting-input" value={profile.displayName || ''} onChange={e => setProfile({...profile, displayName: e.target.value})} />
        </div>

        <div className="setting-item" style={{textAlign: 'left'}}>
          <label className="setting-label">Avatar URL</label>
          <input type="text" className="setting-input" placeholder="https://..." value={profile.avatar || ''} onChange={e => setProfile({...profile, avatar: e.target.value})} />
        </div>

        <button className="save-settings-btn" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Update Profile'}
        </button>
      </div>
    </div>
  );
}