# Delegating Work to opencode

Use opencode as a headless coding agent — send tasks, walk away, and check
results. Every tool uses `directory` to identify which project to work on.

### Sessions are directories

The `directory` parameter maps to an opencode session. Same directory = same
session. You never need to manage session IDs.

```javascript
// All operations on the same directory share one session:
message_send(directory: "/path/to/project", text: "Fix the build")
session_diff(directory: "/path/to/project")
session_get_response(directory: "/path/to/project")
```

---

## Quick Reference

| Step | Tool | What it does |
|------|------|-------------|
| **Create or reuse** | *just pass `directory`* | Session auto-created on first use |
| **Send blocking** | `message_send(directory, text, agent?)` | Sends prompt, blocks until response complete |
| **Send async** | `prompt_async(directory, text, agent?)` | Returns immediately, agent works in background |
| **Check status** | `session_poll_status(directory)` | Polls until session becomes idle |
| **Get result** | `session_get_response(directory)` | Fetch the assistant's response |
| **See changes** | `session_diff(directory)` | Files modified with line counts |
| **Review history** | `message_list(directory, limit)` | Recent messages with previews |
| **Abort** | `session_abort(directory)` | Stop an in-progress task |

---

## Pattern 1: Code Review

Send a review task and wait for the result in one call:

```javascript
message_send(
  directory: "/home/user/my-project",
  agent: "code-reviewer",
  text: "Review changes in src/api/ since last commit. Check for:\n" +
    "- Security vulnerabilities (SQL injection, XSS, auth bypass)\n" +
    "- Error handling gaps (uncaught promises, missing try/catch)\n" +
    "- Performance issues (N+1 queries, large payloads)\n" +
    "- Style violations against the project conventions\n\n" +
    "For each issue found, provide: file path, line number, severity, and fix suggestion."
)
```

`message_send` blocks — the response comes back with the full review.

Review history afterwards: `message_list(directory: "/home/user/my-project", limit: 10)`

---

## Pattern 2: Multi-File Implementation

For complex tasks that touch many files, let the agent work autonomously:

```javascript
message_send(
  directory: "/home/user/my-project",
  text: [
    "Implement user authentication using JWT with the following requirements:",
    "",
    "1. POST /api/auth/register — create user with email + hashed password",
    "2. POST /api/auth/login — validate credentials, return access + refresh tokens",
    "3. GET /api/auth/me — return current user from JWT token",
    "4. POST /api/auth/refresh — exchange refresh token for new access token",
    "5. POST /api/auth/logout — invalidate refresh token",
    "",
    "Follow the existing patterns in src/auth/. Add validation with zod. ",
    "Write integration tests for all endpoints. Run tests after each route.",
    "Do not use any external auth libraries beyond jsonwebtoken and bcryptjs."
  ].join("\n")
)
```

Check what was changed: `session_diff(directory: "/home/user/my-project")`

---

## Pattern 3: Deep Search & Context Building

Use opencode as a research agent — explore the codebase and report findings
without making any changes:

```javascript
message_send(
  directory: "/home/user/my-project",
  agent: "explore",
  text: [
    "I need to understand how payments are processed. Do NOT make any changes.",
    "",
    "1. Find all files related to payment processing (look in src/payments/, ",
    "   src/billing/, and any references in the database layer)",
    "2. Map the full payment flow: from API endpoint → business logic → ",
    "   database → third-party provider integration",
    "3. Identify:",
    "   - Which providers are supported (Stripe, PayPal, etc.)",
    "   - How webhooks are handled",
    "   - Where subscription billing logic lives",
    "   - How refunds work",
    "4. List all database tables and their schemas related to payments",
    "5. Note any error handling gaps or missing edge cases",
    "",
    "Output a structured report with file paths, function names, and architecture diagram (ASCII)."
  ].join("\n")
)
```

This is also useful for onboarding — hand a new contributor the output of a
deep search session to get them up to speed.

---

## Pattern 4: Parallel Delegation

Send work to multiple project directories simultaneously:

```javascript
// Fire three tasks in parallel (all return immediately):
prompt_async(directory: "/home/user/frontend", text: "Add dark mode toggle to the settings page")
prompt_async(directory: "/home/user/backend",   text: "Add rate limiting to all API routes")
prompt_async(directory: "/home/user/docs",      text: "Update API documentation with the new rate limit headers")

// Check on each one:
session_poll_status(directory: "/home/user/frontend", timeoutMs: 300000)
result_f = session_get_response(directory: "/home/user/frontend")

session_poll_status(directory: "/home/user/backend", timeoutMs: 300000)
result_b = session_get_response(directory: "/home/user/backend")

session_poll_status(directory: "/home/user/docs", timeoutMs: 300000)
result_d = session_get_response(directory: "/home/user/docs")
```

---

## Pattern 5: Investigate & Fix

First investigate, then decide whether to apply a fix:

```javascript
// Step 1: Investigate only
prompt_async(
  directory: "/home/user/my-project",
  text: "Investigate why the CI pipeline fails on the 'test:e2e' step. " +
    "Look at the CI config, recent test failures, and any related source changes. " +
    "Do NOT make any changes. Report root cause and recommended fix."
)

// Wait for results
session_poll_status(directory: "/home/user/my-project", timeoutMs: 120000)
report = session_get_response(directory: "/home/user/my-project")

// Step 2: If the report looks good, apply the fix
message_send(
  directory: "/home/user/my-project",
  text: "Apply the fix you recommended for the CI pipeline. Run the tests to verify."
)
```

---

## Pattern 6: Refactor with Safety Net

Fork the session before a risky refactor so you can always go back:

```javascript
// Snapshot current state
message_list(directory: "/home/user/my-project", limit: 1)
// → note the first message ID: "msg_start"

// Do the refactor
message_send(
  directory: "/home/user/my-project",
  text: "Refactor the data access layer from callbacks to async/await. " +
    "Update all call sites. Run the full test suite after each file."
)

// If it goes wrong, revert to the fork point:
session_revert(directory: "/home/user/my-project", messageID: "msg_start")
```

---

## Agent Selection

Use `agent_list()` to see available agents. Pass `agent` to route a task to a
specific agent:

```javascript
message_send(
  directory: "/home/user/my-project",
  text: "Audit the codebase for credentials hardcoded in source files",
  agent: "code-reviewer"
)

prompt_async(
  directory: "/home/user/my-project",
  text: "Find all files that import from the legacy utils library",
  agent: "explore"
)
```

Agents are available on: `message_send`, `prompt_async`, `prompt_and_wait`,
`session_command`, `session_shell`.

---

## Prompt Writing Tips

| Do | Don't |
|----|-------|
| Specify exact file paths and patterns | "Fix thing in that one file" |
| State constraints (no new deps, follow existing patterns) | "Just make it work" |
| List requirements as numbered steps | "Do everything" |
| Explicitly say "do NOT make changes" for research tasks | Assume the agent won't change things |
| Ask for specific output format (structured report, diff summary) | Vague requests |
| Include failure modes to check for | Only describe the happy path |

---

## Reference: All Directory-Based Tools

Most tools accept `directory` (defaults to current project root):

| Tool | Purpose |
|------|---------|
| `message_send(directory, text, agent?, ...)` | Send prompt, block for response |
| `prompt_async(directory, text, agent?, ...)` | Send prompt, return immediately |
| `prompt_and_wait(directory, text, agent?, ...)` | Async + poll, one call |
| `session_poll_status(directory, ...)` | Wait until session idle |
| `session_get_response(directory, ...)` | Fetch latest assistant message |
| `session_diff(directory)` | Files changed in session |
| `session_list()` | All sessions (no directory needed) |
| `session_get(directory)` | Session details |
| `session_delete(directory)` | Remove session |
| `session_update(directory, title)` | Rename session |
| `session_abort(directory)` | Stop in-progress work |
| `session_revert(directory, messageID)` | Undo changes |
| `session_unrevert(directory)` | Restore reverted |
| `session_fork(directory, messageID)` | Branch from message |
| `session_share(directory)` | Get public URL |
| `session_unshare(directory)` | Revoke sharing |
| `session_summarize(directory, ...)` | Summarize with a model |
| `session_init(directory, ...)` | Create AGENTS.md |
| `session_todo_list(directory)` | AI's task list |
| `session_children(directory)` | Child sessions |
| `session_command(directory, command, ...)` | Slash commands |
| `session_shell(directory, command, agent)` | Run shell command |
| `permission_respond(directory, permissionID, ...)` | Allow/deny |
| `message_list(directory, limit)` | Recent messages |
| `message_get(directory, messageId)` | Full message |
