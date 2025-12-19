require('dotenv').config();
const express = require('express'); // quantrong
const mongoose = require('mongoose'); // quan trong
const cors = require('cors');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');     
const jwt = require('jsonwebtoken');   

// Import Models & Middleware
const ChatMessage = require('./models/chatMessage');
const Conversation = require('./models/conversation'); 
const Knowledge = require('./models/Knowledge');
const User = require('./models/User');  
const auth = require('./middleware/auth'); 

// PROMPT IMPORT
let belleSystemPrompt = ""; 
try {
    belleSystemPrompt = fs.readFileSync(path.join(__dirname, 'belle-prompt.txt'), 'utf-8');
    console.log('System Prompt OK!');
} catch (e) { console.error('Thiếu belle-prompt.txt'); process.exit(1); }

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
app.use(cors());
app.use(express.json());

// PHUONG THUC KET NOI
mongoose.connect(process.env.MONGO_URI)

    .then(() => console.log('MongoDB OK!'))
    .catch(err => console.error('MongoDB Err:', err));// duoc ket noi qua mongoose bang uri da co ben tronog file .env

// ==========================================
// 1. AUTHENTICATION
// ==========================================

// Đăng ký
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Kiểm tra trùng tên
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: 'Tên này đã có người dùng.' });

        // Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();

        res.json({ success: true, message: 'Đăng ký thành công!' });
    } catch (error) { res.status(500).json({ error: 'Lỗi đăng ký' }); }
});

// Đăng nhập
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: 'Sai tên hoặc mật khẩu.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Sai tên hoặc mật khẩu.' });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' }); 
        res.json({ token, username });
    } catch (error) { res.status(500).json({ error: 'Lỗi đăng nhập' }); }
});


// ==========================================
// 2. API CHAT 
// ==========================================

// Lấy danh sách Chat của User đang đăng nhập
app.get('/api/conversations', auth, async (req, res) => {
    try {
        // Chỉ tìm conversation của userId này
        const conversations = await Conversation.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.json(conversations);
    } catch (error) { res.status(500).json({ error: 'Lỗi server' }); }
});

// Tạo Chat mới
app.post('/api/conversations', auth, async (req, res) => {
    try {
        // Gắn userId vào cuộc trò chuyện
        const newConv = new Conversation({ title: 'New Chat', userId: req.user.userId });
        await newConv.save();
        res.json(newConv);
    } catch (error) { res.status(500).json({ error: 'Lỗi tạo chat' }); }
});

// Xóa Chat
app.delete('/api/conversations/:id', auth, async (req, res) => {
    try {
        // Chỉ xóa nếu đúng là của user đó
        const conv = await Conversation.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
        if (conv) await ChatMessage.deleteMany({ conversationId: req.params.id });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Lỗi xóa' }); }
});

// Đổi tên Chat
app.put('/api/conversations/:id', auth, async (req, res) => {
    try {
        const { title } = req.body;
        // Chỉ sửa nếu đúng là của user đó
        const updatedConv = await Conversation.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { title },
            { new: true }
        );
        if (!updatedConv) return res.status(403).json({ error: 'Không có quyền' });
        res.json(updatedConv);
    } catch (error) { res.status(500).json({ error: 'Lỗi đổi tên' }); }
});

// Lấy tin 
// cac endpoint chinh, dung de thao tac voi csdl qua website
app.get('/api/conversations/:id/messages', auth, async (req, res) => {
    try {
        // Kiểm tra quyền sở hữu chat trước khi trả về tin nhắn
        const conv = await Conversation.findOne({ _id: req.params.id, userId: req.user.userId });
        if (!conv) return res.status(403).json({ error: 'Không có quyền truy cập' });

        const messages = await ChatMessage.find({ conversationId: req.params.id }).sort({ createdAt: 'asc' });
        const formatted = messages.map(msg => ({
            id: msg._id, sender: msg.role === 'user' ? 'user' : 'belle', text: msg.content, avatar: msg.role === 'user' ? '/default.png' : '/belle.png'
        }));
        res.json(formatted);
    } catch (error) { res.status(500).json({ error: 'Lỗi tải tin' }); }
});

// API Chat Chính 
app.post('/api/chat', auth, async (req, res) => {
    try {
        const { userMessage, conversationId, aiTemperature = 0.7 } = req.body;
        if (!userMessage || !conversationId) return res.status(400).json({ error: 'Thiếu thông tin.' });

        // Kiểm tra quyền
        const conv = await Conversation.findOne({ _id: conversationId, userId: req.user.userId });
        if (!conv) return res.status(403).json({ error: 'Không có quyền' });

        // Auto-Title
        if (conv.title === 'New Chat') {
            try {
                const titleRes = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "system", content: "Summarize to title (max 5 words)" }, { role: "user", content: userMessage }],
                    max_tokens: 10
                });
                const newTitle = titleRes.choices[0].message.content.replace(/^"|"$/g, '');
                await Conversation.findByIdAndUpdate(conversationId, { title: newTitle });
            } catch (e) {}
        }

        // Lưu tin User
        const userChat = new ChatMessage({ role: 'user', content: userMessage, conversationId });
        await userChat.save();

        // RAG 
        let contextText = "";
        try {
            const embedding = await openai.embeddings.create({ model: "text-embedding-3-small", input: userMessage });
            const results = await Knowledge.aggregate([
                { "$vectorSearch": { "index": "vector_index", "path": "embedding", "queryVector": embedding.data[0].embedding, "numCandidates": 100, "limit": 3 } },
                { "$project": { "_id": 0, "content": 1 } }
            ]);
            if (results.length > 0) contextText = results.map(r => r.content).join("\n---\n");
        } catch (e) { console.error("RAG Error:", e.message); }

        // Prompt
        let finalPrompt = belleSystemPrompt;
        if (contextText) finalPrompt += `\n\n--- KNOWLEDGE ---\n${contextText}\n----------------`;

        // Get Context
        const history = await ChatMessage.find({ conversationId }).sort({ createdAt: -1 }).limit(10);
        const msgs = history.map(m => ({ role: m.role, content: m.content })).reverse();

        // Stream
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const stream = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "system", content: finalPrompt }, ...msgs, { role: "user", content: userMessage }],
            stream: true,
            temperature: Number(aiTemperature)
        });

        let fullRes = "";
        for await (const chunk of stream) {
            const txt = chunk.choices[0]?.delta?.content || "";
            if (txt) { fullRes += txt; res.write(txt); }
        }

        // Save AI Msg
        await new ChatMessage({ role: 'assistant', content: fullRes, conversationId }).save();
        res.end();

    } catch (error) { console.error(error); res.end(); }
});

// CRUD Message 
// DELETE
app.delete('/api/messages/:id', auth, async (req, res) => {
    try { await ChatMessage.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: 'Err' }); }
});

// UPDATE
app.put('/api/messages/:id', auth, async (req, res) => {
    try { await ChatMessage.findByIdAndUpdate(req.params.id, { content: req.body.newContent }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: 'Err' }); }
});

// -----------------------------------------------------------------------------
app.get('/api/user/settings', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User không tồn tại' });
        res.json(user.settings || {});
    } catch (error) {
        res.status(500).json({ error: 'Lỗi lấy cài đặt' });
    }
});

// Cập nhật cài đặt
app.put('/api/user/settings', auth, async (req, res) => {
    try {
        const { typewriterSpeed, enableSound, backgroundImage, aiTemperature } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { 
                $set: { 
                    settings: { 
                        typewriterSpeed, 
                        enableSound, 
                        backgroundImage, 
                        aiTemperature 
                    } 
                } 
            },
            { new: true } 
        );
        
        res.json({ success: true, settings: user.settings });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi lưu cài đặt' });
    }
});

// --- API PROFILE & STATS ---

// Lấy thông tin Profile + Thống kê tin nhắn
app.get('/api/user/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        
        // THỐNG KÊ: Đếm số tin nhắn của User này
        // 1. Tìm tất cả cuộc trò chuyện của user
        const conversations = await Conversation.find({ userId: req.user.userId });
        const conversationIds = conversations.map(c => c._id);
        
        // 2. Đếm tin nhắn 'user' trong các cuộc trò chuyện đó
        const messageCount = await ChatMessage.countDocuments({
            conversationId: { $in: conversationIds },
            role: 'user'
        });

        res.json({
            username: user.username,
            profile: user.profile || {},
            stats: {
                messageCount: messageCount,
                conversationCount: conversations.length
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi lấy profile' });
    }
});

// Cập nhật Profile 
app.put('/api/user/profile', auth, async (req, res) => {
    try {
        const { displayName, avatar } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { $set: { 'profile.displayName': displayName, 'profile.avatar': avatar } },
            { new: true }
        );
        res.json({ success: true, profile: user.profile });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi cập nhật profile' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => { console.log(`Server Auth chạy port ${PORT}`); });