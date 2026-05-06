# opencode-mcp

An MCP (Model Context Protocol) server that wraps the [opencode](https://opencode.ai) REST API. Drop it into any MCP-compatible client (Claude Desktop, Cursor, Antigravity, etc.) and control opencode programmatically through natural language.

**Key behaviours:**
- **Auto-launches** `opencode serve` if the server is not already running
- **Self-registers** into `~/.gemini/antigravity/mcp_config.json` on first run
- **Blocks on `message_send`** — waits for the full AI response via SSE before returning
- All behaviour is controlled by `config.json` — no code changes needed

---

## Requirements

- Node.js 18+
- [`opencode`](https://opencode.ai/docs/installation) installed and in PATH

---

## Installation

```bash
git clone <this-repo>
cd opencode-mcp
npm install
```

Make `server.js` executable (optional, for direct invocation):

```bash
chmod +x server.js
```

---

## Quick Start

Run it directly — it will auto-launch opencode and self-register:

```bash
node server.js
```

On first run you'll see:

```
[opencode-mcp] [INFO] Registered 'opencode' in /home/you/.gemini/antigravity/mcp_config.json
[opencode-mcp] [INFO] opencode server not detected at http://127.0.0.1:4096 — launching...
[opencode-mcp] [INFO] opencode server is up on http://127.0.0.1:4096
[opencode-mcp] [INFO] MCP server connected and ready
```

---

## Configuration

All configuration lives in `config.json`. You never need to touch `server.js`.

```jsonc
{
  "server": {
    "host": "127.0.0.1",        // opencode server host
    "port": 4096,                // opencode server port (default: 4096)
    "launchCommand": "opencode", // command to launch opencode
    "launchArgs": ["serve"],     // args passed to launchCommand
    "startupTimeoutMs": 8000,    // how long to wait for opencode to start
    "pollIntervalMs": 200,       // health check polling interval
    "leaveRunningOnExit": true,  // don't kill opencode when MCP exits
    "auth": {
      "passwordEnvVar": "OPENCODE_SERVER_PASSWORD",  // env var for basic auth password
      "usernameEnvVar": "OPENCODE_SERVER_USERNAME",  // env var for basic auth username
      "defaultUsername": "opencode"
    }
  },
  "mcp": {
    "serverName": "opencode",    // key used in mcp_config.json
    "version": "1.0.0",
    "selfRegistration": {
      "enabled": true,
      "configPath": "~/.gemini/antigravity/mcp_config.json"
    }
  },
  "tools": {
    "include": ["*"],            // "*" = all tools
    "exclude": ["tui_*"]         // exclude TUI tools by default (need TUI running)
  },
  "messages": {
    "waitForIdle": true,         // block message_send until response is complete
    "maxWaitMs": 300000,         // max wait: 5 minutes (for long agentic tasks)
    "pollIntervalMs": 500
  }
}
```

### Connecting to an already-running opencode instance

If opencode is already running on a custom port:

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 9000,
    "launchArgs": ["serve", "--port", "9000"]
  }
}
```

### Using authentication

Start opencode with a password:

```bash
OPENCODE_SERVER_PASSWORD=secret opencode serve
```

Then set the same env var when running the MCP server:

```bash
OPENCODE_SERVER_PASSWORD=secret node server.js
```

### Enabling TUI tools

To include TUI control tools (only useful when `opencode` TUI is open in a terminal):

```json
{
  "tools": {
    "include": ["*"],
    "exclude": []
  }
}
```

### Disabling specific tools

Expose only the tools you need to keep the LLM tool list lean:

```json
{
  "tools": {
    "include": ["*"],
    "exclude": ["tui_*", "auth_set", "config_update", "session_shell"]
  }
}
```

---

## MCP Client Setup

### Antigravity

Self-registration happens automatically on first run. The server writes to:

```
~/.gemini/antigravity/mcp_config.json
```

Result:

```json
{
  "mcpServers": {
    "opencode": {
      "command": "node",
      "args": ["/absolute/path/to/opencode-mcp/server.js"],
      "env": {}
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "opencode": {
      "command": "node",
      "args": ["/absolute/path/to/opencode-mcp/server.js"],
      "env": {
        "OPENCODE_SERVER_PASSWORD": "optional-if-using-auth"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "opencode": {
      "command": "node",
      "args": ["/absolute/path/to/opencode-mcp/server.js"]
    }
  }
}
```

---

## Available Tools

Tools are grouped by domain. All are enabled by default except TUI tools.

### Core Workflow

| Tool | Description |
|---|---|
| `message_send` | **Primary tool.** Send a prompt to a session and get the full AI response back (blocks until complete) |
| `session_create` | Create a new session |
| `session_list` | List all sessions |
| `session_get` | Get session details |
| `session_abort` | Stop an in-progress AI response |

### Session Management

| Tool | Description |
|---|---|
| `session_update` | Rename a session |
| `session_delete` | Delete a session and all its data |
| `session_fork` | Fork a session at a specific message |
| `session_share` / `session_unshare` | Share/unshare a session publicly |
| `session_diff` | See what files were changed in a session |
| `session_revert` / `session_unrevert` | Undo/redo changes |
| `session_summarize` | Summarize a session with a model |
| `session_children` | Get child sessions |
| `session_status` | Get idle/busy/retry status for all sessions |
| `session_todo_list` | Get the AI's task list for a session |
| `session_init` | Analyze project and create AGENTS.md |

### Messages

| Tool | Description |
|---|---|
| `message_list` | List messages in a session |
| `message_get` | Get full details of a message |
| `prompt_async` | Send a prompt without waiting for response |
| `session_command` | Execute a slash command (e.g. `/compact`) |
| `session_shell` | Run a shell command in session context |
| `permission_respond` | Allow/deny a permission request from the AI |

### Files & Search

| Tool | Description |
|---|---|
| `file_list` | List project files/directories |
| `file_read` | Read a file's contents |
| `file_status` | Get git status for tracked files |
| `find_text` | Search for text/regex across files |
| `find_file` | Find files by name (fuzzy) |
| `find_symbol` | Find code symbols (functions, classes) |

### Config & Providers

| Tool | Description |
|---|---|
| `config_get` | Get opencode config |
| `config_update` | Update config settings |
| `provider_list` | List providers and connection status |
| `config_providers` | List configured providers and default models |
| `provider_auth` | Get auth methods for providers |
| `auth_set` | Set provider credentials |

### Discovery

| Tool | Description |
|---|---|
| `agent_list` | List available agents |
| `command_list` | List available slash commands |
| `project_list` | List known projects |
| `project_current` | Get current project |
| `vcs_info` | Get git info for current project |
| `lsp_status` | Get LSP server status |
| `mcp_status` | Get MCP server status (within opencode) |
| `health_check` | Check server health and version |

### TUI Tools *(disabled by default)*

| Tool | Description |
|---|---|
| `tui_append_prompt` | Append text to the TUI prompt |
| `tui_submit_prompt` | Submit the TUI prompt |
| `tui_clear_prompt` | Clear the TUI prompt |
| `tui_show_toast` | Show a toast notification |
| `tui_open_sessions` | Open session selector |
| `tui_open_models` | Open model selector |

---

## How `message_send` Works

`message_send` is the most important tool. Here's what happens internally:

```
1. POST /session/:id/message  →  sends the prompt, gets back initial message info
2. GET  /event (SSE stream)   →  listens for session.idle event
3. When session.idle fires    →  returns the formatted response to the LLM
4. Timeout (default 5 min)    →  returns whatever was received + a warning
```

The response is formatted for readability — text parts are extracted and concatenated, tool calls are summarised as `[tool:name] title (status)`.

---

## How Auto-Launch Works

On every startup, the MCP server:

1. `GET /global/health` — if `200 OK`, opencode is already running, proceed
2. If connection refused — spawn `opencode serve --port <port>` as a detached background process
3. Poll `/global/health` every 200ms up to `startupTimeoutMs` (default 8s)
4. If still not up — throw a clear error with instructions

The spawned process is **detached** (`child.unref()`) so it outlives the MCP server — opencode keeps running even if the MCP server is restarted.

---

## Troubleshooting

**`opencode not found`** — Make sure opencode is installed and in your PATH:
```bash
which opencode   # should return a path
opencode --version
```

**Server won't start within timeout** — Increase `startupTimeoutMs` in `config.json` or start opencode manually first:
```bash
opencode serve &
node server.js
```

**Auth errors** — Set the env var before running:
```bash
OPENCODE_SERVER_PASSWORD=your-password node server.js
```

**Port conflict** — Change `port` in `config.json` and update `launchArgs` to match:
```json
{
  "server": {
    "port": 5000,
    "launchArgs": ["serve", "--port", "5000"]
  }
}
```

**TUI tools return errors** — They require the opencode TUI to be open in a terminal. Enable them in config and make sure `opencode` (not `opencode serve`) is running.