import React, { useCallback } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function RecordingPanel({ send, connected }) {
  const onAudioChunk = useCallback((buffer) => {
    if (connected) {
      send(buffer);
    }
  }, [send, connected]);

  const { isRecording, duration, audioLevel, startRecording, stopRecording } = useAudioRecorder(onAudioChunk);

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Generate level bars
  const bars = 8;
  const barHeights = Array.from({ length: bars }, (_, i) => {
    const threshold = (i + 1) / bars;
    return audioLevel >= threshold ? 100 : Math.max(8, audioLevel * 100 * (1 + Math.random() * 0.3));
  });

  return (
    <div className="panel-section">
      <h3>Recording</h3>
      <div className="recording-panel">
        <button
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={handleClick}
          disabled={!connected}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <div className="record-btn-inner" />
        </button>

        <div className="recording-info">
          <span className="recording-timer">{formatTime(duration)}</span>
          <span className="recording-label">
            {isRecording ? 'Recording...' : connected ? 'Click to record' : 'Disconnected'}
          </span>
        </div>

        {isRecording && (
          <div className="audio-level">
            {barHeights.map((h, i) => (
              <div
                key={i}
                className="audio-level-bar"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
