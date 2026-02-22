import React, { useRef, useEffect } from 'react';

export default function ClaudeOutputPanel({ claudeOutput, claudeStatus }) {
  const outputRef = useRef(null);
  const isAutoScrollRef = useRef(true);

  const handleScroll = () => {
    const el = outputRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    isAutoScrollRef.current = atBottom;
  };

  useEffect(() => {
    const el = outputRef.current;
    if (el && isAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [claudeOutput]);

  return (
    <div className="claude-output-panel">
      <h3>
        Claude Code Output
        {claudeStatus === 'running' && (
          <span className="claude-output-spinner"> (running...)</span>
        )}
      </h3>
      <pre
        className="claude-output"
        ref={outputRef}
        onScroll={handleScroll}
      >
        {claudeOutput || 'No output yet...'}
      </pre>
    </div>
  );
}
