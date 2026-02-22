import React from 'react';

export default function GraphControls({ settings, onChange }) {
  const update = (key, value) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="graph-controls">
      <label>
        <input
          type="checkbox"
          checked={settings.showFiles}
          onChange={(e) => update('showFiles', e.target.checked)}
        />
        Files
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.showConcepts}
          onChange={(e) => update('showConcepts', e.target.checked)}
        />
        Concepts
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.showTasks}
          onChange={(e) => update('showTasks', e.target.checked)}
        />
        Tasks
      </label>
      <span style={{ color: '#6e7681', fontSize: 11, margin: '0 4px' }}>|</span>
      <label>
        Charge
        <input
          type="range"
          min="-1000"
          max="-50"
          value={settings.charge}
          onChange={(e) => update('charge', Number(e.target.value))}
        />
      </label>
      <label>
        Distance
        <input
          type="range"
          min="30"
          max="300"
          value={settings.linkDistance}
          onChange={(e) => update('linkDistance', Number(e.target.value))}
        />
      </label>
    </div>
  );
}
