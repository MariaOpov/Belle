// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    settings: {
        typewriterSpeed: { type: Number, default: 30 }, 
        enableSound: { type: Boolean, default: true },  
        backgroundImage: { type: String, default: '' }, 
        aiTemperature: { type: Number, default: 0.7 }   
    },
    
    profile: {
        displayName: { type: String, default: '' }, 
        avatar: { type: String, default: '' }       
    }
});

module.exports = mongoose.model('User', userSchema);