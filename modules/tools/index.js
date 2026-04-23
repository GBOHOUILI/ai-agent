// modules/tools/index.js — Safe file and system tools
// Nouveauté V9 : showDiff() pour visualiser les changements avant confirmation

import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ─── Safety ───────────────────────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//, /mkfs/, /dd\s+if=/, /:\(\)\{/, /shutdown/, /reboot/,
  /format\s+[a-z]:/, /del\s+\/[sq]/, /sudo\s+rm/,
];

const SAFE_COMMANDS = [
  /^npm\s+(install|run|test|build|start|ci)/,
  /^npx\s+/,
  /^node\s+/,
  /^git\s+(status|log|diff|add|commit|push|pull|clone|init|checkout)/,
  /^ls/, /^cat\s+/, /^echo\s+/, /^mkdir\s+-p\s+/, /^cp\s+/, /^mv\s+/,
  /^docker\s+(compose|build|run|ps|logs)/,
  /^prisma\s+/,
  /^tsc\s+/, /^eslint\s+/, /^jest\s+/, /^vitest\s+/,
  /^curl\s+/, /^grep\s+/, /^find\s+/, /^pwd/, /^whoami/,
  /^yarn\s+/, /^pnpm\s+/,
];

export function isSafeCommand(cmd) {
  const trimmed = cmd.trim().toLowerCase();
  for (const p of BLOCKED_PATTERNS) if (p.test(cmd)) return false;
  for (const p of SAFE_COMMANDS)    if (p.test(trimmed)) return true;
  return false;
}

// ─── File operations ──────────────────────────────────────────────────────────

export function readFile(filePath) {
  try { return fs.readFileSync(filePath, "utf-8"); }
  catch (e) { throw new Error(`Impossible de lire ${filePath}: ${e.message}`); }
}

export function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf-8");
}

export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

export function listFiles(dir = ".") {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).map((d) => ({
      name:  d.name,
      isDir: d.isDirectory(),
    }));
  } catch (e) {
    throw new Error(`Impossible de lister ${dir}: ${e.message}`);
  }
}

// ─── Diff display ─────────────────────────────────────────────────────────────
// Génère un diff lisible entre l'ancien et le nouveau contenu

export function buildDiff(oldContent, newContent, filePath = "") {
  const C = {
    green:  "\x1b[32m",
    red:    "\x1b[31m",
    gray:   "\x1b[90m",
    yellow: "\x1b[33m",
    reset:  "\x1b[0m",
    bold:   "\x1b[1m",
  };

  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  // Diff simple ligne par ligne (Myers-like approximation)
  const lines = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  let added   = 0;
  let removed = 0;

  // LCS simplifié — compare ligne par ligne
  const oldSet = new Map();
  oldLines.forEach((l, i) => oldSet.set(l, i));

  const newSet = new Map();
  newLines.forEach((l, i) => newSet.set(l, i));

  let oi = 0;
  let ni = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    const ol = oldLines[oi];
    const nl = newLines[ni];

    if (oi >= oldLines.length) {
      lines.push(`${C.green}+ ${nl}${C.reset}`);
      added++; ni++;
    } else if (ni >= newLines.length) {
      lines.push(`${C.red}- ${ol}${C.reset}`);
      removed++; oi++;
    } else if (ol === nl) {
      lines.push(`${C.gray}  ${ol}${C.reset}`);
      oi++; ni++;
    } else {
      lines.push(`${C.red}- ${ol}${C.reset}`);
      lines.push(`${C.green}+ ${nl}${C.reset}`);
      removed++; added++; oi++; ni++;
    }
  }

  // Tronquer si trop long (garder début + fin)
  const MAX_LINES = 60;
  let displayLines = lines;
  if (lines.length > MAX_LINES) {
    const half = Math.floor(MAX_LINES / 2);
    displayLines = [
      ...lines.slice(0, half),
      `${C.yellow}  ... (${lines.length - MAX_LINES} lignes cachées) ...${C.reset}`,
      ...lines.slice(-half),
    ];
  }

  const header = `${C.bold}  Diff: ${filePath}${C.reset}  ${C.green}+${added}${C.reset} ${C.red}-${removed}${C.reset}`;
  return { text: [header, ...displayLines].join("\n"), added, removed };
}

// ─── Patch / insert ───────────────────────────────────────────────────────────

export function patchFile(filePath, searchStr, replaceStr) {
  const content = readFile(filePath);
  if (!content.includes(searchStr)) {
    throw new Error(`Chaîne de recherche introuvable dans ${filePath}`);
  }
  const patched = content.replace(searchStr, replaceStr);
  writeFile(filePath, patched);
  return patched;
}

export function insertAfter(filePath, afterStr, insertStr) {
  const content = readFile(filePath);
  if (!content.includes(afterStr)) {
    throw new Error(`Ancre introuvable dans ${filePath}`);
  }
  const patched = content.replace(afterStr, afterStr + "\n" + insertStr);
  writeFile(filePath, patched);
  return patched;
}

// ─── Command execution ────────────────────────────────────────────────────────

export async function run(cmd, options = {}) {
  const { cwd = ".", timeout = 30000, force = false } = options;

  if (!force && !isSafeCommand(cmd)) {
    return {
      success: false,
      output:  `⛔ Commande bloquée: "${cmd}"\nPas dans la whitelist. Confirmez manuellement.`,
    };
  }

  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout });
    return { success: true, output: stdout || stderr || "(aucune sortie)" };
  } catch (e) {
    return { success: false, output: e.stdout || e.stderr || e.message };
  }
}

// ─── Git ──────────────────────────────────────────────────────────────────────

export async function gitStatus(cwd = ".")  { return (await run("git status --short",  { cwd })).output; }
export async function gitDiff(cwd = ".")    { return (await run("git diff --stat",     { cwd })).output; }