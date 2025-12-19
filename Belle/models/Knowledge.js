// models/Knowledge.js
const mongoose = require('mongoose');

const KnowledgeSchema = new mongoose.Schema({
    content: { type: String, required: true }, 
    embedding: { type: [Number], required: true } 
});

module.exports = mongoose.model('Knowledge', KnowledgeSchema);