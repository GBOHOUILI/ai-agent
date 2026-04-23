#!/usr/bin/env node
// agent.js — Zero-to-One AI V10
// by Eldo-Moréo GBOHOUILI — github.com/GBOHOUILI/ai-agent

import readlineSync from "readline-sync";
import { createREPL, confirm as replConfirm, question as replQuestion } from "./modules/repl/index.js";
import { config as dotenvConfig } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import os from "os";
import fs from "fs"; 

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Charge le .env depuis plusieurs emplacements ─────────────────────────────
const GLOBAL_DIR     = join(os.homedir(), ".ai-agent");
const GLOBAL_ENV     = join(GLOBAL_DIR, ".env");
const GLOBAL_PROFILE = join(GLOBAL_DIR, "profile.json");

const ENV_LOCATIONS = [
  GLOBAL_ENV,
  join(process.cwd(), ".env"),
  join(__dirname, ".env"),
];

// Charge TOUS les .env trouvés (merge) — fix du bug "clés non rechargées"
for (const loc of ENV_LOCATIONS) {
  if (fs.existsSync(loc)) {
    dotenvConfig({ path: loc, override: false }); // ne pas écraser les valeurs déjà chargées
  }
}

// --help / -h sans lancer le REPL
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
  Zero-to-One AI — Agent CLI V1
  by Eldo-Moréo GBOHOUILI

  Usage:
    ai                        Lance l'agent (répertoire courant)
    ai /chemin/du/projet      Lance sur un projet spécifique
    ai --help                 Affiche cette aide

  Premières étapes:
    1. ai              → tape 'setup' pour configurer
    2. Remplis tes clés API dans ~/.ai-agent/.env
    3. Tape une question ou une commande

  Commandes principales:
    setup              Wizard de configuration
    config             Gérer les clés API
    analyze            Analyser le projet
    build <feature>    Construire une feature
    diff               Résumer les changements Git
    review             Code review complète
    roadmap            Gérer le roadmap
    organize           Organiser les fichiers
    help               Toutes les commandes

  Providers supportés:
    Gemini · Groq · Mistral · Claude · Cohere · OpenRouter · Ollama (local)

  GitHub: https://github.com/GBOHOUILI/ai-agent
  `);
  process.exit(0);
}

import path from "path";
import { ask, getActiveProvider, getProviderStatus, reloadPools, getProviderStatusWithOllama, isOllamaRunning } from "./modules/llm/index.js";
import { buildProjectContext, scanTree, detectProjectType } from "./modules/scanner/index.js";
import { readFile, writeFile, run, isSafeCommand, buildDiff, fileExists } from "./modules/tools/index.js";
import { createPlan, executeStep } from "./modules/planner/index.js";
import { Memory } from "./memory/index.js";
import { runRoadmapCheck, findRoadmapFile, generateRoadmapFromCode, analyzeDependencies, getNextTasks, extractMarketingPosts, STATUTS, parseRoadmap } from "./modules/roadmap/index.js";
import { analyzeProject, debugIssue, planFeature, refactorFile, generateTests, explainCode, generateFile, securityAudit, gitSummary, diffSummary, reviewCode } from "./commands/index.js";
import { previewOrganize, executeOrganize } from "./modules/organizer/index.js";
import { trackCommand, trackInstall, detectStack } from "./modules/analytics/index.js";
import { getTheme } from "./config/themes/index.js";

// ── Fix critique : recharge les pools dès le démarrage ───────────────────────
reloadPools();

// ─── Charge le profil utilisateur ────────────────────────────────────────────

function loadProfile() {
  if (fs.existsSync(GLOBAL_PROFILE)) {
    try { return JSON.parse(fs.readFileSync(GLOBAL_PROFILE, "utf-8")); }
    catch { return null; }
  }
  return null;
}

function saveProfile(profile) {
  if (!fs.existsSync(GLOBAL_DIR)) fs.mkdirSync(GLOBAL_DIR, { recursive: true });
  fs.writeFileSync(GLOBAL_PROFILE, JSON.stringify(profile, null, 2));
}

let PROFILE = loadProfile();
let C = getTheme(PROFILE?.theme || "gold");

// ─── Config ───────────────────────────────────────────────────────────────────

const VERSION = "10.0.0";
let TARGET_DIR = path.resolve(process.argv[2] || ".");
const memory = new Memory(TARGET_DIR);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function p(text, color = C.reset) { console.log(`${color}${text}${C.reset}`); }
function div() { p("─".repeat(60), C.dim); }

const USER_NAME = PROFILE?.name || "Dev";
const LANG_SYSTEM = {
  fr: "Tu es un expert en développement logiciel. Réponds en français.",
  en: "You are an expert software engineer. Reply in English.",
  es: "Eres un experto en desarrollo de software. Responde en español.",
  de: "Du bist ein erfahrener Softwareentwickler. Antworte auf Deutsch.",
  pt: "Você é um especialista em desenvolvimento de software. Responda em português.",
};

function getSystemPrompt() {
  if (PROFILE?.systemPrompt) return PROFILE.systemPrompt;
  return LANG_SYSTEM[PROFILE?.language || "fr"] || LANG_SYSTEM.fr;
}

// ─── Header ───────────────────────────────────────────────────────────────────

function printHeader() {
  console.clear();
  p("");
  p("  ╔══════════════════════════════════════════════╗", C.primary);
  p("  ║   Zero-to-One AI  —  V1                     ║", C.primary);
  p("  ║   by Eldo-Moréo GBOHOUILI                    ║", C.primary);
  p("  ╚══════════════════════════════════════════════╝", C.primary);
  p("");
}

function printStatus() {
  const types    = detectProjectType(TARGET_DIR);
  const provider = getActiveProvider();
  const hasKey   = !provider.includes("⚠");

  p(`  Bonjour ${C.primary}${USER_NAME}${C.reset} 👋`, C.secondary);
  p(`  Projet   ${C.primary}${TARGET_DIR}${C.reset}`, C.secondary);
  p(`  Stack    ${C.info}${types.length ? types.join(", ") : "Unknown"}${C.reset}`, C.secondary);
  p(`  Modèle   ${hasKey ? C.success : C.error}${provider}${C.reset}`, C.secondary);
  p(`  Thème    ${C.primary}${PROFILE?.theme || "gold"}${C.reset}  Style ${C.primary}${PROFILE?.style || "balanced"}${C.reset}`, C.secondary);

  const activeEnv = ENV_LOCATIONS.find((l) => fs.existsSync(l));
  if (activeEnv) {
    p(`  Config   ${C.info}${activeEnv}${C.reset}`, C.secondary);
  } else {
    p(`  Config   ${C.error}⚠ Aucune config — tapez 'setup' pour configurer${C.reset}`, C.secondary);
  }

  const roadmapFiles = findRoadmapFile(TARGET_DIR);
  if (roadmapFiles.length > 0) {
    p(`  Roadmap  ${C.primary}${path.basename(roadmapFiles[0])} détecté${C.reset}`, C.secondary);
  } else {
    p(`  Roadmap  ${C.secondary}aucun — tapez 'roadmap generate'${C.reset}`, C.secondary);
  }
  p("");
}

function printHelp() {
  div();
  p("  COMMANDES PRINCIPALES", C.bold + C.primary);
  div();
  const sections = [
    ["Configuration", [
      ["setup",              "Reconfigurer l'agent (wizard interactif)"],
      ["profile",            "Voir / modifier ton profil"],
      ["config",             "Gérer les clés API"],
      ["tokens",             "Statut des providers LLM"],
    ]],
    ["Projet & Code", [
      ["analyze",            "Analyse complète du projet"],
      ["debug <bug>",        "Débugger un problème"],
      ["build <feature>",    "Planifier + construire une feature"],
      ["refactor <file>",    "Refactoriser (avec diff visuel)"],
      ["generate <f> <desc>","Générer un nouveau fichier"],
      ["tests <file>",       "Générer des tests"],
      ["explain <file>",     "Expliquer un fichier"],
      ["security",           "Audit de sécurité"],
    ]],
    ["Organisation", [
      ["organize",           "Suggérer une réorganisation des fichiers"],
      ["organize go",        "Exécuter la réorganisation suggérée"],
      ["tree",               "Arborescence du projet"],
    ]],
    ["Roadmap", [
      ["roadmap",            "Analyser le roadmap vs le code"],
      ["roadmap update",     "Mettre à jour les statuts"],
      ["roadmap next",       "Prochaines tâches + Prompt IA"],
      ["roadmap deps",       "Dépendances et conflits"],
      ["roadmap marketing",  "Posts LinkedIn / Twitter / Facebook"],
      ["roadmap generate",   "Générer un roadmap depuis le code"],
    ]],
    ["Utilitaires", [
      ["run <cmd>",          "Exécuter une commande shell"],
      ["read <file>",        "Lire un fichier"],
      ["memory",             "Mémoire du projet"],
      ["git",                "Suggérer un message de commit"],
      ["cd <path>",          "Changer de projet cible"],
      ["clear",              "Vider l'écran"],
      ["exit",               "Quitter"],
    ]],
  ];
  for (const [section, cmds] of sections) {
    p(`\n  ${section}`, C.bold);
    for (const [cmd, desc] of cmds) {
      p(`  ${C.primary}${cmd.padEnd(26)}${C.reset}${C.secondary}${desc}${C.reset}`);
    }
  }
  div();
  p(`\n  ${C.secondary}Question directe = chat avec l'agent.${C.reset}`);
}

// ─── Token status ─────────────────────────────────────────────────────────────

function printTokenStatus() {
  div();
  p("  STATUT DES CLÉS API", C.bold);
  div();
  for (const s of getProviderStatus()) {
    const dot = s.active ? `${C.success}●${C.reset}` : `${C.secondary}○${C.reset}`;
    const detail = s.active
      ? `${C.success}${s.available}/${s.total} clé(s)${C.reset}`
      : `${C.secondary}non configuré${C.reset}`;
    p(`  ${dot}  ${s.name.padEnd(14)} ${detail}`);
  }
  p(`\n  ${C.secondary}Multi-tokens : PROVIDER_API_KEY_2, _3... dans .env${C.reset}`);
  div();
}

// ─── Profile editor ───────────────────────────────────────────────────────────

function printProfile() {
  div();
  p("  TON PROFIL", C.bold);
  div();
  if (!PROFILE) {
    p(`  ${C.error}Aucun profil. Tape 'setup' pour configurer.${C.reset}`);
    return;
  }
  const fields = [
    ["Nom",        PROFILE.name],
    ["Langue",     PROFILE.language],
    ["Style",      PROFILE.style],
    ["Thème",      PROFILE.theme],
    ["Provider",   PROFILE.preferredProvider],
    ["Analytics",  PROFILE.analytics ? "activé (anonyme)" : "désactivé"],
    ["Créé le",    PROFILE.createdAt ? new Date(PROFILE.createdAt).toLocaleDateString("fr-FR") : "?"],
  ];
  for (const [k, v] of fields) {
    p(`  ${C.primary}${k.padEnd(12)}${C.reset}${C.secondary}${v}${C.reset}`);
  }
  if (PROFILE.systemPrompt) {
    p(`  ${C.primary}Prompt sys  ${C.reset}${C.secondary}${PROFILE.systemPrompt.slice(0, 80)}...${C.reset}`);
  }
  p(`\n  ${C.secondary}Fichier : ${GLOBAL_PROFILE}${C.reset}`);
  div();
  p(`  ${C.secondary}Tape 'setup' pour tout reconfigurer avec le wizard.${C.reset}`);
}

// ─── Config (clés API) ────────────────────────────────────────────────────────

async function cmdConfig() {
  const globalEnvPath = GLOBAL_ENV;
  if (!fs.existsSync(GLOBAL_DIR)) fs.mkdirSync(GLOBAL_DIR, { recursive: true });
  const templatePath = join(__dirname, ".env.example");
  if (!fs.existsSync(globalEnvPath)) {
    const template = fs.existsSync(templatePath)
      ? fs.readFileSync(templatePath, "utf-8")
      : `GEMINI_API_KEY=\nGROQ_API_KEY=\nOPENROUTER_API_KEY=\nCLAUDE_API_KEY=\n`;
    fs.writeFileSync(globalEnvPath, template);
  }
  const rawEnv = fs.readFileSync(globalEnvPath, "utf-8").split("\n");
  let reloaded = 0;
  for (const line of rawEnv) {
    if (line.startsWith("#") || !line.includes("=")) continue;
    const eqIdx = line.indexOf("=");
    const key   = line.slice(0, eqIdx).trim();
    const val   = line.slice(eqIdx + 1).trim();
    if (key && val) { process.env[key] = val; reloaded++; }
  }
  div();
  p("  CONFIGURATION — Clés API", C.bold);
  div();
  p(`  Fichier : ${C.primary}${globalEnvPath}${C.reset}`, C.secondary);
  p("\n  Clés configurées :", C.reset);
  for (const line of rawEnv) {
    if (line.startsWith("#") || !line.includes("=")) continue;
    const eqIdx = line.indexOf("=");
    const key   = line.slice(0, eqIdx).trim();
    const val   = line.slice(eqIdx + 1).trim();
    if (!key) continue;
    const filled = val.length > 0;
    p(`  ${filled ? C.success + "●" : C.secondary + "○"}  ${key.padEnd(26)} ${filled ? val.slice(0, 10) + "..." : C.secondary + "(vide)"}${C.reset}`);
  }
  if (reloaded > 0) {
    const { reloadPools: rp } = await import("./modules/llm/index.js").catch(() => ({ reloadPools: () => {} }));
    p(`\n  ${C.success}✅ ${reloaded} clé(s) rechargée(s) — Provider actif : ${getActiveProvider()}${C.reset}`);
  } else {
    p(`\n  ${C.error}⚠  Aucune clé. Édite : nano ${globalEnvPath}${C.reset}`);
  }
  div();
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

let spinnerInterval = null;
const spinFrames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
let spinIdx = 0;

function startSpinner(msg = "Réflexion") {
  spinIdx = 0;
  spinnerInterval = setInterval(() => {
    process.stdout.write(`\r  ${C.primary}${spinFrames[spinIdx++ % spinFrames.length]}${C.reset}  ${C.secondary}${msg}...${C.reset}`);
  }, 80);
}
function stopSpinner() {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    process.stdout.write("\r" + " ".repeat(70) + "\r");
  }
}

// ─── Roadmap display ──────────────────────────────────────────────────────────

function displayRoadmapAnalysis(result) {
  if (!result.analysis) return;
  const { summary, completion_pct, tasks, next_priority } = result.analysis;
  const pct    = Math.min(100, Math.max(0, completion_pct || 0));
  const filled = Math.round(pct / 5);
  const bar    = "█".repeat(filled) + "░".repeat(20 - filled);
  p(`\n  Progression  ${C.primary}${bar}${C.reset}  ${C.bold}${pct}%${C.reset}`, C.reset);
  p(`  ${summary}`, C.secondary);
  const done       = tasks?.filter((t) => t.real_status === "DONE")        || [];
  const inProgress = tasks?.filter((t) => t.real_status === "IN_PROGRESS") || [];
  const todo       = tasks?.filter((t) => t.real_status === "TODO")        || [];
  const toUpdate   = tasks?.filter((t) => t.should_update)                 || [];
  p(`\n  ✅ Terminées ${C.success}${done.length}${C.reset}   🔄 En cours ${C.primary}${inProgress.length}${C.reset}   ⏳ À faire ${C.secondary}${todo.length}${C.reset}`, C.reset);
  if (toUpdate.length > 0) {
    p(`\n  Statuts à corriger (${toUpdate.length}) :`, C.primary);
    for (const t of toUpdate.slice(0, 12)) {
      const arrow =
        t.real_status === "DONE"        ? `${C.success}✓ Terminé${C.reset}` :
        t.real_status === "IN_PROGRESS" ? `${C.primary}⟳ En cours${C.reset}` :
                                          `${C.secondary}○ À faire${C.reset}`;
      p(`  ${C.secondary}[${t.id}]${C.reset} ${String(t.titre || "").slice(0, 55)} → ${arrow}`);
      if (t.evidence) p(`         ${C.secondary}${String(t.evidence).slice(0, 90)}${C.reset}`);
    }
  }
  if (next_priority) p(`\n  🎯 Prochaine priorité : ${C.primary}${next_priority}${C.reset}`, C.reset);
}

function cmdRoadmapNext(roadmap) {
  const nexts = getNextTasks(roadmap.tasks, 5);
  if (nexts.length === 0) { p("\n  ✅ Aucune tâche en attente.", C.success); return; }
  p(`\n  🎯 PROCHAINES TÂCHES (${nexts.length})\n`, C.bold);
  for (const t of nexts) {
    const prio = { CRITIQUE: `${C.error}CRITIQUE`, HAUTE: `${C.primary}HAUTE`, MOYENNE: `${C.info}MOYENNE`, BASSE: `${C.secondary}BASSE` }[t.priorite?.toUpperCase()] || C.secondary + (t.priorite || "?");
    div();
    p(`  ${C.primary}[${t.id}]${C.reset} ${C.bold}${t.titre}${C.reset}  |  ${prio}${C.reset}`);
    if (t.description) p(`  ${C.secondary}${t.description.slice(0, 120)}${C.reset}`);
    if (t.promptIA) {
      p(`\n  ${C.primary}▶ PROMPT IA :${C.reset}`);
      t.promptIA.slice(0, 600).split("|").map((l) => l.trim()).filter(Boolean).forEach((line) => p(`  ${C.secondary}${line}${C.reset}`));
    }
  }
  div();
}

function cmdRoadmapDeps(roadmap) {
  const { blocked, conflicts } = analyzeDependencies(roadmap.tasks);
  if (conflicts.length === 0 && blocked.length === 0) { p("\n  ✅ Aucun conflit.", C.success); return; }
  if (conflicts.length > 0) {
    p(`\n  ⚠  CONFLITS : ${conflicts.length}`, C.error);
    for (const c of conflicts) p(`  ${C.error}[${c.task.id}]${C.reset} ${c.task.titre} → dépend de non-terminées: ${c.missingDeps.map((d) => `[${d.id}]`).join(", ")}`);
  }
  if (blocked.length > 0) {
    p(`\n  🔒 BLOQUÉES : ${blocked.length}`, C.primary);
    for (const b of blocked) {
      p(`  ${C.primary}[${b.task.id}]${C.reset} ${b.task.titre}`);
      p(`     Bloquée par: ${b.blockedBy.map((d) => `${C.secondary}[${d.id}] ${d.titre.slice(0, 40)}${C.reset}`).join(", ")}`);
    }
  }
}

function cmdRoadmapMarketing(roadmap, plateforme = "all") {
  const posts = extractMarketingPosts(roadmap.tasks, plateforme);
  if (posts.length === 0) { p(`\n  ℹ  Aucun post marketing trouvé.`, C.secondary); return; }
  p(`\n  📢 POSTS MARKETING (${posts.length} jalons)\n`, C.bold);
  for (const post of posts) {
    div();
    const statusIcon = post.statut === STATUTS.DONE ? `${C.success}✅` : post.statut === STATUTS.IN_PROGRESS ? `${C.primary}🔄` : `${C.secondary}⏳`;
    p(`  ${C.primary}[${post.id}]${C.reset} ${C.bold}${post.titre}${C.reset}  ${statusIcon}${C.reset}`);
    if (post.linkedin) { p(`\n  ${C.info}── LINKEDIN ──${C.reset}`); post.linkedin.split("\n").slice(0, 8).forEach((l) => p(`  ${l}`, C.secondary)); }
    if (post.twitter)  { p(`\n  ${C.info}── TWITTER/X ──${C.reset}`); post.twitter.split("\n").slice(0, 6).forEach((l) => p(`  ${l}`, C.secondary)); }
    if (post.facebook) { p(`\n  ${C.info}── FACEBOOK ──${C.reset}`); post.facebook.split("\n").slice(0, 8).forEach((l) => p(`  ${l}`, C.secondary)); }
  }
  div();
}

// ─── Smart answer ─────────────────────────────────────────────────────────────

async function smartAnswer(input) {
  const context = buildProjectContext(TARGET_DIR, { maxFiles: 15, maxCharsPerFile: 1500 });
  const history = memory.getHistory(8);
  const messages = [...history, { role: "user", content: `PROJECT:\n${context.slice(0, 3000)}\n\nQUESTION: ${input}` }];
  const styleHints = {
    concise:   "Be very concise, straight to the point.",
    balanced:  "Give a balanced, clear answer.",
    detailed:  "Be thorough and detailed.",
    technical: "Use technical language, be precise.",
  };
  const system = `${getSystemPrompt()} ${styleHints[PROFILE?.style || "balanced"] || ""} Expert software engineer. Project: ${TARGET_DIR}. Stack: ${detectProjectType(TARGET_DIR).join(", ")}.`;
  return await ask(messages, system, { useCache: false });
}

// ─── Plan & Execute ───────────────────────────────────────────────────────────

async function planAndExecute(task) {
  p("\n  📋 Création du plan...", C.primary);
  const context = buildProjectContext(TARGET_DIR, { maxFiles: 20, maxCharsPerFile: 1500 });
  const history = memory.getHistory(6);
  const plan = await createPlan(task, context, history);
  p(`\n  Objectif: ${plan.goal}`, C.bold);
  div();
  for (const s of plan.steps) {
    const icon = { ANALYZE:"🔍", CREATE_FILE:"📝", MODIFY_FILE:"✏️ ", RUN_CMD:"⚙️ ", VERIFY:"✅", EXPLAIN:"💡" }[s.type] || "•";
    p(`  ${icon} ${s.id}. [${s.type}] ${s.title}`, C.secondary);
    if (s.file) p(`      ${C.info}→ ${s.file}${C.reset}`);
  }
  div();
  const ok = readlineSync.question("\n  Exécuter ce plan? (y/n): ").trim().toLowerCase();
  if (ok !== "y") { p("  Annulé.", C.secondary); return; }
  for (const step of plan.steps) {
    const icon = { ANALYZE:"🔍", CREATE_FILE:"📝", MODIFY_FILE:"✏️ ", RUN_CMD:"⚙️ ", VERIFY:"✅", EXPLAIN:"💡" }[step.type] || "•";
    p(`\n  ${icon} Étape ${step.id}: ${step.title}`, C.primary);
    if (step.type === "RUN_CMD" && step.command) {
      const safe = isSafeCommand(step.command);
      p(`  Commande: ${step.command}`, safe ? C.info : C.error);
      const okRun = readlineSync.question("  Exécuter? (y/n): ");
      if (okRun.toLowerCase() !== "y") { p("  Ignoré.", C.secondary); continue; }
      const result = await run(step.command, { cwd: TARGET_DIR, force: !safe });
      p(`\n${result.output}`, result.success ? C.success : C.error);
      memory.logAction("RUN_CMD", step.command);
      continue;
    }
    if (step.type === "CREATE_FILE" && step.file) {
      startSpinner(`Génération ${step.file}`);
      const content = await executeStep(step, context, history);
      stopSpinner();
      p(`\n  Aperçu (20 premières lignes):`, C.info);
      p(content.split("\n").slice(0, 20).join("\n"), C.secondary);
      const okWrite = readlineSync.question("\n  Écrire ce fichier? (y/n): ");
      if (okWrite.toLowerCase() === "y") {
        writeFile(path.join(TARGET_DIR, step.file), content);
        p(`  ✅ Créé: ${step.file}`, C.success);
        memory.logAction("CREATE_FILE", step.title, [step.file]);
      }
      continue;
    }
    if (step.type === "MODIFY_FILE" && step.file) {
      const fullPath = path.join(TARGET_DIR, step.file);
      const oldContent = fileExists(fullPath) ? readFile(fullPath) : "";
      startSpinner(`Modification ${step.file}`);
      const newContent = await executeStep(step, context, history);
      stopSpinner();
      if (oldContent) {
        const diff = buildDiff(oldContent, newContent, step.file);
        p(`\n${diff.text}`);
        p(`\n  ${C.success}+${diff.added}${C.reset}  ${C.error}-${diff.removed}${C.reset}`);
      }
      const okMod = readlineSync.question(`\n  Appliquer? (y/n): `);
      if (okMod.toLowerCase() === "y") {
        writeFile(fullPath, newContent);
        p(`  ✅ Modifié: ${step.file}`, C.success);
        memory.logAction("MODIFY_FILE", step.title, [step.file]);
      }
      continue;
    }
    startSpinner(step.title);
    const result = await executeStep(step, context, history);
    stopSpinner();
    p(`\n${result}`, C.reset);
    memory.logAction(step.type, step.title);
  }
  p("\n  ✅ Plan terminé.", C.success);
}


// ─── Suggestion de la prochaine action ───────────────────────────────────────

async function suggestNextAction(userInput, agentResponse) {
  try {
    // Vérifier s'il y a un roadmap pour suggérer la prochaine tâche
    const roadmapFiles = findRoadmapFile(TARGET_DIR);

    if (roadmapFiles.length > 0) {
      const roadmap = parseRoadmap(roadmapFiles[0]);
      const nexts   = getNextTasks(roadmap.tasks, 1);

      if (nexts.length > 0) {
        const t = nexts[0];
        p("", C.reset);
        div();
        p(`  💡 Prochaine tâche suggérée :`, C.secondary);
        p(`  ${C.primary}[${t.id}]${C.reset} ${t.titre}`, C.reset);
        if (t.promptIA) {
          p(`  ${C.secondary}→ Tape :${C.reset} ${C.primary}${t.promptIA}${C.reset}`);
        }
        div();
        return;
      }
    }

    // Pas de roadmap — suggérer des commandes contextuelles
    const lower = (userInput + " " + agentResponse).toLowerCase();
    const suggestions = [];

    if (lower.includes("bug") || lower.includes("erreur") || lower.includes("error")) {
      suggestions.push(`debug ${userInput.slice(0, 60)}`);
    }
    if (lower.includes("test") || lower.includes("spec")) {
      suggestions.push("tests <fichier>");
    }
    if (lower.includes("sécurité") || lower.includes("security") || lower.includes("vulnerab")) {
      suggestions.push("security");
    }
    if (lower.includes("refactor") || lower.includes("améliorer") || lower.includes("clean")) {
      suggestions.push("refactor <fichier>");
    }
    if (lower.includes("git") || lower.includes("commit") || lower.includes("push")) {
      suggestions.push("diff");
      suggestions.push("git");
    }
    if (lower.includes("roadmap") || lower.includes("tâche") || lower.includes("feature")) {
      suggestions.push("roadmap next");
    }
    if (suggestions.length === 0) {
      suggestions.push("analyze");
      suggestions.push("roadmap");
    }

    p("", C.reset);
    p(`  ${C.secondary}💡 Commandes suggérées :${C.reset}  ${suggestions.slice(0, 2).map((s) => `${C.primary}${s}${C.reset}`).join("   ")}`, C.reset);

  } catch {
    // Silencieux — les suggestions ne doivent jamais bloquer
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function dispatch(input) {
  input = input.trim();
  if (!input) return;
  const parts = input.split(" ");
  const cmd   = parts[0].toLowerCase();
  const args  = parts.slice(1).join(" ").trim();
  memory.addMessage("user", input);
  try {
    switch (cmd) {
      case "help": case "?":
        printHelp(); break;

      case "setup":
        p("\n  Lancement du wizard de configuration...", C.primary);
        p(`  ${C.secondary}Commande : ai-setup${C.reset}`);
        p(`  ${C.secondary}Ou : node setup/wizard.js${C.reset}`);
        const { execSync } = await import("child_process");
        try {
          execSync(`node ${path.join(__dirname, "setup/wizard.js")}`, { stdio: "inherit" });
          PROFILE = loadProfile();
          C = getTheme(PROFILE?.theme || "gold");
          printHeader();
          printStatus();
        } catch {}
        break;

      case "profile":
        printProfile(); break;

      case "tokens": {
        div();
        p("  STATUT DES PROVIDERS", C.bold);
        div();
        const statuses = await getProviderStatusWithOllama();
        for (const s of statuses) {
          if (s.local) {
            const dot = s.active ? `${C.success}●${C.reset}` : `${C.secondary}○${C.reset}`;
            const detail = s.active
              ? `${C.success}actif (local, sans clé)${C.reset}`
              : `${C.secondary}non démarré — 'ollama serve'${C.reset}`;
            p(`  ${dot}  ${"Ollama".padEnd(14)} ${detail}`);
          } else {
            const dot = s.active ? `${C.success}●${C.reset}` : `${C.secondary}○${C.reset}`;
            const detail = s.active
              ? `${C.success}${s.available}/${s.total} clé(s)${C.reset}`
              : `${C.secondary}non configuré${C.reset}`;
            p(`  ${dot}  ${s.name.padEnd(14)} ${detail}`);
          }
        }
        p(`\n  ${C.secondary}Multi-tokens : PROVIDER_API_KEY_2, _3... dans .env${C.reset}`);
        p(`  ${C.secondary}Ollama local : OLLAMA_MODEL=llama3.2 (défaut)${C.reset}`);
        div();
        break;
      }

      case "diff": {
        startSpinner("Analyse des changements Git");
        const result = await diffSummary(TARGET_DIR, memory.getHistory(2));
        stopSpinner();
        p(`\n${result}`, C.reset);
        memory.addMessage("assistant", result.slice(0, 500));
        break;
      }

      case "review": {
        const targetBranch = args || "main";
        startSpinner(`Code review vs ${targetBranch}`);
        const result = await reviewCode(TARGET_DIR, targetBranch, memory.getHistory(2));
        stopSpinner();
        p(`\n${result}`, C.reset);
        memory.addMessage("assistant", result.slice(0, 500));
        await trackCommand("review", { projectStack: detectStack(TARGET_DIR) });
        await suggestNextAction("review", result);
        break;
      }

      case "history": {
        div();
        p("  HISTORIQUE DES CONVERSATIONS", C.bold);
        div();
        const hist = memory.getHistory(20);
        if (!hist.length) { p("  Aucun historique pour ce projet.", C.secondary); break; }
        for (let i = 0; i < hist.length; i++) {
          const m = hist[i];
          const icon = m.role === "user" ? `${C.primary}▶${C.reset}` : `${C.secondary}◀${C.reset}`;
          const preview = (m.content || "").replace(/\n/g, " ").slice(0, 90);
          p(`  ${icon}  ${preview}${preview.length >= 90 ? "..." : ""}`);
        }
        div();
        break;
      }

      case "config": {
        const globalEnvPath = GLOBAL_ENV;
        if (!fs.existsSync(GLOBAL_DIR)) fs.mkdirSync(GLOBAL_DIR, { recursive: true });
        const templatePath = join(__dirname, ".env.example");
        if (!fs.existsSync(globalEnvPath)) {
          const template = fs.existsSync(templatePath)
            ? fs.readFileSync(templatePath, "utf-8")
            : `GEMINI_API_KEY=\nGROQ_API_KEY=\nOPENROUTER_API_KEY=\nCLAUDE_API_KEY=\n`;
          fs.writeFileSync(globalEnvPath, template);
        }
        const rawEnv = fs.readFileSync(globalEnvPath, "utf-8").split("\n");
        let reloaded = 0;
        for (const line of rawEnv) {
          if (line.startsWith("#") || !line.includes("=")) continue;
          const eqIdx = line.indexOf("=");
          const key   = line.slice(0, eqIdx).trim();
          const val   = line.slice(eqIdx + 1).trim();
          if (key && val) { process.env[key] = val; reloaded++; }
        }
        reloadPools();
        div();
        p("  CONFIGURATION — Clés API", C.bold);
        div();
        p(`  Fichier : ${C.primary}${globalEnvPath}${C.reset}`, C.secondary);
        p("\n  Clés configurées :", C.reset);
        for (const line of rawEnv) {
          if (line.startsWith("#") || !line.includes("=")) continue;
          const eqIdx = line.indexOf("=");
          const key   = line.slice(0, eqIdx).trim();
          const val   = line.slice(eqIdx + 1).trim();
          if (!key) continue;
          const filled = val.length > 0;
          p(`  ${filled ? C.success + "●" : C.secondary + "○"}  ${key.padEnd(26)} ${filled ? val.slice(0, 10) + "..." : C.secondary + "(vide)"}${C.reset}`);
        }
        if (reloaded > 0) {
          p(`\n  ${C.success}✅ ${reloaded} clé(s) rechargée(s) — Provider actif : ${getActiveProvider()}${C.reset}`);
        } else {
          p(`\n  ${C.error}⚠  Aucune clé. Édite : nano ${globalEnvPath}${C.reset}`);
        }
        div();
        break;
      }

      // ── ORGANIZE ────────────────────────────────────────────────────────────
      case "organize": {
        const sub = args.toLowerCase();
        if (sub === "go") {
          const analysis = previewOrganize(TARGET_DIR, C);
          if (!analysis || analysis.suggestions.length === 0) break;
          const ok = readlineSync.question("\n  Exécuter la réorganisation? (y/n): ");
          if (ok.toLowerCase() === "y") {
            executeOrganize(analysis, C);
            p("\n  ✅ Réorganisation terminée.", C.success);
            await trackCommand("organize", { projectStack: detectStack(TARGET_DIR) });
          } else {
            p("  Annulé.", C.secondary);
          }
        } else {
          previewOrganize(TARGET_DIR, C);
          p(`\n  ${C.secondary}Tape 'organize go' pour exécuter le plan.${C.reset}`);
        }
        break;
      }

      // ── ROADMAP ─────────────────────────────────────────────────────────────
      case "roadmap": {
        const sub = args.toLowerCase();
        if (sub === "generate") {
          const existing = findRoadmapFile(TARGET_DIR);
          if (existing.length > 0) {
            p(`\n  ℹ Roadmap existant: ${C.primary}${path.basename(existing[0])}${C.reset}`, C.secondary);
            const ok = readlineSync.question("  Générer un nouveau quand même? (y/n): ");
            if (ok.toLowerCase() !== "y") break;
          }
          startSpinner("Génération du roadmap enrichi");
          const csv = await generateRoadmapFromCode(TARGET_DIR);
          stopSpinner();
          p("\n  Aperçu :", C.info);
          csv.split("\n").slice(0, 12).forEach((l) => p(`  ${l}`, C.secondary));
          const ok = readlineSync.question("\n  Sauvegarder comme roadmap.csv? (y/n): ");
          if (ok.toLowerCase() === "y") {
            writeFile(path.join(TARGET_DIR, "roadmap.csv"), csv);
            p("  ✅ roadmap.csv créé!", C.success);
          }
          break;
        }
        if (sub === "next") {
          const files = findRoadmapFile(TARGET_DIR);
          if (!files.length) { p("\n  ℹ  Aucun roadmap. Tape 'roadmap generate'.", C.secondary); break; }
          const roadmap = parseRoadmap(files[0]);
          cmdRoadmapNext(roadmap);
          break;
        }
        if (sub === "deps") {
          const files = findRoadmapFile(TARGET_DIR);
          if (!files.length) { p("\n  ℹ  Aucun roadmap.", C.secondary); break; }
          cmdRoadmapDeps(parseRoadmap(files[0]));
          break;
        }
        if (sub.startsWith("marketing")) {
          const pf = sub.split(" ")[1] || "all";
          const files = findRoadmapFile(TARGET_DIR);
          if (!files.length) { p("\n  ℹ  Aucun roadmap.", C.secondary); break; }
          cmdRoadmapMarketing(parseRoadmap(files[0]), pf);
          break;
        }
        const autoUpdate = sub === "update";
        startSpinner(autoUpdate ? "Analyse + mise à jour statuts" : "Analyse roadmap vs code");
        const result = await runRoadmapCheck(TARGET_DIR, { autoUpdate });
        stopSpinner();
        if (!result.found) {
          p("\n  ℹ  Aucun roadmap détecté.", C.secondary);
          const ok = readlineSync.question("\n  Générer maintenant? (y/n): ");
          if (ok.toLowerCase() === "y") await dispatch("roadmap generate");
          break;
        }
        p(`\n  📋 Roadmap : ${C.primary}${result.fileName || path.basename(result.filePath)}${C.reset} · ${result.totalTasks ?? "?"} tâches${result.isEnriched ? ` · ${C.success}format enrichi ✓${C.reset}` : ""}`, C.reset);
        if (result.message) {
          p(`\n  ⚠  ${result.message}`, C.primary);
          p(`  ${C.secondary}Tape 'roadmap next' pour voir les tâches sans analyse IA.${C.reset}`);
          break;
        }
        div();
        displayRoadmapAnalysis(result);
        if (autoUpdate && result.updateResult) {
          p(result.updateResult.updated > 0 ? `\n  ✅ ${result.updateResult.updated} statuts mis à jour` : "\n  ℹ Aucun statut à mettre à jour.", result.updateResult.updated > 0 ? C.success : C.secondary);
        } else if (result.analysis?.tasks?.some((t) => t.should_update) && !autoUpdate) {
          p(`\n  ${C.secondary}Tape 'roadmap update' pour mettre à jour.${C.reset}`);
        }
        if (result.isEnriched) p(`\n  ${C.secondary}'roadmap next' · 'roadmap deps' · 'roadmap marketing'${C.reset}`);
        await trackCommand("roadmap", { projectStack: detectStack(TARGET_DIR) });
        break;
      }

      // ── CODE COMMANDS ────────────────────────────────────────────────────────
      case "analyze": {
        startSpinner("Analyse du projet");
        const result = await analyzeProject(TARGET_DIR, memory.getHistory(4));
        stopSpinner();
        p(`\n${result}`, C.reset);
        memory.addMessage("assistant", result.slice(0, 500));
        await trackCommand("analyze", { projectStack: detectStack(TARGET_DIR) });
        await suggestNextAction("analyze", result);
        break;
      }
      case "debug": {
        if (!args) { p("  Usage: debug <description du bug>", C.error); break; }
        startSpinner("Debugging");
        const result = await debugIssue(args, TARGET_DIR, memory.getHistory(6));
        stopSpinner();
        p(`\n${result}`, C.reset);
        memory.addMessage("assistant", result.slice(0, 500));
        break;
      }
      case "build": {
        if (!args) { p("  Usage: build <description de la feature>", C.error); break; }
        await planAndExecute(`Build feature: ${args}`);
        break;
      }
      case "refactor": {
        if (!args) { p("  Usage: refactor <file> [instruction]", C.error); break; }
        const [file, ...instrParts] = args.split(" ");
        const filePath = path.join(TARGET_DIR, file);
        startSpinner(`Refactoring ${file}`);
        const result = await refactorFile(filePath, instrParts.join(" "), memory.getHistory(4));
        stopSpinner();
        if (fileExists(filePath)) {
          const diff = buildDiff(readFile(filePath), result, file);
          p(`\n${diff.text}`);
        } else p(result.split("\n").slice(0, 25).join("\n"), C.secondary);
        const ok = readlineSync.question("\n  Écraser le fichier? (y/n): ");
        if (ok.toLowerCase() === "y") { writeFile(filePath, result); p(`  ✅ Refactorisé: ${file}`, C.success); }
        break;
      }
      case "generate": {
        if (!args) { p("  Usage: generate <filepath> <description>", C.error); break; }
        const si = args.indexOf(" ");
        if (si === -1) { p("  Il faut un chemin ET une description", C.error); break; }
        const file = args.slice(0, si);
        const desc = args.slice(si + 1);
        startSpinner(`Génération ${file}`);
        const content = await generateFile(desc, file, TARGET_DIR, memory.getHistory(4));
        stopSpinner();
        p(`\n  Aperçu (${file}):`, C.info);
        p(content.split("\n").slice(0, 25).join("\n"), C.secondary);
        const ok = readlineSync.question("\n  Écrire le fichier? (y/n): ");
        if (ok.toLowerCase() === "y") { writeFile(path.join(TARGET_DIR, file), content); p(`  ✅ Créé: ${file}`, C.success); }
        break;
      }
      case "tests": {
        if (!args) { p("  Usage: tests <file>", C.error); break; }
        startSpinner("Génération des tests");
        const result = await generateTests(path.join(TARGET_DIR, args), memory.getHistory(4));
        stopSpinner();
        p(`\n${result}`, C.reset);
        const testFile = args.replace(/\.(ts|js)$/, ".spec.$1");
        const ok = readlineSync.question(`\n  Sauvegarder comme ${testFile}? (y/n): `);
        if (ok.toLowerCase() === "y") { writeFile(path.join(TARGET_DIR, testFile), result); p(`  ✅ ${testFile}`, C.success); }
        break;
      }
      case "explain": {
        if (!args) { p("  Usage: explain <file>", C.error); break; }
        startSpinner("Analyse du code");
        const result = await explainCode(path.join(TARGET_DIR, args), memory.getHistory(4));
        stopSpinner();
        p(`\n${result}`, C.reset);
        break;
      }
      case "security": {
        startSpinner("Audit de sécurité");
        const result = await securityAudit(TARGET_DIR, memory.getHistory(2));
        stopSpinner();
        p(`\n${result}`, C.reset);
        break;
      }
      case "run": {
        if (!args) { p("  Usage: run <commande>", C.error); break; }
        const safe = isSafeCommand(args);
        if (!safe) {
          const ok = readlineSync.question(`  ⚠ Non whitelistée: "${args}". Continuer? (y/n): `);
          if (ok.toLowerCase() !== "y") break;
        }
        const result = await run(args, { cwd: TARGET_DIR, force: !safe });
        p(`\n${result.output}`, result.success ? C.reset : C.error);
        break;
      }
      case "read": {
        if (!args) { p("  Usage: read <file>", C.error); break; }
        p(`\n${readFile(path.join(TARGET_DIR, args))}`, C.reset);
        break;
      }
      case "tree":
        p(`\n${scanTree(TARGET_DIR, 4)}`, C.secondary); break;
      case "memory": {
        p(`\n${memory.getSummary()}`, C.reset);
        p("\n  Actions récentes:", C.primary);
        for (const a of memory.getRecentActions(5)) {
          p(`  ${C.secondary}${a.timestamp.slice(0, 16)} ${C.primary}[${a.type}]${C.reset} ${a.description}`);
        }
        break;
      }
      case "git": {
        startSpinner("Analyse des changements");
        const result = await gitSummary(TARGET_DIR);
        stopSpinner();
        p(`\n  Message de commit:\n  ${C.primary}${result}${C.reset}`, C.reset);
        const ok = readlineSync.question("\n  Committer avec ce message? (y/n): ");
        if (ok.toLowerCase() === "y") {
          const r = await run(`git add -A && git commit -m "${result.replace(/"/g, "'")}"`, { cwd: TARGET_DIR });
          p(r.output, r.success ? C.success : C.error);
        }
        break;
      }
      case "cd": {
        if (!args) { p("  Usage: cd <path>", C.error); break; }
        const np = path.resolve(TARGET_DIR, args);
        if (!fs.existsSync(np)) { p(`  ❌ Introuvable: ${np}`, C.error); break; }
        TARGET_DIR = np;
        p(`  ✅ Projet : ${TARGET_DIR}`, C.success);
        break;
      }
      case "clear":
        printHeader(); printStatus(); break;
      case "exit": case "quit":
        p("\n  Au revoir.\n", C.primary);
        process.exit(0);
      default: {
        startSpinner("Réflexion");
        const result = await smartAnswer(input);
        stopSpinner();
        p(`\n  ${result}`, C.reset);
        memory.addMessage("assistant", result.slice(0, 500));
        await trackCommand("chat", { projectStack: detectStack(TARGET_DIR) });

        // Suggestion de la prochaine action
        await suggestNextAction(input, result);
        break;
      }
    }
  } catch (e) {
    stopSpinner();
    p(`\n  ❌ Erreur: ${e.message}`, C.error);
    if (process.env.DEBUG) console.error(e.stack);
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  printHeader();
  printStatus();

  const hasKey = !!(
    process.env.GEMINI_API_KEY || process.env.CLAUDE_API_KEY ||
    process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY
  );

  if (!hasKey && !PROFILE) {
    p("  ⚠  Première utilisation détectée !", C.error);
    p("");
    p(`  ${C.primary}Tape 'setup' pour configurer l'agent en 2 minutes.${C.reset}`);
    p(`  ${C.secondary}Clés gratuites : Groq (console.groq.com) · Gemini (aistudio.google.com)${C.reset}`);
    p("");
  } else if (!hasKey) {
    p("  ⚠  Aucune clé API. Tape 'config' pour recharger tes clés.", C.error);
    p("");
  }

  p(`  ${C.secondary}'help' pour les commandes. Question directe = chat avec ${USER_NAME}.${C.reset}`);
  div();

  createREPL({
    prompt: `\n  ${C.primary}${USER_NAME} >${C.reset} `,
    onLine: async (input) => {
      await dispatch(input);
    },
  });
}

main().catch(console.error);
