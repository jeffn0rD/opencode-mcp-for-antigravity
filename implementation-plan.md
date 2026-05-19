# High-Level Implementation Plan

1. **Modularize Architecture**: Refactor `server.js` into separate modules (`src/index.js`, `src/session.js`, `src/api.js`, etc.) to improve maintainability.
2. **Context-Aware Sessions (old)**: Tools accepted `directory` instead of `sessionID`, with an internal manager mapping directories to active sessions. **Removed** — see point 5.
3. **Network Transport Support**: Add `SSEServerTransport` alongside standard I/O to enable remote access to the MCP server.
4. **Configuration Updates**: Update configurations to support network binding and protocol selection.
5. **Direct Session Management (current)**: Removed the implicit `directory → sessionId` mapping. Agents create sessions explicitly via `session_create`, receive a `sessionId`, and pass it to all session tools. `session_list` supports discovery by title and directory. This enables multiple independent sessions per project directory.