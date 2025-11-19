// server/routes/rooms.js
const express = require('express');
const Room = require('../models/Rooms');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// helper: extract user id from Authorization header token
function getUserIdFromReq(req) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const token = auth.split(' ')[1];
    if (!token) return null;
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.id;
  } catch (e) {
    return null;
  }
}

module.exports = function(io) {
  const router = express.Router();

// GET /api/rooms               -> list rooms for current user
router.get('/', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const rooms = await Room.find({ members: userId }).sort({ createdAt: -1 });
    res.json(rooms);
  } catch (err) {
    console.error('GET /api/rooms error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms              -> create a room (creator-only)
// Request: { name, displayName?, memberEmails: ['user1@test.com', 'user2@test.com'] }
// Returns 400 if any email does not map to existing user
router.post('/', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { name, displayName, memberEmails = [] } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'name required' });

  try {
    // Resolve email addresses to user IDs
    const emailList = Array.isArray(memberEmails) ? memberEmails.map(e => e.trim()) : [];
    let memberIds = [];
    
    if (emailList.length > 0) {
      const users = await User.find({ username: { $in: emailList } }).select('_id username');
      const foundEmails = new Set(users.map(u => u.username));
      
      // Check for missing emails
      const missingEmails = emailList.filter(email => !foundEmails.has(email));
      if (missingEmails.length > 0) {
        console.log(`[POST /rooms] Missing users: ${missingEmails.join(', ')}`);
        return res.status(400).json({ message: `User(s) not found: ${missingEmails.join(', ')}` });
      }
      
      memberIds = users.map(u => String(u._id));
    }
    
    // Always include creator
    const uniqueMembers = Array.from(new Set([...memberIds, String(userId)]));
    
    const room = new Room({
      name: name.trim(),
      displayName: displayName || name.trim(),
      creatorId: userId,
      members: uniqueMembers
    });
    await room.save();
    console.log(`[POST /rooms] Creator ${userId} created "${name}" (id: ${room._id}) with ${uniqueMembers.length} members`);
    res.json(room);
  } catch (err) {
    console.error('POST /api/rooms error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms/dm          -> create or return DM room with otherUserId { otherUserId }
router.post('/dm', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { otherUserId } = req.body;
  if (!otherUserId) return res.status(400).json({ message: 'otherUserId required' });

  try {
    // deterministic dm name so duplicates are avoided
    const members = [String(userId), String(otherUserId)].sort();
    const roomName = `dm:${members.join('_')}`;
    let room = await Room.findOne({ name: roomName, isDM: true });
    if (!room) {
      room = new Room({ name: roomName, displayName: `DM: ${members.join(',')}`, isDM: true, members });
      await room.save();
    }
    res.json(room);
  } catch (err) {
    console.error('POST /api/rooms/dm error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/rooms/:id          -> get room info (members and creator only)
router.get('/:id', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params;
  
  try {
    const room = await Room.findById(id).populate('creatorId', 'username name').populate('members', 'username name');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    // Only members and creator can view
    const memberIds = room.members.map(m => String(m._id || m));
    const creatorId = String(room.creatorId?._id || room.creatorId);
    if (!memberIds.includes(String(userId)) && creatorId !== String(userId)) {
      console.log(`[GET /rooms/:id] User ${userId} access denied to ${id}`);
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    console.log(`[GET /rooms/:id] User ${userId} retrieved room ${id}`);
    res.json(room);
  } catch (err) {
    console.error('GET /api/rooms/:id error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/rooms/:id/present -> list currently connected users in the room
router.get('/:id/present', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params;

  try {
    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const roomName = room.name;

    // fetch sockets in the room using socket.io server instance
    // io.in(roomName).fetchSockets() returns Socket instances (supported in socket.io v3+)
    const sockets = await io.in(roomName).fetchSockets();

    // map sockets to simple user payloads
    const present = sockets.map(s => {
      const u = s.user || {};
      return {
        userId: u.id || null,
        username: u.username || null,
        displayName: u.name || u.username || null,
        socketId: s.id
      };
    });

    res.json(present);
  } catch (err) {
    console.error('GET /api/rooms/:id/present error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/rooms/:id    -> delete a room (creator-only)
// Emits 'room-deleted' to all users in the room
router.delete('/:id', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params;
  
  try {
    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    // Only creator can delete
    if (String(room.creatorId) !== String(userId)) {
      console.log(`[DELETE /rooms/:id] User ${userId} not creator of ${id}, denied`);
      return res.status(403).json({ message: 'Only creator can delete this room' });
    }
    
    const roomName = room.name;
    await Room.findByIdAndDelete(id);
    
    // Emit room-deleted to all clients in this room
    // Payload: { roomId, roomName }
    io.to(roomName).emit('room-deleted', { roomId: id, roomName: roomName });
    console.log(`[DELETE /rooms/:id] Creator ${userId} deleted room ${roomName} (id: ${id})`);
    
    res.json({ message: 'Room deleted' });
  } catch (err) {
    console.error('DELETE /api/rooms/:id error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms/:id/leave -> member leaves room
// Removes user from room.members, emits 'user-left' to the room
router.post('/:id/leave', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params;
  
  try {
    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    // Check if user is a member
    const memberIds = room.members.map(m => String(m));
    if (!memberIds.includes(String(userId))) {
      console.log(`[POST /rooms/:id/leave] User ${userId} not member of ${id}, denied`);
      return res.status(403).json({ message: 'Not a member of this room' });
    }
    
    // Remove user from members
    room.members = room.members.filter(m => String(m) !== String(userId));
    await room.save();
    
    const roomName = room.name;
    
    // Emit user-left to the room (other members will see this)
    // Payload: { userId, roomId, roomName }
    io.to(roomName).emit('user-left', { userId: userId, roomId: id, roomName: roomName });
    console.log(`[POST /rooms/:id/leave] User ${userId} left room ${roomName} (id: ${id})`);
    
    res.json({ message: 'Left room' });
  } catch (err) {
    console.error('POST /api/rooms/:id/leave error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms/:id/invite  -> add members to room (creator-only)
// Request: { memberEmails: ['email1@test.com', 'email2@test.com'] }
router.post('/:id/invite', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params;
  const { memberEmails = [] } = req.body;
  
  try {
    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    // Only creator can invite
    if (String(room.creatorId) !== String(userId)) {
      console.log(`[POST /rooms/:id/invite] User ${userId} not creator of ${id}, denied`);
      return res.status(403).json({ message: 'Only creator can invite members' });
    }
    
    // Resolve emails to user IDs
    const emailList = Array.isArray(memberEmails) ? memberEmails.map(e => e.trim()) : [];
    if (emailList.length === 0) return res.json(room);
    
    const users = await User.find({ username: { $in: emailList } }).select('_id username');
    const foundEmails = new Set(users.map(u => u.username));
    const missingEmails = emailList.filter(email => !foundEmails.has(email));
    
    if (missingEmails.length > 0) {
      return res.status(400).json({ message: `User(s) not found: ${missingEmails.join(', ')}` });
    }
    
    // Add new members (avoid duplicates)
    const newMemberIds = users.map(u => String(u._id));
    const existingMembers = new Set(room.members.map(m => String(m)));
    const toAdd = newMemberIds.filter(id => !existingMembers.has(id));
    
    room.members.push(...toAdd);
    await room.save();
    console.log(`[POST /rooms/:id/invite] Creator ${userId} added ${toAdd.length} members to ${room.name}`);
    res.json(room);
  } catch (err) {
    console.error('POST /api/rooms/:id/invite error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms/:roomId/join -> join a room using room code/id
router.post('/:roomId/join', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { roomId } = req.params;
  
  try {
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    // check if user is already a member
    if (room.members.map(String).includes(String(userId))) {
      return res.json(room); // already a member
    }
    
    // add user to members
    room.members.push(userId);
    await room.save();
    res.json(room);
  } catch (err) {
    console.error('POST /api/rooms/:roomId/join error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms/:id/remove  -> remove members from room (creator-only)
// Request: { memberIds: ['userId1', 'userId2'] } or { memberEmails: ['email1@test.com'] }
router.post('/:id/remove', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params;
  const { memberIds = [], memberEmails = [] } = req.body;
  
  try {
    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    // Only creator can remove members
    if (String(room.creatorId) !== String(userId)) {
      console.log(`[POST /rooms/:id/remove] User ${userId} not creator of ${id}, denied`);
      return res.status(403).json({ message: 'Only creator can remove members' });
    }
    
    let toRemoveIds = memberIds.map(id => String(id));
    
    // If memberEmails provided, resolve first
    if (memberEmails.length > 0) {
      const emailList = memberEmails.map(e => e.trim());
      const users = await User.find({ username: { $in: emailList } }).select('_id');
      toRemoveIds = users.map(u => String(u._id));
    }
    
    if (toRemoveIds.length === 0) return res.json(room);
    
    // Remove members
    const toRemoveSet = new Set(toRemoveIds);
    room.members = room.members.filter(m => !toRemoveSet.has(String(m)));
    await room.save();
    console.log(`[POST /rooms/:id/remove] Creator ${userId} removed ${toRemoveIds.length} members from ${room.name}`);
    res.json(room);
  } catch (err) {
    console.error('POST /api/rooms/:id/remove error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/rooms/public/search -> search for available rooms by code or name
router.get('/public/search', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { code } = req.query;
  
  try {
    if (!code || code.length < 3) {
      return res.json([]);
    }
    
    // search by room id or display name
    const rooms = await Room.find({
      $and: [
        { members: { $ne: userId } }, // not already a member
        {
          $or: [
            { _id: code }, // search by id
            { displayName: { $regex: code, $options: 'i' } } // search by name
          ]
        }
      ]
    }).limit(10);
    
    res.json(rooms);
  } catch (err) {
    console.error('GET /api/rooms/public/search error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

  return router;
};
