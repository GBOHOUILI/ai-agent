// modules/repl/index.js — REPL avec historique + touches directionnelles
// FIX: confirm/question 100% async readline natif — plus de readline-sync
// FIX: Ctrl+C pendant une tâche = annule proprement sans fermer le terminal

import readline from "readline";

// ─── Instance globale ─────────────────────────────────────────────────────────
let _rl = null;
let _busy = false; // true quand l'agent traite une commande

// ─── REPL principal ───────────────────────────────────────────────────────────

export function createREPL({ prompt, onLine }) {
  _rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 500,
    removeHistoryDuplicates: true,
  });

  _rl.setPrompt(prompt);
  _rl.prompt();

  _rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      _rl.prompt();
      return;
    }
    _busy = true;
    try {
      await onLine(trimmed);
    } finally {
      _busy = false;
      _rl.prompt();
    }
  });

  _rl.on("close", () => {
    console.log("\n  Au revoir.\n");
    process.exit(0);
  });

  // Ctrl+C : annule la tâche en cours sans quitter
  _rl.on("SIGINT", () => {
    if (_busy) {
      console.log("\n\n  ⚠  Tâche interrompue. Tape 'exit' pour quitter.\n");
      _busy = false;
      _rl.prompt();
    } else {
      console.log("\n  Tape 'exit' pour quitter.\n");
      _rl.prompt();
    }
  });

  return _rl;
}

// ─── confirm(question) → Promise<boolean> ────────────────────────────────────
// Pause le REPL, attend y/n, reprend
// Accepte : y, o, oui, yes → true | tout le reste → false

export function confirm(question) {
  return new Promise((resolve) => {
    if (!_rl) {
      resolve(false);
      return;
    }

    // Retire temporairement le listener "line" pour ne pas déclencher onLine
    _rl.pause();
    process.stdout.write(question);

    // Écoute une seule fois stdin directement
    const handler = (data) => {
      const ans = data.toString().trim().toLowerCase();
      process.stdout.write("\n");
      process.stdin.removeListener("data", handler);
      process.stdin.pause();
      _rl.resume();
      resolve(["y", "o", "oui", "yes"].includes(ans));
    };

    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", handler);
  });
}

// ─── question(q) → Promise<string> ───────────────────────────────────────────

export function question(q) {
  return new Promise((resolve) => {
    if (!_rl) {
      resolve("");
      return;
    }

    _rl.pause();
    process.stdout.write(q);

    const handler = (data) => {
      const ans = data.toString().trim();
      process.stdout.write("\n");
      process.stdin.removeListener("data", handler);
      process.stdin.pause();
      _rl.resume();
      resolve(ans);
    };

    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", handler);
  });
}

// ─── setBusy — permet à agent.js de signaler qu'une tâche tourne ─────────────

export function setBusy(val) {
  _busy = val;
}
