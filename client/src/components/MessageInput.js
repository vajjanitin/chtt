// MessageInput.js
import React, { useState, useRef } from 'react';

export default function MessageInput({ onSend, onTyping, disabled = false }) {
  const [text, setText] = useState('');
  const typingRef = useRef(null);

  function handleChange(e) {
    setText(e.target.value);
    if (onTyping && !disabled) {
      // simple debounce to avoid spamming typing events
      if (typingRef.current) clearTimeout(typingRef.current);
      onTyping();
      typingRef.current = setTimeout(() => {
        typingRef.current = null;
      }, 800);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (disabled) {
      alert('Please wait for room to load');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    if (onSend) onSend(trimmed);
    setText('');
  }

  return (
    <form onSubmit={handleSubmit} className="message-input-form">
      <input
        value={text}
        onChange={handleChange}
        placeholder={disabled ? "Loading room..." : "Type a message..."}
        className="message-input"
        disabled={disabled}
        style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
      />
      <button type="submit" className="send-button" disabled={disabled}>
        {disabled ? "..." : "Send"}
      </button>
    </form>
  );
}
