const mongoose = require('mongoose');


const MessageSchema = new mongoose.Schema({
from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
to: { type: String, default: 'global' }, // allow for rooms or direct IDs
text: String,
createdAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('Message', MessageSchema);