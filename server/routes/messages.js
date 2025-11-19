// server/routes/messages.js
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// GET messages for a room by room name (room is a URL param)
router.get('/:room', async (req, res) => {
  const room = req.params.room;
  const limit = parseInt(req.query.limit || '100', 10);
  try {
    const messages = await Message.find({ to: room })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('from', 'username name');
    res.json(messages.reverse());
  } catch (err) {
    console.error('GET /api/messages/:room error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
