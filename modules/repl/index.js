// modules/repl/index.js — REPL avec historique + touches directionnelles
// Remplace readline-sync pour le prompt principal

import readline from "readline";
import readlineSync from "readline-sync";

// ─── Prompt principal avec flèches haut/bas ───────────────────────────────────

export function createREPL({ prompt, onLine }) {
  const rl = readline.createInterface({
    input:     process.stdin,
    output:    process.stdout,
    terminal:  true,
    historySize: 500,
    removeHistoryDuplicates: true,
  });

  rl.setPrompt(prompt);
  rl.prompt();

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (trimmed) {
      await onLine(trimmed);
    }
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\n  Au revoir.\n");
    process.exit(0);
  });

  rl.on("SIGINT", () => {
    console.log("\n  Ctrl+C — tape 'exit' pour quitter proprement.");
    rl.prompt();
  });

  return rl;
}

// ─── Confirmation y/n (readline-sync pour les questions inline) ───────────────

export function confirm(question) {
  return readlineSync.question(question).trim().toLowerCase() === "y";
}

export function question(q) {
  return readlineSync.question(q).trim();
}
