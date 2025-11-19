// client/src/components/RoomsList.js
import React, { useState, useEffect } from 'react';
import API from '../api';

export default function RoomsList({ rooms = [], onSelect, onRoomsUpdate, user = null, currentRoom = null, onRoomDeleted, onRoomLeft }) {
  const [newRoomName, setNewRoomName] = useState('');
  const [memberCount, setMemberCount] = useState('');
  const [memberEmails, setMemberEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRooms, setShowRooms] = useState(true);
  const [expandForm, setExpandForm] = useState(false);
  const [step, setStep] = useState(1); // 1: room name, 2: member count, 3: email inputs
  const [showCreatedRooms, setShowCreatedRooms] = useState(true);
  const [showJoinedRooms, setShowJoinedRooms] = useState(true);
  const [roomsState, setRoomsState] = useState(rooms || []);

  // keep local rooms state in sync with prop updates
  useEffect(() => {
    setRoomsState(rooms || []);
  }, [rooms]);

  // Separate created rooms from joined rooms (use local state for optimistic UI)
  // IMPORTANT: A room must appear in EXACTLY ONE section, never both
  const globalRoom = roomsState.find(r => r.name === 'global') || rooms.find(r => r.name === 'global');
  
  // Normalize current user id (fall back to username if id missing)
  const currentUserKey = user ? (user.id || user.username || null) : null;

  // Helper to get string id for creator or member entries (handles populated objects)
  const idOf = (val) => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return String(val._id || val.id || val);
    return String(val);
  };

  // My Rooms: only rooms where currentUser is the creator
  const createdRooms = (roomsState || []).filter(r => {
    if (!r || r.name === 'global') return false;
    const creator = idOf(r.creatorId);
    if (!creator || !currentUserKey) return false;
    return String(creator) === String(currentUserKey);
  });

  // Joined Rooms: rooms where currentUser is a member BUT NOT the creator
  const joinedRooms = (roomsState || []).filter(r => {
    if (!r || r.name === 'global') return false;
    if (!currentUserKey) return false;

    const memberIds = (r.members || []).map(idOf).filter(Boolean);
    const isMember = memberIds.some(m => String(m) === String(currentUserKey));
    if (!isMember) return false;

    const creator = idOf(r.creatorId);
    if (creator && String(creator) === String(currentUserKey)) return false;

    return true;
  });

  function handleNextStep() {
    if (step === 1 && !newRoomName.trim()) {
      alert('Please enter a room name');
      return;
    }
    if (step === 2 && !memberCount) {
      alert('Please specify member count');
      return;
    }
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      const count = parseInt(memberCount, 10);
      if (count < 0 || isNaN(count)) {
        alert('Please enter a valid number');
        return;
      }
      setMemberEmails(new Array(count).fill(''));
      setStep(3);
    }
  }

  function handleEmailChange(index, value) {
    const updated = [...memberEmails];
    updated[index] = value;
    setMemberEmails(updated);
  }

  async function createRoom(e) {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    
    const emailList = memberEmails
      .map(e => e.trim())
      .filter(e => e.length > 0);
    
    setLoading(true);
    try {
      const res = await API.post('/rooms', {
        name: newRoomName.trim(),
        displayName: newRoomName.trim(),
        memberEmails: emailList
      });
      setNewRoomName('');
      setMemberCount('');
      setMemberEmails([]);
      setStep(1);
      setExpandForm(false);
      
      // Optimistically add the new room to local state so it appears immediately under "My Rooms"
      const newRoom = res.data;
      setRoomsState(prev => [newRoom, ...prev]);
      
      onSelect(res.data);
      // Refresh rooms list from server to ensure sync
      if (onRoomsUpdate) onRoomsUpdate();
    } catch (err) {
      console.error('createRoom error', err);
      alert(err.response?.data?.message || 'Could not create room');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setNewRoomName('');
    setMemberCount('');
    setMemberEmails([]);
    setStep(1);
    setExpandForm(false);
  }

  async function deleteRoom(e, room) {
    e.stopPropagation();
    const name = room.displayName || room.name || room._id;
    if (!window.confirm(`Delete room "${name}"? This cannot be undone.`)) return;
    const previous = roomsState;
    // optimistic remove locally
    setRoomsState(prev => prev.filter(r => String(r._id) !== String(room._id)));
    try {
      await API.delete(`/rooms/${room._id}`);
      // Refresh rooms list async
      if (onRoomsUpdate) onRoomsUpdate();
      if (typeof onRoomDeleted === 'function') onRoomDeleted(room);
    } catch (err) {
      console.error('deleteRoom error', err);
      // revert
      setRoomsState(previous);
      alert(err.response?.data?.message || 'Could not delete room');
    }
  }

  async function leaveRoom(e, room) {
    e.stopPropagation();
    const name = room.displayName || room.name || room._id;
    if (!window.confirm(`Leave room "${name}"?`)) return;
    const previous = roomsState;
    // optimistic remove locally
    setRoomsState(prev => prev.filter(r => String(r._id) !== String(room._id)));
    try {
      console.log(`[RoomsList] Leaving room ${room._id}`);
      await API.post(`/rooms/${room._id}/leave`);
      if (onRoomsUpdate) onRoomsUpdate();
      if (typeof onRoomLeft === 'function') onRoomLeft(room);
    } catch (err) {
      console.error('leaveRoom error', err);
      // revert
      setRoomsState(previous);
      alert(err.response?.data?.message || 'Could not leave room');
    }
  }

  return (
    <div style={{ width: 260, borderRight: '1px solid #eee', paddingRight: 12, paddingLeft: 12 }}>
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>Chat</h3>

      {/* Global Room */}
      {globalRoom && (
        <div
          onClick={() => onSelect(globalRoom)}
          style={{
            padding: 10,
            backgroundColor: '#2563eb',
            color: '#fff',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            marginBottom: 16,
            textAlign: 'center',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
        >
          🌐 Global
        </div>
      )}

      {/* Create Room Form - Multi-step */}
      <form onSubmit={createRoom} style={{ marginBottom: 12 }}>
        {/* Step 1: Room Name + Toggle Button */}
        <div style={{ display: 'flex', gap: 6, marginBottom: expandForm ? 8 : 0 }}>
          <input
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
            placeholder="New room name"
            disabled={expandForm && step > 1}
            style={{
              flex: 1,
              padding: '8px 10px',
              fontSize: 13,
              borderRadius: 4,
              border: '1px solid #d1d5db',
              opacity: expandForm && step > 1 ? 0.6 : 1,
              cursor: expandForm && step > 1 ? 'not-allowed' : 'auto'
            }}
          />
          <button
            disabled={loading}
            type="button"
            onClick={() => setExpandForm(!expandForm)}
            style={{
              padding: '8px 10px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 12
            }}
          >
            {loading ? '...' : '+'}
          </button>
        </div>

        {/* Multi-step form (shown when expanded) */}
        {expandForm && (
          <div style={{ marginBottom: 8, padding: 12, backgroundColor: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
            
            {/* Step 1: Room Name (confirmation) */}
            {step >= 1 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#1f2937', fontSize: 12 }}>
                  Step 1: Room Name
                </label>
                <div style={{ padding: 8, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13, color: '#1f2937' }}>
                  <strong>{newRoomName || '(enter name above)'}</strong>
                </div>
              </div>
            )}

            {/* Step 2: Member Count */}
            {step >= 2 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#1f2937', fontSize: 12 }}>
                  Step 2: How many members? (0 or more)
                </label>
                <input
                  type="number"
                  value={memberCount}
                  onChange={e => setMemberCount(e.target.value)}
                  placeholder="e.g., 2"
                  min="0"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 13,
                    borderRadius: 4,
                    border: '1px solid #d1d5db',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Step 3: Individual Email Inputs */}
            {step >= 3 && memberEmails.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#1f2937', fontSize: 12 }}>
                  Step 3: Add {memberEmails.length} Member{memberEmails.length !== 1 ? 's' : ''} Email
                </label>
                <div style={{ maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                  {memberEmails.map((email, idx) => (
                    <input
                      key={idx}
                      type="email"
                      value={email}
                      onChange={e => handleEmailChange(idx, e.target.value)}
                      placeholder={`Member ${idx + 1} email`}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: '1px solid #d1d5db',
                        marginBottom: idx < memberEmails.length - 1 ? 6 : 0,
                        boxSizing: 'border-box'
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                  Enter {memberEmails.length} email address{memberEmails.length !== 1 ? 'es' : ''}
                </div>
              </div>
            )}

            {/* Step 3 Message (no members) */}
            {step >= 3 && memberEmails.length === 0 && (
              <div style={{ marginBottom: 12, padding: 8, backgroundColor: '#dbeafe', borderRadius: 4, color: '#1e40af', fontSize: 12 }}>
                ℹ️ No members to add (count was 0). Room will be created with just you.
              </div>
            )}

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {step < 3 ? (
                <>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13
                    }}
                  >
                    {step === 1 ? 'Next' : 'Add Members →'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={loading}
                    style={{
                      flex: 0.5,
                      padding: '8px 10px',
                      background: '#f3f4f6',
                      color: '#1f2937',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 12
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={loading}
                    style={{
                      flex: 0.5,
                      padding: '8px 10px',
                      background: '#f3f4f6',
                      color: '#1f2937',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 12
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      background: loading ? '#d1d5db' : '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: 13
                    }}
                  >
                    {loading ? 'Creating...' : '✓ Create Room'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </form>

      {/* My Rooms (Created) Section */}
      <div style={{ marginBottom: 8 }}>
        <button
          onClick={() => setShowCreatedRooms(!showCreatedRooms)}
          style={{
            width: '100%',
            padding: 10,
            background: '#dbeafe',
            border: '1px solid #93c5fd',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#1e40af'
          }}
        >
          <span>👑 My Rooms ({createdRooms.length})</span>
          <span style={{ fontSize: 14 }}>{showCreatedRooms ? '▼' : '▶'}</span>
        </button>
      </div>

      {/* Created Rooms List */}
      {showCreatedRooms && (
        <div style={{ maxHeight: '30vh', overflowY: 'auto', paddingBottom: 12, marginBottom: 12 }}>
          {createdRooms.length === 0 ? (
            <div style={{ padding: 12, color: '#6b7280', fontSize: 13, textAlign: 'center' }}>
              No rooms created yet
            </div>
          ) : (
            createdRooms.map(r => (
              <div
                key={r._id || r.name}
                onClick={() => onSelect(r)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 10,
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 6,
                  marginBottom: 8,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e40af' }}>
                    {r.displayName || r.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 2 }}>
                    {r.members?.length || 0} member{(r.members?.length || 0) !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={(e) => deleteRoom(e, r)}
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 10px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    transition: 'background 0.2s',
                    marginLeft: 8
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
                >
                  ✕ Delete
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Joined Rooms Section */}
      <div style={{ marginBottom: 8 }}>
        <button
          onClick={() => setShowJoinedRooms(!showJoinedRooms)}
          style={{
            width: '100%',
            padding: 10,
            background: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#166534'
          }}
        >
          <span>📁 Joined Rooms ({joinedRooms.length})</span>
          <span style={{ fontSize: 14 }}>{showJoinedRooms ? '▼' : '▶'}</span>
        </button>
      </div>

      {/* Joined Rooms List */}
      {showJoinedRooms && (
        <div style={{ maxHeight: '30vh', overflowY: 'auto', paddingBottom: 12 }}>
          {joinedRooms.length === 0 ? (
            <div style={{ padding: 12, color: '#6b7280', fontSize: 13, textAlign: 'center' }}>
              No joined rooms yet
            </div>
          ) : (
            joinedRooms.map(r => (
              <div
                key={r._id || r.name}
                onClick={() => onSelect(r)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 10,
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 6,
                  marginBottom: 8,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#166534' }}>
                    {r.displayName || r.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#22c55e', marginTop: 2 }}>
                    👤 Joined Room • {r.members?.length || 0} members
                  </div>
                </div>
                {/* Leave button: only show if user is a member AND not the creator */}
                {user && (r.members || []).some(m => String(m) === String(user.id)) && String(r.creatorId) !== String(user.id) && (
                  <button
                    onClick={(e) => leaveRoom(e, r)}
                    style={{
                      background: '#f59e0b',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 10px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                      transition: 'background 0.2s',
                      marginLeft: 8
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#d97706'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#f59e0b'}
                  >
                    📤 Leave
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
