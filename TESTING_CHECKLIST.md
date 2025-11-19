# MERN Chat Application - Testing Checklist

## Pre-Testing Setup

- [ ] Start MongoDB
- [ ] Install dependencies: `npm install` in both `/client` and `/server`
- [ ] Start backend: `npm start` in `/server`
- [ ] Start frontend: `npm start` in `/client`
- [ ] Both running on correct ports (Backend: 5000, Frontend: 3000)

---

## 1. Authentication & Login

### Test 1.1: User Registration
- [ ] Navigate to Login page
- [ ] Enter new email and password
- [ ] Click "Sign Up"
- [ ] Verify success message appears
- [ ] Check MongoDB that user was created
- [ ] Try registering same email again - should show error "User already exists"

### Test 1.2: User Login
- [ ] Enter registered email and password
- [ ] Click "Sign In"
- [ ] Verify redirected to Chat page
- [ ] Verify user name appears in top right
- [ ] Check that auth token is stored in localStorage

### Test 1.3: Invalid Login
- [ ] Enter wrong password
- [ ] Should show error message
- [ ] Try non-existent email
- [ ] Should show error message

### Test 1.4: Logout
- [ ] Click "Logout" button in Chat header
- [ ] Verify redirected to Login page
- [ ] Verify localStorage is cleared
- [ ] Try accessing Chat page directly - should redirect to Login

---

## 2. Global Room Functionality

### Test 2.1: Connection & Online Users
- [ ] Open Chat page after login
- [ ] Verify "Online:" list shows current user
- [ ] Open another browser tab/window and login with different user
- [ ] Verify first user appears in second user's online list
- [ ] Verify second user appears in first user's online list

### Test 2.2: Sending Messages in Global Room
- [ ] User A sends message "Hello from User A"
- [ ] Verify message appears immediately in User A's chat
- [ ] Verify message appears in User B's chat in real-time
- [ ] Message shows: "[timestamp] User A: Hello from User A"
- [ ] Send multiple messages rapidly - all should appear

### Test 2.3: Typing Indicator
- [ ] User A starts typing in message input
- [ ] Verify "User A is typing..." appears in User B's chat
- [ ] Message indicator disappears after User A stops typing (1-2 seconds)
- [ ] Send message - indicator disappears
- [ ] Test with multiple users typing simultaneously

### Test 2.4: Message Persistence
- [ ] Reload chat page (F5)
- [ ] Verify previous messages still appear
- [ ] Check database that messages were persisted

---

## 3. Room Management

### Test 3.1: Create New Room
- [ ] Click "Join Room" button
- [ ] Click "Create New Room"
- [ ] Enter room name "Test Room 1"
- [ ] Click "Create"
- [ ] Verify room appears in rooms list on left
- [ ] Verify room is selected and has "✓ Joined" badge
- [ ] Try creating room with duplicate name - should fail with error

### Test 3.2: Join Public Room
- [ ] User A creates public room "Public Chat"
- [ ] Switch to User B
- [ ] Click "Join Room"
- [ ] Select "Public Chat" from available rooms
- [ ] Click "Join"
- [ ] Verify "✓ Joined" badge appears for User B
- [ ] Send message from User B
- [ ] Verify User A sees message from User B in real-time

### Test 3.3: Invite User to Private Room
- [ ] User A creates private room "Private Room"
- [ ] Click "Room Options" for Private Room
- [ ] Enter User B's email in invite field
- [ ] Click "Invite"
- [ ] Verify success message "Invited successfully"
- [ ] Switch to User B
- [ ] Click "Join Room"
- [ ] Verify "Private Room" appears in invited rooms
- [ ] Join the room

### Test 3.4: Deny Unauthorized Access
- [ ] User A creates private room "Secret Room"
- [ ] User A does NOT invite User B
- [ ] Switch to User B
- [ ] Click "Join Room"
- [ ] Try to join "Secret Room"
- [ ] Verify error: "You are not invited to this room. Ask the creator to invite you."
- [ ] Verify "⏳ Joining..." badge stays, messages disabled

### Test 3.5: Room-Specific Messages
- [ ] User A in "Test Room 1" sends "Room 1 message"
- [ ] User B in Global sends "Global message"
- [ ] Verify User A's room doesn't show global message
- [ ] Verify User B's global doesn't show room message
- [ ] User A switches to Global
- [ ] Verify only global messages appear
- [ ] User A switches back to "Test Room 1"
- [ ] Verify only room messages appear

### Test 3.6: Delete Room
- [ ] User A (room creator) selects room
- [ ] Click "Room Options"
- [ ] Click "Delete Room"
- [ ] Confirm deletion
- [ ] Verify room removed from User A's list
- [ ] Verify room removed from all members' lists
- [ ] Switch to User B
- [ ] Verify error message appears: "Room [name] has been deleted by the owner"
- [ ] Verify switched to Global room automatically

### Test 3.7: Leave Room
- [ ] User A and User B both in "Test Room 1"
- [ ] User A clicks room settings and "Leave Room"
- [ ] Confirm leaving
- [ ] Verify room removed from User A's list
- [ ] Verify User A switched to Global room
- [ ] User B still in room, sends message
- [ ] User A doesn't receive message (no longer in room)

---

## 4. Real-Time Features

### Test 4.1: Multi-Tab Synchronization
- [ ] Open Chat in Tab 1, Tab 2, and Tab 3 (same user, same browser)
- [ ] User B sends message
- [ ] Verify message appears in all 3 tabs simultaneously
- [ ] User A sends message in Tab 1
- [ ] Verify message shows in Tabs 2 and 3 instantly

### Test 4.2: Rapid Room Switching
- [ ] Create 3 rooms: Room A, Room B, Room C
- [ ] User sends message to each room
- [ ] Rapidly click between rooms
- [ ] Verify correct messages appear for each room
- [ ] Verify no message mixing between rooms

### Test 4.3: Multiple Users in Same Room
- [ ] Create room with 3+ users
- [ ] Each user sends message sequentially
- [ ] Verify all messages appear for all users in correct order
- [ ] Check no messages are lost

### Test 4.4: Connection Recovery
- [ ] Open Chat normally
- [ ] Open Developer Console (F12)
- [ ] Simulate offline: `DevTools > Network > Offline`
- [ ] Try to send message - should show error or queue
- [ ] Go back online: `DevTools > Network > Online`
- [ ] Verify connection resumes
- [ ] Send message - should deliver successfully

---

## 5. Database Persistence

### Test 5.1: Users Collection
- [ ] Login creates user document
- [ ] Open MongoDB
- [ ] Check `users` collection
- [ ] Verify user document has: `email`, `password` (hashed), `displayName`, `createdAt`
- [ ] Logout and login again
- [ ] User should load from database

### Test 5.2: Messages Collection
- [ ] Send multiple messages in different rooms
- [ ] Check `messages` collection
- [ ] Verify each message has: `text`, `from`, `to` (room name), `timestamp`
- [ ] Reload page
- [ ] Verify messages load from database
- [ ] Check count of messages in DB matches UI

### Test 5.3: Rooms Collection
- [ ] Create multiple rooms with different settings
- [ ] Check `rooms` collection
- [ ] Verify each room has: `name`, `creator`, `isPublic`, `members` (array), `createdAt`
- [ ] Delete a room
- [ ] Verify room removed from database
- [ ] Create room with same name again - should succeed

### Test 5.4: Message History on Rejoin
- [ ] User A in Room sends 5 messages
- [ ] User B joins room later
- [ ] Verify User B sees all 5 previous messages
- [ ] User B sends 3 messages
- [ ] User B leaves and rejoins
- [ ] Verify User B sees all 8 messages (5 old + 3 from before leaving)

---

## 6. Error Handling

### Test 6.1: Network Errors
- [ ] Kill backend server
- [ ] Try to send message
- [ ] Verify appropriate error message
- [ ] Restart backend
- [ ] Verify connection recovers or refresh works

### Test 6.2: Invalid Input
- [ ] Try to send empty message (just whitespace)
- [ ] Should not send or show validation error
- [ ] Try very long message (10000+ characters)
- [ ] Should either truncate or show error
- [ ] Send message with special characters: `<script>alert('xss')</script>`
- [ ] Should display safely (escaped)

### Test 6.3: Database Errors
- [ ] Stop MongoDB
- [ ] Try to login
- [ ] Should show error message
- [ ] Restart MongoDB
- [ ] Should work again

### Test 6.4: Room Permission Errors
- [ ] User A creates private room
- [ ] User B tries to join without invite - should fail
- [ ] User A invites User B
- [ ] User B joins - should succeed
- [ ] User A removes User B from room
- [ ] User B tries to send message - should fail
- [ ] User B tries to read messages - should fail

---

## 7. UI/UX Tests

### Test 7.1: Responsive Design
- [ ] Test on desktop (1920x1080)
- [ ] Test on tablet (iPad landscape)
- [ ] Test on mobile (iPhone/Android)
- [ ] Verify layout adapts properly
- [ ] All buttons clickable on mobile
- [ ] Chat readable on all sizes

### Test 7.2: Visual Feedback
- [ ] Message sends - shows instantly
- [ ] Typing indicator appears/disappears smoothly
- [ ] "Joined" badge changes color appropriately
- [ ] Online users list updates without page reload
- [ ] Error messages styled clearly
- [ ] Success messages appear and disappear appropriately

### Test 7.3: Room List UI
- [ ] Rooms list shows all joined rooms
- [ ] Current room is highlighted
- [ ] Room names are readable
- [ ] Can scroll if many rooms
- [ ] "Global" room always at top

### Test 7.4: User Controls
- [ ] "Join Room" button opens dialog
- [ ] "Room Options" button opens settings for selected room
- [ ] "Logout" button clears session
- [ ] User name displays correctly in header
- [ ] Current room name displays in header with badge

---

## 8. Security Tests

### Test 8.1: Password Security
- [ ] Check that passwords are hashed in MongoDB (not plain text)
- [ ] Cannot see password in network requests
- [ ] Cannot see password in localStorage

### Test 8.2: Authentication Tokens
- [ ] After login, localStorage has `token`
- [ ] Token used for authenticated requests
- [ ] Invalid token should be rejected
- [ ] Logout removes token

### Test 8.3: Authorization
- [ ] Non-creator cannot delete room
- [ ] Non-creator cannot invite users (if rules apply)
- [ ] Non-member cannot read private room messages
- [ ] Cannot modify other user's messages

### Test 8.4: Input Sanitization
- [ ] Send message with HTML: `<b>bold</b>`
- [ ] Should display as text, not render as HTML
- [ ] Send message with script tags
- [ ] Should not execute
- [ ] Send message with database injection attempts
- [ ] Should handle safely

---

## 9. Performance Tests

### Test 9.1: Large Message Volume
- [ ] Send 100 messages rapidly
- [ ] Verify all appear in correct order
- [ ] No lag or missing messages
- [ ] UI remains responsive

### Test 9.2: Many Users Online
- [ ] Simulate 10+ users online in same room (can use multiple tabs)
- [ ] Send message - should broadcast to all
- [ ] Online users list updates for each
- [ ] No performance degradation

### Test 9.3: Message Loading
- [ ] Enter room with 1000+ messages
- [ ] Should load reasonably fast (< 2 seconds)
- [ ] Can scroll through history smoothly
- [ ] Consider implementing pagination if too slow

### Test 9.4: Connection Stability
- [ ] Keep Chat open for 10+ minutes
- [ ] Send occasional messages
- [ ] No unexpected disconnections
- [ ] Online status remains accurate

---

## 10. Browser Compatibility

- [ ] Chrome latest
- [ ] Firefox latest
- [ ] Safari latest
- [ ] Edge latest
- [ ] Mobile browsers (Chrome Mobile, Safari iOS)

---

## 11. Socket Events Verification

### Test 11.1: Check All Events Emit Correctly
- [ ] **new-message**: Messages appear in real-time ✓
- [ ] **typing**: Typing indicator appears ✓
- [ ] **online-users**: Online list updates ✓
- [ ] **joined-room**: Join success shows badge ✓
- [ ] **room-error**: NOT_INVITED shows error ✓
- [ ] **room-deleted**: Room removed, user redirected ✓ (NEW)
- [ ] **user-left-room**: Online list updates when user leaves ✓ (NEW)

### Test 11.2: Socket Cleanup
- [ ] Logout and check console for socket errors
- [ ] No lingering event listeners
- [ ] No memory leaks from event subscriptions

---

## 12. Final Smoke Test

### Complete User Journey
1. [ ] New user registers
2. [ ] User logs in
3. [ ] User sees online users in Global room
4. [ ] User sends message in Global
5. [ ] User creates new private room
6. [ ] User invites another user to private room
7. [ ] Second user joins private room
8. [ ] Both users exchange messages
9. [ ] First user deletes room
10. [ ] Second user sees error and is redirected to Global
11. [ ] First user leaves Global room
12. [ ] Second user sees first user offline
13. [ ] Both users logout
14. [ ] Both can login again and see message history

---

## Bugs Found & Fixed

| Bug | Status | Fix |
|-----|--------|-----|
| Empty room creation | Fixed | Added validation |
| NOT_INVITED error | Fixed | Added specific error handler |
| Room deletion didn't update clients | Fixed | Added room-deleted event |
| User leaving didn't update online list | Fixed | Added user-left-room event |

---

## Notes for Testing

- **Test in Incognito/Private mode** to avoid browser cache issues
- **Clear localStorage** between major test sections (`localStorage.clear()` in console)
- **Use different browsers** for multi-user testing
- **Monitor browser console** for errors during testing
- **Monitor Network tab** to verify WebSocket connections
- **Check server logs** for any backend errors
- **Keep MongoDB compass open** to verify data persistence

---

## Sign-Off

- [ ] All tests passed
- [ ] No critical bugs
- [ ] Production ready

**Tested by:** _______________  
**Date:** _______________  
**Notes:** ________________________________________________________________
