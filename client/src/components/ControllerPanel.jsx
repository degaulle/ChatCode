import React, { useState, useEffect, useCallback } from 'react';

export default function ControllerPanel({
  todos,
  features,
  claudeStatus,
  sendToClaude,
  removeTodo,
  updateTodo,
}) {
  const [autoSend, setAutoSend] = useState(false);
  const [manualInput, setManualInput] = useState('');

  // Auto-send: when Claude becomes idle and autoSend is on, send next todo
  useEffect(() => {
    if (!autoSend || claudeStatus !== 'idle' || todos.length === 0) return;
    const next = todos[0];
    if (next) {
      handleSend(next.id, next.text);
    }
  }, [autoSend, claudeStatus, todos]);

  const handleSend = useCallback((id, text) => {
    sendToClaude(text);
    removeTodo(id);
  }, [sendToClaude, removeTodo]);

  const handleSendNext = () => {
    if (todos.length > 0) {
      handleSend(todos[0].id, todos[0].text);
    }
  };

  const handleSendAll = () => {
    // Combine all todos into a single prompt
    const combined = todos.map((t) => `- ${t.text}`).join('\n');
    sendToClaude(combined);
    todos.forEach((t) => removeTodo(t.id));
  };

  // Group todos by feature
  const featureMap = {};
  features.forEach((f) => { featureMap[f.id] = f.name; });

  const handleManualSend = () => {
    if (!manualInput.trim()) return;
    sendToClaude(manualInput.trim());
    setManualInput('');
  };

  return (
    <div className="panel-section">
      <h3>Controller — TODOs for Claude Code</h3>
      <div className="controller-panel">
        {/* Manual input */}
        <div className="manual-input-bar">
          <textarea
            className="queue-item-text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Type a command for Claude Code..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleManualSend();
              }
            }}
          />
          <button
            className="btn primary"
            onClick={handleManualSend}
            disabled={!manualInput.trim() || claudeStatus === 'running'}
          >
            Send
          </button>
        </div>

        <div className="controls-bar">
          <button
            className="btn primary"
            onClick={handleSendNext}
            disabled={todos.length === 0 || claudeStatus === 'running'}
          >
            Send Next
          </button>
          <button
            className="btn primary"
            onClick={handleSendAll}
            disabled={todos.length === 0 || claudeStatus === 'running'}
          >
            Send All
          </button>
          <button
            className={`btn ${autoSend ? 'active' : ''}`}
            onClick={() => setAutoSend(!autoSend)}
          >
            Auto {autoSend ? 'ON' : 'OFF'}
          </button>
          <span className={`claude-status ${claudeStatus}`}>
            Claude: {claudeStatus}
          </span>
        </div>

        <div className="queue-list">
          {todos.length === 0 ? (
            <div className="queue-empty">
              No TODOs yet. Upload a transcript or type a command above.
            </div>
          ) : (
            todos.map((todo) => (
              <div key={todo.id} className="queue-item">
                {todo.feature && featureMap[todo.feature] && (
                  <div className="queue-item-feature">
                    <span className="todo-feature-badge">{featureMap[todo.feature]}</span>
                  </div>
                )}
                <textarea
                  className="queue-item-text"
                  value={todo.text}
                  onChange={(e) => updateTodo(todo.id, e.target.value)}
                  rows={3}
                />
                <div className="queue-item-actions">
                  <button
                    className="btn primary"
                    onClick={() => handleSend(todo.id, todo.text)}
                    disabled={claudeStatus === 'running'}
                    title="Send to Claude Code"
                  >
                    Send
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => removeTodo(todo.id)}
                    title="Remove"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
