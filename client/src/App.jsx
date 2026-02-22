import React, { useState, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket.js';
import AudioUploadPanel from './components/AudioUploadPanel.jsx';
import TranscriptPanel from './components/TranscriptPanel.jsx';
import ControllerPanel from './components/ControllerPanel.jsx';
import KnowledgeGraph from './components/KnowledgeGraph.jsx';
import GraphControls from './components/GraphControls.jsx';
import ProjectPanel from './components/ProjectPanel.jsx';
import ClaudeOutputPanel from './components/ClaudeOutputPanel.jsx';

export default function App() {
  const [fullTranscript, setFullTranscript] = useState('');
  const [features, setFeatures] = useState([]);
  const [todos, setTodos] = useState([]);
  const [extractionSummary, setExtractionSummary] = useState('');
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [claudeStatus, setClaudeStatus] = useState('idle');
  const [claudeOutput, setClaudeOutput] = useState('');
  const [graphSettings, setGraphSettings] = useState({
    showFiles: true,
    showConcepts: true,
    showTasks: true,
    charge: -300,
    linkDistance: 100,
  });

  const handleMessage = useCallback((msg) => {
    window.dispatchEvent(new CustomEvent('chatcode-message', { detail: msg }));

    switch (msg.type) {
      case 'transcript_chunk':
        setFullTranscript(msg.fullTranscript);
        break;
      case 'extraction':
        setFeatures(msg.features || []);
        setTodos(msg.todos || []);
        setExtractionSummary(msg.summary || '');
        break;
      case 'claude_output_chunk':
        if (msg.content) {
          setClaudeOutput((prev) => prev + msg.content);
        }
        break;
      case 'claude_output':
        setClaudeOutput(msg.text);
        break;
      case 'claude_status':
        setClaudeStatus(msg.status);
        break;
      case 'claude_ready':
        setClaudeStatus('idle');
        break;
      case 'graph_update':
        setGraph(msg.graph);
        break;
      case 'project_loaded':
        if (msg.fullTranscript) setFullTranscript(msg.fullTranscript);
        if (msg.extraction) {
          setFeatures(msg.extraction.features || []);
          setTodos(msg.extraction.todos || []);
          setExtractionSummary(msg.extraction.summary || '');
        }
        if (msg.graph) setGraph(msg.graph);
        break;
      case 'error':
        console.error('Server error:', msg.message);
        break;
    }
  }, []);

  const { send, connected } = useWebSocket(handleMessage);

  const sendToClaude = useCallback((text) => {
    send({ type: 'send_to_claude', text });
    setClaudeStatus('running');
    setClaudeOutput('');
  }, [send]);

  const removeTodo = useCallback((id) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTodo = useCallback((id, text) => {
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, text } : t));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">ChatCode</h1>
        <div className="connection-status">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
        <ProjectPanel
          send={send}
          fullTranscript={fullTranscript}
          graph={graph}
          features={features}
          todos={todos}
          setFullTranscript={setFullTranscript}
          setGraph={setGraph}
          setFeatures={setFeatures}
          setTodos={setTodos}
        />
      </header>

      <div className="app-body">
        <div className="left-panel">
          <AudioUploadPanel send={send} connected={connected} />
          <TranscriptPanel
            fullTranscript={fullTranscript}
            features={features}
            summary={extractionSummary}
          />
          <ControllerPanel
            todos={todos}
            features={features}
            claudeStatus={claudeStatus}
            sendToClaude={sendToClaude}
            removeTodo={removeTodo}
            updateTodo={updateTodo}
          />
          <ClaudeOutputPanel claudeOutput={claudeOutput} claudeStatus={claudeStatus} />
        </div>

        <div className="right-panel">
          <GraphControls settings={graphSettings} onChange={setGraphSettings} />
          <KnowledgeGraph graph={graph} settings={graphSettings} />
        </div>
      </div>
    </div>
  );
}
