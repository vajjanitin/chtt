// server/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // email used as login
  passwordHash: { type: String, required: true },
  name: { type: String }, // friendly display name (optional)
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
