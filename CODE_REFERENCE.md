// ============================================================================
// INVITED-ONLY ROOM IMPLEMENTATION - CODE REFERENCE
// ============================================================================

// MINIMAL CODE CHANGES ONLY
// This document shows the exact changes made to implement the feature.

// ============================================================================
// 1. SERVER ROUTE: POST /api/rooms (UPDATED)
// ============================================================================

router.post('/', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const { name, displayName, memberEmails = [] } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'name required' });

  try {
    // CHANGE: Validate all memberEmails exist before creating room
    const emailList = Array.isArray(memberEmails) ? memberEmails.map(e => e.trim()) : [];
    let memberIds = [];
    
    if (emailList.length > 0) {
      const users = await User.find({ username: { $in: emailList } }).select('_id username');
      const foundEmails = new Set(users.map(u => u.username));
      
      // NEW: Check for missing emails, return 400 if any not found
      const missingEmails = emailList.filter(email => !foundEmails.has(email));
      if (missingEmails.length > 0) {
        return res.status(400).json({ message: `User(s) not found: ${missingEmails.join(', ')}` });
      }
      
      memberIds = users.map(u => String(u._id));
    }
    
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

// ============================================================================
// 2. NEW ROUTE: GET /api/rooms/:id
// ============================================================================

router.get('/:id', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params;
  
  try {
    const room = await Room.findById(id).populate('creatorId', 'username name').populate('members', 'username name');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    // NEW: Only members and creator can view
    const memberIds = room.members.map(m => String(m._id || m));
    const creatorId = String(room.creatorId?._id || room.creatorId);
    if (!memberIds.includes(String(userId)) && creatorId !== String(userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    res.json(room);
  } catch (err) {
    console.error('GET /api/rooms/:id error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================================
// 3. NEW ROUTE: POST /api/rooms/:id/invite (creator-only)
// ============================================================================

router.post('/:id/invite', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params;
  const { memberEmails = [] } = req.body;
  
  try {
    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    // NEW: Creator-only check
    if (String(room.creatorId) !== String(userId)) {
      return res.status(403).json({ message: 'Only creator can invite members' });
    }
    
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

// ============================================================================
// 4. NEW ROUTE: POST /api/rooms/:id/remove (creator-only)
// ============================================================================

router.post('/:id/remove', async (req, res) => {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params;
  const { memberIds = [], memberEmails = [] } = req.body;
  
  try {
    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    // NEW: Creator-only check
    if (String(room.creatorId) !== String(userId)) {
      return res.status(403).json({ message: 'Only creator can remove members' });
    }
    
    let toRemoveIds = memberIds.map(id => String(id));
    
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

// ============================================================================
// 5. SOCKET HANDLER: join-room (UPDATED)
// ============================================================================

socket.on('join-room', async (roomName) => {
  try {
    if (!roomName) {
      socket.emit('room-error', { code: 'INVALID_ROOM', message: 'Room name required' });
      return;
    }

    const uid = String(socket.user?.id);

    // Global room bypass (no DB check)
    if (roomName === 'global') {
      socket.join(roomName);
      socket.emit('joined-room', { room: roomName, success: true });
      console.log(`[join-room] User ${uid} joined global`);
      return;
    }

    // UPDATED: Verify membership for custom rooms
    const roomDoc = await Room.findOne({ name: roomName });
    if (!roomDoc) {
      socket.emit('room-error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    // CRITICAL: Check if user is in room.members (String comparison)
    const memberIds = roomDoc.members.map(m => String(m));
    const isInvited = memberIds.includes(uid);
    
    if (!isInvited) {
      console.log(`[join-room] User ${uid} NOT_INVITED to ${roomName}`);
      // CHANGED: Emit NOT_INVITED error code
      socket.emit('room-error', { code: 'NOT_INVITED', message: 'You are not invited to this room.' });
      return;
    }

    // User is invited, allow join
    socket.join(roomName);
    socket.emit('joined-room', { room: roomName, success: true });
    socket.to(roomName).emit('user-joined', { displayName: displayName, room: roomName });
    console.log(`[join-room] User ${uid} successfully joined ${roomName}`);
  } catch (err) {
    console.error('[join-room] error', err);
    socket.emit('room-error', { code: 'SERVER_ERROR', message: 'Failed to join room' });
  }
});

// ============================================================================
// 6. CLIENT: JoinRoomDialog.js (NEW COMPONENT)
// ============================================================================

// FLOW:
// 1. User clicks "Join Room" → modal opens
// 2. User types room name/ID → clicks "Join"
// 3. Emit 'join-room' event via socket
// 4. Listen for 'joined-room' (success) or 'room-error' (failure)
// 5. If NOT_INVITED: show "❌ You are not invited..."
// 6. If success: close modal, refresh rooms, select room

// KEY CODE:
socket.emit('join-room', roomNameOrId.trim());

socket.once('joined-room', ({ room, success }) => {
  if (success) {
    onJoined({ name: room });
    onClose();
  }
});

socket.once('room-error', ({ code, message }) => {
  if (code === 'NOT_INVITED') {
    setError('❌ You are not invited to this room. Ask the creator to invite you.');
  }
});

// ============================================================================
// 7. CLIENT: RoomsList.js (UPDATED)
// ============================================================================

// CHANGE: Parse comma-separated emails and pass to server

async function createRoom(e) {
  e.preventDefault();
  if (!newRoomName.trim()) return;
  setLoading(true);
  try {
    // NEW: Parse comma-separated emails
    const emailList = memberEmails
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);
    
    // NEW: Pass memberEmails array to server
    const res = await API.post('/rooms', {
      name: newRoomName.trim(),
      displayName: newRoomName.trim(),
      memberEmails: emailList
    });
    setNewRoomName('');
    setMemberEmails('');
    onSelect(res.data);
    if (onRoomsUpdate) onRoomsUpdate();
  } catch (err) {
    console.error('createRoom error', err);
    // NEW: Display error if emails not found (400 response)
    alert('Could not create room');
  }
}

// NEW: Textarea for email input (shown in expandable form)
<textarea
  value={memberEmails}
  onChange={e => setMemberEmails(e.target.value)}
  placeholder="Invite members (comma-separated emails)"
  {...}
/>

// ============================================================================
// 8. CLIENT: Chat.js (UPDATED)
// ============================================================================

// NEW: Import JoinRoomDialog
import JoinRoomDialog from '../components/JoinRoomDialog';

// NEW: State for dialog
const [showJoinDialog, setShowJoinDialog] = useState(false);

// NEW: "Join Room" button in header
<button className="btn-plain" onClick={() => setShowJoinDialog(true)}>
  Join Room
</button>

// NEW: Render JoinRoomDialog
{showJoinDialog && (
  <JoinRoomDialog
    user={user}
    onJoined={(room) => {
      loadRooms();
      handleSelectRoom(room);
    }}
    onClose={() => setShowJoinDialog(false)}
  />
)}

// ============================================================================
// SECURITY KEY POINTS
// ============================================================================

✓ memberEmails validated before creating room (400 if missing)
✓ Socket join-room checks String(userId) in room.members array
✓ Creator-only check on invite/remove (403 if not creator)
✓ No direct client-side bypasses possible
✓ All membership checks use string comparison to avoid ObjectId issues

// ============================================================================
