import React, { useState, useEffect } from 'react';

export default function ProjectPanel({
  send,
  fullTranscript,
  graph,
  features,
  todos,
  setFullTranscript,
  setGraph,
  setFeatures,
  setTodos,
}) {
  const [projectName, setProjectName] = useState('my-project');
  const [projects, setProjects] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      const msg = event.detail;
      if (msg.type === 'project_list') {
        setProjects(msg.projects);
      } else if (msg.type === 'project_saved') {
        setSaving(false);
        send({ type: 'list_projects' });
      } else if (msg.type === 'project_loaded') {
        if (msg.fullTranscript) setFullTranscript(msg.fullTranscript);
        if (msg.graph) setGraph(msg.graph);
        if (msg.extraction) {
          setFeatures(msg.extraction.features || []);
          setTodos(msg.extraction.todos || []);
        }
        setProjectName(msg.name || 'my-project');
      }
    };

    window.addEventListener('chatcode-message', handler);
    return () => window.removeEventListener('chatcode-message', handler);
  }, [send, setFullTranscript, setGraph, setFeatures, setTodos]);

  const handleSave = () => {
    if (!projectName.trim()) return;
    setSaving(true);
    send({
      type: 'save_project',
      name: projectName.trim(),
      graph,
    });
  };

  const handleLoad = (name) => {
    send({ type: 'load_project', name });
  };

  return (
    <div className="project-panel">
      <input
        className="project-name-input"
        type="text"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        placeholder="Project name"
      />
      <button className="btn primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </button>
      <select
        className="project-select"
        onChange={(e) => { if (e.target.value) handleLoad(e.target.value); }}
        onClick={() => send({ type: 'list_projects' })}
        defaultValue=""
      >
        <option value="" disabled>Load project...</option>
        {projects.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name} {p.savedAt ? `(${new Date(p.savedAt).toLocaleDateString()})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
