// memory/memory.js — Persistent project memory
import fs from "fs";
import path from "path";
import os from "os";

const MEMORY_DIR = path.join(os.homedir(), ".ai-agent-v9");
const MEMORY_FILE = path.join(MEMORY_DIR, "memory.json");

function ensureDir() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(MEMORY_FILE)) return { projects: {}, globalHistory: [] };
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  } catch {
    return { projects: {}, globalHistory: [] };
  }
}

function save(data) {
  ensureDir();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

export class Memory {
  constructor(projectPath = process.cwd()) {
    this.projectPath = path.resolve(projectPath);
    this.projectKey = this.projectPath.replace(/[^a-zA-Z0-9]/g, "_");
  }

  // ─── Conversation history ───────────────────────────────────────────────

  addMessage(role, content) {
    const data = load();
    if (!data.projects[this.projectKey]) {
      data.projects[this.projectKey] = { history: [], context: {}, actions: [] };
    }

    data.projects[this.projectKey].history.push({
      role,
      content: content.slice(0, 2000), // limit stored size
      timestamp: new Date().toISOString()
    });

    // Keep last 30 messages
    if (data.projects[this.projectKey].history.length > 30) {
      data.projects[this.projectKey].history = data.projects[this.projectKey].history.slice(-30);
    }

    save(data);
  }

  getHistory(limit = 10) {
    const data = load();
    const proj = data.projects[this.projectKey];
    if (!proj) return [];
    return proj.history.slice(-limit).map(m => ({ role: m.role, content: m.content }));
  }

  // ─── Project context / notes ─────────────────────────────────────────────

  setContext(key, value) {
    const data = load();
    if (!data.projects[this.projectKey]) {
      data.projects[this.projectKey] = { history: [], context: {}, actions: [] };
    }
    data.projects[this.projectKey].context[key] = value;
    save(data);
  }

  getContext(key) {
    const data = load();
    return data.projects[this.projectKey]?.context?.[key];
  }

  getAllContext() {
    const data = load();
    return data.projects[this.projectKey]?.context || {};
  }

  // ─── Action log ──────────────────────────────────────────────────────────

  logAction(type, description, files = []) {
    const data = load();
    if (!data.projects[this.projectKey]) {
      data.projects[this.projectKey] = { history: [], context: {}, actions: [] };
    }

    data.projects[this.projectKey].actions.push({
      type,
      description,
      files,
      timestamp: new Date().toISOString()
    });

    // Keep last 100 actions
    if (data.projects[this.projectKey].actions.length > 100) {
      data.projects[this.projectKey].actions = data.projects[this.projectKey].actions.slice(-100);
    }

    save(data);
  }

  getRecentActions(limit = 10) {
    const data = load();
    return data.projects[this.projectKey]?.actions?.slice(-limit) || [];
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

  getSummary() {
    const data = load();
    const proj = data.projects[this.projectKey];
    if (!proj) return "No memory for this project yet.";

    const msgCount = proj.history.length;
    const actionCount = proj.actions.length;
    const context = JSON.stringify(proj.context, null, 2);

    return `Project: ${this.projectPath}
Messages remembered: ${msgCount}
Actions logged: ${actionCount}
Context notes:\n${context}`;
  }

  clearProject() {
    const data = load();
    delete data.projects[this.projectKey];
    save(data);
  }
}
