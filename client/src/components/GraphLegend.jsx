import React from 'react';

const NODE_TYPES = [
  { id: 'file', label: 'File', color: '#58a6ff', border: '#388bfd' },
  { id: 'concept', label: 'Concept', color: '#d2a8ff', border: '#bc8cff' },
  { id: 'task', label: 'Task', color: '#3fb950', border: '#2ea043' },
];

const EDGE_TYPES = [
  { id: 'implements', label: 'Implements', color: '#79c0ff' },
  { id: 'produces', label: 'Produces', color: '#7ee787' },
  { id: 'requires', label: 'Requires', color: '#d29922' },
  { id: 'relates_to', label: 'Relates to', color: '#484f58' },
  { id: 'modifies', label: 'Modifies', color: '#e3b341' },
];

export default function GraphLegend() {
  return (
    <div className="graph-legend">
      <svg width="200" height="130" viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg">
        <text x="4" y="12" fill="#8b949e" fontSize="10" fontWeight="600">NODES</text>
        {NODE_TYPES.map((t, i) => (
          <g key={t.id} transform={`translate(8, ${20 + i * 18})`}>
            <use href={`#icon-${t.id}`} width="12" height="12" y="-6" />
            <text x="18" y="3" fill="#c9d1d9" fontSize="11">{t.label}</text>
          </g>
        ))}

        <text x="4" y="82" fill="#8b949e" fontSize="10" fontWeight="600">EDGES</text>
        {EDGE_TYPES.map((t, i) => (
          <g key={t.id} transform={`translate(8, ${92 + i * 14})`}>
            <line x1="0" y1="-2" x2="14" y2="-2" stroke={t.color} strokeWidth="1.5" />
            <text x="18" y="2" fill="#8b949e" fontSize="10">{t.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
