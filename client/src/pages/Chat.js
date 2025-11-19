// client/src/pages/Chat.js
import React, { useEffect, useState } from 'react';
import API from '../api';
import { connectSocket, getSocket } from '../socket';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import RoomsList from '../components/RoomsList';
// RoomSettings removed from header per UX request
import JoinRoomDialog from '../components/JoinRoomDialog';
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              
function formatNameFromEmail(email) {
  if (!email) return 'Anonymous';
  const part = String(email).split('@')[0];
  return part.replace(/[.\-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function Chat({ user, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState({ name: 'global', displayName: 'Global' });
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  const [roomJoined, setRoomJoined] = useState(false);
  const [roomError, setRoomError] = useState(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  // initial load: get rooms and ensure socket connected
  useEffect(() => {
    loadRooms();
    connectSocket(user.token);
  }, [user.token]);

  async function loadRooms() {
    try {
      const res = await API.get('/rooms');
      setRooms(res.data || []);
    } catch (err) {
      console.warn('Could not load rooms', err);
    }
  }

  // when currentRoom changes, load messages and join that room
  useEffect(() => {
    let mounted = true;
    setRoomJoined(false);
    setRoomError(null);

    (async () => {
      const roomName = currentRoom.name || 'global';
      try {
        const res = await API.get(`/messages/${encodeURIComponent(roomName)}`);
        if (mounted) setMessages(res.data || []);
      } catch (err) {
        console.error('Failed to load messages for room', err);
        if (mounted) setMessages([]);
      }

      // Emit join-room and wait for confirmation
      const socket = getSocket();
      if (socket) {
        console.log(`[Client] Attempting to join room: ${roomName}`);
        socket.emit('join-room', roomName);
      }
    })();

    return () => {
      mounted = false;
      const socket = getSocket();
      if (socket) {
        socket.emit('leave-room', currentRoom.name);
      }
    };
  }, [currentRoom.name]);

  // socket event handlers
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (msg) => {
      if (msg.to === (currentRoom.name || 'global')) {
        setMessages(prev => [...prev, msg]);
      }
    };

    const onTyping = ({ username, room }) => {
      if (room === (currentRoom.name || 'global')) {
        setTyping(username);
        setTimeout(() => setTyping(null), 1200);
      }
    };

    const onOnline = (list) => {
      const seen = new Set();
      const unique = [];
      for (const it of list || []) {
        const key = it.userId || it.username;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push({
            userId: it.userId,
            username: it.username,
            displayName: it.displayName || formatNameFromEmail(it.username)
          });
        }
      }
      setOnlineUsers(unique);
    };

    // NEW: Handle room join confirmation
    const onJoinedRoom = ({ room, success }) => {
      console.log(`[Client] Joined room confirmation: ${room}, success: ${success}`);
      if (success) {
        setRoomJoined(true);
        setRoomError(null);
      }
    };

    // NEW: Handle room errors (including NOT_INVITED)
    const onRoomError = ({ code, message }) => {
      console.warn(`[Client] Room error (${code}): ${message}`);
      if (code === 'NOT_INVITED') {
        setRoomError('❌ You are not invited to this room. Ask the creator to invite you.');
      } else {
        setRoomError(message || 'Failed to join room');
      }
      setRoomJoined(false);
    };

    // NEW: Handle room deleted (server emits { roomId, roomName, message })
    const onRoomDeleted = ({ roomId, roomName, message }) => {
      console.log(`[Client] Room deleted: ${roomName} (${roomId})`);
      if (currentRoom.name === roomName) {
        setRoomError(`Room "${roomName}" has been deleted by the owner.`);
        setRoomJoined(false);
        setMessages([]);
        setCurrentRoom({ name: 'global', displayName: 'Global' });
      }
      loadRooms();
    };

    // NEW: Handle user left room (server emits { userId, roomId, roomName, message })
    const onUserLeftRoom = ({ userId, roomId, roomName }) => {
      console.log(`[Client] user-left: ${userId} from ${roomName} (${roomId})`);
      if (roomName === currentRoom.name) {
        // remove user from onlineUsers list
        setOnlineUsers(prev => (prev || []).filter(u => String(u.userId) !== String(userId)));
        // transient feedback
        setRoomError('A user left the room');
        setTimeout(() => setRoomError(null), 2800);
      }
    };

    socket.on('new-message', onNewMessage);
    socket.on('typing', onTyping);
    socket.on('online-users', onOnline);
    socket.on('joined-room', onJoinedRoom);
    socket.on('room-error', onRoomError);
    socket.on('room-deleted', onRoomDeleted);
    socket.on('user-left', onUserLeftRoom);

    return () => {
      socket.off('new-message', onNewMessage);
      socket.off('typing', onTyping);
      socket.off('online-users', onOnline);
      socket.off('joined-room', onJoinedRoom);
      socket.off('room-error', onRoomError);
      socket.off('room-deleted', onRoomDeleted);
      socket.off('user-left', onUserLeftRoom);
    };
  }, [currentRoom.name]);

  async function handleSelectRoom(room) {
    // Preserve the full room object (including _id, members, creatorId) when available
    // Rooms from server typically include `name` and `_id`; synthetic global room may be a simple object.
    const next = room || { name: 'global', displayName: 'Global' };
    // ensure we always have name and displayName fields for UI
    const normalized = {
      ...next,
      name: next.name || next.displayName || 'global',
      displayName: next.displayName || next.name || 'Global'
    };
    setCurrentRoom(normalized);
  }

  async function  handleSend(text) {
    const socket = getSocket();
    if (!socket) {
      alert('Socket not connected');
      return;
    }

    // Global room is always allowed
    if (currentRoom.name === 'global') {
      socket.emit('send-message', { room: currentRoom.name, text });
      return;
    }

    // For custom rooms, verify membership
    if (!roomJoined) {
      alert('Still joining room... please wait or check room access');
      return;
    }

    console.log(`[Client] Sending to ${currentRoom.name}`);
    socket.emit('send-message', { room: currentRoom.name || 'global', text });
  }

  function handleTyping() {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing', { room: currentRoom.name || 'global', username: user.name || user.username });
  }

  return (
    <div style={{ display: 'flex', gap: 16, padding: 16 }}>
      <RoomsList
        rooms={[{ name: 'global', displayName: 'Global' }, ...rooms]}
        onSelect={handleSelectRoom}
        onRoomsUpdate={loadRooms}
        user={user}
        currentRoom={currentRoom}
        onRoomDeleted={(room) => {
          // if current room was deleted, navigate to global and show message
          if ((room.name || room.displayName) === currentRoom.name) {
            setCurrentRoom({ name: 'global', displayName: 'Global' });
            setRoomError(`Room "${room.displayName || room.name}" deleted`);
          }
          // refresh rooms
          loadRooms();
        }}
        onRoomLeft={(room) => {
          // if user left the active room, navigate to global
          if ((room.name || room.displayName) === currentRoom.name) {
            setCurrentRoom({ name: 'global', displayName: 'Global' });
            setRoomError(`You left room "${room.displayName || room.name}"`);
          }
          loadRooms();
        }}
      />

      <div style={{ flex: 1 }}>
        <div className="chat-header">
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {currentRoom.displayName || currentRoom.name}
              {currentRoom.name !== 'global' && (
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: roomJoined ? '#10b981' : '#f59e0b', color: '#fff' }}>
                  {roomJoined ? '✓ Joined' : '⏳ Joining...'}
                </span>
              )}
            </h2>
          </div>
            <div className="user-controls">
            <span>Hello, <strong>{user.name || user.username}</strong></span>
            <button className="btn-plain" onClick={() => setShowJoinDialog(true)}>Join Room</button>
            <button className="btn-plain" onClick={onLogout}>Logout</button>
          </div>
        </div>

        {roomError && (
          <div style={{ padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
            ⚠️ {roomError}
          </div>
        )}

        <div className="online-list">
          <strong>Online:</strong> {onlineUsers.length ? onlineUsers.map(u => u.displayName).join(', ') : 'No one online'}
        </div>

        <MessageList messages={messages} currentUser={user} />

        {typing && <div className="typing-indicator">{typing} is typing...</div>}

        <MessageInput onSend={handleSend} onTyping={handleTyping} disabled={currentRoom.name !== 'global' && !roomJoined} />
      </div>

      {/* RoomSettings removed from header */}

      {showJoinDialog && (
        <JoinRoomDialog
          user={user}
          onJoined={(room) => {
            console.log('[Chat] Room joined:', room);
            loadRooms();
            handleSelectRoom(room);
          }}
          onClose={() => setShowJoinDialog(false)}
        />
      )}
    </div>
  );
}
