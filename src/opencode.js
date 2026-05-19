import { spawn } from "child_process";
import { config, BASE_URL, STARTUP_TIMEOUT, POLL_INTERVAL } from "./config.js";
import { log, sleep } from "./logger.js";
import { apiGet } from "./api.js";

export async function checkHealth() {
  try {
    const res = await apiGet("/global/health", {}, { timeout: 3000 });
    return res.ok;
  } catch {
    return false;
  }
}

export async function launchOpencode() {
  const { launchCommand, launchArgs } = config.server;
  log("info", `Launching: ${launchCommand} ${launchArgs.join(" ")}`);

  await new Promise((resolve, reject) => {
    const child = spawn(launchCommand, launchArgs, {
      detached: true,
      stdio: "ignore",
    });

    child.on("error", (e) => {
      if (e.code === "ENOENT") {
        reject(new Error(
          `Cannot launch opencode: '${launchCommand}' not found in PATH. ` +
          `Install opencode first: https://opencode.ai/docs/installation`
        ));
      } else {
        reject(new Error(`Failed to spawn opencode: ${e.message}`));
      }
    });

    setTimeout(() => {
      child.unref();
      resolve();
    }, 300);
  });

  const deadline = Date.now() + STARTUP_TIMEOUT;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL);
    if (await checkHealth()) {
      log("info", `opencode server is up on ${BASE_URL}`);
      return;
    }
  }
  throw new Error(
    `opencode server did not become healthy within ${STARTUP_TIMEOUT}ms. ` +
    `Check that '${launchCommand}' is installed and in PATH.`
  );
}

export async function ensureServerRunning() {
  if (await checkHealth()) {
    log("info", `opencode server already running at ${BASE_URL}`);
    return;
  }
  log("info", `opencode server not detected at ${BASE_URL} — launching...`);
  await launchOpencode();
}
