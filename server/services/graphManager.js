import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { watch } from 'chokidar';

export class GraphManager {
  constructor(projectDir) {
    this.projectDir = projectDir;
    this.graphPath = join(projectDir, 'knowledge_graph.json');
    this._callback = null;
    this._watcher = null;
    this._lastGraph = null;

    this._initGraph();
    this._startWatching();
  }

  _initGraph() {
    if (!existsSync(this.graphPath)) {
      const empty = { nodes: [], edges: [] };
      writeFileSync(this.graphPath, JSON.stringify(empty, null, 2));
      this._lastGraph = empty;
    } else {
      this._lastGraph = this._readGraph();
    }
  }

  _readGraph() {
    try {
      const raw = readFileSync(this.graphPath, 'utf-8');
      const data = JSON.parse(raw);
      // Validate basic schema
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        console.warn('Invalid graph schema, resetting');
        return { nodes: [], edges: [] };
      }
      return data;
    } catch (err) {
      console.error('Error reading graph:', err.message);
      return { nodes: [], edges: [] };
    }
  }

  _startWatching() {
    this._watcher = watch(this.graphPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200 },
    });

    this._watcher.on('change', () => {
      const graph = this._readGraph();
      // Only broadcast if actually changed
      if (JSON.stringify(graph) !== JSON.stringify(this._lastGraph)) {
        this._lastGraph = graph;
        console.log(`Graph updated: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
        this._callback?.(graph);
      }
    });
  }

  // Programmatically add a node and broadcast immediately
  addNode(node) {
    if (!this._lastGraph) this._lastGraph = { nodes: [], edges: [] };
    // Don't duplicate
    if (this._lastGraph.nodes.some((n) => n.id === node.id)) return;
    this._lastGraph.nodes.push(node);
    // Also write to disk so Claude sees it
    writeFileSync(this.graphPath, JSON.stringify(this._lastGraph, null, 2));
    this._callback?.(this._lastGraph);
  }

  // Reset graph to empty (fresh start on page load)
  reset() {
    const empty = { nodes: [], edges: [] };
    this._lastGraph = empty;
    writeFileSync(this.graphPath, JSON.stringify(empty, null, 2));
  }

  onUpdate(callback) {
    this._callback = callback;
  }

  getGraphSync() {
    return this._lastGraph;
  }

  stop() {
    this._watcher?.close();
  }
}
