// client/src/socket.js
import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token) {
  if (socket && socket.connected) return socket;
  // socket URL should point to the server root (no `/api` prefix) where socket.io is listening
  socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
    auth: { token }
  });

  socket.on('connect', () => {
    console.log('Socket connected', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connect_error', err.message || err);
  });

  return socket;
}

export function getSocket() {
  return socket;
}
