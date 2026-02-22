import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GraphRenderer } from '../utils/graphRenderer.js';
import GraphLegend from './GraphLegend.jsx';

export default function KnowledgeGraph({ graph, settings }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new GraphRenderer(canvasRef.current);
    rendererRef.current = renderer;

    renderer.onHover = (node, x, y) => {
      if (node) {
        setTooltip({ node, x, y });
      } else {
        setTooltip(null);
      }
    };

    renderer.onSelect = (node) => {
      setSelectedNode(node);
    };

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !rendererRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          rendererRef.current.resize(width, height);
        }
      }
    });

    observer.observe(container);

    // Initial size
    const { width, height } = container.getBoundingClientRect();
    if (width > 0 && height > 0) {
      rendererRef.current.resize(width, height);
    }

    return () => observer.disconnect();
  }, []);

  // Track previous node IDs to detect full replacements vs incremental updates
  const prevNodeIdsRef = useRef(new Set());

  // Update data when graph changes
  useEffect(() => {
    if (!rendererRef.current || !graph) return;

    const newIds = new Set((graph.nodes || []).map((n) => n.id));
    const prevIds = prevNodeIdsRef.current;

    // Check if this is a full replacement: none of the old IDs exist in the new set
    const isFullReset = prevIds.size > 0 && ![...prevIds].some((id) => newIds.has(id));

    if (isFullReset) {
      rendererRef.current.resetData(graph);
    } else {
      rendererRef.current.setData(graph);
    }

    prevNodeIdsRef.current = newIds;
  }, [graph]);

  // Update settings
  useEffect(() => {
    if (rendererRef.current && settings) {
      rendererRef.current.updateSettings(settings);
    }
  }, [settings]);

  const hasNodes = graph && graph.nodes && graph.nodes.length > 0;

  return (
    <div className="graph-container" ref={containerRef}>
      <canvas ref={canvasRef} className="graph-canvas" aria-label="Knowledge graph visualization" />
      {hasNodes && <GraphLegend />}

      {!hasNodes && (
        <div className="graph-empty">
          <h3>Knowledge Graph</h3>
          <p>Send tasks to Claude Code to build the graph</p>
        </div>
      )}

      {tooltip && (
        <div
          className="graph-tooltip visible"
          style={{
            left: tooltip.x - (containerRef.current?.getBoundingClientRect().left || 0) + 12,
            top: tooltip.y - (containerRef.current?.getBoundingClientRect().top || 0) - 10,
          }}
        >
          <div className="graph-tooltip-label">{tooltip.node.label || tooltip.node.id}</div>
          <div className="graph-tooltip-type">
            {tooltip.node.type}
            {tooltip.node.status ? ` - ${tooltip.node.status}` : ''}
          </div>
          {tooltip.node.path && (
            <div className="graph-tooltip-summary">{tooltip.node.path}</div>
          )}
          {tooltip.node.summary && (
            <div className="graph-tooltip-summary">{tooltip.node.summary}</div>
          )}
        </div>
      )}

      {selectedNode && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          right: 12,
          background: '#1c2128',
          border: '1px solid #30363d',
          borderRadius: 6,
          padding: '10px 12px',
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, color: '#c9d1d9', marginBottom: 4 }}>
            {selectedNode.label || selectedNode.id}
          </div>
          <div style={{ color: '#8b949e', fontSize: 11 }}>
            Type: {selectedNode.type} | Status: {selectedNode.status || 'n/a'}
            {selectedNode.path && ` | Path: ${selectedNode.path}`}
          </div>
          {selectedNode.summary && (
            <div style={{ color: '#8b949e', fontSize: 11, marginTop: 4 }}>
              {selectedNode.summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
