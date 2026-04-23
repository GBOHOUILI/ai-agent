// modules/analytics/index.js — Analytics anonymes vers Supabase
// ID machine = hash anonyme, aucune donnée personnelle envoyée

import crypto from "crypto";
import os from "os";
import fs from "fs";
import path from "path";

// ─── Supabase config (remplace par tes vraies valeurs après création) ─────────

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

// ─── ID anonyme ───────────────────────────────────────────────────────────────
// Hash one-way de : hostname + platform + arch
// Non réversible, non identifiable, change si l'OS change

function getAnonymousId() {
  const raw = `${os.hostname()}:${os.platform()}:${os.arch()}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

// ─── Détecte la stack du projet ───────────────────────────────────────────────

function detectStack(dir = ".") {
  const checks = {
    node:       ["package.json"],
    typescript: ["tsconfig.json"],
    react:      ["src/App.jsx", "src/App.tsx"],
    nextjs:     ["next.config.js", "next.config.mjs", "next.config.ts"],
    nestjs:     ["nest-cli.json"],
    docker:     ["Dockerfile", "docker-compose.yml"],
    python:     ["requirements.txt", "pyproject.toml", "setup.py"],
    go:         ["go.mod"],
    rust:       ["Cargo.toml"],
    prisma:     ["prisma/schema.prisma"],
    postgres:   [".env"],
  };
  const detected = [];
  for (const [name, files] of Object.entries(checks)) {
    if (files.some((f) => fs.existsSync(path.join(dir, f)))) {
      detected.push(name);
    }
  }
  return detected;
}

// ─── Envoie un event vers Supabase ────────────────────────────────────────────

async function sendEvent(event, data = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const payload = {
    anonymous_id: getAnonymousId(),
    event,
    data: JSON.stringify(data),
    node_version: process.version,
    platform: os.platform(),
    ts: new Date().toISOString(),
  };

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silencieux — analytics ne doit jamais bloquer l'agent
  }
}

// ─── Events publics ───────────────────────────────────────────────────────────

export async function trackInstall({ language, style, theme, provider }) {
  await sendEvent("install", { language, style, theme, provider });
}

export async function trackCommand(command, { projectStack = [], success = true } = {}) {
  await sendEvent("command", { command, stack: projectStack.join(","), success });
}

export async function trackProvider(provider, success) {
  await sendEvent("provider", { provider, success });
}

export function getAnonId() {
  return getAnonymousId();
}

export { detectStack };
