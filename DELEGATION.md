# Delegating Work to opencode

Use opencode as a headless coding agent — send tasks, walk away, and check
results. Every session tool uses a `sessionId` to identify which session to
work on. Create sessions explicitly and pass the ID.

### Sessions are identified by sessionId

```javascript
// Create a session, capture the ID
s = session_create(title: "fix build", directory: "/path/to/project")
// → { sessionId: "abc123", title: "fix build", directory: "/path/to/project" }

// Use the sessionId in all subsequent calls
message_send(sessionId: s.sessionId, text: "Fix the build")
session_diff(sessionId: s.sessionId)
session_get_response(sessionId: s.sessionId)
```

---

## Quick Reference

| Step | Tool | What it does |
|------|------|-------------|
| **Create** | `session_create(title?, directory?)` | Returns `{ sessionId, title, directory }` |
| **Send blocking** | `message_send(sessionId, text, agent?)` | Sends prompt, blocks until response complete |
| **Send async** | `prompt_async(sessionId, text, agent?)` | Returns immediately, agent works in background |
| **Check status** | `session_poll_status(sessionId)` | Polls until session becomes idle |
| **Get result** | `session_get_response(sessionId)` | Fetch the assistant's response |
| **See changes** | `session_diff(sessionId)` | Files modified with line counts |
| **Review history** | `message_list(sessionId, limit)` | Recent messages with previews |
| **Abort** | `session_abort(sessionId)` | Stop an in-progress task |
| **Find sessions** | `session_list(title?)` | All sessions, optionally filtered by name |

---

## Pattern 1: Code Review

Send a review task and wait for the result in one call:

```javascript
s = session_create(title: "Code review", directory: "/home/user/my-project")

message_send(
  sessionId: s.sessionId,
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

Review history afterwards: `message_list(sessionId: s.sessionId, limit: 10)`

---

## Pattern 2: Multi-File Implementation

For complex tasks that touch many files, let the agent work autonomously:

```javascript
s = session_create(title: "JWT auth", directory: "/home/user/my-project")

message_send(
  sessionId: s.sessionId,
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
    "Write integration tests for all endpoints. Run tests after each file.",
    "Do not use any external auth libraries beyond jsonwebtoken and bcryptjs."
  ].join("\n")
)
```

Check what was changed: `session_diff(sessionId: s.sessionId)`

---

## Pattern 3: Deep Search & Context Building

Use opencode as a research agent — explore the codebase and report findings
without making any changes:

```javascript
s = session_create(title: "Explore payments", directory: "/home/user/my-project")

message_send(
  sessionId: s.sessionId,
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

Send work to multiple projects simultaneously using separate sessions:

```javascript
// Create independent sessions for each project
s_frontend = session_create(title: "Dark mode", directory: "/home/user/frontend")
s_backend  = session_create(title: "Rate limiting", directory: "/home/user/backend")
s_docs     = session_create(title: "API docs", directory: "/home/user/docs")

// Fire three tasks in parallel (all return immediately):
prompt_async(sessionId: s_frontend.sessionId, text: "Add dark mode toggle to the settings page")
prompt_async(sessionId: s_backend.sessionId,  text: "Add rate limiting to all API routes")
prompt_async(sessionId: s_docs.sessionId,     text: "Update API documentation with the new rate limit headers")

// Check on each one:
session_poll_status(sessionId: s_frontend.sessionId, timeoutMs: 300000)
result_f = session_get_response(sessionId: s_frontend.sessionId)

session_poll_status(sessionId: s_backend.sessionId, timeoutMs: 300000)
result_b = session_get_response(sessionId: s_backend.sessionId)

session_poll_status(sessionId: s_docs.sessionId, timeoutMs: 300000)
result_d = session_get_response(sessionId: s_docs.sessionId)
```

### Parallel tasks in the same directory

Since sessions are identified by sessionId (not directory), you can run
multiple independent sessions in the same project:

```javascript
s1 = session_create(title: "Refactor auth", directory: "/home/user/project")
s2 = session_create(title: "Write tests", directory: "/home/user/project")

prompt_async(sessionId: s1.sessionId, text: "Refactor the auth module")
prompt_async(sessionId: s2.sessionId, text: "Write unit tests for the payment module")

session_poll_status(sessionId: s1.sessionId)
result_a = session_get_response(sessionId: s1.sessionId)

session_poll_status(sessionId: s2.sessionId)
result_b = session_get_response(sessionId: s2.sessionId)
```

---

## Pattern 5: Investigate & Fix

First investigate, then decide whether to apply a fix:

```javascript
// Step 1: Create a session and investigate only
s = session_create(title: "CI investigation", directory: "/home/user/my-project")

prompt_async(
  sessionId: s.sessionId,
  text: "Investigate why the CI pipeline fails on the 'test:e2e' step. " +
    "Look at the CI config, recent test failures, and any related source changes. " +
    "Do NOT make any changes. Report root cause and recommended fix."
)

// Wait for results
session_poll_status(sessionId: s.sessionId, timeoutMs: 120000)
report = session_get_response(sessionId: s.sessionId)

// Step 2: If the report looks good, apply the fix in the same session
message_send(
  sessionId: s.sessionId,
  text: "Apply the fix you recommended for the CI pipeline. Run the tests to verify."
)
```

---

## Pattern 6: Refactor with Safety Net

Fork the session before a risky refactor so you can always go back:

```javascript
s = session_create(title: "Refactor DAL", directory: "/home/user/my-project")

// Do the refactor
message_send(
  sessionId: s.sessionId,
  text: "Refactor the data access layer from callbacks to async/await. " +
    "Update all call sites. Run the full test suite after each file."
)

// If it goes wrong, revert the session's changes:
session_revert(sessionId: s.sessionId)
```

---

## Agent Selection

Use `agent_list()` to see available agents. Pass `agent` to route a task to a
specific agent:

```javascript
s = session_create(title: "Security audit")

message_send(
  sessionId: s.sessionId,
  text: "Audit the codebase for credentials hardcoded in source files",
  agent: "code-reviewer"
)

prompt_async(
  sessionId: s.sessionId,
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

## Reference: All Session Tools

Most session tools accept `sessionId` (required) and optional `directory` for project scoping:

| Tool | Purpose |
|------|---------|
| `session_create(title?, directory?)` | Create a new session → returns `{sessionId, title, directory}` |
| `session_list(title?)` | All sessions, optionally filtered by name |
| `session_get(sessionId)` | Session details |
| `session_delete(sessionId)` | Remove session |
| `session_title(sessionId, title)` | Rename session |
| `session_abort(sessionId)` | Stop in-progress work |
| `session_fork(sessionId)` | Branch from a session |
| `session_share(sessionId)` | Get public URL |
| `session_unshare(sessionId)` | Revoke sharing |
| `session_summarize(sessionId, ...)` | Summarize with a model |
| `session_diff(sessionId)` | Files changed in session |
| `session_revert(sessionId)` | Undo changes |
| `session_unrevert(sessionId)` | Restore reverted |
| `session_todo_list(sessionId)` | AI's task list |
| `session_children(sessionId)` | Child sessions |
| `session_init(sessionId, ...)` | Create AGENTS.md |
| `session_status()` | All session statuses (no sessionId needed) |
| `message_send(sessionId, text, agent?, ...)` | Send prompt, block for response |
| `prompt_async(sessionId, text, agent?, ...)` | Send prompt, return immediately |
| `prompt_and_wait(sessionId, text, agent?, ...)` | Async + poll, one call |
| `session_poll_status(sessionId, ...)` | Wait until session idle |
| `session_get_response(sessionId, ...)` | Fetch latest assistant message |
| `message_list(sessionId, limit)` | Recent messages |
| `message_get(sessionId, messageId)` | Full message |
| `session_command(sessionId, command, ...)` | Slash commands |
| `session_shell(sessionId, command, agent)` | Run shell command |
| `permission_respond(sessionId, permissionID, ...)` | Allow/deny |
