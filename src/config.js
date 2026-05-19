import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is one level up from src
export const PROJECT_ROOT = resolve(__dirname, "..");
export const CONFIG_PATH = resolve(PROJECT_ROOT, "config.json");

export function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch (e) {
    console.error(`[opencode-mcp] FATAL: Failed to load config from ${CONFIG_PATH}: ${e.message}`);
    process.exit(1);
  }
}

export const config = loadConfig();

export const HOST = config.server.host;
export const PORT = config.server.port;
export const BASE_URL = `http://${HOST}:${PORT}`;
export const STARTUP_TIMEOUT = config.server.startupTimeoutMs;
export const POLL_INTERVAL = config.server.pollIntervalMs;
export const DEFAULT_TIMEOUT = config.server.defaultTimeoutMs || 30000;
export const MSG_WAIT_IDLE = config.messages.waitForIdle;
export const MSG_MAX_WAIT = config.messages.maxWaitMs;
export const TOOL_EXCLUDE = new Set((config.tools.exclude || []).map((p) => p.replace("*", "")));

export function isToolEnabled(name) {
  if (Array.isArray(config.tools?.include) && config.tools.include[0] === "*") {
    for (const excl of TOOL_EXCLUDE) {
      if (name.startsWith(excl)) return false;
    }
    return true;
  }
  return Array.isArray(config.tools?.include) && config.tools.include.includes(name);
}
