# opencode — AI Coding Agent Skill

This project has access to **opencode** via MCP. opencode is a headless AI
coding agent that can read and edit files, run shell commands, browse your
codebase, and work autonomously on multi-step tasks.

Use the `opencode` MCP tools to delegate coding tasks, get code reviews,
generate tests, refactor modules, or run any agentic coding workflow.

---

## Sessions & Session IDs

Every opencode session is a conversation + workspace attached to a project
directory. Sessions are identified by a **sessionId** — always return the
sessionId from `session_create` and pass it to subsequent tools.

| Concept | Meaning |
|---------|---------|
| `sessionId` | Unique ID for a session (returned by `session_create`). Pass this to all session tools. |
| `directory` | Optional project path for API scoping. Not used for session identity. |
| `title` | Optional name for a session. Use it to find sessions later via `session_list`. |

**The same directory can have many sessions.** You create sessions explicitly
and manage their IDs:

```javascript
// Create a named session and capture its ID
s = session_create(title: "fix login bug", directory: "/home/user/my-project")
// → { sessionId: "abc123", title: "fix login bug", directory: "/home/user/my-project" }

// Use the sessionId in all subsequent calls
message_send(sessionId: s.sessionId, text: "Add error handling")
message_send(sessionId: s.sessionId, text: "Now add tests")

// Different session, same directory — independent!
s2 = session_create(title: "refactor auth", directory: "/home/user/my-project")
message_send(sessionId: s2.sessionId, text: "Rewrite the auth module")
```

---

## Getting Started

Before sending any prompt, orient yourself:

```
1. health_check()                  → confirm server is running
2. provider_list()                 → see which AI models are connected
3. project_current(directory)      → confirm the working directory
4. session_list()                  → see all existing sessions
```

Read the full workflow reference:
```
read_resource("opencode://guide")    → complete workflow guide
read_resource("opencode://status")   → live server state, providers, sessions
```

---

## Core Workflow

### 1. Create a session

```javascript
s = session_create(
  title: "Fix JWT validation",          // optional: name it for later discovery
  directory: "/home/user/my-project"    // optional: project scoping
)
// → { sessionId: "...", title: "...", directory: "..." }
```

### 2. Send a prompt and wait for the result

```javascript
message_send(
  sessionId: s.sessionId,
  text: "Fix the bug in auth/login.ts where JWT tokens are not being validated"
)
```

`message_send` blocks until the AI finishes. The response includes the
assistant's text, tool usage summary, costs, and token counts.

### 3. Check what changed

```javascript
session_diff(sessionId: s.sessionId)
// → list of files changed with line counts
```

### 4. Inspect the response

```javascript
message_list(sessionId: s.sessionId, limit: 5)
// → recent messages with role, model, text preview
```

---

## Finding Sessions

List all sessions or filter by title:

```javascript
// All sessions
session_list()
// → [{ sessionId, title, directory, status, created }, ...]

// Filter by title (case-insensitive substring match)
session_list(title: "fix login bug")
// → matching sessions
```

---

## Delegation Patterns

### Fire-and-forget (async send, check later)

```javascript
s = session_create(title: "Refactor auth")
prompt_async(sessionId: s.sessionId, text: "Refactor auth to use refresh tokens")
// Returns immediately. Session starts working in the background.

session_poll_status(sessionId: s.sessionId, timeoutMs: 300000)
// Blocks until idle or timeout.

session_get_response(sessionId: s.sessionId)
// Fetches the latest assistant message.
```

### Parallel delegation (multiple sessions in the same project)

```javascript
// Create independent sessions for parallel work
s1 = session_create(title: "Input validation", directory: "/home/user/project")
s2 = session_create(title: "Unit tests", directory: "/home/user/project")

// Kick off both simultaneously:
prompt_async(sessionId: s1.sessionId, text: "Add input validation to the API")
prompt_async(sessionId: s2.sessionId, text: "Write unit tests for the payment module")

// Poll each one in turn:
session_poll_status(sessionId: s1.sessionId, timeoutMs: 300000)
result_a = session_get_response(sessionId: s1.sessionId)

session_poll_status(sessionId: s2.sessionId, timeoutMs: 300000)
result_b = session_get_response(sessionId: s2.sessionId)
```

### Combined async + wait (one call, polling instead of SSE)

```javascript
s = session_create(title: "Upgrade express")
prompt_and_wait(
  sessionId: s.sessionId,
  text: "Upgrade express to v5 and fix all deprecated API calls",
  timeoutMs: 600000
)
// Sends async then polls until idle. Same result as message_send
// but uses polling instead of SSE.
```

---

## Agent Selection

Specify which opencode agent handles a task. Agents are named configurations
that define the AI's capabilities, tools, and behaviour.

List available agents: `agent_list()`

Pass `agent` to any send tool:

```javascript
message_send(
  sessionId: s.sessionId,
  text: "Review the code for security vulnerabilities",
  agent: "code-reviewer"        // use a specialised agent
)

prompt_async(
  sessionId: s.sessionId,
  text: "Explore the codebase and report on the data layer architecture",
  agent: "explore"              // lightweight agent for research
)
```

Available on: `message_send`, `prompt_async`, `prompt_and_wait`, `session_command`, `session_shell`.

## Model Selection

Override the default model on any send:

```javascript
message_send(
  sessionId: s.sessionId,
  text: "Refactor the data layer",
  providerID: "anthropic",
  modelID: "claude-opus-4-5"
)
```

List available providers and models: `provider_list()`

---

## Reverting Changes

```javascript
// Undo everything a session did:
session_revert(sessionId: s.sessionId)
```

---

## Handling Permissions

opencode may pause to request permission before editing files or running
shell commands. If a session stays `busy` longer than expected:

```javascript
session_status()
// → check all session states, find any pending permission requests

permission_respond(
  sessionId: s.sessionId,
  permissionID: "perm_xyz",
  response: "allow"
)
```

Response values: `"allow"` · `"deny"` · `"always"` (remember for session)

---

## Forking & Exploration

Fork a session to try an alternative approach:

```javascript
s1 = session_create(title: "Explore approach A")
s2 = session_fork(sessionId: s1.sessionId)
// → s2 is a copy of s1's conversation

message_send(sessionId: s1.sessionId, text: "Use approach A")
message_send(sessionId: s2.sessionId, text: "Use approach B")
```

---

## Common Task Recipes

### Code review
```javascript
s = session_create(title: "Code review")
message_send(
  sessionId: s.sessionId,
  text: "Review the changes in git diff HEAD~1 for correctness, security issues, and style. Focus on src/api/"
)
```

### Deep investigation (no changes)
```javascript
s = session_create(title: "Investigate memory leak")
message_send(
  sessionId: s.sessionId,
  text: "Investigate why memory usage grows over time in the worker process. Check src/workers/ for event listener leaks or uncleaned intervals. Report findings — do NOT make any changes."
)
```

### Dependency upgrade
```javascript
s = session_create(title: "Upgrade lodash")
message_send(
  sessionId: s.sessionId,
  text: "Upgrade lodash from v4 to v5. Update all call sites that use deprecated APIs and run the tests after each file change."
)
```

### Generate documentation
```javascript
s = session_create(title: "Generate JSDoc")
message_send(
  sessionId: s.sessionId,
  text: "Generate JSDoc comments for all exported functions in src/utils/ that are currently undocumented."
)
```

### Initialize agent context (AGENTS.md)
```javascript
session_init(
  sessionId: s.sessionId,
  providerID: "anthropic",
  modelID: "claude-opus-4-5"
)
// Creates AGENTS.md — a project manifest for future sessions
```

---

## Full Tool Reference

| Category | Tools |
|----------|-------|
| **Sessions** | `session_create(title, directory)` — creates a new session, returns `{sessionId, title, directory}` |
| | `session_list(title?)` — all sessions, optionally filtered by title |
| | `session_get(sessionId)` — session details |
| | `session_delete(sessionId)` — remove session and data |
| | `session_title(sessionId, title)` — rename |
| | `session_abort(sessionId)` — stop in-progress response |
| | `session_status()` — idle/busy/retry for all sessions |
| **Send prompts** | `message_send(sessionId, text, ...)` — blocks, waits for response |
| | `prompt_async(sessionId, text, ...)` — fire and forget |
| | `prompt_and_wait(sessionId, text, ...)` — async + poll, one call |
| **Get responses** | `session_get_response(sessionId)` — latest assistant message |
| | `message_list(sessionId, limit)` — recent messages |
| | `message_get(sessionId, messageId)` — full message details |
| **Wait** | `session_poll_status(sessionId, timeoutMs)` — poll until idle |
| **Inspect** | `session_diff(sessionId)` — files changed |
| | `session_todo_list(sessionId)` — AI's task list |
| | `session_children(sessionId)` — child sessions |
| **Version control** | `session_revert(sessionId)` — undo changes |
| | `session_unrevert(sessionId)` — restore reverted messages |
| | `session_fork(sessionId)` — branch from a message |
| **Share** | `session_share(sessionId)` — get public URL |
| | `session_unshare(sessionId)` — revoke |
| **Summarize** | `session_summarize(sessionId, providerID, modelID)` |
| **Init** | `session_init(sessionId, providerID, modelID)` — create AGENTS.md |
| **Files** | `file_list(path)`, `file_read(path)`, `file_status()` |
| **Search** | `find_text(pattern)`, `find_file(query)`, `find_symbol(query)` |
| **Config** | `config_get()`, `config_update(updates)`, `provider_list()` |
| **Auth** | `config_providers()`, `provider_auth()`, `auth_set(providerId, credentials)` |
| **Discovery** | `agent_list()`, `command_list()`, `project_current()`, `vcs_info()`, `lsp_status()`, `mcp_status()`, `health_check()` |
| **TUI** | `tui_append_prompt(text)`, `tui_submit_prompt()`, `tui_clear_prompt()`, `tui_show_toast(message, variant)`, `tui_open_sessions()`, `tui_open_models()` |
| **Permissions** | `permission_respond(sessionId, permissionID, response, remember)` |
| **Commands** | `session_command(sessionId, command, arguments)` |
| **Shell** | `session_shell(sessionId, command, agent)` |
| **Async helpers** | `session_poll_status(sessionId, timeoutMs)`, `session_get_response(sessionId, limit)`, `prompt_and_wait(sessionId, text, ...)` |

---

## Resources

| Resource | Content |
|----------|---------|
| `opencode://guide` | Full workflow guide with examples |
| `opencode://status` | Live server health, connected providers, open sessions |

```
read_resource("opencode://status")   → what's connected right now
read_resource("opencode://guide")    → detailed tool reference
```
