import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import './App.css';
import Auth from './Auth';
import SettingsModal from './SettingsModal';
import ProfileModal from './ProfileModal'; 
import Live2DAvatar from './Live2DAvatar';

const BASE_URL = 'http://localhost:5000/api';

function App() {
  // --- AUTH & USER ---
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('username'));
  const [userProfile, setUserProfile] = useState({});

  // --- MODALS & UI ---
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [userSettings, setUserSettings] = useState({ typewriterSpeed: 30, enableSound: true, backgroundImage: '', aiTemperature: 0.7 });

  // --- CHAT ---
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const chatWindowRef = useRef(null);
  const textareaRef = useRef(null);
  const typewriterIntervalRef = useRef(null);
  
  // Mặc định bật Live2D
  const [isLive2DMode, setIsLive2DMode] = useState(true);

  // --- AUTH HELPERS ---
  const getHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });

  const handleLoginSuccess = (newToken, newUsername) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setToken(newToken);
    setCurrentUser(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setCurrentUser(null);
    setConversations([]); setMessages([]);
  };

  // --- FETCH DATA ---
  const fetchUserProfile = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/user/profile`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setUserProfile(data.profile);
    } catch (e) {}
  }, [token]);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/user/settings`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUserSettings(prev => ({ ...prev, ...data }));
      }
    } catch (e) {}
  }, [token]);

  const fetchConversations = useCallback(async (isBackground = false) => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/conversations`, { headers: getHeaders() });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json();
      setConversations(data);
      if (!currentChatId && data.length > 0) selectChat(data[0]._id);
      else if (data.length === 0 && !isBackground) createNewChat();
    } catch (e) {}
  }, [token, currentChatId]);

  const fetchMessages = useCallback(async (chatId) => {
    if (!chatId || !token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/conversations/${chatId}/messages`, { headers: getHeaders() });
      const data = await res.json();
      if (data.length > 0) setMessages(data);
      else setMessages([{ sender: 'belle', text: "Hey! New chat. What's on your mind?", avatar: '/belle.png' }]);
    } catch (e) {} finally { setIsLoading(false); }
  }, [token]);

  const selectChat = (chatId) => { setCurrentChatId(chatId); fetchMessages(chatId); setShowMobileMenu(false); };

  const createNewChat = async () => {
    try {
      const res = await fetch(`${BASE_URL}/conversations`, { method: 'POST', headers: getHeaders() });
      const newChat = await res.json();
      setConversations(prev => [newChat, ...prev]);
      setCurrentChatId(newChat._id);
      setMessages([{ sender: 'belle', text: "Hey! New chat.", avatar: '/belle.png' }]);
      setShowMobileMenu(false);
    } catch (e) { alert("Err"); }
  };

  const deleteConversation = async (e, chatId) => {
    e.stopPropagation();
    if (!window.confirm("Delete?")) return;
    try {
      await fetch(`${BASE_URL}/conversations/${chatId}`, { method: 'DELETE', headers: getHeaders() });
      const newList = conversations.filter(c => c._id !== chatId);
      setConversations(newList);
      if (currentChatId === chatId) {
        if (newList.length > 0) selectChat(newList[0]._id);
        else createNewChat();
      }
    } catch (e) {}
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (token) {
      fetchConversations();
      fetchSettings();
      fetchUserProfile();
    }
  }, [token]);

  useEffect(() => { if (chatWindowRef.current) chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight; }, [messages, editingId]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; } }, [input]);

  // --- CHAT LOGIC ---
  const startTypewriter = (fullText) => {
    let i = 0;
    if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);
    const speed = userSettings.typewriterSpeed || 30; 
    typewriterIntervalRef.current = setInterval(() => {
      if (i < fullText.length) {
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          const updatedMsg = { ...lastMsg, text: fullText.substring(0, i + 1) };
          return [...prev.slice(0, -1), updatedMsg];
        });
        i++;
      } else {
        clearInterval(typewriterIntervalRef.current);
        setIsLoading(false);
        if (currentChatId) fetchMessages(currentChatId);
        fetchConversations(true);
      }
    }, speed);
  };

  const resendMessage = async (text) => {
    const userAvatar = userProfile.avatar || '/default.png';
    setMessages(prev => [...prev, { sender: 'user', text: text, avatar: userAvatar }, { sender: 'belle', text: '', avatar: '/belle.png' }]);

    try {
      const res = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userMessage: text, conversationId: currentChatId, aiTemperature: userSettings.aiTemperature })
      });
      if (res.status === 401) { handleLogout(); return; }
      if (!res.body) throw new Error('No body');
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullResponse = "";
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) fullResponse += chunk;
      }
      startTypewriter(fullResponse);
    } catch (error) { console.error(error); startTypewriter("Oops, connection error."); }
  };

  const handleRegenerate = async () => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.sender !== 'belle' || isLoading) return;
    const prevUserMsg = messages[messages.length - 2];
    setIsLoading(true); 
    try {
      if (lastMsg.id) await fetch(`${BASE_URL}/messages/${lastMsg.id}`, { method: 'DELETE', headers: getHeaders() });
      if (prevUserMsg.id) await fetch(`${BASE_URL}/messages/${prevUserMsg.id}`, { method: 'DELETE', headers: getHeaders() });
      setMessages(prev => prev.slice(0, -2));
      await resendMessage(prevUserMsg.text);
    } catch (e) { setIsLoading(false); }
  };

  const handleSubmit = async (e) => { if (e) e.preventDefault(); if (!input.trim() || isLoading || !currentChatId) return; const text = input; setInput(''); setIsLoading(true); await resendMessage(text); };
  const handleDeleteMsg = async (id) => { if (!window.confirm("Delete?")) return; try { await fetch(`${BASE_URL}/messages/${id}`, { method: 'DELETE', headers: getHeaders() }); setMessages(prev => prev.filter(msg => msg.id !== id)); } catch (e) {} };
  const saveEdit = async (id) => { try { await fetch(`${BASE_URL}/messages/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ newContent: editText }) }); setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, text: editText } : msg)); setEditingId(null); } catch (e) {} };
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } };

  if (!token) return <Auth onLogin={handleLoginSuccess} />;

  const layoutStyle = userSettings.backgroundImage ? { background: `url('${userSettings.backgroundImage}') no-repeat center center fixed`, backgroundSize: 'cover' } : {};

  return (
    <div className={`app-layout ${isLive2DMode ? 'mode-live2d' : 'mode-standard'}`} style={layoutStyle}>
      
      {showMobileMenu && <div className="mobile-overlay" onClick={() => setShowMobileMenu(false)}></div>}

      {/* SIDEBAR TRÁI */}
      <div className={`sidebar sidebar-left ${showMobileMenu ? 'open' : ''}`}>
        <div className="sidebar-title">Navigation</div>
        <div onClick={() => setShowProfile(true)} style={{marginBottom: 10, padding: 10, background: '#333', borderRadius: 10, color: 'white', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10}}>
          <img src={userProfile.avatar || '/default.png'} style={{width: 30, height: 30, borderRadius: '50%', objectFit: 'cover'}} onError={(e) => e.target.src = '/default.png'} />
          <div style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
            {userProfile.displayName || currentUser}
          </div>
        </div>

        <div className="sidebar-item" style={{justifyContent: 'center', background: '#007bff', color: 'white', marginBottom: '10px'}} onClick={createNewChat}>+ New Chat</div>
        <div className="sidebar-item" onClick={() => setIsLive2DMode(!isLive2DMode)} style={{background: isLive2DMode ? 'rgba(46, 204, 113, 0.2)' : 'transparent', color: isLive2DMode ? '#2ecc71' : '#aaa', border: isLive2DMode ? '1px solid #2ecc71' : '1px solid transparent'}}>
          {isLive2DMode ? '🟢 Live2D Mode' : '⚪ Standard Mode'}
        </div>

        <div style={{flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px'}}>
          {conversations.map(chat => (
            <div key={chat._id} className={`sidebar-item ${currentChatId === chat._id ? 'active' : ''}`} onClick={() => selectChat(chat._id)} style={{justifyContent: 'space-between'}}>
              <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{chat.title}</span>
              <span onClick={(e) => deleteConversation(e, chat._id)} style={{fontSize: '0.8rem', opacity: 0.5, padding: '2px 6px'}}>x</span>
            </div>
          ))}
        </div>
        <div className="sidebar-item" onClick={() => setShowSettings(true)}>⚙️ Settings</div>
        <div className="sidebar-item" onClick={handleLogout} style={{marginTop: '10px', borderTop: '1px solid #444', paddingTop: 10, color: '#ff4d4d'}}>Log Out</div>
      </div>

      {/* KHUNG CHAT GIỮA */}
      <div className={`chat-container zzz-theme ${isLive2DMode ? 'mode-immersive' : ''}`}>
        
        {/* 1. BELLE LIVE2D */}
        {isLive2DMode && (
          <div className="live2d-background">
             <Live2DAvatar />
          </div>
        )}

        <div className="chat-header">
          <button className="mobile-menu-btn" onClick={() => setShowMobileMenu(true)}>☰</button>
          <img src="/belle.png" alt="Avatar" className="header-avatar" />
          <span className="header-title">Belle</span>
          <button className="close-button" onClick={() => alert('Closing...')}>X</button>
        </div>

        <div className="chat-window" ref={chatWindowRef}>
          {messages.map((msg, index) => (
            <div key={index} className={`message-row ${msg.sender}`}>
              {msg.sender === 'belle' && <img src={msg.avatar} alt="Ava" className="chat-avatar" />}
              {editingId === msg.id ? (
                <div className="edit-container">
                  <textarea className="edit-textarea" value={editText} onChange={(e) => setEditText(e.target.value)}/>
                  <div className="edit-buttons">
                    <button className="save-btn" onClick={() => saveEdit(msg.id)}>Save</button>
                    <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`chat-message ${msg.sender}`}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {msg.text + (isLoading && index === messages.length - 1 && messages.length > 0 ? '▌' : '')}
                    </ReactMarkdown>
                  </div>
                  {msg.id && !isLoading && (
                    <div className="message-actions">
                      {msg.sender === 'belle' && index === messages.length - 1 && (
                        <button className="action-btn regenerate" onClick={handleRegenerate} title="Regenerate">🔄</button>
                      )}
                      <button className="action-btn edit" onClick={() => {setEditingId(msg.id); setEditText(msg.text);}}>✎</button>
                      <button className="action-btn delete" onClick={() => handleDeleteMsg(msg.id)}>🗑️</button>
                    </div>
                  )}
                </>
              )}
              {msg.sender === 'user' && <img src={msg.avatar} alt="Ava" className="chat-avatar" onError={(e) => e.target.src = '/default.png'} />}
            </div>
          ))}
        </div>
        <form className="chat-input-form" onSubmit={handleSubmit}>
          <textarea ref={textareaRef} placeholder="Message Belle..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={isLoading} style={{ maxHeight: '150px', resize: 'none' }} />
          <button type="submit" disabled={isLoading}>{isLoading ? <div className="spinner"></div> : 'Send'}</button>
        </form>
      </div>

      {/* SIDEBAR PHẢI - LUÔN HIỂN THỊ */}
      <div className="sidebar sidebar-right">
        <div style={{textAlign: 'center'}}>
          <img src="/belle.png" alt="Belle Big" style={{width: '100px', height: '100px', borderRadius: '50%', border: '3px solid #007bff', marginBottom: '10px'}} />
          <div className="sidebar-title" style={{fontSize: '1.5rem'}}>Belle</div>
          <div style={{color: '#aaa'}}>AI Assistant / Random Play / Proxy</div>
        </div>
        <hr style={{borderColor: '#333', width: '100%'}}/>
        <div>
          <div className="sidebar-title">Details</div>
          <p style={{fontSize: '0.9rem', color: '#ccc', lineHeight: '1.6'}}>Belle is a spirited and sharp-witted AI assistant.</p>
        </div>
         <div style={{flexGrow: 1}}></div>
         <div className="sidebar-item" style={{justifyContent: 'center', backgroundColor: '#333'}}>View Profile</div>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} currentSettings={userSettings} onSave={setUserSettings} token={token} />
      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} token={token} onUpdateUser={setUserProfile} />

    </div>
  );
}

export default App;