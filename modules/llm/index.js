// modules/llm/index.js — Multi-provider LLM client V10
// Providers : Claude · Gemini · Groq · OpenRouter · Mistral · Cohere · Ollama
// Pool multi-tokens par provider + rotation automatique + retry 3x

import { getCache, setCache } from "../cache/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function parseRetryDelay(msg = "") {
  const match = msg.match(/retry in (\d+(\.\d+)?)s/i);
  return match ? Math.ceil(parseFloat(match[1])) * 1000 : null;
}

// ─── Token Pool ───────────────────────────────────────────────────────────────

class TokenPool {
  constructor(envPrefix) {
    this.prefix    = envPrefix;
    this.keys      = this._load();
    this.current   = 0;
    this.exhausted = new Set();
  }
  _load() {
    const keys = [];
    if (process.env[this.prefix]) keys.push(process.env[this.prefix]);
    for (let i = 2; i <= 10; i++) {
      const k = process.env[`${this.prefix}_${i}`];
      if (k) keys.push(k);
    }
    return keys;
  }
  hasKeys()        { return this.keys.length > 0; }
  availableCount() { return this.keys.filter((_, i) => !this.exhausted.has(i)).length; }
  totalCount()     { return this.keys.length; }
  getKey() {
    if (this.exhausted.has(this.current)) this._rotate();
    return this.keys[this.current] || null;
  }
  _rotate() {
    for (let i = 1; i <= this.keys.length; i++) {
      const next = (this.current + i) % this.keys.length;
      if (!this.exhausted.has(next)) { this.current = next; return true; }
    }
    return false;
  }
  markExhausted(reason = "") {
    const idx = this.current + 1;
    this.exhausted.add(this.current);
    const ok = this._rotate();
    if (ok) process.stdout.write(`\n  ⟳  ${this.prefix} clé #${idx} épuisée${reason ? ` (${reason})` : ""} — rotation vers #${this.current + 1}\n`);
    return ok;
  }
  reset()  { this.exhausted.clear(); this.current = 0; }
  reload() { this.keys = this._load(); this.reset(); }
}

// ─── Pools ────────────────────────────────────────────────────────────────────

const pools = {
  claude:     new TokenPool("CLAUDE_API_KEY"),
  anthropic:  new TokenPool("ANTHROPIC_API_KEY"),
  gemini:     new TokenPool("GEMINI_API_KEY"),
  groq:       new TokenPool("GROQ_API_KEY"),
  openrouter: new TokenPool("OPENROUTER_API_KEY"),
  mistral:    new TokenPool("MISTRAL_API_KEY"),
  cohere:     new TokenPool("COHERE_API_KEY"),
  // Ollama est local — pas de clé, on vérifie juste si le serveur tourne
};

function getClaudeKey() { return pools.claude.getKey() || pools.anthropic.getKey(); }
function hasClaudeKey() { return pools.claude.hasKeys() || pools.anthropic.hasKeys(); }

// ─── Retry wrapper ────────────────────────────────────────────────────────────

async function withRetry(fn, label = "LLM", maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn(); }
    catch (e) {
      lastError = e;
      const msg = e.message || "";
      if (msg.includes("toutes les clés épuisées") || msg.includes("clé invalide") || msg.includes("401")) throw e;
      if (attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        process.stdout.write(`\n  ↺  ${label} tentative ${attempt}/${maxAttempts} — retry dans ${delay/1000}s\n`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// ─── CLAUDE ───────────────────────────────────────────────────────────────────

async function callClaude(messages, systemPrompt) {
  return withRetry(async () => {
    const API_KEY = getClaudeKey();
    if (!API_KEY) throw new Error("CLAUDE_API_KEY non défini");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 8192,
        system: systemPrompt || "You are an expert autonomous software engineer.",
        messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      if (res.status === 429 || msg.includes("rate_limit") || msg.includes("quota")) {
        const pool = pools.claude.hasKeys() ? pools.claude : pools.anthropic;
        if (pool.markExhausted("rate limit")) return callClaude(messages, systemPrompt);
        throw new Error(`Claude: toutes les clés épuisées — ${msg}`);
      }
      throw new Error(`Claude: ${msg}`);
    }
    const text = data.content?.[0]?.text;
    if (!text) throw new Error("Claude: réponse vide");
    return text;
  }, "Claude");
}

// ─── GEMINI ───────────────────────────────────────────────────────────────────

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

async function callGemini(model, messages, systemPrompt) {
  return withRetry(async () => {
    const API_KEY = pools.gemini.getKey();
    if (!API_KEY) throw new Error("GEMINI_API_KEY non défini");
    const filtered = [];
    for (const m of messages) {
      const role = m.role === "assistant" ? "model" : "user";
      if (filtered.length > 0 && filtered.at(-1).role === role) {
        filtered.at(-1).parts[0].text += "\n" + m.content;
      } else {
        filtered.push({ role, parts: [{ text: m.content }] });
      }
    }
    if (filtered.length === 0 || filtered[0].role !== "user") {
      filtered.unshift({ role: "user", parts: [{ text: "Hello" }] });
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
        body: JSON.stringify({
          contents: filtered,
          systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      if (res.status === 429) {
        const delay = parseRetryDelay(msg);
        if (pools.gemini.markExhausted("quota")) return callGemini(model, messages, systemPrompt);
        if (delay) { await sleep(delay + 500); pools.gemini.reset(); return callGemini(model, messages, systemPrompt); }
        throw new Error(`Gemini: toutes les clés épuisées — ${msg}`);
      }
      throw new Error(`Gemini ${model}: ${msg}`);
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Gemini ${model}: réponse vide`);
    return text;
  }, `Gemini ${model}`);
}

// ─── GROQ ─────────────────────────────────────────────────────────────────────

const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];

async function callGroq(messages, systemPrompt) {
  return withRetry(async () => {
    const API_KEY = pools.groq.getKey();
    if (!API_KEY) throw new Error("GROQ_API_KEY non défini");
    const allMessages = systemPrompt ? [{ role: "system", content: systemPrompt }, ...messages] : messages;
    let lastError;
    for (const model of GROQ_MODELS) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
          body: JSON.stringify({ model, messages: allMessages, temperature: 0.3, max_tokens: 8192 }),
        });
        const data = await res.json();
        if (res.status === 401) { pools.groq.markExhausted("clé invalide"); const next = pools.groq.getKey(); if (next) return callGroq(messages, systemPrompt); throw new Error("Groq: toutes les clés invalides"); }
        if (res.status === 429) { pools.groq.markExhausted("rate limit"); const next = pools.groq.getKey(); if (next) return callGroq(messages, systemPrompt); throw new Error("Groq: toutes les clés épuisées"); }
        if (!res.ok) throw new Error(`Groq ${model}: ${data?.error?.message || `HTTP ${res.status}`}`);
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      } catch (e) { lastError = e; if (e.message.includes("toutes les clés")) throw e; }
    }
    throw new Error("Groq: " + lastError?.message);
  }, "Groq");
}

// ─── OPENROUTER ───────────────────────────────────────────────────────────────

const OPENROUTER_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "google/gemma-3-12b-it:free",
];

async function callOpenRouter(messages, systemPrompt) {
  return withRetry(async () => {
    const API_KEY = pools.openrouter.getKey();
    if (!API_KEY) throw new Error("OPENROUTER_API_KEY non défini");
    const allMessages = systemPrompt ? [{ role: "system", content: systemPrompt }, ...messages] : messages;
    let lastError;
    for (const model of OPENROUTER_MODELS) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}`, "HTTP-Referer": "https://github.com/GBOHOUILI/ai-agent", "X-Title": "Zero-to-One AI" },
          body: JSON.stringify({ model, messages: allMessages, temperature: 0.3, max_tokens: 8192 }),
        });
        const data = await res.json();
        if (res.status === 429) { pools.openrouter.markExhausted("rate limit"); if (pools.openrouter.getKey()) return callOpenRouter(messages, systemPrompt); throw new Error("OpenRouter: épuisé"); }
        if (!res.ok) throw new Error(`OpenRouter ${model}: ${data?.error?.message || `HTTP ${res.status}`}`);
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      } catch (e) { lastError = e; if (e.message.includes("toutes les clés")) throw e; }
    }
    throw new Error("OpenRouter: " + lastError?.message);
  }, "OpenRouter");
}

// ─── MISTRAL ──────────────────────────────────────────────────────────────────

const MISTRAL_MODELS = ["mistral-small-latest", "mistral-medium-latest", "open-mistral-7b"];

async function callMistral(messages, systemPrompt) {
  return withRetry(async () => {
    const API_KEY = pools.mistral.getKey();
    if (!API_KEY) throw new Error("MISTRAL_API_KEY non défini");
    const allMessages = systemPrompt ? [{ role: "system", content: systemPrompt }, ...messages] : messages;
    let lastError;
    for (const model of MISTRAL_MODELS) {
      try {
        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
          body: JSON.stringify({ model, messages: allMessages, temperature: 0.3, max_tokens: 8192 }),
        });
        const data = await res.json();
        if (res.status === 429) { pools.mistral.markExhausted("rate limit"); if (pools.mistral.getKey()) return callMistral(messages, systemPrompt); throw new Error("Mistral: épuisé"); }
        if (!res.ok) throw new Error(`Mistral ${model}: ${data?.error?.message || `HTTP ${res.status}`}`);
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      } catch (e) { lastError = e; if (e.message.includes("toutes les clés")) throw e; }
    }
    throw new Error("Mistral: " + lastError?.message);
  }, "Mistral");
}

// ─── COHERE ───────────────────────────────────────────────────────────────────

async function callCohere(messages, systemPrompt) {
  return withRetry(async () => {
    const API_KEY = pools.cohere.getKey();
    if (!API_KEY) throw new Error("COHERE_API_KEY non défini");
    // Cohere format : dernier message = message, les autres = chat_history
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "CHATBOT" : "USER",
      message: m.content,
    }));
    const lastMsg = messages.at(-1)?.content || "";
    const res = await fetch("https://api.cohere.ai/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: "command-r-plus",
        message: lastMsg,
        chat_history: history,
        preamble: systemPrompt || undefined,
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.message || `HTTP ${res.status}`;
      if (res.status === 429) { if (pools.cohere.markExhausted("rate limit")) return callCohere(messages, systemPrompt); throw new Error(`Cohere épuisé: ${msg}`); }
      throw new Error(`Cohere: ${msg}`);
    }
    const text = data.text;
    if (!text) throw new Error("Cohere: réponse vide");
    return text;
  }, "Cohere");
}

// ─── OLLAMA (local) ───────────────────────────────────────────────────────────
// Pas de clé API — tourne sur localhost:11434
// Pour l'activer : installer Ollama + ollama pull llama3.2

const OLLAMA_BASE = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

async function isOllamaRunning() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

async function callOllama(messages, systemPrompt) {
  return withRetry(async () => {
    const allMessages = systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages;
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages: allMessages, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const text = data.message?.content;
    if (!text) throw new Error("Ollama: réponse vide");
    return text;
  }, "Ollama");
}

// ─── ask() ────────────────────────────────────────────────────────────────────

export async function ask(messages, systemPrompt, options = {}) {
  const { useCache = true, preferredProvider = null } = options;
  const lastMsg  = messages.at(-1)?.content || "";
  const cacheKey = `v10:${lastMsg.slice(0, 200)}`;
  if (useCache) { const cached = getCache(cacheKey); if (cached) return cached; }

  const errors = [];
  const tryProvider = async (name, fn) => {
    try { const r = await fn(); if (useCache) setCache(cacheKey, r); return r; }
    catch (e) { errors.push(`${name}: ${e.message}`); return null; }
  };

  // Ordre : preferred > Claude > Gemini > Mistral > Groq > Cohere > OpenRouter > Ollama

  if (preferredProvider === "ollama" || (!preferredProvider && process.env.OLLAMA_FIRST === "true")) {
    if (await isOllamaRunning()) {
      const r = await tryProvider("Ollama", () => callOllama(messages, systemPrompt));
      if (r) return r;
    }
  }

  if (hasClaudeKey()) {
    const r = await tryProvider("Claude", () => callClaude(messages, systemPrompt));
    if (r) return r;
  }

  if (pools.gemini.hasKeys()) {
    for (const model of GEMINI_MODELS) {
      const r = await tryProvider(`Gemini/${model}`, () => callGemini(model, messages, systemPrompt));
      if (r) return r;
    }
  }

  if (pools.mistral.hasKeys()) {
    const r = await tryProvider("Mistral", () => callMistral(messages, systemPrompt));
    if (r) return r;
  }

  if (pools.groq.hasKeys()) {
    const r = await tryProvider("Groq", () => callGroq(messages, systemPrompt));
    if (r) return r;
  }

  if (pools.cohere.hasKeys()) {
    const r = await tryProvider("Cohere", () => callCohere(messages, systemPrompt));
    if (r) return r;
  }

  if (pools.openrouter.hasKeys()) {
    const r = await tryProvider("OpenRouter", () => callOpenRouter(messages, systemPrompt));
    if (r) return r;
  }

  // Ollama en dernier fallback si local dispo
  if (await isOllamaRunning()) {
    const r = await tryProvider("Ollama (fallback)", () => callOllama(messages, systemPrompt));
    if (r) return r;
  }

  throw new Error(`Tous les providers ont échoué.\n${errors.map((e) => `  • ${e}`).join("\n")}`);
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function getProviderStatus() {
  return [
    { name: "Claude",     pool: pools.claude,     extra: pools.anthropic },
    { name: "Gemini",     pool: pools.gemini },
    { name: "Mistral",    pool: pools.mistral },
    { name: "Groq",       pool: pools.groq },
    { name: "Cohere",     pool: pools.cohere },
    { name: "OpenRouter", pool: pools.openrouter },
    { name: "Ollama",     pool: null, local: true },
  ].map((p) => {
    if (p.local) return { name: p.name, total: 1, available: 1, active: false, local: true };
    const total = p.pool.totalCount() + (p.extra?.totalCount() || 0);
    const avail = p.pool.availableCount() + (p.extra?.availableCount() || 0);
    return { name: p.name, total, available: avail, active: total > 0 };
  });
}

export async function getProviderStatusWithOllama() {
  const statuses = getProviderStatus();
  const ollamaIdx = statuses.findIndex((s) => s.name === "Ollama");
  if (ollamaIdx >= 0) statuses[ollamaIdx].active = await isOllamaRunning();
  return statuses;
}

export function getActiveProvider() {
  if (hasClaudeKey())             return `Claude (${pools.claude.totalCount() + pools.anthropic.totalCount()} clé(s))`;
  if (pools.gemini.hasKeys())     return `Gemini (${pools.gemini.totalCount()} clé(s))`;
  if (pools.mistral.hasKeys())    return `Mistral (${pools.mistral.totalCount()} clé(s))`;
  if (pools.groq.hasKeys())       return `Groq (${pools.groq.totalCount()} clé(s))`;
  if (pools.cohere.hasKeys())     return `Cohere (${pools.cohere.totalCount()} clé(s))`;
  if (pools.openrouter.hasKeys()) return `OpenRouter (${pools.openrouter.totalCount()} clé(s))`;
  return "⚠  AUCUNE CLÉ API";
}

export function reloadPools() {
  for (const pool of Object.values(pools)) if (pool) pool.reload();
}

export { isOllamaRunning };
