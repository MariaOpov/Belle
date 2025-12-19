import { useState } from 'react';
import './Settings.css';

const BASE_URL = 'http://localhost:5000/api/user/settings';

export default function SettingsModal({ isOpen, onClose, currentSettings, onSave, token }) {
  // State nội bộ để lưu giá trị khi đang chỉnh
  const [localSettings, setLocalSettings] = useState(currentSettings);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  // Hàm xử lý thay đổi input
  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  // Hàm gọi API lưu settings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(BASE_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(localSettings)
      });
      
      if (!res.ok) throw new Error('Lỗi lưu cài đặt');
      
      const data = await res.json();
      onSave(data.settings); // Cập nhật state ở App.jsx
      onClose(); // Đóng modal
      alert("Đã lưu cài đặt thành công!");
    } catch (error) {
      alert("Không thể lưu cài đặt: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-box" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title">Settings</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* 1. TỐC ĐỘ GÕ (Typewriter Speed) */}
        <div className="setting-item">
          <label className="setting-label">
            Tốc độ gõ phím: {localSettings.typewriterSpeed}ms
          </label>
          <div className="setting-desc">Càng nhỏ gõ càng nhanh (10ms - 100ms).</div>
          <input 
            type="range" className="setting-range"
            min="10" max="100" step="5"
            value={localSettings.typewriterSpeed}
            onChange={e => handleChange('typewriterSpeed', Number(e.target.value))}
          />
        </div>

        {/* 2. ĐỘ SÁNG TẠO (AI Temperature) */}
        <div className="setting-item">
          <label className="setting-label">
            Độ "tưng tửng" (Temperature): {localSettings.aiTemperature}
          </label>
          <div className="setting-desc">0.0: Nghiêm túc, Logic — 1.0: Sáng tạo — 2.0: Điên rồ.</div>
          <input 
            type="range" className="setting-range"
            min="0" max="2" step="0.1"
            value={localSettings.aiTemperature}
            onChange={e => handleChange('aiTemperature', Number(e.target.value))}
          />
        </div>

        {/* 3. HÌNH NỀN (Background Image) */}
        <div className="setting-item">
          <label className="setting-label">Link Hình Nền (URL)</label>
          <input 
            type="text" className="setting-input"
            placeholder="https://example.com/image.jpg"
            value={localSettings.backgroundImage}
            onChange={e => handleChange('backgroundImage', e.target.value)}
          />
        </div>

        <button className="save-settings-btn" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </div>
  );
}