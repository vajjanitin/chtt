import React, { useState } from 'react';
import API from '../api';

export default function RoomSettings({ room, onClose, onRoomJoined }) {
  const [joinCode, setJoinCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundRooms, setFoundRooms] = useState([]);
  const [tab, setTab] = useState('join'); // 'join' or 'info'
  const [roomDetails, setRoomDetails] = useState(room || null);
  const [presentMembers, setPresentMembers] = useState([]);

  async function handleSearchRoom(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setSearching(true);
    try {
      const res = await API.get('/rooms/public/search', { params: { code: joinCode.trim() } });
      setFoundRooms(res.data || []);
    } catch (err) {
      console.error('Search error', err);
      alert('Failed to search rooms');
    } finally {
      setSearching(false);
    }
  }

  async function handleJoinRoom(roomId) {
    try {
      const res = await API.post(`/rooms/${roomId}/join`);
      alert('Joined room successfully!');
      setJoinCode('');
      setFoundRooms([]);
      if (onRoomJoined) onRoomJoined(res.data);
    } catch (err) {
      console.error('Join error', err);
      alert('Could not join room');
    }
  }

  // When switching to Info tab, fetch room details and present members if we have a room id
  React.useEffect(() => {
    if (tab !== 'info') return;
    let mounted = true;
    async function load() {
      try {
        if (room && room._id) {
          const res = await API.get(`/rooms/${room._id}`);
          if (!mounted) return;
          setRoomDetails(res.data || room);
          // fetch present members
          try {
            const pres = await API.get(`/rooms/${room._id}/present`);
            if (!mounted) return;
            setPresentMembers(pres.data || []);
          } catch (e) {
            // ignore present fetch errors
            console.warn('Could not fetch present members', e);
            setPresentMembers([]);
          }
        } else if (room) {
          // if no _id (e.g., global), just set roomDetails to provided prop
          setRoomDetails(room);
          setPresentMembers([]);
        }
      } catch (err) {
        console.error('Failed to load room info', err);
        setRoomDetails(room || null);
      }
    }
    load();
    return () => { mounted = false; };
  }, [tab, room]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        maxWidth: 500,
        width: '90%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Room Options</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: '#999'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setTab('join')}
            style={{
              flex: 1,
              padding: 10,
              background: tab === 'join' ? '#2563eb' : '#f3f4f6',
              color: tab === 'join' ? '#fff' : '#000',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Join Room
          </button>
          <button
            onClick={() => setTab('info')}
            style={{
              flex: 1,
              padding: 10,
              background: tab === 'info' ? '#2563eb' : '#f3f4f6',
              color: tab === 'info' ? '#fff' : '#000',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Room Info
          </button>
        </div>

        {/* Join Tab */}
        {tab === 'join' && (
          <div>
            <p style={{ color: '#666', marginBottom: 12 }}>
              Search for a room by name or enter its ID to join:
            </p>
            <form onSubmit={handleSearchRoom} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Room name or ID"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
              <button
                type="submit"
                disabled={searching}
                style={{
                  padding: '10px 16px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {searching ? '...' : 'Search'}
              </button>
            </form>

            {/* Found Rooms */}
            {foundRooms.length > 0 && (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                  Found {foundRooms.length} room(s):
                </p>
                {foundRooms.map(r => (
                  <div
                    key={r._id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      marginBottom: 8
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{r.displayName || r.name}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>ID: {r._id}</div>
                    </div>
                    <button
                      onClick={() => handleJoinRoom(r._id)}
                      style={{
                        padding: '6px 12px',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600
                      }}
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info Tab */}
        {tab === 'info' && (
          <div>
            {roomDetails ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Room Name:</label>
                  <div style={{ fontSize: 14, fontWeight: 600, padding: '8px 0' }}>
                    {roomDetails.displayName || roomDetails.name || (room && (room.displayName || room.name))}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Room ID (Share this to invite):</label>
                  <div style={{
                    fontSize: 12,
                    padding: 10,
                    background: '#f3f4f6',
                    borderRadius: 6,
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    cursor: 'pointer',
                    userSelect: 'all'
                  }}>
                    {roomDetails._id || room?._id || ''}
                  </div>
                  { (roomDetails._id || room?._id) && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(roomDetails._id || room._id);
                        alert('Room ID copied to clipboard!');
                      }}
                      style={{
                        marginTop: 8,
                        padding: '6px 12px',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600
                      }}
                    >
                      Copy to Clipboard
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Members (invited):</label>
                  <div style={{ fontSize: 12, padding: '8px 0' }}>
                    {Array.isArray(roomDetails.members) ? `${roomDetails.members.length} member(s)` : 'Loading...'}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Members Present Now:</label>
                  <div style={{ fontSize: 12, padding: '8px 0' }}>
                    {presentMembers.length === 0 ? (
                      <div style={{ color: '#6b7280' }}>No users currently present in this room</div>
                    ) : (
                      <div>
                        {presentMembers.map(p => (
                          <div key={p.socketId} style={{ padding: '6px 0' }}>
                            <strong>{p.displayName || p.username}</strong>
                            <div style={{ fontSize: 11, color: '#666' }}>{p.username}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div>Loading room info...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
