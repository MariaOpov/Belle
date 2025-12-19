// ingest.js - File này dùng để "dạy" Belle học từ file text
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const { OpenAI } = require('openai');
const Knowledge = require('./models/Knowledge');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Kết nối DB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Kết nối MongoDB để nạp dữ liệu thành công!'))
    .catch(err => console.error('Lỗi DB:', err));

const ingestData = async () => {
    try {
        // 1. Đọc file knowledge.txt
        console.log('Đang đọc file kiến thức...');
        const text = fs.readFileSync('knowledge.txt', 'utf-8');

        // 2. Chia nhỏ văn bản (Chunking)
        const chunks = text.split('\n\n').filter(chunk => chunk.trim().length > 0);
        console.log(`Tìm thấy ${chunks.length} đoạn kiến thức.`);

        // 3. Xóa kiến thức cũ (để tránh trùng lặp)
        await Knowledge.deleteMany({});
        console.log('Đã xóa kiến thức cũ.');

        // 4. Tạo Vector (Embedding) cho từng đoạn và lưu vào DB
        console.log('Đang "học" (tạo Vector)... Vui lòng chờ.');
        
        for (const chunk of chunks) {
            // Gọi OpenAI để biến chữ thành số (Embedding)
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small", 
                input: chunk,
            });

            const vector = embeddingResponse.data[0].embedding;

            // Lưu vào DB
            await Knowledge.create({
                content: chunk,
                embedding: vector
            });
            process.stdout.write('.'); 
        }

        console.log('\nĐã nạp xong kiến thức vào não Belle!');
        process.exit(0);

    } catch (error) {
        console.error('\nLỗi khi nạp dữ liệu:', error);
        process.exit(1);
    }
};

ingestData();