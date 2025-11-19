// client/src/components/JoinRoomDialog.js
import React, { useState } from 'react';
import { getSocket } from '../socket';

export default function JoinRoomDialog({ user, onJoined, onClose }) {
  const [roomNameOrId, setRoomNameOrId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleJoinRoom(e) {
    e.preventDefault();
    if (!roomNameOrId.trim()) return;
    
    setLoading(true);
    setError(null);
    
    const socket = getSocket();
    if (!socket) {
      setError('Socket not connected');
      setLoading(false);
      return;
    }

    console.log(`[JoinRoomDialog] Emitting join-room for: ${roomNameOrId}`);
    
    // Emit join-room and wait for response
    socket.emit('join-room', roomNameOrId.trim());
    
    // Set up one-time listeners for join-room response
    const handleJoinedRoom = ({ room, success }) => {
      console.log(`[JoinRoomDialog] Received joined-room: ${room}, success: ${success}`);
      if (success) {
        setRoomNameOrId('');
        setLoading(false);
        if (onJoined) onJoined({ name: room });
        onClose();
      }
      cleanup();
    };

    const handleRoomError = ({ code, message }) => {
      console.error(`[JoinRoomDialog] Room error (${code}): ${message}`);
      let displayMsg = message;
      if (code === 'NOT_INVITED') {
        displayMsg = '❌ You are not invited to this room. Ask the creator to invite you.';
      } else if (code === 'ROOM_NOT_FOUND') {
        displayMsg = '❌ Room not found. Check the room name or ID.';
      }
      setError(displayMsg);
      setLoading(false);
      cleanup();
    };

    const cleanup = () => {
      socket.off('joined-room', handleJoinedRoom);
      socket.off('room-error', handleRoomError);
    };

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      setError('Join request timed out. Try again.');
      setLoading(false);
      cleanup();
    }, 5000);

    socket.once('joined-room', handleJoinedRoom);
    socket.once('room-error', (payload) => {
      clearTimeout(timeout);
      handleRoomError(payload);
    });
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 24,
        maxWidth: 400,
        width: '90%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        <h2 style={{ marginTop: 0 }}>Join a Room</h2>
        
        <form onSubmit={handleJoinRoom}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#1f2937' }}>
              Room Name or ID
            </label>
            <input
              type="text"
              value={roomNameOrId}
              onChange={e => setRoomNameOrId(e.target.value)}
              placeholder="e.g., team-alpha or 507f1f77bcf86cd799439011"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'auto'
              }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 12,
              padding: 12,
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: 6,
              color: '#991b1b',
              fontSize: 13
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={loading || !roomNameOrId.trim()}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: loading || !roomNameOrId.trim() ? '#d1d5db' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: loading || !roomNameOrId.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 14
              }}
            >
              {loading ? '⏳ Joining...' : '➜ Join'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: '#f3f4f6',
                color: '#1f2937',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 14,
                opacity: loading ? 0.6 : 1
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
