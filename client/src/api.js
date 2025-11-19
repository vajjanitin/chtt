// client/src/api.js
import axios from 'axios';

// The frontend expects the API base URL to include the `/api` prefix so calls
// like `API.get('/rooms')` map to `http://host:port/api/rooms` on the server.
const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
});

export function setAuthToken(token) {
  if (token) API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete API.defaults.headers.common['Authorization'];
}

export default API;
