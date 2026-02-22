import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export default function CompatibilityGraph({ agents, compatibilityMatrix, onNodeClick, selectedAgent }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const simulationRef = useRef(null);
  const transformRef = useRef(d3.zoomIdentity);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || agents.length === 0) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Resize canvas
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width, height };
    };

    const { width, height } = resize();

    // Create nodes and links
    const nodes = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      agent,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));

    const links = [];
    agents.forEach((agent1) => {
      agents.forEach((agent2) => {
        if (agent1.id !== agent2.id) {
          const compatibility = compatibilityMatrix[agent1.id]?.[agent2.id];
          if (compatibility !== undefined) {
            // Only create one link per pair (avoid duplicates)
            const existingLink = links.find(
              (l) => (l.source.id === agent1.id && l.target.id === agent2.id) ||
                     (l.source.id === agent2.id && l.target.id === agent1.id)
            );
            if (!existingLink) {
              links.push({
                source: agent1.id,
                target: agent2.id,
                compatibility,
              });
            }
          }
        }
      });
    });

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id((d) => d.id)
        .distance((d) => 150 * (1.1 - d.compatibility)) // Closer for higher compatibility
        .strength(0.5)
      )
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(50))
      .alphaDecay(0.02);

    simulationRef.current = simulation;

    // Render function
    const render = () => {
      const t = transformRef.current;
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Apply transform
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // Draw links
      links.forEach((link) => {
        const source = typeof link.source === 'object' ? link.source : nodes.find((n) => n.id === link.source);
        const target = typeof link.target === 'object' ? link.target : nodes.find((n) => n.id === link.target);
        if (!source || !target) return;

        const compatibility = link.compatibility;
        const isHighlighted = selectedAgent &&
          (source.id === selectedAgent.id || target.id === selectedAgent.id);

        // Color based on compatibility
        let color;
        if (compatibility > 0.8) color = '#4caf50'; // Green
        else if (compatibility > 0.6) color = '#ff9800'; // Orange
        else color = '#f44336'; // Red

        ctx.strokeStyle = isHighlighted ? color : color + '66';
        ctx.lineWidth = isHighlighted ? 3 : Math.max(1, compatibility * 4);
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();

        // Draw compatibility score on the link
        if (isHighlighted) {
          const mx = (source.x + target.x) / 2;
          const my = (source.y + target.y) / 2;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeText(`${(compatibility * 100).toFixed(0)}%`, mx, my);
          ctx.fillText(`${(compatibility * 100).toFixed(0)}%`, mx, my);
        }
      });

      // Draw nodes
      nodes.forEach((node) => {
        const isSelected = selectedAgent?.id === node.id;
        const isConnected = selectedAgent && links.some(
          (l) => ((l.source.id || l.source) === node.id && (l.target.id || l.target) === selectedAgent.id) ||
                 ((l.target.id || l.target) === node.id && (l.source.id || l.source) === selectedAgent.id)
        );

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, 30, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#3b82f6' : isConnected ? '#60a5fa' : '#94a3b8';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : '#475569';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();

        // Node label (initials)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = node.name.split(' ').map((n) => n[0]).join('').substring(0, 2);
        ctx.fillText(initials, node.x, node.y);

        // Name below node
        ctx.fillStyle = isSelected ? '#ffffff' : '#e2e8f0';
        ctx.font = `${isSelected ? 'bold ' : ''}12px sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(node.name, node.x, node.y + 35);
      });

      ctx.restore();
    };

    simulation.on('tick', render);
    render();

    // Zoom & pan
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        render();
      });

    d3.select(canvas).call(zoom);

    // Interaction
    const hitTest = (mx, my) => {
      const [x, y] = transformRef.current.invert([mx, my]);
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy < 30 * 30) {
          return node;
        }
      }
      return null;
    };

    let hoveredNode = null;
    let draggedNode = null;
    let isDragging = false;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const node = hitTest(mx, my);

      if (isDragging && draggedNode) {
        const [x, y] = transformRef.current.invert([mx, my]);
        draggedNode.fx = x;
        draggedNode.fy = y;
        return;
      }

      if (node !== hoveredNode) {
        hoveredNode = node;
        canvas.style.cursor = node ? 'pointer' : 'default';
        if (node) {
          setTooltip({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            content: `${node.name} - ${node.role}`,
          });
        } else {
          setTooltip({ visible: false, x: 0, y: 0, content: '' });
        }
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        isDragging = true;
        draggedNode = node;
        node.fx = node.x;
        node.fy = node.y;
        simulation.alphaTarget(0.3).restart();
      }
    });

    canvas.addEventListener('mouseup', () => {
      if (isDragging && draggedNode) {
        draggedNode.fx = null;
        draggedNode.fy = null;
        simulation.alphaTarget(0);
        draggedNode = null;
        isDragging = false;
      }
    });

    canvas.addEventListener('click', (e) => {
      if (isDragging) return; // Don't trigger click during drag
      const rect = canvas.getBoundingClientRect();
      const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (node && onNodeClick) {
        onNodeClick(node.agent);
      }
    });

    canvas.addEventListener('mouseleave', () => {
      setTooltip({ visible: false, x: 0, y: 0, content: '' });
      if (isDragging && draggedNode) {
        draggedNode.fx = null;
        draggedNode.fy = null;
        simulation.alphaTarget(0);
        draggedNode = null;
        isDragging = false;
      }
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [agents, compatibilityMatrix, selectedAgent, onNodeClick]);

  return (
    <div ref={containerRef} className="compatibility-graph-container">
      <canvas ref={canvasRef} />
      {tooltip.visible && (
        <div
          className="graph-tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x + 10,
            top: tooltip.y + 10,
            pointerEvents: 'none',
          }}
        >
          {tooltip.content}
        </div>
      )}
      <div className="graph-legend">
        <h4>Compatibility</h4>
        <div className="legend-item">
          <div className="legend-line" style={{ backgroundColor: '#4caf50' }} />
          <span>High (&gt;80%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ backgroundColor: '#ff9800' }} />
          <span>Medium (60-80%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ backgroundColor: '#f44336' }} />
          <span>Low (&lt;60%)</span>
        </div>
      </div>
    </div>
  );
}
