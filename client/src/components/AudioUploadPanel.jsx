import React, { useState, useRef } from 'react';

export default function AudioUploadPanel({ send, connected }) {
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !connected) return;

    setFileName(file.name);
    setStatus('Reading...');

    try {
      const isDocx = file.name.toLowerCase().endsWith('.docx');
      if (isDocx) {
        // Send binary for server-side parsing
        const buffer = await file.arrayBuffer();
        send({ type: 'docx_upload', name: file.name });
        send(buffer);
        setStatus('Parsing & extracting...');
      } else {
        const text = await file.text();
        if (!text.trim()) {
          setStatus('File is empty');
          return;
        }
        send({ type: 'transcript_upload', text: text.trim(), name: file.name });
        setStatus('Extracting TODOs...');
      }
    } catch (err) {
      setStatus('Failed: ' + err.message);
    }
  };

  React.useEffect(() => {
    const handler = (event) => {
      if (event.detail.type === 'extraction') {
        setStatus('Done');
      }
    };
    window.addEventListener('chatcode-message', handler);
    return () => window.removeEventListener('chatcode-message', handler);
  }, []);

  return (
    <div className="panel-section">
      <h3>Transcript Input</h3>
      <div className="audio-upload-panel">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.doc,.docx,.rtf,.csv,.json"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button
          className="btn primary upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={!connected}
        >
          Upload Transcript
        </button>
        {fileName && (
          <div className="upload-info">
            <span className="upload-filename">{fileName}</span>
            <span className="upload-status">{status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
