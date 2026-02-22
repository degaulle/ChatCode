import React, { useRef, useEffect } from 'react';

export default function TranscriptPanel({ fullTranscript, features, summary }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [fullTranscript]);

  return (
    <div className="panel-section">
      <h3>Live Transcript</h3>

      {/* Running transcript */}
      <div className="transcript-panel" ref={scrollRef}>
        {fullTranscript ? (
          <div className="transcript-live-text">{fullTranscript}</div>
        ) : (
          <p className="transcript-empty">Start recording to see live transcript...</p>
        )}
      </div>

      {/* Extracted summary */}
      {summary && (
        <div className="transcript-extraction-summary">
          <span className="extraction-label">Summary:</span> {summary}
        </div>
      )}

      {/* Extracted features */}
      {features.length > 0 && (
        <div className="transcript-features">
          <span className="extraction-label">Features:</span>
          <div className="feature-tags">
            {features.map((f) => (
              <span key={f.id} className="feature-tag" title={f.description}>
                {f.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
