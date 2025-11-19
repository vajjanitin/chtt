// server/models/Room.js
const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true },           // internal unique name
  displayName: { type: String },                    // friendly display name
  isDM: { type: Boolean, default: false },          // is this a one-to-one DM?
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // room creator
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // invited user ids
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', RoomSchema);
