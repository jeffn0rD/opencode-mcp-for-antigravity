import { apiGet, apiPost } from "./api.js";
import { log } from "./logger.js";
import { resolve } from "path";

export class SessionManager {
  constructor() {
    this.directoryToSession = new Map();
    this.inflightRequests = new Map();
    this.maxCacheSize = 100;
  }

  _addToCache(dir, id) {
    if (this.directoryToSession.has(dir)) {
      this.directoryToSession.delete(dir);
    } else if (this.directoryToSession.size >= this.maxCacheSize) {
      // Evict oldest (Map iterates in insertion order)
      const oldest = this.directoryToSession.keys().next().value;
      this.directoryToSession.delete(oldest);
    }
    this.directoryToSession.set(dir, id);
  }

  async _doGetSessionIdForDirectory(directory, title, parentID) {
    const resolvedDir = resolve(directory || process.cwd());
    
    // Check cache
    if (this.directoryToSession.has(resolvedDir)) {
      const cachedId = this.directoryToSession.get(resolvedDir);
      // Verify it still exists
      const res = await apiGet(`/session/${cachedId}`, {}, { directory: resolvedDir });
      if (res.ok) {
        this._addToCache(resolvedDir, cachedId); // Update LRU
        return cachedId;
      } else if (res.status === 404) {
        this.directoryToSession.delete(resolvedDir);
      } else {
        // Return cached ID on transient errors
        this._addToCache(resolvedDir, cachedId); // Update LRU
        return cachedId;
      }
    }

    // Check backend
    const listRes = await apiGet("/session", {}, { directory: resolvedDir });
    if (listRes.ok && Array.isArray(listRes.data)) {
      const existing = listRes.data.find((s) => s.directory === resolvedDir);
      if (existing) {
        this._addToCache(resolvedDir, existing.id);
        return existing.id;
      }
    }

    // Create new session in this directory's project context
    const body = {};
    if (title) body.title = title;
    if (parentID) body.parentID = parentID;
    
    const createRes = await apiPost("/session", body, { directory: resolvedDir });
    if (!createRes.ok) {
      throw new Error(`Failed to create session for directory ${resolvedDir}: HTTP ${createRes.status}`);
    }
    
    const newSessionId = createRes.data.id;
    const actualDir = createRes.data.directory;
    if (actualDir && resolve(actualDir) !== resolvedDir) {
      log("warn", `Backend created session for "${actualDir}" instead of requested "${resolvedDir}"`);
    }
    this._addToCache(resolvedDir, newSessionId);
    return newSessionId;
  }

  async getSessionIdForDirectory(directory, title = null, parentID = null) {
    const resolvedDir = resolve(directory || process.cwd());
    const cacheKey = `${resolvedDir}|${title || ''}`;
    
    if (this.inflightRequests.has(cacheKey)) {
      return this.inflightRequests.get(cacheKey);
    }
    
    const promise = this._doGetSessionIdForDirectory(resolvedDir, title, parentID).finally(() => {
      this.inflightRequests.delete(cacheKey);
    });
    this.inflightRequests.set(cacheKey, promise);
    return promise;
  }
}

export const sessionManager = new SessionManager();
