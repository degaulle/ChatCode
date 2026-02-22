# ChatCode

Transcript-to-code pipeline with real-time knowledge graph visualization. Upload a conversation transcript, extract actionable tasks, send them to Claude Code for execution, and watch the project grow as an interactive graph.

## How It Works

1. **Upload a transcript** (`.txt`, `.md`, `.docx`) describing what you want to build
2. **Claude Sonnet extracts** features and TODOs from the transcript automatically
3. **Review and send** TODOs to Claude Code via the controller panel (send one-by-one, all at once, or auto-send)
4. **Claude Code executes** each task in headless mode, streaming output in real-time
5. **Knowledge graph builds** incrementally as Claude Code works — showing tasks completed, files created, and concepts involved

## Architecture

```
Transcript Upload ──> Claude Sonnet (extraction) ──> TODO Queue
                                                        │
                                                   Controller
                                                        │
                                              Claude Code (headless)
                                                        │
                                            knowledge_graph.json
                                                        │
                                              D3.js Force Graph
```

**Frontend:** React 18 + Vite + D3.js v7 (Canvas rendering)
**Backend:** Node.js + Express + WebSocket (ws)
**Extraction:** Claude Sonnet via Anthropic API
**Execution:** Claude Code CLI in headless mode (`-p --output-format stream-json`)
**Graph:** D3.js force-directed simulation on HTML5 Canvas

## Setup

```bash
# Clone
git clone https://github.com/degaulle/ChatCode.git
cd ChatCode

# Install dependencies
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your API keys:
#   OPENAI_API_KEY=sk-...        (for Whisper transcription, optional)
#   ANTHROPIC_API_KEY=sk-ant-... (for Claude Sonnet extraction)
```

## Running

```bash
npm run dev
```

Opens the server on `http://localhost:3001` and the client on `http://localhost:5173`.

## Usage

### Transcript Upload
Upload a `.txt`, `.md`, or `.docx` file containing a conversation transcript. The system parses the text and extracts features and TODOs.

### Manual Input
Type commands directly in the controller panel text box and press Enter or click Send.

### Controller
- **Send Next** — Send the first TODO in the queue to Claude Code
- **Send All** — Combine all TODOs into one prompt and send
- **Auto ON/OFF** — Automatically send the next TODO when Claude Code finishes
- **Send** (per item) — Send a specific TODO
- **Skip** (per item) — Remove a TODO from the queue

### Knowledge Graph
The graph visualizes the project as it's being built:
- **Task nodes** (green squares) — Commands executed by Claude Code
- **File nodes** (blue circles) — Files created or modified
- **Concept nodes** (purple hexagons) — Features and systems involved
- **Edges** — Relationships: implements, produces, requires, relates_to, modifies

Interact with the graph: zoom, pan, drag nodes, hover for tooltips, click for details.

### Claude Code Output
The output panel streams Claude Code's responses in real-time, showing text output and tool usage as it works.

## Project Structure

```
ChatCode/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioUploadPanel.jsx   # Transcript file upload
│   │   │   ├── ClaudeOutputPanel.jsx  # Streaming output display
│   │   │   ├── ControllerPanel.jsx    # TODO queue and controls
│   │   │   ├── GraphControls.jsx      # Graph visualization settings
│   │   │   ├── GraphLegend.jsx        # Node/edge type legend
│   │   │   ├── KnowledgeGraph.jsx     # D3 graph canvas wrapper
│   │   │   ├── ProjectPanel.jsx       # Save/load projects
│   │   │   └── TranscriptPanel.jsx    # Live transcript display
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.js    # Mic recording (optional)
│   │   │   └── useWebSocket.js        # WebSocket with auto-reconnect
│   │   ├── utils/
│   │   │   └── graphRenderer.js       # D3 force simulation + Canvas
│   │   ├── styles/App.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── vite.config.js
├── server/
│   ├── services/
│   │   ├── claudeController.js        # Claude Code headless execution
│   │   ├── graphManager.js            # knowledge_graph.json watcher
│   │   ├── projectManager.js          # Project save/load
│   │   ├── summarizer.js              # Claude Sonnet extraction
│   │   └── transcription.js           # Whisper API (optional)
│   └── index.js                       # Express + WebSocket server
├── workspace/                          # Claude Code working directory
├── .env.example
└── package.json
```

## Requirements

- Node.js 18+
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- Anthropic API key (for transcript extraction)
- OpenAI API key (optional, for Whisper audio transcription)
