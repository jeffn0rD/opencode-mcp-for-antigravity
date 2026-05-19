# opencode — AI Coding Agent Skill

This project has access to **opencode** via MCP. opencode is a headless AI
coding agent that can read and edit files, run shell commands, browse your
codebase, and work autonomously on multi-step tasks.

Use the `opencode` MCP tools to delegate coding tasks, get code reviews,
generate tests, refactor modules, or run any agentic coding workflow.

---

## Sessions & Directories

Every opencode session is tied to a working directory. The `directory`
parameter tells opencode which project to operate on.

| Concept | Meaning |
|---------|---------|
| `directory` | A project path on disk. All tools accept this instead of a raw session ID. |
| Session | A conversation + workspace attached to a directory. Holds message history, file diffs, and agent context. |
| Default | If you omit `directory`, it defaults to *this* project's root. |

**The same directory always maps to the same session.** You don't manage session
IDs — just pass the directory path and the MCP server handles the mapping.

```javascript
// These two calls use the same session (same directory):
message_send(directory: "/home/user/my-project", text: "Add error handling")
message_send(directory: "/home/user/my-project", text: "Now add tests")

// Different directory → different session:
message_send(directory: "/home/user/other-project", text: "Fix the build")
```

---

## Getting Started

Before sending any prompt, orient yourself:

```
1. health_check()                  → confirm server is running
2. provider_list()                 → see which AI models are connected
3. project_current()               → confirm the working directory
4. session_list()                  → see all existing sessions
```

Read the full workflow reference:
```
read_resource("opencode://guide")    → complete workflow guide
read_resource("opencode://status")   → live server state, providers, sessions
```

---

## Core Workflow

### 1. Send a prompt and wait for the result

```javascript
message_send(
  directory: "/home/user/my-project",
  text: "Fix the bug in auth/login.ts where JWT tokens are not being validated"
)
```

`message_send` blocks until the AI finishes. The response includes the
assistant's text, tool usage summary, costs, and token counts.

### 2. Check what changed

```javascript
session_diff(directory: "/home/user/my-project")
// → list of files changed with line counts
```

### 3. Inspect the response

```javascript
message_list(directory: "/home/user/my-project", limit: 5)
// → recent messages with role, model, text preview
```

---

## Delegation Patterns

### Fire-and-forget (async send, check later)

```javascript
prompt_async(directory: "/home/user/my-project", text: "Refactor auth to use refresh tokens")
// Returns immediately. Session starts working in the background.

session_poll_status(directory: "/home/user/my-project", timeoutMs: 300000)
// Blocks until idle or timeout.

session_get_response(directory: "/home/user/my-project")
// Fetches the latest assistant message.
```

### Parallel delegation (send to multiple directories)

```javascript
// Kick off work in different projects simultaneously:
prompt_async(directory: "/home/user/project-a", text: "Add input validation to the API")
prompt_async(directory: "/home/user/project-b", text: "Write unit tests for the payment module")

// Poll each one in turn:
session_poll_status(directory: "/home/user/project-a", timeoutMs: 300000)
result_a = session_get_response(directory: "/home/user/project-a")

session_poll_status(directory: "/home/user/project-b", timeoutMs: 300000)
result_b = session_get_response(directory: "/home/user/project-b")
```

### Combined async + wait (one call, polling instead of SSE)

```javascript
prompt_and_wait(
  directory: "/home/user/my-project",
  text: "Upgrade express to v5 and fix all deprecated API calls",
  timeoutMs: 600000
)
// Sends async then polls until idle. Same result as message_send
// but uses polling instead of SSE.
```

---

## Model Selection

Override the default model on any send:

```javascript
message_send(
  directory: "/home/user/my-project",
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
message_list(directory: "/home/user/my-project", limit: 1)
// → get the first message ID
session_revert(directory: "/home/user/my-project", messageID: "msg_abc123")
```

---

## Handling Permissions

opencode may pause to request permission before editing files or running
shell commands. If a session stays `busy` longer than expected:

```javascript
session_status()
// → check all session states, find any pending permission requests

permission_respond(
  directory: "/home/user/my-project",
  permissionID: "perm_xyz",
  response: "allow"
)
```

Response values: `"allow"` · `"deny"` · `"always"` (remember for session)

---

## Forking & Exploration

Fork a session to try an alternative approach:

```javascript
session_fork(directory: "/home/user/my-project", messageID: "msg_xyz")
// → fork session exploring approach A in original
message_send(directory: "/home/user/my-project", text: "Use approach A")
// → fork explores approach B
message_send(directory: "/home/user/other-project", text: "Use approach B")
```

---

## Common Task Recipes

### Code review
```javascript
message_send(
  directory: "/home/user/my-project",
  text: "Review the changes in git diff HEAD~1 for correctness, security issues, and style. Focus on src/api/"
)
```

### Deep investigation (no changes)
```javascript
message_send(
  directory: "/home/user/my-project",
  text: "Investigate why memory usage grows over time in the worker process. Check src/workers/ for event listener leaks or uncleaned intervals. Report findings — do NOT make any changes."
)
```

### Dependency upgrade
```javascript
message_send(
  directory: "/home/user/my-project",
  text: "Upgrade lodash from v4 to v5. Update all call sites that use deprecated APIs and run the tests after each file change."
)
```

### Generate documentation
```javascript
message_send(
  directory: "/home/user/my-project",
  text: "Generate JSDoc comments for all exported functions in src/utils/ that are currently undocumented."
)
```

### Initialize agent context (AGENTS.md)
```javascript
session_init(
  directory: "/home/user/my-project",
  providerID: "anthropic",
  modelID: "claude-opus-4-5"
)
// Creates AGENTS.md — a project manifest for future sessions
```

---

## Full Tool Reference

| Category | Tools |
|----------|-------|
| **Send prompts** | `message_send(directory, text, ...)` — blocks, waits for response |
| | `prompt_async(directory, text, ...)` — fire and forget |
| | `prompt_and_wait(directory, text, ...)` — async + poll, one call |
| **Get responses** | `session_get_response(directory)` — latest assistant message |
| | `message_list(directory, limit)` — recent messages |
| | `message_get(directory, messageId)` — full message details |
| **Wait** | `session_poll_status(directory, timeoutMs)` — poll until idle |
| **Sessions** | `session_create(directory, title)` — create (auto-maps to directory) |
| | `session_list()` — all sessions |
| | `session_get(directory)` — session details |
| | `session_delete(directory)` — remove session and data |
| | `session_update(directory, title)` — rename |
| | `session_abort(directory)` — stop in-progress response |
| | `session_status()` — idle/busy/retry for all sessions |
| **Inspect** | `session_diff(directory)` — files changed |
| | `session_todo_list(directory)` — AI's task list |
| | `session_children(directory)` — child sessions |
| **Version control** | `session_revert(directory, messageID)` — undo changes |
| | `session_unrevert(directory)` — restore reverted messages |
| | `session_fork(directory, messageID)` — branch from a message |
| **Share** | `session_share(directory)` — get public URL |
| | `session_unshare(directory)` — revoke |
| **Summarize** | `session_summarize(directory, providerID, modelID)` |
| **Init** | `session_init(directory, providerID, modelID)` — create AGENTS.md |
| **Files** | `file_list(path)`, `file_read(path)`, `file_status()` |
| **Search** | `find_text(pattern)`, `find_file(query)`, `find_symbol(query)` |
| **Config** | `config_get()`, `config_update(updates)`, `provider_list()` |
| **Auth** | `config_providers()`, `provider_auth()`, `auth_set(providerId, credentials)` |
| **Discovery** | `agent_list()`, `command_list()`, `project_current()`, `vcs_info()`, `lsp_status()`, `mcp_status()`, `health_check()` |
| **TUI** | `tui_append_prompt(text)`, `tui_submit_prompt()`, `tui_clear_prompt()`, `tui_show_toast(message, variant)`, `tui_open_sessions()`, `tui_open_models()` |
| **Permissions** | `permission_respond(directory, permissionID, response, remember)` |
| **Commands** | `session_command(directory, command, arguments)` |
| **Shell** | `session_shell(directory, command, agent)` |
| **Async helpers** | `session_poll_status(directory, timeoutMs)`, `session_get_response(directory, limit)`, `prompt_and_wait(directory, text, ...)` |

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
