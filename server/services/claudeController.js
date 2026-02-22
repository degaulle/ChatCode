import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';

const GRAPH_INSTRUCTION = `

IMPORTANT: After completing the above task, you MUST read the existing knowledge_graph.json (if it exists) and then write an updated version. This graph tracks YOUR work — what the user asked for and what you built in response.

Node types:
- "task": A user request or command you just completed (label = short description of what was asked)
- "concept": A feature, system, or idea involved (label = feature name)
- "file": A file you created or modified (label = filename, path = relative path)

Edge types:
- "implements": file implements a concept/feature
- "produces": task produces a file
- "requires": one thing depends on another
- "relates_to": conceptual relationship
- "modifies": task modifies an existing file

Write knowledge_graph.json with this schema:
{
  "nodes": [
    {"id": "unique_id", "type": "task|concept|file", "label": "display name", "path": "file path (files only)", "summary": "brief description", "status": "created|modified|completed|pending"}
  ],
  "edges": [
    {"source": "node_id", "target": "node_id", "type": "implements|produces|requires|relates_to|modifies"}
  ]
}

Rules:
- Preserve ALL existing nodes and edges from the current knowledge_graph.json
- Add a "task" node for THIS command you just completed
- Add "file" nodes for every file you created or modified
- Add "concept" nodes for features/systems involved
- Connect them with appropriate edges
- Do NOT scan or map pre-existing project files that you didn't touch`;

export class ClaudeController extends EventEmitter {
  constructor() {
    super();
    this.status = 'uninitialized';
    this.projectDir = null;
    this._currentProcess = null;
    this._accumulatedOutput = '';
  }

  onReady(callback) {
    this.on('ready', callback);
  }

  async init(projectDir) {
    this.projectDir = projectDir;
    this.status = 'idle';
    console.log('Claude Controller initialized for project:', projectDir);
  }

  async sendPrompt(text) {
    if (!this.projectDir) {
      throw new Error('Claude controller not initialized. Call init() first.');
    }
    if (this._currentProcess) {
      throw new Error('Claude is already running a command.');
    }

    this.status = 'running';
    this._accumulatedOutput = '';

    const fullPrompt = text + GRAPH_INSTRUCTION;

    const execEnv = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/local/node/bin:${process.env.PATH || ''}`,
    };
    // Remove CLAUDECODE env var to avoid "nested session" detection
    delete execEnv.CLAUDECODE;

    const child = spawn('claude', [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', 'claude-sonnet-4-5-20250929',
      '--dangerously-skip-permissions',
    ], {
      cwd: this.projectDir,
      env: execEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this._currentProcess = child;

    // Send prompt via stdin to avoid argument length limits
    child.stdin.write(fullPrompt);
    child.stdin.end();

    const rl = createInterface({ input: child.stdout });

    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        const parsed = JSON.parse(line);
        console.log(`Stream event: ${parsed.type}${parsed.subtype ? '/' + parsed.subtype : ''}`);
        this._handleStreamEvent(parsed);
      } catch {
        // Not valid JSON — emit as raw text
        this._accumulatedOutput += line + '\n';
        this.emit('output_chunk', { type: 'text', content: line + '\n' });
      }
    });

    let stderrData = '';
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrData += text;
      // Stream stderr as progress info (Claude Code may output progress here)
      if (text.trim()) {
        this.emit('output_chunk', { type: 'text', content: `[stderr] ${text}` });
      }
    });

    child.on('close', (code) => {
      this._currentProcess = null;
      if (code !== 0 && stderrData) {
        console.error('Claude process stderr:', stderrData);
        this.emit('output_chunk', {
          type: 'error',
          content: `\n[Process exited with code ${code}]: ${stderrData}`,
        });
        this._accumulatedOutput += `\n[Error]: ${stderrData}`;
      }
      this.status = 'idle';
      this.emit('ready');
      console.log(`Claude process exited with code ${code}`);
    });

    child.on('error', (err) => {
      this._currentProcess = null;
      this.status = 'error';
      console.error('Failed to spawn claude process:', err);
      this.emit('output_chunk', {
        type: 'error',
        content: `Failed to start Claude: ${err.message}`,
      });
      this.emit('ready');
    });

    console.log('Prompt sent to Claude Code (headless)');
  }

  _handleStreamEvent(event) {
    let textContent = '';

    if (event.type === 'assistant') {
      // Assistant message — contains text and/or tool_use content blocks
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text' && block.text) {
            textContent += block.text;
          } else if (block.type === 'tool_use') {
            const inputSummary = block.input
              ? JSON.stringify(block.input).slice(0, 200)
              : '';
            textContent += `\n[Tool: ${block.name}] ${inputSummary}\n`;
          }
        }
      }
    } else if (event.type === 'user') {
      // Tool result from Claude Code
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'tool_result') {
            const result = typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content);
            textContent += `[Result] ${result.slice(0, 300)}\n`;
          }
        }
      }
    } else if (event.type === 'result') {
      // Final result
      this.emit('output_chunk', { type: 'complete', content: '' });
      return;
    }
    // Ignore 'system' init events

    if (textContent) {
      this._accumulatedOutput += textContent;
      this.emit('output_chunk', { type: 'text', content: textContent });
    }
  }

  async getOutput() {
    return this._accumulatedOutput;
  }

  async destroy() {
    if (this._currentProcess) {
      this._currentProcess.kill('SIGTERM');
      this._currentProcess = null;
    }
    this.status = 'uninitialized';
    console.log('Claude controller destroyed');
  }
}
