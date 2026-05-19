#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

import { config, isToolEnabled } from "./config.js";
import { registerTools } from "./tools.js";
import { ensureServerRunning } from "./opencode.js";
import { log } from "./logger.js";
import { existsSync, writeFileSync, mkdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);

function expandHome(p) {
  if (p.startsWith("~/")) return resolve(homedir(), p.slice(2));
  return p;
}

function selfRegister() {
  if (!config.mcp.selfRegistration?.enabled) return;

  const configPath = expandHome(config.mcp.selfRegistration.configPath);
  const serverName = config.mcp.serverName;
  const serverEntry = {
    command: "node",
    args: [resolve(__filename)],
    env: {},
  };

  if (process.env[config.server.auth.passwordEnvVar]) {
    serverEntry.env[config.server.auth.passwordEnvVar] = process.env[config.server.auth.passwordEnvVar];
  }
  if (process.env[config.server.auth.usernameEnvVar]) {
    serverEntry.env[config.server.auth.usernameEnvVar] = process.env[config.server.auth.usernameEnvVar];
  }

  let mcpConfig = { mcpServers: {} };
  if (existsSync(configPath)) {
    try {
      mcpConfig = JSON.parse(readFileSync(configPath, "utf-8"));
      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
    } catch (e) {
      log("warn", `Could not parse ${configPath}: ${e.message} — will overwrite`);
    }
  }

  const existing = mcpConfig.mcpServers[serverName];
  if (
    existing &&
    existing.command === serverEntry.command &&
    JSON.stringify(existing.args) === JSON.stringify(serverEntry.args)
  ) {
    log("info", `Already registered in ${configPath} as '${serverName}'`);
    return;
  }

  mcpConfig.mcpServers[serverName] = serverEntry;
  try {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2) + "\n", "utf-8");
    log("info", `Registered '${serverName}' in ${configPath}`);
  } catch (e) {
    log("warn", `Could not write ${configPath}: ${e.message}`);
  }
}

async function main() {
  selfRegister();
  await ensureServerRunning();

  const server = new McpServer({
    name: config.mcp.serverName,
    version: config.mcp.version,
  });

  registerTools(server);

  const transportType = config.mcp.transport || "stdio";

  if (transportType === "stdio") {
    const transport = new StdioServerTransport();
    try {
      await server.connect(transport);
    } catch (e) {
      log("error", `Failed to connect stdio transport: ${e.message}`);
      throw e;
    }
    log("info", "MCP server connected via stdio and ready");
  } else if (transportType === "sse") {
    const app = express();
    const port = config.mcp.port || 3001;
    const host = config.mcp.host || "127.0.0.1";
    const authToken = config.mcp.authToken || process.env.MCP_AUTH_TOKEN;
    
    const transports = new Map();

    app.use((req, res, next) => {
      if (!authToken) return next();
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token;
      
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : queryToken;
      if (token && authToken) {
        const tokenBuf = Buffer.from(token);
        const authBuf = Buffer.from(authToken);
        if (tokenBuf.length === authBuf.length && crypto.timingSafeEqual(tokenBuf, authBuf)) {
          return next();
        }
      }
      res.status(401).send("Unauthorized");
    });

    app.get("/sse", async (req, res) => {
      log("info", "New SSE connection established");
      const transport = new SSEServerTransport(`/message`, res);
      const sessionId = transport.sessionId;
      transports.set(sessionId, transport);
      
      res.on("close", () => {
        transports.delete(sessionId);
      });

      try {
        await server.connect(transport);
      } catch (e) {
        transports.delete(sessionId);
        res.end();
        throw e;
      }
    });

    app.post("/message", async (req, res) => {
      const sessionId = req.query.sessionId;
      const transport = transports.get(sessionId);
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(400).send("No active SSE connection");
      }
    });

    const httpServer = app.listen(port, host, () => {
      log("info", `MCP server listening for SSE connections on http://${host}:${port}/sse`);
    });
    
    httpServer.on("error", (err) => {
      log("error", `Express server error: ${err.message}`);
      process.exit(1);
    });
  } else {
    log("error", `Unknown transport type: ${transportType}`);
    process.exit(1);
  }
}

main().catch((e) => {
  process.stderr.write(`[opencode-mcp] FATAL: ${e.message}\n`);
  process.exit(1);
});
