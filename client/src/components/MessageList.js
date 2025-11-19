// client/src/components/MessageList.js
import React, { useEffect, useRef } from 'react';

function formatNameFromEmail(email) {
  if (!email) return 'Anonymous';
  const part = String(email).split('@')[0];
  return part.replace(/[.\-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function MessageList({ messages = [], currentUser }) {
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length]);

  return (
    <div className="messages">
      {messages.length === 0 && <div className="no-messages">No messages yet — say hi 👋</div>}

      {messages.map((m) => {
        const senderName = m.from?.name || m.from?.username || formatNameFromEmail(m.from?.username);
        const isMine = currentUser && m.from && (String(m.from._id) === String(currentUser.id) || m.from.username === currentUser.username);

        return (
          <div key={m._id || Math.random()} className={`message-row ${isMine ? 'mine' : ''}`}>
            <div className="align">
              <div className={`message-bubble ${isMine ? 'mine' : ''}`}>
                <div className="message-author">
                  {senderName}
                </div>
                <div className="message-text">{m.text}</div>
                <div className="message-time">
                  {new Date(m.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={endRef} />
    </div>
  );
}
