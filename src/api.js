import { config, BASE_URL, DEFAULT_TIMEOUT } from "./config.js";
import { log } from "./logger.js";

function getHeaders(extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  const password = process.env[config.server.auth.passwordEnvVar];
  if (password) {
    const username =
      process.env[config.server.auth.usernameEnvVar] ||
      config.server.auth.defaultUsername;
    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    headers["Authorization"] = `Basic ${encoded}`;
  }
  return headers;
}

function resolveUrl(path, queryParams = {}, opts = {}) {
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  if (opts.directory) {
    url.searchParams.set("directory", opts.directory);
  }
  return url.toString();
}

async function fetchWithOpts(url, method, body, opts = {}) {
  const fetchOpts = {
    method,
    headers: getHeaders(),
    signal: AbortSignal.timeout(opts.timeout || DEFAULT_TIMEOUT)
  };
  if (body !== undefined) fetchOpts.body = JSON.stringify(body);
  const res = await fetch(url, fetchOpts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

export async function apiGet(path, queryParams = {}, opts = {}) {
  return fetchWithOpts(resolveUrl(path, queryParams, opts), "GET");
}

export async function apiPost(path, body = {}, opts = {}) {
  return fetchWithOpts(resolveUrl(path, {}, opts), "POST", body);
}

export async function apiPatch(path, body = {}, opts = {}) {
  return fetchWithOpts(resolveUrl(path, {}, opts), "PATCH", body);
}

export async function apiDelete(path, opts = {}) {
  return fetchWithOpts(resolveUrl(path, {}, opts), "DELETE");
}

export async function apiPut(path, body = {}, opts = {}) {
  return fetchWithOpts(resolveUrl(path, {}, opts), "PUT", body);
}

export function ok(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    isError: false,
  };
}

export function err(message, data = null) {
  const text = data ? `${message}\n\n${JSON.stringify(data, null, 2)}` : message;
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

export function apiResult(result, transform = null) {
  if (!result.ok) return err(`HTTP ${result.status}`, result.data);
  const data = transform ? transform(result.data) : result.data;
  return ok(data);
}

export function formatMessageResponse(msgResponse) {
  if (!msgResponse || !msgResponse.parts) return msgResponse;
  const textParts = msgResponse.parts
    .filter((p) => p.type === "text" && !p.synthetic && !p.ignored)
    .map((p) => p.text)
    .join("\n");
  const toolSummary = msgResponse.parts
    .filter((p) => p.type === "tool")
    .map((p) => {
      const status = p.state?.status || "unknown";
      const title = p.state?.title || p.tool || "";
      return `[tool:${p.tool}] ${title} (${status})`;
    })
    .join("\n");
  return {
    messageId: msgResponse.info?.id,
    sessionId: msgResponse.info?.sessionID,
    role: msgResponse.info?.role,
    model: msgResponse.info?.modelID,
    provider: msgResponse.info?.providerID,
    cost: msgResponse.info?.cost,
    tokens: msgResponse.info?.tokens,
    error: msgResponse.info?.error,
    response: textParts || "(no text output)",
    toolsUsed: toolSummary || null,
  };
}

export async function waitForSessionIdle(sessionId, maxWaitMs, onEvent = null, onConnected = null) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + maxWaitMs;
    const url = `${BASE_URL}/event`;
    const headers = getHeaders({ Accept: "text/event-stream" });

    let buffer = "";
    let resolved = false;
    let connectedResult = undefined;

    function finish(result) {
      if (resolved) return;
      resolved = true;
      resolve(connectedResult !== undefined ? { ...result, connectedResult } : result);
    }

    function abort(reason) {
      if (resolved) return;
      resolved = true;
      reject(reason);
    }

    async function connect() {
      try {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(maxWaitMs + 1000) });
        if (!res.ok) {
          abort(new Error(`SSE connection failed: HTTP ${res.status}`));
          return;
        }

        // SSE stream is live — invoke onConnected before waiting for events.
        // This lets callers send a message with confidence that no idle event
        // will be missed (avoids the race between POST → SSE connect).
        if (onConnected) {
          try {
            connectedResult = await onConnected();
          } catch (e) {
            abort(e);
            return;
          }
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (!resolved) {
          if (Date.now() > deadline) {
            abort(new Error(`Timed out waiting for session ${sessionId} to become idle`));
            return;
          }

          const { done, value } = await reader.read();
          if (done) { finish({ timedOut: false, reason: "stream_ended" }); return; }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;
            try {
              const envelope = JSON.parse(raw);
              const event = envelope.payload || envelope;
              if (onEvent) onEvent(event);

              const t = event.type;
              const props = event.properties || {};

              if (
                (t === "session.idle" && props.sessionID === sessionId) ||
                (t === "session.status" &&
                  props.sessionID === sessionId &&
                  props.status?.type === "idle")
              ) {
                finish({ timedOut: false, reason: "idle" });
                return;
              }

              if (t === "session.error" && (props.sessionID === sessionId || !props.sessionID)) {
                finish({ timedOut: false, reason: "error", error: props.error });
                return;
              }
            } catch {
              // ignore parse errors on individual events
            }
          }
        }
      } catch (e) {
        if (!resolved) abort(e);
      }
    }

    connect();
  });
}
