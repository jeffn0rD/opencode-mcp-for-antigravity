import { z } from "zod";
import { isToolEnabled, config, MSG_WAIT_IDLE, MSG_MAX_WAIT } from "../config.js";
import { apiGet, apiPost, apiPatch, apiDelete, apiPut, apiResult, err, ok, formatMessageResponse, waitForSessionIdle } from "../api.js";
import { sessionManager } from "../session.js";
import { log, sleep } from "../logger.js";

export function registerTools(server) {

  // Global tools
  if (isToolEnabled("health_check")) {
    server.tool(
      "health_check",
      "Get opencode server health status and version",
      {},
      async () => apiResult(await apiGet("/global/health"))
    );
  }

  // Session / Directory tools
  if (isToolEnabled("session_list")) {
    server.tool(
      "session_list",
      "List all opencode sessions",
      {},
      async () => apiResult(await apiGet("/session"))
    );
  }

  if (isToolEnabled("session_get")) {
    server.tool(
      "session_get",
      "Get details of a specific session by directory",
      {
        directory: z.string().optional().describe("The working directory (defaults to current)"),
      },
      async ({ directory }) => {
        try {
          const sessionId = await sessionManager.getSessionIdForDirectory(directory);
          return apiResult(await apiGet(`/session/${sessionId}`));
        } catch (e) {
          return err(e.message);
        }
      }
    );
  }

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
        directory: z.string().optional().describe("The working directory (defaults to current)"),
        text: z.string().describe("The message/prompt text to send"),
        providerID: z.string().optional().describe("AI provider ID (e.g. 'anthropic', 'openai')"),
        modelID: z.string().optional().describe("Model ID (e.g. 'claude-opus-4-5', 'gpt-4o')"),
        agent: z.string().optional().describe("Agent name to use for this message"),
        noReply: z.boolean().optional().describe("If true, send without waiting for AI reply"),
      },
      async ({ directory, text, providerID, modelID, agent, noReply }) => {
        try {
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

          const result = await apiPost(`/session/${sessionId}/message`, body);
          if (!result.ok) return err(`HTTP ${result.status}`, result.data);

          if (noReply || !MSG_WAIT_IDLE) {
            return ok(formatMessageResponse(result.data));
          }

          try {
            const idleResult = await waitForSessionIdle(sessionId, MSG_MAX_WAIT);
            const formatted = formatMessageResponse(result.data);
            if (idleResult.error) {
              formatted._sessionError = idleResult.error;
            }
            return ok(formatted);
          } catch (e) {
            log("warn", `SSE wait failed: ${e.message} — returning initial response`);
            return ok({ ...formatMessageResponse(result.data), _sseWarning: e.message });
          }
        } catch (e) {
          return err(e.message);
        }
      }
    );
  }

  if (isToolEnabled("message_list")) {
    server.tool(
      "message_list",
      "List all messages in a session by directory",
      {
        directory: z.string().optional().describe("The working directory"),
        limit: z.number().optional().describe("Maximum number of messages to return"),
      },
      async ({ directory, limit }) => {
        try {
          const sessionId = await sessionManager.getSessionIdForDirectory(directory);
          const query = limit ? { limit } : {};
          const result = await apiGet(`/session/${sessionId}/message`, query);
          if (!result.ok) return err(`HTTP ${result.status}`, result.data);
          
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
        } catch (e) {
          return err(e.message);
        }
      }
    );
  }

  // Adding standard session tools using directory
  if (isToolEnabled("session_todo_list")) {
    server.tool(
      "session_todo_list",
      "Get the todo/task list for a session",
      {
        directory: z.string().optional().describe("The working directory"),
      },
      async ({ directory }) => {
        try {
          const sessionId = await sessionManager.getSessionIdForDirectory(directory);
          return apiResult(await apiGet(`/session/${sessionId}/todo`));
        } catch (e) {
          return err(e.message);
        }
      }
    );
  }

  if (isToolEnabled("session_diff")) {
    server.tool(
      "session_diff",
      "Get the file diff for a session",
      {
        directory: z.string().optional().describe("The working directory"),
        messageID: z.string().optional().describe("Optional message ID to diff up to"),
      },
      async ({ directory, messageID }) => {
        try {
          const sessionId = await sessionManager.getSessionIdForDirectory(directory);
          const query = messageID ? { messageID } : {};
          return apiResult(await apiGet(`/session/${sessionId}/diff`, query));
        } catch (e) {
          return err(e.message);
        }
      }
    );
  }

  if (isToolEnabled("file_list")) {
    server.tool(
      "file_list",
      "List files and directories in the opencode project",
      {
        path: z.string().optional().describe("Path to list (relative to project root)"),
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
}
