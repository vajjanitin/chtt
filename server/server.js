// server/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const roomsRoutes = require('./routes/rooms');
const Message = require('./models/Message');
const User = require('./models/User');
const Room = require('./models/Rooms');

const app = express();
app.use(cors());
app.use(express.json());

// create HTTP server + socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // restrict in production
});

// mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/rooms', roomsRoutes(io)); // Pass io instance to routes

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mern-chat';
mongoose.connect(MONGO_URI, { autoIndex: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// presence bookkeeping (dedup by userId)
const onlineByUserId = new Map();   // userId -> { userId, username, displayName, count }
const socketToUserId = new Map();   // socketId -> userId

// socket auth: require valid token
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error: token required'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload; // { id, username, name? }
    return next();
  } catch (err) {
    return next(new Error('Authentication error: invalid token'));
  }
});

io.on('connection', async (socket) => {
  try {
    const userId = String(socket.user?.id);
    const username = socket.user?.username || 'unknown';

    // compute displayName: prefer token name, then DB name, then friendly email part
    let displayName = socket.user?.name || null;
    if (!displayName && userId) {
      try {
        const dbUser = await User.findById(userId).select('name username').lean();
        if (dbUser) displayName = dbUser.name || dbUser.username;
      } catch (err) {
        // ignore DB errors for displayName fallback
      }
    }
    if (!displayName && username) {
      const part = String(username).split('@')[0] || username;
      displayName = part.replace(/[.\-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // map socket -> user and maintain counts
    socketToUserId.set(socket.id, userId);
    const existing = onlineByUserId.get(userId);
    if (existing) {
      existing.count += 1;
      // make sure displayName is present
      existing.displayName = existing.displayName || displayName;
    } else {
      onlineByUserId.set(userId, { userId, username, displayName, count: 1 });
    }

    // emit deduplicated online list with displayName
    io.emit('online-users', Array.from(onlineByUserId.values()).map(u => ({ userId: u.userId, username: u.username, displayName: u.displayName })));

    // join default room
    socket.join('global');

    console.log(`Socket connected: ${socket.id} (user: ${displayName})`);

    // join a room (name passed from client)
    socket.on('join-room', async (roomName) => {
      try {
        if (!roomName) {
          socket.emit('room-error', { code: 'INVALID_ROOM', message: 'Room name required' });
          return;
        }

        const uid = String(socket.user?.id);

        // Special handling for global room (no DB check needed)
        if (roomName === 'global') {
          socket.join(roomName);
          socket.emit('joined-room', { room: roomName, success: true });
          console.log(`[join-room] User ${uid} joined global`);
          return;
        }

        // For custom rooms, verify invitation
        const roomDoc = await Room.findOne({ name: roomName });
        if (!roomDoc) {
          console.log(`[join-room] Room ${roomName} not found`);
          socket.emit('room-error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
          return;
        }

        // Check if user is invited (use string comparison)
        const memberIds = roomDoc.members.map(m => String(m));
        const isInvited = memberIds.includes(uid);
        
        if (!isInvited) {
          console.log(`[join-room] User ${uid} NOT_INVITED to ${roomName}. Room members: ${memberIds.join(', ')}`);
          socket.emit('room-error', { code: 'NOT_INVITED', message: 'You are not invited to this room.' });
          return;
        }

        // User is invited, allow join
        socket.join(roomName);
        socket.emit('joined-room', { room: roomName, success: true });
        socket.to(roomName).emit('user-joined', { displayName: displayName, room: roomName });
        console.log(`[join-room] User ${uid} successfully joined ${roomName} (members: ${memberIds.join(', ')})`);
      } catch (err) {
        console.error('[join-room] error', err);
        socket.emit('room-error', { code: 'SERVER_ERROR', message: 'Failed to join room' });
      }
    });

    socket.on('leave-room', (roomName) => {
      try {
        if (!roomName) return;
        socket.leave(roomName);
        const uid = String(socket.user?.id);
        // emit a consistent payload: { userId, displayName, roomName }
        socket.to(roomName).emit('user-left', { userId: uid, displayName: displayName, roomName: roomName });
      } catch (err) {
        console.error('leave-room error', err);
      }
    });

    socket.on('typing', ({ room = 'global', username: typingUser }) => {
      socket.to(room).emit('typing', { username: typingUser || displayName, room });
    });

    // send-message -> verify membership (if room exists), save & broadcast only to room
    socket.on('send-message', async ({ room = 'global', text }) => {
      if (typeof text !== 'string' || !text.trim()) {
        socket.emit('room-error', { message: 'Empty message' });
        return;
      }

      try {
        const uid = String(socket.user?.id);

        // Membership check: only required for non-global custom rooms
        if (room !== 'global') {
          const roomDoc = await Room.findOne({ name: room });
          if (!roomDoc) {
            console.log(`[send-message] Room ${room} not found`);
            socket.emit('room-error', { message: 'Room not found' });
            return;
          }

          const isMember = roomDoc.members.map(String).includes(uid);
          if (!isMember) {
            console.log(`[send-message] User ${uid} NOT in members of ${room}, rejecting send`);
            socket.emit('room-error', { message: 'You are not a member of this room' });
            return;
          }
        }

        // User is member, save and broadcast
        const fromId = socket.user?.id || null;
        const msg = new Message({ from: fromId, to: room, text: text.trim() });
        await msg.save();
        const populated = await msg.populate('from', 'username name');
        // convert mongoose doc -> plain object to avoid serialization oddities
        const payload = (populated && typeof populated.toObject === 'function') ? populated.toObject() : populated;
        payload.to = room;
        console.log(`[send-message] User ${uid} sent to ${room} (socket rooms: ${Array.from(socket.rooms).join(',')})`);
        // If the message is for the global room, broadcast to all connected sockets.
        // For other rooms emit only to sockets that joined that room.
        if (room === 'global') {
          io.emit('new-message', payload);
        } else {
          io.in(room).emit('new-message', payload);
        }
      } catch (err) {
        console.error('send-message error', err);
        socket.emit('room-error', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      const uid = socketToUserId.get(socket.id);
      socketToUserId.delete(socket.id);
      if (uid) {
        const entry = onlineByUserId.get(uid);
        if (entry) {
          entry.count -= 1;
          if (entry.count <= 0) onlineByUserId.delete(uid);
          else onlineByUserId.set(uid, entry);
        }
        io.emit('online-users', Array.from(onlineByUserId.values()).map(u => ({ userId: u.userId, username: u.username, displayName: u.displayName })));
      }
      console.log(`Socket disconnected: ${socket.id} (userId: ${uid})`);
    });

  } catch (err) {
    console.error('Socket connection handler error', err);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
