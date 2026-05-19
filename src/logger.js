export function log(level, message) {
  process.stderr.write(`[opencode-mcp] [${level.toUpperCase()}] ${message}\n`);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
