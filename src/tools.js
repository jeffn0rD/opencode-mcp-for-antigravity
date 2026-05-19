import { z } from "zod";
import { isToolEnabled, config, MSG_WAIT_IDLE, MSG_MAX_WAIT } from "./config.js";
import { apiGet, apiPost, apiPatch, apiDelete, apiPut, apiResult, err, ok, formatMessageResponse, waitForSessionIdle } from "./api.js";
import { sessionManager } from "./session.js";
import { log, sleep } from "./logger.js";

export function registerTools(server) {
// ---------------------------------------------------------------------------
// TOOL: health_check
// ---------------------------------------------------------------------------

if (isToolEnabled("health_check")) {
  server.tool(
    "health_check",
    "Get opencode server health status and version",
    {},
    async () => apiResult(await apiGet("/global/health"))
  );
}

// ---------------------------------------------------------------------------
// TOOLS: Sessions
// ---------------------------------------------------------------------------

if (isToolEnabled("session_list")) {
  server.tool(
    "session_list",
    "List all opencode sessions",
    {},
    async () => apiResult(await apiGet("/session"))
  );
}

if (isToolEnabled("session_create")) {
  server.tool(
    "session_create",
    "Create a new opencode session",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      title: z.string().optional().describe("Optional title for the session"),
      parentID: z.string().optional().describe("Optional parent session ID to create a child session"),
    },
    async ({ directory, title, parentID }) => {
      if (directory) {
        const sessionId = await sessionManager.getSessionIdForDirectory(directory, title, parentID);
        return apiResult(await apiGet(`/session/${sessionId}`));
      }
      const body = {};
      if (title) body.title = title;
      if (parentID) body.parentID = parentID;
      return apiResult(await apiPost("/session", body));
    }
  );
}

if (isToolEnabled("session_get")) {
  server.tool(
    "session_get",
    "Get details of a specific session by ID",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
    },
    async ({ directory }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      return apiResult(await apiGet(`/session/${sessionId}`));
    }
  );
}

if (isToolEnabled("session_delete")) {
  server.tool(
    "session_delete",
    "Delete a session and all its data",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
    },
    async ({ directory }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      return apiResult(await apiDelete(`/session/${sessionId}`));
    }
  );
}

if (isToolEnabled("session_update")) {
  server.tool(
    "session_update",
    "Update session properties (e.g. rename it)",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      title: z.string().describe("New title for the session"),
    },
    async ({ directory, title }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      return apiResult(await apiPatch(`/session/${sessionId}`, { title }));
    }
  );
}

if (isToolEnabled("session_abort")) {
  server.tool(
    "session_abort",
    "Abort a currently running session (stop the in-progress AI response)",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
    },
    async ({ directory }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      return apiResult(await apiPost(`/session/${sessionId}/abort`));
    }
  );
}

if (isToolEnabled("session_fork")) {
  server.tool(
    "session_fork",
    "Fork an existing session, optionally at a specific message",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      messageID: z.string().optional().describe("Fork point message ID (defaults to latest)"),
    },
    async ({ directory, messageID }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const body = {};
      if (messageID) body.messageID = messageID;
      return apiResult(await apiPost(`/session/${sessionId}/fork`, body));
    }
  );
}

if (isToolEnabled("session_share")) {
  server.tool(
    "session_share",
    "Share a session publicly and get a share URL",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
    },
    async ({ directory }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      return apiResult(await apiPost(`/session/${sessionId}/share`));
    }
  );
}

if (isToolEnabled("session_unshare")) {
  server.tool(
    "session_unshare",
    "Unshare a previously shared session",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
    },
    async ({ directory }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      return apiResult(await apiDelete(`/session/${sessionId}/share`));
    }
  );
}

if (isToolEnabled("session_summarize")) {
  server.tool(
    "session_summarize",
    "Summarize a session using a specified model",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      providerID: z.string().describe("The AI provider ID to use for summarization"),
      modelID: z.string().describe("The model ID to use for summarization"),
    },
    async ({ directory, providerID, modelID }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      return apiResult(await apiPost(`/session/${sessionId}/summarize`, { providerID, modelID }));
    }
  );
}

if (isToolEnabled("session_diff")) {
  server.tool(
    "session_diff",
    "Get the file diff for a session (what files were changed)",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      messageID: z.string().optional().describe("Optional message ID to diff up to"),
    },
    async ({ directory, messageID }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const query = messageID ? { messageID } : {};
      return apiResult(await apiGet(`/session/${sessionId}/diff`, query));
    }
  );
}

if (isToolEnabled("session_revert")) {
  server.tool(
    "session_revert",
    "Revert a session to a specific message (undo changes after that message)",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      messageID: z.string().describe("The message ID to revert to"),
      partID: z.string().optional().describe("Optional specific part ID within the message"),
    },
    async ({ directory, messageID, partID }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const body = { messageID };
      if (partID) body.partID = partID;
      return apiResult(await apiPost(`/session/${sessionId}/revert`, body));
    }
  );
}

if (isToolEnabled("session_unrevert")) {
  server.tool(
    "session_unrevert",
    "Restore all reverted messages in a session",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
    },
    async ({ directory }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      return apiResult(await apiPost(`/session/${sessionId}/unrevert`));
    }
  );
}

if (isToolEnabled("session_todo_list")) {
  server.tool(
    "session_todo_list",
    "Get the todo/task list for a session (tasks the AI is tracking)",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
    },
    async ({ directory }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      return apiResult(await apiGet(`/session/${sessionId}/todo`));
    }
  );
}

if (isToolEnabled("session_children")) {
  server.tool(
    "session_children",
    "Get child sessions of a session",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
    },
    async ({ directory }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      return apiResult(await apiGet(`/session/${sessionId}/children`));
    }
  );
}

if (isToolEnabled("session_status")) {
  server.tool(
    "session_status",
    "Get status (idle/busy/retry) for all sessions",
    {},
    async () => apiResult(await apiGet("/session/status"))
  );
}

if (isToolEnabled("permission_respond")) {
  server.tool(
    "permission_respond",
    "Respond to a permission request from opencode (e.g. allow/deny a file edit or bash command)",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      permissionID: z.string().describe("The permission request ID"),
      response: z.string().describe("The response: 'allow', 'deny', or 'always'"),
      remember: z.boolean().optional().describe("Whether to remember this decision"),
    },
    async ({ directory, permissionID, response, remember }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const body = { response };
      if (remember !== undefined) body.remember = remember;
      return apiResult(
        await apiPost(`/session/${sessionId}/permissions/${permissionID}`, body)
      );
    }
  );
}

// ---------------------------------------------------------------------------
// TOOLS: Messages
// ---------------------------------------------------------------------------

if (isToolEnabled("message_send")) {
  server.tool(
    "message_send",
    [
      "Send a message to an opencode session and wait for the full AI response.",
      "This is the primary way to interact with opencode — provide a prompt and get back the assistant's reply.",
      "The tool blocks until the session becomes idle (response complete) or the timeout is reached.",
      "Returns the assistant's text response plus a summary of any tools it used.",
    ].join(" "),
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      text: z.string().describe("The message/prompt text to send"),
      providerID: z.string().optional().describe("AI provider ID (e.g. 'anthropic', 'openai')"),
      modelID: z.string().optional().describe("Model ID (e.g. 'claude-opus-4-5', 'gpt-4o')"),
      agent: z.string().optional().describe("Agent name to use for this message"),
      noReply: z.boolean().optional().describe("If true, send without waiting for AI reply"),
    },
    async ({ directory, text, providerID, modelID, agent, noReply }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const body = {
        parts: [{ type: "text", text }],
      };
      if (providerID || modelID) {
        body.model = {};
        if (providerID) body.model.providerID = providerID;
        if (modelID) body.model.modelID = modelID;
      }
      if (agent) body.agent = agent;
      if (noReply) body.noReply = true;

      log("debug", `Sending message to opencode API: ${JSON.stringify(body).substring(0, 200)}...`);
      const result = await apiPost(`/session/${sessionId}/message`, body);
      if (!result.ok) {
        log("error", `Failed to send message: HTTP ${result.status}`);
        return err(`HTTP ${result.status}`, result.data);
      }

      log("debug", `Message sent successfully, response: ${JSON.stringify(result.data).substring(0, 200)}...`);

      // If noReply or waitForIdle is disabled, return immediately
      if (noReply || !MSG_WAIT_IDLE) {
        log("debug", `Returning immediately (noReply=${noReply}, MSG_WAIT_IDLE=${MSG_WAIT_IDLE})`);
        return ok(formatMessageResponse(result.data));
      }

      // Wait for the session to become idle via SSE
      try {
        log("debug", `Waiting for session ${sessionId} to become idle (timeout: ${MSG_MAX_WAIT}ms)`);
        const idleResult = await waitForSessionIdle(sessionId, MSG_MAX_WAIT);
        const formatted = formatMessageResponse(result.data);
        
        if (idleResult.error) {
          formatted._sessionError = idleResult.error;
        }
        
        log("debug", `Session ${sessionId} wait completed: ${JSON.stringify(idleResult)}`);
        return ok(formatted);
      } catch (e) {
        // SSE failed — still return the message data we have
        log("error", `SSE wait failed: ${e.message} — returning initial response`);
        return ok({ 
          ...formatMessageResponse(result.data), 
          _sseWarning: e.message,
          _debug: { sessionId, timeout: MSG_MAX_WAIT, error: e.message }
        });
      }
    }
  );
}

if (isToolEnabled("message_list")) {
  server.tool(
    "message_list",
    "List all messages in a session",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      limit: z.number().optional().describe("Maximum number of messages to return"),
    },
    async ({ directory, limit }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const query = limit ? { limit } : {};
      const result = await apiGet(`/session/${sessionId}/message`, query);
      if (!result.ok) return err(`HTTP ${result.status}`, result.data);
      // Summarize for readability
      const messages = Array.isArray(result.data) ? result.data : [];
      const summary = messages.map((m) => ({
        messageId: m.info?.id,
        role: m.info?.role,
        created: m.info?.time?.created,
        model: m.info?.modelID,
        textPreview: m.parts
          ?.filter((p) => p.type === "text" && !p.synthetic)
          ?.map((p) => p.text?.slice(0, 200))
          ?.join(" ")
          ?.trim() || "",
        toolCount: m.parts?.filter((p) => p.type === "tool").length || 0,
        error: m.info?.error || null,
      }));
      return ok(summary);
    }
  );
}

if (isToolEnabled("message_get")) {
  server.tool(
    "message_get",
    "Get full details of a specific message including all parts",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      messageId: z.string().describe("The message ID"),
    },
    async ({ directory, messageId }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const result = await apiGet(`/session/${sessionId}/message/${messageId}`);
      if (!result.ok) return err(`HTTP ${result.status}`, result.data);
      return ok(formatMessageResponse(result.data));
    }
  );
}

if (isToolEnabled("prompt_async")) {
  server.tool(
    "prompt_async",
    "Send a message asynchronously — returns immediately without waiting for the AI response (fire and forget)",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      text: z.string().describe("The prompt text to send"),
      providerID: z.string().optional().describe("AI provider ID"),
      modelID: z.string().optional().describe("Model ID"),
      agent: z.string().optional().describe("Agent name"),
    },
    async ({ directory, text, providerID, modelID, agent }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const body = { parts: [{ type: "text", text }] };
      if (providerID || modelID) {
        body.model = {};
        if (providerID) body.model.providerID = providerID;
        if (modelID) body.model.modelID = modelID;
      }
      if (agent) body.agent = agent;
      const result = await apiPost(`/session/${sessionId}/prompt_async`, body);
      if (!result.ok) return err(`HTTP ${result.status}`, result.data);
      return ok({ sent: true, sessionId, note: "Message sent asynchronously. Use message_list or subscribe to events to get the response." });
    }
  );
}

if (isToolEnabled("session_command")) {
  server.tool(
    "session_command",
    "Execute a slash command in a session (e.g. /compact, /clear)",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      command: z.string().describe("The slash command name (without the slash, e.g. 'compact')"),
      arguments: z.string().optional().describe("Arguments to pass to the command"),
      agent: z.string().optional().describe("Agent to use"),
      modelID: z.string().optional().describe("Model ID to use"),
    },
    async ({ directory, command, arguments: args, agent, modelID }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const body = { command, arguments: args || "" };
      if (agent) body.agent = agent;
      if (modelID) body.model = { modelID };
      const result = await apiPost(`/session/${sessionId}/command`, body);
      if (!result.ok) return err(`HTTP ${result.status}`, result.data);
      return ok(formatMessageResponse(result.data));
    }
  );
}

if (isToolEnabled("session_shell")) {
  server.tool(
    "session_shell",
    "Run a shell command within an opencode session context",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      command: z.string().describe("The shell command to run"),
      agent: z.string().describe("Agent to use for this shell command"),
      modelID: z.string().optional().describe("Model ID to use"),
    },
    async ({ directory, command, agent, modelID }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const body = { command, agent };
      if (modelID) body.model = { modelID };
      const result = await apiPost(`/session/${sessionId}/shell`, body);
      if (!result.ok) return err(`HTTP ${result.status}`, result.data);
      return ok(formatMessageResponse(result.data));
    }
  );
}

// ---------------------------------------------------------------------------
// TOOLS: Files
// ---------------------------------------------------------------------------

if (isToolEnabled("file_list")) {
  server.tool(
    "file_list",
    "List files and directories in the opencode project",
    {
      path: z.string().optional().describe("Path to list (relative to project root, defaults to root)"),
    },
    async ({ path }) => {
      const query = path ? { path } : {};
      return apiResult(await apiGet("/file", query));
    }
  );
}

if (isToolEnabled("file_read")) {
  server.tool(
    "file_read",
    "Read the contents of a file in the opencode project",
    {
      path: z.string().describe("Path to the file (relative to project root)"),
    },
    async ({ path }) => apiResult(await apiGet("/file/content", { path }))
  );
}

if (isToolEnabled("file_status")) {
  server.tool(
    "file_status",
    "Get VCS/git status for all tracked files in the project",
    {},
    async () => apiResult(await apiGet("/file/status"))
  );
}

if (isToolEnabled("find_text")) {
  server.tool(
    "find_text",
    "Search for text/regex patterns across files in the project",
    {
      pattern: z.string().describe("Text or regex pattern to search for"),
    },
    async ({ pattern }) => apiResult(await apiGet("/find", { pattern }))
  );
}

if (isToolEnabled("find_file")) {
  server.tool(
    "find_file",
    "Find files or directories by name (fuzzy match)",
    {
      query: z.string().describe("Filename search query (fuzzy match)"),
      type: z.enum(["file", "directory"]).optional().describe("Limit to files or directories only"),
      limit: z.number().min(1).max(200).optional().describe("Maximum number of results (1-200)"),
      searchPath: z.string().optional().describe("Override project root for search"),
    },
    async ({ query, type, limit, searchPath }) => {
      const params = { query };
      if (type) params.type = type;
      if (limit) params.limit = limit;
      if (searchPath) params.directory = searchPath;
      return apiResult(await apiGet("/find/file", params));
    }
  );
}

if (isToolEnabled("find_symbol")) {
  server.tool(
    "find_symbol",
    "Find workspace symbols (functions, classes, variables) by name",
    {
      query: z.string().describe("Symbol name to search for"),
    },
    async ({ query }) => apiResult(await apiGet("/find/symbol", { query }))
  );
}

// ---------------------------------------------------------------------------
// TOOLS: Config & Providers
// ---------------------------------------------------------------------------

if (isToolEnabled("config_get")) {
  server.tool(
    "config_get",
    "Get the current opencode configuration",
    {},
    async () => apiResult(await apiGet("/config"))
  );
}

if (isToolEnabled("config_update")) {
  server.tool(
    "config_update",
    "Update opencode configuration settings",
    {
      updates: z.record(z.unknown()).describe("Configuration key/value pairs to update (partial update)"),
    },
    async ({ updates }) => apiResult(await apiPatch("/config", updates))
  );
}

if (isToolEnabled("provider_list")) {
  server.tool(
    "provider_list",
    "List all AI providers with their connection status and available models",
    {},
    async () => apiResult(await apiGet("/provider"))
  );
}

if (isToolEnabled("config_providers")) {
  server.tool(
    "config_providers",
    "List configured providers and their default models",
    {},
    async () => apiResult(await apiGet("/config/providers"))
  );
}

if (isToolEnabled("provider_auth")) {
  server.tool(
    "provider_auth",
    "Get authentication methods available for each provider",
    {},
    async () => apiResult(await apiGet("/provider/auth"))
  );
}

if (isToolEnabled("auth_set")) {
  server.tool(
    "auth_set",
    "Set authentication credentials for a provider",
    {
      providerId: z.string().describe("The provider ID (e.g. 'anthropic', 'openai')"),
      credentials: z.record(z.unknown()).describe("Credential key/value pairs matching the provider's auth schema"),
    },
    async ({ providerId, credentials }) =>
      apiResult(await apiPut(`/auth/${providerId}`, credentials))
  );
}

// ---------------------------------------------------------------------------
// TOOLS: Agents, Commands, VCS, Project
// ---------------------------------------------------------------------------

if (isToolEnabled("agent_list")) {
  server.tool(
    "agent_list",
    "List all available opencode agents",
    {},
    async () => apiResult(await apiGet("/agent"))
  );
}

if (isToolEnabled("command_list")) {
  server.tool(
    "command_list",
    "List all available slash commands",
    {},
    async () => apiResult(await apiGet("/command"))
  );
}

if (isToolEnabled("project_list")) {
  server.tool(
    "project_list",
    "List all known projects",
    {},
    async () => apiResult(await apiGet("/project"))
  );
}

if (isToolEnabled("project_current")) {
  server.tool(
    "project_current",
    "Get the current active project",
    {},
    async () => apiResult(await apiGet("/project/current"))
  );
}

if (isToolEnabled("vcs_info")) {
  server.tool(
    "vcs_info",
    "Get VCS (git) information for the current project",
    {},
    async () => apiResult(await apiGet("/vcs"))
  );
}

if (isToolEnabled("lsp_status")) {
  server.tool(
    "lsp_status",
    "Get the status of all LSP (language server) connections",
    {},
    async () => apiResult(await apiGet("/lsp"))
  );
}

if (isToolEnabled("mcp_status")) {
  server.tool(
    "mcp_status",
    "Get the status of all MCP servers configured in opencode",
    {},
    async () => apiResult(await apiGet("/mcp"))
  );
}

// ---------------------------------------------------------------------------
// TOOLS: TUI (excluded by default via config — only useful with TUI running)
// ---------------------------------------------------------------------------

if (isToolEnabled("tui_append_prompt")) {
  server.tool(
    "tui_append_prompt",
    "Append text to the opencode TUI prompt input (requires TUI to be running)",
    {
      text: z.string().describe("Text to append to the current prompt"),
    },
    async ({ text }) => apiResult(await apiPost("/tui/append-prompt", { text }))
  );
}

if (isToolEnabled("tui_submit_prompt")) {
  server.tool(
    "tui_submit_prompt",
    "Submit the current prompt in the opencode TUI (requires TUI to be running)",
    {},
    async () => apiResult(await apiPost("/tui/submit-prompt"))
  );
}

if (isToolEnabled("tui_clear_prompt")) {
  server.tool(
    "tui_clear_prompt",
    "Clear the current prompt in the opencode TUI (requires TUI to be running)",
    {},
    async () => apiResult(await apiPost("/tui/clear-prompt"))
  );
}

if (isToolEnabled("tui_show_toast")) {
  server.tool(
    "tui_show_toast",
    "Show a toast notification in the opencode TUI (requires TUI to be running)",
    {
      message: z.string().describe("The toast message"),
      title: z.string().optional().describe("Optional toast title"),
      variant: z.enum(["info", "success", "warning", "error"]).describe("Toast style variant"),
    },
    async ({ message, title, variant }) => {
      const body = { message, variant };
      if (title) body.title = title;
      return apiResult(await apiPost("/tui/show-toast", body));
    }
  );
}

if (isToolEnabled("tui_open_sessions")) {
  server.tool(
    "tui_open_sessions",
    "Open the session selector in the opencode TUI (requires TUI to be running)",
    {},
    async () => apiResult(await apiPost("/tui/open-sessions"))
  );
}

if (isToolEnabled("tui_open_models")) {
  server.tool(
    "tui_open_models",
    "Open the model selector in the opencode TUI (requires TUI to be running)",
    {},
    async () => apiResult(await apiPost("/tui/open-models"))
  );
}

// ---------------------------------------------------------------------------
// TOOLS: session_init
// ---------------------------------------------------------------------------

if (isToolEnabled("session_init")) {
  server.tool(
    "session_init",
    "Analyze the app in a session and create AGENTS.md",
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      providerID: z.string().describe("AI provider ID to use for analysis"),
      modelID: z.string().describe("Model ID to use for analysis"),
      messageID: z.string().optional().describe("Optional message ID"),
    },
    async ({ directory, providerID, modelID, messageID }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const body = { providerID, modelID };
      if (messageID) body.messageID = messageID;
      return apiResult(await apiPost(`/session/${sessionId}/init`, body));
    }
  );
}

// ---------------------------------------------------------------------------
// TOOLS: Async workflow helpers
// ---------------------------------------------------------------------------

if (isToolEnabled("session_poll_status")) {
  server.tool(
    "session_poll_status",
    [
      "Poll a session until it becomes idle (AI response complete) or the timeout is reached.",
      "Use this after prompt_async to know when the response is ready to fetch.",
      "Returns immediately if the session is already idle.",
    ].join(" "),
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      timeoutMs: z.number().optional().describe("Max time to wait in milliseconds (default: 120000 = 2 minutes)"),
      pollIntervalMs: z.number().optional().describe("How often to check status in milliseconds (default: 800)"),
    },
    async ({ directory, timeoutMs = 120000, pollIntervalMs = 800 }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const deadline = Date.now() + timeoutMs;
      let attempts = 0;

      while (Date.now() < deadline) {
        attempts++;
        const result = await apiGet("/session/status");
        if (!result.ok) return err(`HTTP ${result.status}`, result.data);

        const sessionStatus = result.data?.[sessionId];
        if (!sessionStatus) {
          return err(`Session '${sessionId}' not found in status response`, result.data);
        }

        if (sessionStatus.type === "idle") {
          return ok({
            status: "idle",
            sessionId,
            elapsedMs: timeoutMs - (deadline - Date.now()),
            attempts,
          });
        }

        if (sessionStatus.type === "retry") {
          log("info", `Session ${sessionId} is retrying: ${sessionStatus.message}`);
        }

        await sleep(pollIntervalMs);
      }

      return err(
        `Session '${sessionId}' did not become idle within ${timeoutMs}ms after ${attempts} attempts. ` +
        `Use session_abort to stop it, or increase timeoutMs.`
      );
    }
  );
}

if (isToolEnabled("session_get_response")) {
  server.tool(
    "session_get_response",
    [
      "Fetch the latest assistant response from a session.",
      "Use this after session_poll_status confirms the session is idle.",
      "Returns the most recent assistant message text, tool usage summary, cost, and token counts.",
    ].join(" "),
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      limit: z.number().optional().describe("Number of recent messages to fetch (default: 10, increase if needed)"),
    },
    async ({ directory, limit = 10 }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      const result = await apiGet(`/session/${sessionId}/message`, { limit });
      if (!result.ok) return err(`HTTP ${result.status}`, result.data);

      const messages = Array.isArray(result.data) ? result.data : [];
      if (messages.length === 0) {
        return ok({ response: null, note: "No messages found in session" });
      }

      // Find the most recent assistant message
      const assistantMessages = messages.filter((m) => m.info?.role === "assistant");
      if (assistantMessages.length === 0) {
        return ok({ response: null, note: "No assistant messages found yet — session may still be starting" });
      }

      const latest = assistantMessages[assistantMessages.length - 1];
      return ok(formatMessageResponse(latest));
    }
  );
}

if (isToolEnabled("prompt_and_wait")) {
  server.tool(
    "prompt_and_wait",
    [
      "Send a prompt asynchronously and then poll until the response is complete — all in one call.",
      "This is an alternative to message_send that uses polling instead of SSE for completion detection.",
      "Useful when SSE streaming is unreliable or when you want explicit control over the timeout.",
      "Returns the full assistant response text once complete.",
    ].join(" "),
    {
      directory: z.string().optional().describe("The working directory (maps to a session)"),
      text: z.string().describe("The prompt text to send"),
      providerID: z.string().optional().describe("AI provider ID (e.g. 'anthropic', 'openai')"),
      modelID: z.string().optional().describe("Model ID (e.g. 'claude-opus-4-5', 'gpt-4o')"),
      agent: z.string().optional().describe("Agent name to use"),
      timeoutMs: z.number().optional().describe("Max wait time in milliseconds (default: 300000 = 5 minutes)"),
      pollIntervalMs: z.number().optional().describe("Polling interval in milliseconds (default: 800)"),
    },
    async ({ directory, text, providerID, modelID, agent, timeoutMs = 300000, pollIntervalMs = 800 }) => {
      const sessionId = await sessionManager.getSessionIdForDirectory(directory);
      // Step 1: Send asynchronously
      const body = { parts: [{ type: "text", text }] };
      if (providerID || modelID) {
        body.model = {};
        if (providerID) body.model.providerID = providerID;
        if (modelID) body.model.modelID = modelID;
      }
      if (agent) body.agent = agent;

      const sendResult = await apiPost(`/session/${sessionId}/prompt_async`, body);
      if (!sendResult.ok) return err(`Failed to send prompt: HTTP ${sendResult.status}`, sendResult.data);

      // Step 2: Poll until idle
      const deadline = Date.now() + timeoutMs;
      let attempts = 0;

      while (Date.now() < deadline) {
        attempts++;
        const statusRes = await apiGet(`/session/status`);
        if (!statusRes.ok) {
          return err(`Failed to poll status: HTTP ${statusRes.status}`, statusRes.data);
        }

        const s = statusRes.data?.[sessionId];
        if (!s) {
          return err(`Session '${sessionId}' not found in status check`, statusRes.data);
        }

        if (s.status?.type === "idle") {
          break; // Exit loop to fetch response
        }

        if (s.status?.type === "error") {
          return err("Session error", s.status.error || s.status);
        }

        await sleep(pollIntervalMs);
      }

      if (Date.now() >= deadline) {
        return err(
          `Prompt sent but session '${sessionId}' did not become idle within ${timeoutMs}ms. ` +
          `Use session_get_response to check later, or session_abort to stop.`
        );
      }

      // Step 3: Fetch response
      const msgResult = await apiGet(`/session/${sessionId}/message`, { limit: 10 });
      if (!msgResult.ok) return err(`Prompt sent and completed, but failed to fetch response: HTTP ${msgResult.status}`, msgResult.data);

      const messages = Array.isArray(msgResult.data) ? msgResult.data : [];
      const assistantMessages = messages.filter((m) => m.info?.role === "assistant");
      if (assistantMessages.length === 0) {
        return ok({ response: null, note: "Session completed but no assistant message found", attempts });
      }

      const latest = assistantMessages[assistantMessages.length - 1];
      return ok({ ...formatMessageResponse(latest), _pollAttempts: attempts });
    }
  );
}

// ---------------------------------------------------------------------------
// MCP Resources
// ---------------------------------------------------------------------------

server.resource(
  "opencode://guide",
  "opencode://guide",
  { mimeType: "text/markdown" },
  async () => {
    const guide = `# opencode MCP — Tool Guide

This MCP server wraps the opencode REST API, giving you programmatic control
over opencode sessions, messages, files, and configuration.

---

## Quick Start Workflow

\`\`\`
1. session_create          → get a sessionId
2. message_send            → send a prompt, block until response complete
3. session_diff            → see what files were changed
4. session_delete          → clean up when done
\`\`\`

---

## Sending Messages — Three Patterns

### Pattern 1: Blocking (recommended for most tasks)
\`message_send(sessionId, text)\`
Sends the prompt and waits for the complete AI response via SSE.
Best for interactive use where you want the answer immediately.

### Pattern 2: Async + Poll
\`\`\`
prompt_async(sessionId, text)          → fire and forget
session_poll_status(sessionId)         → wait until idle
session_get_response(sessionId)        → fetch the response
\`\`\`
Use when you want to do other work while waiting, or send multiple prompts
to different sessions in parallel.

### Pattern 3: Async + Wait combined
\`prompt_and_wait(sessionId, text)\`
Sends async and polls internally — same result as pattern 1 but uses
polling instead of SSE. Use if SSE is unreliable.

---

## Session Lifecycle

| Step | Tool | Notes |
|------|------|-------|
| Create | \`session_create\` | Optionally pass a \`title\` |
| Send prompts | \`message_send\` | Main interaction loop |
| Check progress | \`session_todo_list\` | AI's self-tracked tasks |
| See changes | \`session_diff\` | Files modified this session |
| Undo changes | \`session_revert\` | Reverts to a prior message |
| Fork | \`session_fork\` | Branch from any message |
| Share | \`session_share\` | Get a public URL |
| Delete | \`session_delete\` | Removes session and data |

---

## Async Workflow Detail

Use async when running multiple sessions in parallel:

\`\`\`
// Start two sessions in parallel
s1 = session_create("Refactor auth module")
s2 = session_create("Write unit tests")

prompt_async(s1.id, "Refactor the auth module to use JWT")
prompt_async(s2.id, "Write unit tests for the user service")

// Poll both
session_poll_status(s1.id)   // blocks until s1 idle
session_get_response(s1.id)  // fetch s1 result

session_poll_status(s2.id)   // blocks until s2 idle
session_get_response(s2.id)  // fetch s2 result
\`\`\`

---

## File Operations

| Tool | Use |
|------|-----|
| \`file_list\` | Browse project structure |
| \`file_read\` | Read a specific file |
| \`file_status\` | Git status of tracked files |
| \`find_text\` | Grep across all files |
| \`find_file\` | Fuzzy find by filename |
| \`find_symbol\` | Find functions/classes by name |

---

## Permission Handling

opencode may pause and request permission for sensitive operations (file edits,
bash commands). If a session gets stuck in \`busy\` state, check for pending
permissions and respond:

\`\`\`
session_poll_status(sessionId)        → times out / stays busy
permission_respond(sessionId, id, "allow")
session_poll_status(sessionId)        → now completes
\`\`\`

---

## Providers & Models

\`\`\`
provider_list()     → see all providers and which are connected
config_providers()  → see default models per provider
\`\`\`

Pass \`providerID\` and \`modelID\` to \`message_send\` / \`prompt_and_wait\` to
override the default model for a specific message.

---

## Tool Reference by Domain

### Sessions
\`session_list\`, \`session_create\`, \`session_get\`, \`session_delete\`,
\`session_update\`, \`session_abort\`, \`session_fork\`, \`session_share\`,
\`session_unshare\`, \`session_diff\`, \`session_revert\`, \`session_unrevert\`,
\`session_summarize\`, \`session_children\`, \`session_status\`,
\`session_todo_list\`, \`session_init\`, \`session_poll_status\`

### Messages
\`message_send\`, \`message_list\`, \`message_get\`, \`prompt_async\`,
\`prompt_and_wait\`, \`session_get_response\`, \`session_command\`, \`session_shell\`

### Files & Search
\`file_list\`, \`file_read\`, \`file_status\`, \`find_text\`, \`find_file\`,
\`find_symbol\`

### Config & Providers
\`config_get\`, \`config_update\`, \`provider_list\`, \`config_providers\`,
\`provider_auth\`, \`auth_set\`

### Discovery
\`agent_list\`, \`command_list\`, \`project_list\`, \`project_current\`,
\`vcs_info\`, \`lsp_status\`, \`mcp_status\`, \`health_check\`

### TUI (disabled by default — requires opencode TUI running)
\`tui_append_prompt\`, \`tui_submit_prompt\`, \`tui_clear_prompt\`,
\`tui_show_toast\`, \`tui_open_sessions\`, \`tui_open_models\`
`;

    return {
      contents: [{ uri: "opencode://guide", mimeType: "text/markdown", text: guide }],
    };
  }
);

server.resource(
  "opencode://status",
  "opencode://status",
  { mimeType: "application/json" },
  async () => {
    // Gather live data: health + providers + sessions
    const [health, providers, sessions, config] = await Promise.allSettled([
      apiGet("/global/health"),
      apiGet("/provider"),
      apiGet("/session"),
      apiGet("/config"),
    ]);

    const data = {
      server: health.status === "fulfilled" && health.value.ok
        ? health.value.data
        : { healthy: false, error: "unreachable" },
      providers: providers.status === "fulfilled" && providers.value.ok
        ? {
            connected: providers.value.data?.connected || [],
            defaults: providers.value.data?.default || {},
            all: (providers.value.data?.all || []).map((p) => ({
              id: p.id,
              name: p.name,
              models: p.models?.slice(0, 5).map((m) => m.id) || [], // first 5 models
            })),
          }
        : { error: "unavailable" },
      sessions: sessions.status === "fulfilled" && sessions.value.ok
        ? {
            count: Array.isArray(sessions.value.data) ? sessions.value.data.length : 0,
            sessions: Array.isArray(sessions.value.data)
              ? sessions.value.data.map((s) => ({ id: s.id, title: s.title, directory: s.directory }))
              : [],
          }
        : { error: "unavailable" },
      defaultModel: config.status === "fulfilled" && config.value.ok
        ? config.value.data?.model || null
        : null,
      timestamp: new Date().toISOString(),
    };

    return {
      contents: [{
        uri: "opencode://status",
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      }],
    };
  }
);


}
