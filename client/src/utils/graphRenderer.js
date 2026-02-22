import * as d3 from 'd3';

// Node colors by type
const NODE_COLORS = {
  file: '#58a6ff',
  concept: '#d2a8ff',
  task: '#3fb950',
};

const NODE_BORDER = {
  file: '#388bfd',
  concept: '#bc8cff',
  task: '#2ea043',
};

// Edge colors by type
const EDGE_COLORS = {
  implements: '#79c0ff',
  produces: '#7ee787',
  requires: '#d29922',
  relates_to: '#484f58',
  modifies: '#e3b341',
};

// Node shapes
const NODE_RADIUS = {
  file: 8,
  concept: 14,
  task: 10,
};

export class GraphRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;

    this.nodes = [];
    this.edges = [];
    this.simulation = null;
    this.transform = d3.zoomIdentity;

    this.hoveredNode = null;
    this.selectedNode = null;
    this.draggedNode = null;

    this.settings = {
      showFiles: true,
      showConcepts: true,
      showTasks: true,
      charge: -300,
      linkDistance: 100,
      ...options,
    };

    this.onHover = null;
    this.onSelect = null;

    this._setupInteraction();
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (this.simulation) {
      this.simulation.force('center', d3.forceCenter(width / 2, height / 2));
      this.simulation.alpha(0.3).restart();
    }
    this._render();
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };

    if (this.simulation) {
      this.simulation.force('charge').strength(settings.charge ?? this.settings.charge);
      this.simulation.force('link').distance(settings.linkDistance ?? this.settings.linkDistance);
      this.simulation.alpha(0.3).restart();
    }
    this._render();
  }

  // Full reset — discard all existing positions (for project load / reconnect)
  resetData(graph) {
    this.nodes = [];
    this.edges = [];
    this.setData(graph);
  }

  setData(graph) {
    if (!graph) return;

    // Deep copy to avoid mutation
    const newNodes = (graph.nodes || []).map((n) => {
      // Preserve positions from existing nodes
      const existing = this.nodes.find((e) => e.id === n.id);
      return {
        ...n,
        x: existing?.x ?? this.width / 2 + (Math.random() - 0.5) * 200,
        y: existing?.y ?? this.height / 2 + (Math.random() - 0.5) * 200,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
      };
    });

    const nodeIds = new Set(newNodes.map((n) => n.id));
    const newEdges = (graph.edges || []).filter(
      (e) => nodeIds.has(e.source?.id || e.source) && nodeIds.has(e.target?.id || e.target)
    ).map((e) => ({
      ...e,
      source: e.source?.id || e.source,
      target: e.target?.id || e.target,
    }));

    this.nodes = newNodes;
    this.edges = newEdges;

    this._buildSimulation();
  }

  _buildSimulation() {
    if (this.simulation) {
      this.simulation.stop();
    }

    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.edges).id((d) => d.id).distance(this.settings.linkDistance))
      .force('charge', d3.forceManyBody().strength(this.settings.charge))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collide', d3.forceCollide().radius((d) => this._nodeRadius(d) + 5))
      .alphaDecay(0.02)
      .on('tick', () => this._render());
  }

  _nodeRadius(node) {
    const base = NODE_RADIUS[node.type] || 8;
    // Scale by connection count
    const connections = this.edges.filter(
      (e) => (e.source?.id || e.source) === node.id || (e.target?.id || e.target) === node.id
    ).length;
    return base + Math.min(connections * 1.5, 10);
  }

  _isVisible(node) {
    if (node.type === 'file' && !this.settings.showFiles) return false;
    if (node.type === 'concept' && !this.settings.showConcepts) return false;
    if (node.type === 'task' && !this.settings.showTasks) return false;
    return true;
  }

  _render() {
    const ctx = this.ctx;
    const t = this.transform;

    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    // Apply zoom transform
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    // Draw edges
    ctx.lineWidth = 1;
    for (const edge of this.edges) {
      const source = typeof edge.source === 'object' ? edge.source : this.nodes.find((n) => n.id === edge.source);
      const target = typeof edge.target === 'object' ? edge.target : this.nodes.find((n) => n.id === edge.target);
      if (!source || !target) continue;
      if (!this._isVisible(source) || !this._isVisible(target)) continue;

      const isHighlighted = this.selectedNode &&
        (source.id === this.selectedNode.id || target.id === this.selectedNode.id);

      ctx.strokeStyle = isHighlighted
        ? (EDGE_COLORS[edge.type] || '#484f58')
        : (EDGE_COLORS[edge.type] || '#484f58') + '66';
      ctx.lineWidth = isHighlighted ? 2 : 0.8;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      // Draw arrowhead
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const targetR = this._nodeRadius(target);
      const ax = target.x - Math.cos(angle) * (targetR + 4);
      const ay = target.y - Math.sin(angle) * (targetR + 4);
      const arrowSize = 5;

      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(
        ax - arrowSize * Math.cos(angle - Math.PI / 6),
        ay - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        ax - arrowSize * Math.cos(angle + Math.PI / 6),
        ay - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }

    // Draw nodes
    for (const node of this.nodes) {
      if (!this._isVisible(node)) continue;

      const r = this._nodeRadius(node);
      const color = NODE_COLORS[node.type] || '#8b949e';
      const border = NODE_BORDER[node.type] || '#6e7681';
      const isHovered = this.hoveredNode?.id === node.id;
      const isSelected = this.selectedNode?.id === node.id;

      // Node shape
      ctx.beginPath();
      if (node.type === 'concept') {
        // Hexagon
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const x = node.x + r * Math.cos(angle);
          const y = node.y + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else if (node.type === 'task') {
        // Rounded square
        const s = r * 0.8;
        ctx.roundRect(node.x - s, node.y - s, s * 2, s * 2, 3);
      } else {
        // Circle (files)
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      }

      ctx.fillStyle = isSelected ? color : color + 'cc';
      ctx.fill();
      ctx.strokeStyle = isHovered || isSelected ? '#ffffff' : border;
      ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2 : 1;
      ctx.stroke();

      // Completed task checkmark
      if (node.type === 'task' && node.status === 'completed') {
        ctx.strokeStyle = '#0d1117';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(node.x - 3, node.y);
        ctx.lineTo(node.x - 1, node.y + 3);
        ctx.lineTo(node.x + 4, node.y - 3);
        ctx.stroke();
      }

      // Label
      const fontSize = Math.max(9, 11 / t.k);
      ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px -apple-system, sans-serif`;
      ctx.fillStyle = isHovered || isSelected ? '#ffffff' : '#c9d1d9';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const label = node.label || node.id;
      const maxLen = 20;
      const displayLabel = label.length > maxLen ? label.slice(0, maxLen) + '...' : label;
      ctx.fillText(displayLabel, node.x, node.y + r + 4);
    }

    ctx.restore();
  }

  _setupInteraction() {
    const canvas = this.canvas;

    // Zoom & pan
    const zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        this.transform = event.transform;
        this._render();
      });

    d3.select(canvas).call(zoom);

    // Hit test helper
    const hitTest = (mx, my) => {
      const [x, y] = this.transform.invert([mx, my]);
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const node = this.nodes[i];
        if (!this._isVisible(node)) continue;
        const r = this._nodeRadius(node);
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy < (r + 4) * (r + 4)) {
          return node;
        }
      }
      return null;
    };

    // Mouse move — hover detection
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);

      if (node !== this.hoveredNode) {
        this.hoveredNode = node;
        canvas.style.cursor = node ? 'pointer' : 'default';
        this._render();
        this.onHover?.(node, e.clientX, e.clientY);
      }
    });

    // Click — select node
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);

      this.selectedNode = node === this.selectedNode ? null : node;
      this._render();
      this.onSelect?.(this.selectedNode);
    });

    // Drag nodes
    let isDragging = false;

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        isDragging = true;
        this.draggedNode = node;
        node.fx = node.x;
        node.fy = node.y;
        this.simulation?.alphaTarget(0.3).restart();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDragging || !this.draggedNode) return;
      const rect = canvas.getBoundingClientRect();
      const [x, y] = this.transform.invert([e.clientX - rect.left, e.clientY - rect.top]);
      this.draggedNode.fx = x;
      this.draggedNode.fy = y;
    });

    const endDrag = () => {
      if (isDragging && this.draggedNode) {
        this.draggedNode.fx = null;
        this.draggedNode.fy = null;
        this.simulation?.alphaTarget(0);
        this.draggedNode = null;
        isDragging = false;
      }
    };

    canvas.addEventListener('mouseup', endDrag);
    canvas.addEventListener('mouseleave', endDrag);
  }

  destroy() {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
  }
}
