// memory/index.js — Mémoire persistante par projet

import fs from "fs";
import path from "path";
import os from "os";

const MEMORY_DIR  = path.join(os.homedir(), ".ai-agent-v9");
const MEMORY_FILE = path.join(MEMORY_DIR, "memory.json");

function ensureDir() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(MEMORY_FILE)) return { projects: {} };
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8")); }
  catch { return { projects: {} }; }
}

function save(data) {
  ensureDir();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

export class Memory {
  constructor(projectPath = process.cwd()) {
    this.projectPath = path.resolve(projectPath);
    this.projectKey  = this.projectPath.replace(/[^a-zA-Z0-9]/g, "_");
  }

  _ensure(data) {
    if (!data.projects[this.projectKey]) {
      data.projects[this.projectKey] = { history: [], context: {}, actions: [] };
    }
    return data;
  }

  addMessage(role, content) {
    const data    = this._ensure(load());
    const proj    = data.projects[this.projectKey];
    proj.history.push({ role, content: content.slice(0, 2000), timestamp: new Date().toISOString() });
    if (proj.history.length > 30) proj.history = proj.history.slice(-30);
    save(data);
  }

  getHistory(limit = 10) {
    const proj = load().projects[this.projectKey];
    if (!proj) return [];
    return proj.history.slice(-limit).map((m) => ({ role: m.role, content: m.content }));
  }

  setContext(key, value) {
    const data = this._ensure(load());
    data.projects[this.projectKey].context[key] = value;
    save(data);
  }

  getContext(key) {
    return load().projects[this.projectKey]?.context?.[key];
  }

  logAction(type, description, files = []) {
    const data = this._ensure(load());
    const proj = data.projects[this.projectKey];
    proj.actions.push({ type, description, files, timestamp: new Date().toISOString() });
    if (proj.actions.length > 100) proj.actions = proj.actions.slice(-100);
    save(data);
  }

  getRecentActions(limit = 10) {
    return load().projects[this.projectKey]?.actions?.slice(-limit) || [];
  }

  getSummary() {
    const proj = load().projects[this.projectKey];
    if (!proj) return "Pas de mémoire pour ce projet.";
    return `Projet: ${this.projectPath}\nMessages: ${proj.history.length}\nActions: ${proj.actions.length}\nContexte: ${JSON.stringify(proj.context, null, 2)}`;
  }

  clearProject() {
    const data = load();
    delete data.projects[this.projectKey];
    save(data);
  }
}