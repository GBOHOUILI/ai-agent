// roadmap/index.js — Roadmap engine V9
// Supporte le format enrichi : Phase, Version, Domaine, ID_Tache, Titre,
// Description, Prompt_IA, Dependances, Statut, Priorite,
// Post_Marketing, LinkedIn, Twitter_X, Facebook

import fs   from "fs";
import path from "path";
import { ask }                  from "../llm/index.js";
import { buildProjectContext }  from "../scanner/index.js";
import { readFile, writeFile }  from "../tools/index.js";

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROADMAP_PATTERNS   = [/roadmap/i, /taches/i, /tasks/i, /plan/i, /todo/i, /sprint/i];
const ROADMAP_EXTENSIONS = [".csv", ".md", ".json", ".txt"];

export const STATUTS = {
  TODO:        "À faire",
  IN_PROGRESS: "En cours",
  DONE:        "Terminé",
};

// ─── Détection ────────────────────────────────────────────────────────────────

export function findRoadmapFile(dir = ".") {
  const found = [];

  const scanDir = (d) => {
    try {
      const items = fs.readdirSync(d, { withFileTypes: true });
      for (const item of items) {
        if (["node_modules", ".git", "dist", "build"].includes(item.name)) continue;
        if (!item.isDirectory()) {
          const ext  = path.extname(item.name).toLowerCase();
          const base = item.name.toLowerCase();
          if (ROADMAP_EXTENSIONS.includes(ext) && ROADMAP_PATTERNS.some((p) => p.test(base))) {
            found.push(path.join(d, item.name));
          }
        }
      }
      for (const item of items) {
        if (item.isDirectory() && !["node_modules", ".git", "dist", "build"].includes(item.name)) {
          try {
            const sub = fs.readdirSync(path.join(d, item.name), { withFileTypes: true });
            for (const s of sub) {
              if (s.isDirectory()) continue;
              const ext  = path.extname(s.name).toLowerCase();
              const base = s.name.toLowerCase();
              if (ROADMAP_EXTENSIONS.includes(ext) && ROADMAP_PATTERNS.some((p) => p.test(base))) {
                found.push(path.join(d, item.name, s.name));
              }
            }
          } catch {}
        }
      }
    } catch {}
  };

  scanDir(dir);
  return found;
}

// ─── Parser CSV robuste ───────────────────────────────────────────────────────

function splitCSVLine(line, sep = ",") {
  const result = [];
  let current  = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // Double guillemet à l'intérieur d'une valeur entre guillemets
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === sep && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function detectSep(firstLine) {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas     = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function clean(str = "") {
  return String(str).trim().replace(/^"|"$/g, "").replace(/\r/g, "");
}

// ─── Parse roadmap ────────────────────────────────────────────────────────────

export function parseRoadmap(filePath) {
  const raw = readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".md")   return parseMarkdown(raw, filePath);
  if (ext === ".json") return parseJSON(raw, filePath);
  return parseCSV(raw, filePath);
}

function parseCSV(raw, filePath) {
  const content = raw.replace(/^\uFEFF/, ""); // Retirer BOM UTF-8
  const lines   = content.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { raw, tasks: [], filePath, format: "csv", isEnriched: false };

  const sep     = detectSep(lines[0]);
  const headers = splitCSVLine(lines[0], sep).map((h) => clean(h).toLowerCase());

  // Format enrichi : ≥10 colonnes avec colonnes spécifiques
  const isEnriched = headers.length >= 9 && (
    headers.some((h) => h.includes("domaine")) ||
    headers.some((h) => h.includes("prompt")) ||
    headers.some((h) => h.includes("linkedin")) ||
    headers.some((h) => h.includes("id_tache"))
  );

  // Map dynamique des colonnes
  const idx = {
    phase:       headers.findIndex((h) => h === "phase" || h.includes("phase")),
    version:     headers.findIndex((h) => h === "version" || h.includes("version")),
    domaine:     headers.findIndex((h) => h.includes("domaine")),
    id:          headers.findIndex((h) => h === "id_tache" || (h.includes("id") && !h.includes("prompt") && !h.includes("linkedin"))),
    titre:       headers.findIndex((h) => h === "titre" || h.includes("title") || h.includes("nom") || h.includes("titre")),
    description: headers.findIndex((h) => h === "description" || h.includes("desc")),
    promptIA:    headers.findIndex((h) => h.includes("prompt")),
    deps:        headers.findIndex((h) => h.includes("depend")),
    statut:      headers.findIndex((h) => h === "statut" || h.includes("statut") || h.includes("status") || h.includes("état")),
    priorite:    headers.findIndex((h) => h === "priorite" || h.includes("priorit")),
    marketing:   headers.findIndex((h) => h.includes("marketing") || (h.includes("post") && !h.includes("desc"))),
    linkedin:    headers.findIndex((h) => h.includes("linkedin")),
    twitter:     headers.findIndex((h) => h.includes("twitter") || h.includes("_x")),
    facebook:    headers.findIndex((h) => h.includes("facebook")),
  };

  // Fallback titre si aucun header "titre" trouvé → prendre index 1
  if (idx.titre < 0) idx.titre = 1;
  if (idx.id < 0)    idx.id    = 0;

  const tasks = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], sep);
    if (cols.length < 2) continue;

    const get = (key) => idx[key] >= 0 && cols[idx[key]] !== undefined ? clean(cols[idx[key]]) : "";

    const rawStatut = get("statut");
    const statut    = normalizeStatut(rawStatut);

    const task = {
      lineIndex:     i,
      rawLine:       lines[i],
      id:            get("id") || `T${i}`,
      titre:         get("titre"),
      statut,
      rawStatut,
      phase:         get("phase"),
      priorite:      get("priorite"),
      statusColIdx:  idx.statut,
      sep,
      headers,
      isEnriched,
    };

    if (isEnriched) {
      task.version     = get("version");
      task.domaine     = get("domaine");
      task.description = get("description");
      task.promptIA    = get("promptIA");
      task.marketing   = get("marketing");
      task.linkedin    = get("linkedin");
      task.twitter     = get("twitter");
      task.facebook    = get("facebook");
      const depsRaw    = get("deps");
      task.deps        = depsRaw ? depsRaw.split(",").map((d) => d.trim()).filter(Boolean) : [];
    } else {
      task.deps        = [];
      task.description = "";
      task.promptIA    = "";
    }

    tasks.push(task);
  }

  return { raw, tasks, filePath, format: "csv", isEnriched, sep, headers, idx };
}

function normalizeStatut(s) {
  if (!s) return STATUTS.TODO;
  const lower = s.toLowerCase();
  if (lower.includes("termin") || lower.includes("done") || lower.includes("complet")) return STATUTS.DONE;
  if (lower.includes("cours") || lower.includes("progress") || lower.includes("wip"))  return STATUTS.IN_PROGRESS;
  return STATUTS.TODO;
}

function parseMarkdown(raw, filePath) {
  const tasks = [];
  raw.split("\n").forEach((line, i) => {
    const m = line.match(/^[\s]*-\s+\[([x\s])\]\s+(.+)/i);
    if (m) {
      tasks.push({
        lineIndex: i, rawLine: line,
        id:        `L${i}`,
        titre:     m[2].trim(),
        statut:    m[1].toLowerCase() === "x" ? STATUTS.DONE : STATUTS.TODO,
        phase:     "", priorite: "", deps: [],
        description: "", promptIA: "",
      });
    }
  });
  return { raw, tasks, filePath, format: "markdown", isEnriched: false };
}

function parseJSON(raw, filePath) {
  try {
    const data  = JSON.parse(raw);
    const arr   = Array.isArray(data) ? data : data.tasks || data.items || [];
    const tasks = arr.map((t, i) => ({
      lineIndex:   i, rawLine: JSON.stringify(t),
      id:          t.ID_Tache || t.id || t.ID || `T${i}`,
      titre:       t.Titre    || t.titre || t.title || t.name || "",
      statut:      normalizeStatut(t.Statut || t.statut || t.status || ""),
      phase:       t.Phase    || t.phase  || "",
      version:     t.Version  || t.version || "",
      domaine:     t.Domaine  || t.domaine || "",
      priorite:    t.Priorite || t.priorite || t.priority || "",
      description: t.Description || t.description || "",
      promptIA:    t.Prompt_IA   || t.promptIA || "",
      deps:        (t.Dependances || t.deps || "").split(",").map((d) => d.trim()).filter(Boolean),
      marketing:   t.Post_Marketing || t.marketing || "",
      linkedin:    t.LinkedIn  || t.linkedin  || "",
      twitter:     t.Twitter_X || t.twitter   || "",
      facebook:    t.Facebook  || t.facebook  || "",
    }));
    return { raw, tasks, filePath, format: "json", isEnriched: true };
  } catch {
    return { raw, tasks: [], filePath, format: "json", isEnriched: false };
  }
}

// ─── Analyse roadmap vs code ──────────────────────────────────────────────────

const ANALYST_SYSTEM = `You are an expert software engineer analyzing a project roadmap against actual code.

For each task, determine:
- real_status: DONE | IN_PROGRESS | TODO
- evidence: what code you found (file, function, endpoint) or didn't find
- should_update: true if roadmap status is wrong

Output ONLY valid JSON (no markdown):
{
  "summary": "brief overall status in French",
  "completion_pct": 0-100,
  "tasks": [
    {
      "id": "task id",
      "titre": "task title",
      "current_status": "current status",
      "real_status": "DONE|IN_PROGRESS|TODO",
      "evidence": "what was found",
      "should_update": true/false
    }
  ],
  "next_priority": "what to work on next in French"
}`;

export async function analyzeRoadmapVsCode(roadmap, projectContext) {
  const taskSummary = roadmap.tasks.slice(0, 60).map((t) => {
    const parts = [`[${t.id}]`];
    if (t.phase)   parts.push(`[${t.phase}]`);
    if (t.domaine) parts.push(`[${t.domaine}]`);
    parts.push(t.titre);
    parts.push(`(statut: ${t.statut}, priorité: ${t.priorite || "?"})`);
    if (t.description) parts.push(`| ${t.description.slice(0, 80)}`);
    return parts.join(" ");
  }).join("\n");

  const messages = [{
    role:    "user",
    content: `TÂCHES DU ROADMAP:\n${taskSummary}\n\nCODE DU PROJET:\n${projectContext.slice(0, 4000)}\n\nAnalyse chaque tâche par rapport au code réel. JSON uniquement.`,
  }];

  const response = await ask(messages, ANALYST_SYSTEM, { useCache: false });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// ─── Mise à jour des statuts ──────────────────────────────────────────────────

export function updateRoadmapStatuses(roadmap, analysis) {
  if (!analysis?.tasks) return { updated: 0, content: roadmap.raw };

  let content = roadmap.raw;
  let updated = 0;

  const statusMap = { DONE: STATUTS.DONE, IN_PROGRESS: STATUTS.IN_PROGRESS, TODO: STATUTS.TODO };

  for (const analyzed of analysis.tasks) {
    if (!analyzed.should_update) continue;
    const newStatus = statusMap[analyzed.real_status];
    if (!newStatus) continue;

    const task = roadmap.tasks.find((t) => t.id === analyzed.id);
    if (!task || task.statut === newStatus) continue;

    if (roadmap.format === "csv" && task.statusColIdx >= 0) {
      const cols = splitCSVLine(task.rawLine, task.sep);
      cols[task.statusColIdx] = newStatus;
      const newLine = cols.map((c) => {
        const v = c.trim();
        // Remettre les guillemets si la valeur contient séparateur ou newline
        if (v.includes(task.sep) || v.includes("\n") || v.includes('"')) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      }).join(task.sep);
      content = content.replace(task.rawLine, newLine);
      updated++;
    } else if (roadmap.format === "markdown") {
      const newCheck = analyzed.real_status === "DONE" ? "[x]" : "[ ]";
      content = content.replace(task.rawLine, task.rawLine.replace(/\[.\]/, newCheck));
      updated++;
    }
  }

  return { updated, content };
}

// ─── Analyse des dépendances ──────────────────────────────────────────────────

export function analyzeDependencies(tasks) {
  const byId    = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const blocked = [];
  const conflicts = [];

  for (const task of tasks) {
    if (!task.deps?.length) continue;

    // Tâche non-terminée avec dépendances non-terminées = bloquée
    if (task.statut !== STATUTS.DONE) {
      const blockingDeps = task.deps
        .map((id) => byId[id])
        .filter((dep) => dep && dep.statut !== STATUTS.DONE);

      if (blockingDeps.length > 0) {
        blocked.push({ task, blockedBy: blockingDeps });
      }
    }

    // Tâche marquée "Terminé" mais dépendance pas encore faite = incohérence
    if (task.statut === STATUTS.DONE) {
      const unfinishedDeps = task.deps
        .map((id) => byId[id])
        .filter((dep) => dep && dep.statut !== STATUTS.DONE);

      if (unfinishedDeps.length > 0) {
        conflicts.push({ task, missingDeps: unfinishedDeps });
      }
    }
  }

  return { blocked, conflicts };
}

// ─── Prochaines tâches disponibles ───────────────────────────────────────────

export function getNextTasks(tasks, limit = 5) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));

  // Tâches non terminées dont toutes les dépendances sont terminées
  const available = tasks.filter((task) => {
    if (task.statut === STATUTS.DONE) return false;
    return (task.deps || []).every((depId) => {
      const dep = byId[depId];
      return !dep || dep.statut === STATUTS.DONE;
    });
  });

  // Tri : CRITIQUE > HAUTE > MOYENNE > BASSE, En cours avant À faire
  const pOrder = { CRITIQUE: 0, HAUTE: 1, MOYENNE: 2, BASSE: 3, "": 4 };
  const sOrder = { [STATUTS.IN_PROGRESS]: 0, [STATUTS.TODO]: 1 };

  return available.sort((a, b) => {
    const po = (pOrder[a.priorite?.toUpperCase()] ?? 4) - (pOrder[b.priorite?.toUpperCase()] ?? 4);
    if (po !== 0) return po;
    return (sOrder[a.statut] ?? 2) - (sOrder[b.statut] ?? 2);
  }).slice(0, limit);
}

// ─── Posts marketing ──────────────────────────────────────────────────────────

export function extractMarketingPosts(tasks, plateforme = "all") {
  const posts = [];

  for (const task of tasks) {
    const hasContent = task.marketing || task.linkedin || task.twitter || task.facebook;
    if (!hasContent) continue;

    const post = {
      id:      task.id,
      titre:   task.titre,
      phase:   task.phase,
      statut:  task.statut,
      trigger: task.marketing || "",
    };

    if (plateforme === "all" || plateforme === "linkedin") {
      if (task.linkedin) post.linkedin = task.linkedin;
    }
    if (plateforme === "all" || plateforme === "twitter") {
      if (task.twitter) post.twitter = task.twitter;
    }
    if (plateforme === "all" || plateforme === "facebook") {
      if (task.facebook) post.facebook = task.facebook;
    }

    if (post.linkedin || post.twitter || post.facebook) posts.push(post);
  }

  return posts;
}

// ─── Génération auto d'un roadmap enrichi ────────────────────────────────────

const GENERATOR_SYSTEM = `You are a senior software architect and product manager.
Analyze the codebase and generate a comprehensive enriched roadmap CSV in French.

CRITICAL: Use EXACTLY this separator and header order:
"Phase";"Version";"Domaine";"ID_Tache";"Titre";"Description";"Prompt_IA";"Dependances";"Statut";"Priorite";"Post_Marketing";"LinkedIn";"Twitter_X";"Facebook"

Rules:
- Phase: "PHASE 0 — SETUP" / "V0.1 — AUTH" / "V0.2 — FEATURES" etc.
- Version: "SETUP" / "0.1" / "0.2" etc.
- Domaine: BACKEND | FRONTEND | INFRA | ADMIN | MARKETING
- ID_Tache: prefix by domain letter (S=setup, B=backend, F=frontend, A=admin, M=marketing) + 3 digits
- Statut: "Terminé" if code already exists | "En cours" | "À faire"
- Priorite: CRITIQUE | HAUTE | MOYENNE | BASSE
- Dependances: comma-separated IDs of blocking tasks (empty if none)
- Post_Marketing: trigger description (empty for most tasks, only for milestones)
- LinkedIn/Twitter_X/Facebook: post content ONLY for milestone tasks

PROMPT_IA — CRITICAL RULES:
The Prompt_IA must be a ready-to-use command for the Zero-to-One AI agent CLI.
The user should be able to copy-paste it directly into the agent prompt.
Use one of these formats:
  build <feature description in French>
  generate <filepath> <file description in French>
  debug <problem description in French>
  refactor <filepath> <instruction in French>
  tests <filepath>
  security
  analyze
  Or a direct natural language question to ask the agent

Good examples:
  build module authentification JWT avec refresh token et blacklist Redis
  generate src/auth/guards/jwt.guard.ts Guard NestJS vérifiant le token JWT dans le header Authorization
  debug le middleware auth ne rejette pas les tokens expirés
  tests src/auth/auth.service.ts
  refactor src/users/users.service.ts extraire la logique de validation dans un helper séparé
  Quelles sont les failles de sécurité dans mon système d authentification actuel ?

Mark as "Terminé" anything that clearly exists in the code.
Generate 20-50 tasks. Be specific and technical.
Output ONLY the CSV, no markdown fences, no explanations.`;

export async function generateRoadmapFromCode(dir = ".") {
  const context = buildProjectContext(dir, { maxFiles: 25, maxCharsPerFile: 1500 });
  const messages = [{
    role:    "user",
    content: `Analyze this codebase and generate an enriched roadmap CSV.\n\n${context}`,
  }];
  return await ask(messages, GENERATOR_SYSTEM, { useCache: false });
}

// ─── Main roadmap check ───────────────────────────────────────────────────────

export async function runRoadmapCheck(dir = ".", options = {}) {
  const { autoUpdate = false } = options;

  const files = findRoadmapFile(dir);
  if (files.length === 0) return { found: false };

  const filePath = files[0];
  const fileName = path.basename(filePath);
  const roadmap  = parseRoadmap(filePath);

  if (roadmap.tasks.length === 0) {
    return { found: true, filePath, fileName, totalTasks: 0, isEnriched: roadmap.isEnriched, message: "Roadmap trouvé mais aucune tâche parsée." };
  }

  const projectContext = buildProjectContext(dir, { maxFiles: 20, maxCharsPerFile: 1000 });
  const analysis       = await analyzeRoadmapVsCode(roadmap, projectContext);

  if (!analysis) return {
    found: true, filePath, fileName,
    totalTasks: roadmap.tasks.length,
    isEnriched: roadmap.isEnriched,
    message: "Analyse IA échouée — quota épuisé ou erreur JSON. Tapez 'roadmap next' pour voir les tâches.",
    roadmap,
    allFiles: files,
  };

  let updateResult = null;
  if (autoUpdate) {
    updateResult = updateRoadmapStatuses(roadmap, analysis);
    if (updateResult.updated > 0) writeFile(filePath, updateResult.content);
  }

  return {
    found:       true,
    filePath,
    fileName,
    totalTasks:  roadmap.tasks.length,
    isEnriched:  roadmap.isEnriched,
    analysis,
    updateResult,
    allFiles:    files,
    roadmap,
  };
}