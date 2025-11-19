/* ============================================================================
   INVITED-ONLY ROOM IMPLEMENTATION SUMMARY
   ============================================================================ */

// ============================================================================
// 1. SERVER ROUTE SIGNATURES (server/routes/rooms.js)
// ============================================================================

/**
 * POST /api/rooms
 * Creator-only room creation with email-based member invitations
 * Body: { name: string, displayName?: string, memberEmails: string[] }
 * Returns 400 if any email does not map to existing user
 * Response: { _id, name, displayName, creatorId, members, createdAt }
 * Console: "[POST /rooms] Creator {userId} created '{name}' (id: {roomId}) with {count} members"
 */

/**
 * GET /api/rooms/:id
 * Get room info (members and creator only)
 * Checks membership and creatorId before responding
 * Response: { _id, name, displayName, creatorId, members, createdAt }
 * Returns 403 if user is not member or creator
 * Console: "[GET /rooms/:id] User {userId} retrieved room {id}"
 */

/**
 * POST /api/rooms/:id/invite
 * Add members to room (creator-only)
 * Body: { memberEmails: string[] }
 * Returns 400 if any email does not map to existing user
 * Returns 403 if user is not creator
 * Response: { _id, name, displayName, creatorId, members, createdAt }
 * Console: "[POST /rooms/:id/invite] Creator {userId} added {count} members to {roomName}"
 */

/**
 * POST /api/rooms/:id/remove
 * Remove members from room (creator-only)
 * Body: { memberIds?: string[], memberEmails?: string[] }
 * Returns 403 if user is not creator
 * Response: { _id, name, displayName, creatorId, members, createdAt }
 * Console: "[POST /rooms/:id/remove] Creator {userId} removed {count} members from {roomName}"
 */

// ============================================================================
// 2. SOCKET HANDLER CHANGES (server/server.js)
// ============================================================================

/**
 * socket.on('join-room', roomName)
 * 
 * Updated logic:
 * 1. If roomName === 'global' → always allow, emit 'joined-room', return
 * 2. Query Room.findOne({ name: roomName })
 * 3. If not found → emit room-error { code: 'ROOM_NOT_FOUND', message: 'Room not found' }
 * 4. Check if user ObjectId is in room.members array (use String(userId) comparison)
 * 5. If NOT in members → emit room-error { code: 'NOT_INVITED', message: 'You are not invited to this room.' }
 * 6. If IN members → socket.join(roomName), emit joined-room, broadcast user-joined to room
 * 
 * Console logs:
 *   - "[join-room] User {uid} joined global"
 *   - "[join-room] Room {roomName} not found"
 *   - "[join-room] User {uid} NOT_INVITED to {roomName}. Room members: {memberIds}"
 *   - "[join-room] User {uid} successfully joined {roomName} (members: {memberIds})"
 */

// ============================================================================
// 3. CLIENT COMPONENT: JoinRoomDialog (client/src/components/JoinRoomDialog.js)
// ============================================================================

/**
 * Flow:
 * 1. User clicks "Join Room" button in Chat header
 * 2. JoinRoomDialog modal opens with text input for room name/id
 * 3. User types room name or ID and clicks "Join"
 * 4. Client emits 'join-room' event with roomNameOrId
 * 5. Listen for 'joined-room' or 'room-error' events (one-time listeners)
 * 
 * On 'joined-room' { room, success }:
 *   - Close modal, refresh rooms list, select the room
 *   - Console: "[JoinRoomDialog] Received joined-room: {room}, success: {success}"
 * 
 * On 'room-error' { code, message }:
 *   - Display user-friendly error message
 *   - If code === 'NOT_INVITED': "❌ You are not invited to this room. Ask the creator to invite you."
 *   - If code === 'ROOM_NOT_FOUND': "❌ Room not found. Check the room name or ID."
 *   - Console: "[JoinRoomDialog] Room error ({code}): {message}"
 * 
 * Timeout: 5 seconds - "Join request timed out. Try again."
 */

// ============================================================================
// 4. CLIENT UPDATES: Chat.js
// ============================================================================

/**
 * Added state:
 *   - showJoinDialog: boolean
 * 
 * Added button in chat header:
 *   - "Join Room" button → sets showJoinDialog = true
 * 
 * At end of render, added:
 *   {showJoinDialog && (
 *     <JoinRoomDialog
 *       user={user}
 *       onJoined={(room) => { loadRooms(); handleSelectRoom(room); }}
 *       onClose={() => setShowJoinDialog(false)}
 *     />
 *   )}
 * 
 * Error handling already implemented:
 *   - Listens for 'room-error' { code, message } events
 *   - Displays NOT_INVITED message if code === 'NOT_INVITED'
 *   - Disables MessageInput if room not yet joined
 */

// ============================================================================
// 5. CLIENT UPDATES: RoomsList.js
// ============================================================================

/**
 * Updated POST /api/rooms call:
 * 
 * Parses comma-separated emails from textarea:
 *   const emailList = memberEmails
 *     .split(',')
 *     .map(e => e.trim())
 *     .filter(e => e.length > 0);
 * 
 * Sends to server:
 *   POST /api/rooms { name, displayName, memberEmails: emailList }
 * 
 * Error handling:
 *   - If server returns 400 with "User(s) not found: {emails}"
 *   - Shows alert and prevents room creation
 * 
 * UI:
 *   - Expandable form: Click "+" button to show textarea for emails
 *   - Textarea placeholder: "Invite members (comma-separated emails)"
 *   - "Create Room" button appears in expanded form
 */

// ============================================================================
// 6. SECURITY & VALIDATION CHECKLIST
// ============================================================================

✓ POST /api/rooms → Validates all memberEmails exist in DB, rejects 400 if missing
✓ POST /api/rooms/:id/invite → Creator-only check before adding members
✓ POST /api/rooms/:id/remove → Creator-only check before removing members
✓ GET /api/rooms/:id → Blocks non-members and non-creators (403)
✓ socket.on('join-room') → Membership check using String(userId) comparison
✓ Client disables MessageInput until room confirmed (roomJoined state)
✓ All ID comparisons use String() to avoid ObjectId vs string mismatches

// ============================================================================
// 7. TESTING CHECKLIST
// ============================================================================

1. ✓ Creator A logs in → creates room "team-alpha" with member emails [B, C]
   - Console shows: "[POST /rooms] Creator A created 'team-alpha' (id: ...) with 3 members"
   - Server responds with room._id, members array, creatorId

2. ✓ User B logs in, clicks "Join Room", types "team-alpha", clicks "Join"
   - Console shows: "[join-room] User B successfully joined team-alpha"
   - Client receives joined-room { room: 'team-alpha', success: true }
   - B can now send messages to team-alpha

3. ✓ User D (not invited) clicks "Join Room", types "team-alpha"
   - Console shows: "[join-room] User D NOT_INVITED to team-alpha"
   - Client receives room-error { code: 'NOT_INVITED', message: '...' }
   - Error dialog shows: "❌ You are not invited to this room. Ask the creator to invite you."

4. ✓ Creator A uses POST /api/rooms/:id/invite { memberEmails: ['D@...'] }
   - Console shows: "[POST /rooms/:id/invite] Creator A added 1 members to team-alpha"
   - D is now in room.members

5. ✓ User D logs in, clicks "Join Room", types "team-alpha" again
   - Console shows: "[join-room] User D successfully joined team-alpha"
   - D can now send messages

6. ✓ Membership validation with mixed case emails, extra spaces, commas
   - "  user@test.com  , Other@TEST.COM " → trim & find both users

7. ✓ Non-existing email during room creation
   - POST /api/rooms { name: 'test', memberEmails: ['unknown@test.com'] }
   - Server returns 400: "User(s) not found: unknown@test.com"
   - Client shows alert

// ============================================================================
