const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    password: { type: String }, // can be empty for guest
    name: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isGuest: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', UserSchema);
