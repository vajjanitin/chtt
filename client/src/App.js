import React, { useState, useEffect } from 'react';
import './index.css';
import './App.css';
import Login from './pages/Login';
import Chat from './pages/Chat';
import { connectSocket, getSocket } from './socket';
import { setAuthToken } from './api';


export default function App() {
const [user, setUser] = useState(() => {
	try {
		const u = JSON.parse(localStorage.getItem('user'));
		if (u && u.token && !u.id) {
			try {
				const parts = (u.token || '').split('.');
				if (parts.length === 3) {
					const payload = JSON.parse(atob(parts[1]));
					u.id = payload.id || payload._id || null;
					localStorage.setItem('user', JSON.stringify(u));
				}
			} catch (e) {
				// ignore
			}
		}
		return u;
	} catch {
		return null;
	}
});


useEffect(() => {
if (user?.token) {
setAuthToken(user.token);
connectSocket(user.token);
}
}, [user]);


return (
<div style={{ fontFamily: 'Arial, sans-serif', padding: 20 }}>
{user ? <Chat user={user} onLogout={() => { localStorage.removeItem('user'); setUser(null); const s = getSocket(); if (s) s.disconnect(); }} /> : <Login onLogin={setUser} />}
</div>
);
}