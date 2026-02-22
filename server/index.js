import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { transcribeAudio } from './services/transcription.js';
import { extractFeaturesAndTodos } from './services/summarizer.js';
import { ClaudeController } from './services/claudeController.js';
import { GraphManager } from './services/graphManager.js';
import { ProjectManager } from './services/projectManager.js';
import { v4 as uuidv4 } from 'uuid';
import { mkdirSync } from 'fs';
import mammoth from 'mammoth';

const PORT = process.env.PORT || 3001;
// Claude Code works in a separate workspace directory, not the ChatCode source
const APP_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const PROJECT_DIR = join(APP_ROOT, 'workspace');
try { mkdirSync(PROJECT_DIR, { recursive: true }); } catch {}

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Services
const claude = new ClaudeController();
const graphManager = new GraphManager(PROJECT_DIR);
const projectManager = new ProjectManager();

// Per-client state
const clientState = new Map();

// Broadcast to all connected clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

// Graph file watcher — broadcast updates
graphManager.onUpdate((graph) => {
  broadcast({ type: 'graph_update', graph });
});

// Stream Claude output chunks to all clients in real-time
claude.on('output_chunk', (chunk) => {
  broadcast({ type: 'claude_output_chunk', ...chunk });
});

// Claude completion callback
claude.onReady(() => {
  broadcast({ type: 'claude_ready' });
  broadcast({ type: 'claude_status', status: 'idle' });
});

// Debounced extraction — runs after transcript stops changing for 2s
function scheduleExtraction(ws, state) {
  if (state.extractionTimer) {
    clearTimeout(state.extractionTimer);
  }
  state.extractionTimer = setTimeout(async () => {
    if (!state.fullTranscript || state.fullTranscript.trim().length < 10) return;
    if (state.extracting) return;

    state.extracting = true;
    console.log(`Running extraction on ${state.fullTranscript.length} chars of transcript`);

    try {
      const result = await extractFeaturesAndTodos(state.fullTranscript, state.lastExtraction);
      state.lastExtraction = result;
      console.log(`Extraction complete: ${result.features?.length || 0} features, ${result.todos?.length || 0} todos`);
      ws.send(JSON.stringify({
        type: 'extraction',
        ...result,
      }));
    } catch (err) {
      console.error('Extraction error:', err);
    } finally {
      state.extracting = false;
    }
  }, 2000);
}

// WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');

  const state = {
    fullTranscript: '',
    lastExtraction: null,
    extractionTimer: null,
    extracting: false,
    pendingDocx: false,
  };
  clientState.set(ws, state);

  // Reset the knowledge graph on new connection (fresh start)
  graphManager.reset();
  ws.send(JSON.stringify({ type: 'graph_update', graph: { nodes: [], edges: [] } }));
  ws.send(JSON.stringify({ type: 'claude_status', status: claude.status }));
  // Send accumulated output for late-joining clients
  if (claude.status === 'running') {
    claude.getOutput().then((text) => {
      if (text) ws.send(JSON.stringify({ type: 'claude_output', text }));
    });
  }

  ws.on('message', async (data, isBinary) => {
    // Binary data
    if (isBinary) {
      // Check if this is a pending docx upload
      if (state.pendingDocx) {
        state.pendingDocx = false;
        try {
          const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
          const text = result.value?.trim();
          if (!text) {
            ws.send(JSON.stringify({ type: 'error', message: 'Docx file is empty' }));
            return;
          }
          console.log(`Docx parsed: ${text.length} chars`);
          state.fullTranscript = text;
          ws.send(JSON.stringify({
            type: 'transcript_chunk',
            text,
            fullTranscript: text,
            timestamp: Date.now(),
          }));
          // Run extraction immediately
          if (!state.extracting) {
            state.extracting = true;
            try {
              const extracted = await extractFeaturesAndTodos(text, state.lastExtraction);
              state.lastExtraction = extracted;
              console.log(`Extraction complete: ${extracted.features?.length || 0} features, ${extracted.todos?.length || 0} todos`);
              ws.send(JSON.stringify({ type: 'extraction', ...extracted }));
            } catch (err) {
              console.error('Extraction error:', err);
            } finally {
              state.extracting = false;
            }
          }
        } catch (err) {
          console.error('Docx parse error:', err);
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to parse docx: ' + err.message }));
        }
        return;
      }

      // Otherwise treat as audio chunk
      try {
        const rawText = await transcribeAudio(Buffer.from(data));
        if (!rawText || rawText.trim().length === 0) return;
        state.fullTranscript += (state.fullTranscript ? ' ' : '') + rawText;
        ws.send(JSON.stringify({
          type: 'transcript_chunk',
          text: rawText,
          fullTranscript: state.fullTranscript,
          timestamp: Date.now(),
        }));
        scheduleExtraction(ws, state);
      } catch (err) {
        console.error('Transcription error:', err);
        ws.send(JSON.stringify({ type: 'error', message: 'Transcription failed: ' + err.message }));
      }
      return;
    }

    // JSON messages
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'send_to_claude': {
        try {
          if (claude.status === 'uninitialized') {
            await claude.init(PROJECT_DIR);
          }
          // Instantly add a pending task node to the graph
          const taskId = 'task_' + Date.now();
          const label = msg.text.length > 60 ? msg.text.slice(0, 60) + '...' : msg.text;
          graphManager.addNode({
            id: taskId,
            type: 'task',
            label,
            summary: msg.text,
            status: 'pending',
          });
          broadcast({ type: 'claude_status', status: 'running' });
          await claude.sendPrompt(msg.text);
        } catch (err) {
          console.error('Claude send error:', err);
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to send to Claude: ' + err.message }));
          broadcast({ type: 'claude_status', status: 'error' });
        }
        break;
      }

      case 'docx_upload': {
        // Flag that the next binary message is a docx file
        state.pendingDocx = true;
        console.log(`Expecting docx upload: ${msg.name}`);
        break;
      }

      case 'transcript_upload': {
        // Direct transcript text from uploaded document
        if (msg.text) {
          state.fullTranscript = msg.text;
          console.log(`Transcript uploaded: ${msg.name || 'unnamed'} (${msg.text.length} chars)`);
          ws.send(JSON.stringify({
            type: 'transcript_chunk',
            text: msg.text,
            fullTranscript: msg.text,
            timestamp: Date.now(),
          }));
          // Run extraction immediately (no debounce)
          if (msg.text.trim().length >= 10 && !state.extracting) {
            state.extracting = true;
            try {
              const result = await extractFeaturesAndTodos(msg.text, state.lastExtraction);
              state.lastExtraction = result;
              console.log(`Extraction complete: ${result.features?.length || 0} features, ${result.todos?.length || 0} todos`);
              ws.send(JSON.stringify({ type: 'extraction', ...result }));
            } catch (err) {
              console.error('Extraction error:', err);
            } finally {
              state.extracting = false;
            }
          }
        }
        break;
      }

      case 'init_claude': {
        try {
          await claude.init(msg.projectDir || PROJECT_DIR);
          broadcast({ type: 'claude_status', status: 'idle' });
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to init Claude: ' + err.message }));
        }
        break;
      }

      case 'force_extract': {
        // Manually trigger extraction
        if (state.fullTranscript.trim().length >= 10) {
          scheduleExtraction(ws, state);
        }
        break;
      }

      case 'clear_transcript': {
        state.fullTranscript = '';
        state.lastExtraction = null;
        break;
      }

      case 'save_project': {
        try {
          const projectData = {
            name: msg.name,
            fullTranscript: state.fullTranscript,
            extraction: state.lastExtraction,
            graph: msg.graph || { nodes: [], edges: [] },
            queue: msg.queue || [],
          };
          await projectManager.saveProject(msg.name, projectData);
          ws.send(JSON.stringify({ type: 'project_saved', name: msg.name }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: 'Save failed: ' + err.message }));
        }
        break;
      }

      case 'load_project': {
        try {
          const project = await projectManager.loadProject(msg.name);
          // Restore state
          if (project.fullTranscript) state.fullTranscript = project.fullTranscript;
          if (project.extraction) state.lastExtraction = project.extraction;
          ws.send(JSON.stringify({ type: 'project_loaded', ...project }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: 'Load failed: ' + err.message }));
        }
        break;
      }

      case 'list_projects': {
        try {
          const projects = await projectManager.listProjects();
          ws.send(JSON.stringify({ type: 'project_list', projects }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: 'List failed: ' + err.message }));
        }
        break;
      }

      case 'delete_project': {
        try {
          await projectManager.deleteProject(msg.name);
          ws.send(JSON.stringify({ type: 'project_deleted', name: msg.name }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: 'Delete failed: ' + err.message }));
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (state.extractionTimer) clearTimeout(state.extractionTimer);
    clientState.delete(ws);
    console.log('Client disconnected');
  });
});

// REST API for projects
app.get('/api/projects', async (req, res) => {
  try { res.json(await projectManager.listProjects()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/projects/:name', async (req, res) => {
  try { res.json(await projectManager.loadProject(req.params.name)); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

app.post('/api/projects/:name', async (req, res) => {
  try { await projectManager.saveProject(req.params.name, req.body); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/projects/:name', async (req, res) => {
  try { await projectManager.deleteProject(req.params.name); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await claude.destroy();
  graphManager.stop();
  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`ChatCode server running on http://localhost:${PORT}`);
  console.log(`Project directory: ${PROJECT_DIR}`);
});
