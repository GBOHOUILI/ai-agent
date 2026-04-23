// modules/cache/index.js — Cache persistant avec TTL
import fs from "fs";
import path from "path";
import os from "os";

const CACHE_DIR  = path.join(os.homedir(), ".ai-agent-v9");
const CACHE_FILE = path.join(CACHE_DIR, "cache.json");
const TTL_MS     = 1000 * 60 * 60 * 24; // 24h

function ensureDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(CACHE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")); }
  catch { return {}; }
}

function save(data) {
  ensureDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

export function getCache(key) {
  const cache = load();
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.time > TTL_MS) return null;
  return entry.value;
}

export function setCache(key, value) {
  const cache = load();
  cache[key] = { value, time: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > 200) {
    const sorted = keys.sort((a, b) => cache[a].time - cache[b].time);
    sorted.slice(0, keys.length - 200).forEach((k) => delete cache[k]);
  }
  save(cache);
}

export function clearCache() { save({}); }