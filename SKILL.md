# opencode — AI Coding Agent Skill

This project has access to **opencode** via MCP. opencode is a headless AI
coding agent that can read and edit files, run shell commands, browse your
codebase, and work autonomously on multi-step tasks.

Use the `opencode` MCP tools to delegate coding tasks, get code reviews,
generate tests, refactor modules, or run any agentic coding workflow.

---

## Getting Started

Before sending any prompt, always orient yourself:

```
1. health_check()                  → confirm server is running
2. provider_list()                 → see which AI models are connected
3. project_current()               → confirm the working directory
4. session_list()                  → see any existing sessions
```

Or read the full tool reference:
```
resource: opencode://guide         → complete workflow guide (read this first)
resource: opencode://status        → live server state, providers, open sessions
```

---

## Core Workflow

### Simple task (one prompt, wait for result)

```
session = session_create(title: "Fix the login bug")
result  = message_send(sessionId: session.id, text: "Fix the bug in auth/login.ts where JWT tokens are not being validated")
diff    = session_diff(sessionId: session.id)
```

`message_send` blocks until the AI finishes. `session_diff` shows every file
that was changed.

### Long-running or parallel tasks (async pattern)

```
s1 = session_create(title: "Refactor auth")
s2 = session_create(title: "Write tests")

prompt_async(sessionId: s1.id, text: "Refactor the auth module to use refresh tokens")
prompt_async(sessionId: s2.id, text: "Write comprehensive unit tests for UserService")

session_poll_status(sessionId: s1.id)   → waits until s1 is done
response1 = session_get_response(sessionId: s1.id)

session_poll_status(sessionId: s2.id)   → waits until s2 is done
response2 = session_get_response(sessionId: s2.id)
```

### Alternative: combined async send + wait

```
result = prompt_and_wait(sessionId: session.id, text: "...")
```

Same as async pattern above but in one call. Use when you don't need
parallelism but want polling instead of SSE.

---

## Prompt Writing Tips

opencode agents work best with **clear, scoped prompts**:

| ✅ Good | ❌ Avoid |
|---------|---------|
| "Refactor `src/auth/login.ts` to use the `jsonwebtoken` library instead of the custom JWT implementation" | "Fix authentication" |
| "Write unit tests for all public methods in `UserService` using Jest. Mock the database layer." | "Add tests" |
| "Find all places where we catch errors silently and add proper logging using the `logger` module in `src/utils/logger.ts`" | "Improve error handling" |

---

## Checking What Changed

After any coding session, inspect the changes before accepting them:

```
session_diff(sessionId)           → list of files changed with line counts
file_read(path: "src/auth/login.ts")  → read the actual new content
file_status()                     → git status of all tracked files
```

To undo everything a session did:
```
session_revert(sessionId, messageID: firstMessageId)
```

To undo just the last change:
```
session_revert(sessionId, messageID: lastMessageId)
```

---

## Handling Permissions

opencode may pause to request permission before editing files or running
shell commands. If a session stays `busy` longer than expected:

```
session_status()                          → check all session states
permission_respond(sessionId, permissionID, response: "allow")
```

Response values: `"allow"` · `"deny"` · `"always"` (remember for session)

---

## Forking & Exploration

Fork a session to try an alternative approach without losing the current one:

```
fork = session_fork(sessionId, messageID: beforeTheChange)
result_a = message_send(sessionId: original.id, text: "Use approach A")
result_b = message_send(sessionId: fork.id,     text: "Use approach B")
// Compare diffs, keep whichever you prefer
```

---

## Sharing Results

```
shared = session_share(sessionId)
// shared.share.url → public read-only link to the session transcript
session_unshare(sessionId)  // revoke when done
```

---

## Specifying a Model

Pass `providerID` and `modelID` to any send tool to override the default:

```
message_send(
  sessionId: session.id,
  text: "...",
  providerID: "anthropic",
  modelID: "claude-opus-4-5"
)
```

Use `provider_list()` to see what providers and models are available.

---

## Slash Commands

opencode supports slash commands for session management:

```
session_command(sessionId, command: "compact")   → summarise and compress context
session_command(sessionId, command: "clear")     → clear the prompt input
```

List all available commands: `command_list()`

---

## Common Task Recipes

### Code review
```
session = session_create(title: "Review PR #42")
message_send(sessionId, "Review the changes in git diff HEAD~1 for correctness, 
  security issues, and style. Focus on src/api/")
```

### Generate documentation
```
session = session_create(title: "Generate docs")
message_send(sessionId, "Generate JSDoc comments for all exported functions 
  in src/utils/ that are currently undocumented")
```

### Dependency upgrade
```
session = session_create(title: "Upgrade express")
message_send(sessionId, "Upgrade express from v4 to v5. Update all call sites 
  that use deprecated APIs. Run the tests after each file change.")
```

### Bug investigation
```
session = session_create(title: "Debug memory leak")
message_send(sessionId, "Investigate why memory usage grows over time in the 
  worker process. Check src/workers/ for event listener leaks or uncleaned 
  intervals. Report findings before making any changes.")
```

### Initialize agents context
```
session_init(sessionId, providerID: "anthropic", modelID: "claude-opus-4-5")
// Creates AGENTS.md — a manifest of the project structure for future agents
```

---

## Full Tool List

| Category | Tools |
|----------|-------|
| **Send prompts** | `message_send`, `prompt_async`, `prompt_and_wait` |
| **Get responses** | `session_get_response`, `message_list`, `message_get` |
| **Wait for completion** | `session_poll_status` |
| **Session management** | `session_create`, `session_list`, `session_get`, `session_delete`, `session_update`, `session_abort`, `session_fork`, `session_share`, `session_unshare`, `session_summarize`, `session_revert`, `session_unrevert`, `session_init` |
| **Inspect sessions** | `session_diff`, `session_todo_list`, `session_children`, `session_status` |
| **Files & search** | `file_list`, `file_read`, `file_status`, `find_text`, `find_file`, `find_symbol` |
| **Config** | `config_get`, `config_update`, `provider_list`, `config_providers`, `auth_set` |
| **Discovery** | `agent_list`, `command_list`, `project_current`, `vcs_info`, `health_check` |
| **Permissions** | `permission_respond` |
| **Commands** | `session_command`, `session_shell` |

---

## Resources

| Resource | Content |
|----------|---------|
| `opencode://guide` | Full workflow guide with examples |
| `opencode://status` | Live server health, connected providers, open sessions |

Read resources at the start of a session to orient yourself:
```
read_resource("opencode://status")   → what's connected right now
read_resource("opencode://guide")    → detailed tool reference
```