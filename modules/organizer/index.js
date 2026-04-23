// modules/organizer/index.js — Organisateur de fichiers intelligent
// Analyse ce qui existe, suggère une réorganisation, ne touche JAMAIS
// aux node_modules, .git, ou fichiers de projets actifs

import fs from "fs";
import path from "path";

// ─── Dossiers et fichiers à ne jamais toucher ─────────────────────────────────

const PROTECTED_DIRS = new Set([
  "node_modules", ".git", ".svn", "dist", "build", ".next", ".nuxt",
  "venv", ".venv", "__pycache__", ".cache", "vendor", "target",
]);

const PROJECT_SIGNALS = [
  "package.json", "pyproject.toml", "Cargo.toml", "go.mod",
  "Makefile", "CMakeLists.txt", "pom.xml", "build.gradle",
  ".git", "docker-compose.yml",
];

const SYSTEM_FILES = new Set([
  ".DS_Store", "Thumbs.db", ".env", ".env.local", ".gitignore",
  ".gitkeep", "LICENSE", "README.md",
]);

// ─── Règles de catégorisation ─────────────────────────────────────────────────

const CATEGORY_RULES = [
  {
    name: "Projects",
    emoji: "📁",
    desc: "Dossiers contenant un projet actif (package.json, .git, etc.)",
    test: (entry, fullPath) => {
      if (!entry.isDirectory()) return false;
      if (PROTECTED_DIRS.has(entry.name)) return false;
      return PROJECT_SIGNALS.some((s) =>
        fs.existsSync(path.join(fullPath, s))
      );
    },
  },
  {
    name: "Scripts",
    emoji: "⚙️",
    desc: "Fichiers de scripts autonomes (.sh, .py, .js, .ts non dans un projet)",
    test: (entry) =>
      !entry.isDirectory() &&
      /\.(sh|bash|zsh|py|js|ts|mjs)$/.test(entry.name) &&
      !entry.name.startsWith("."),
  },
  {
    name: "Documents",
    emoji: "📄",
    desc: "Fichiers texte, PDF, markdown, notes",
    test: (entry) =>
      !entry.isDirectory() &&
      /\.(md|txt|pdf|doc|docx|odt|pages|rst)$/.test(entry.name),
  },
  {
    name: "Archives",
    emoji: "📦",
    desc: "Archives et backups",
    test: (entry) =>
      !entry.isDirectory() &&
      /\.(zip|tar|gz|bz2|7z|rar|tgz|tar\.gz)$/.test(entry.name),
  },
  {
    name: "Config",
    emoji: "🔧",
    desc: "Fichiers de configuration standalone",
    test: (entry) =>
      !entry.isDirectory() &&
      /\.(json|yaml|yml|toml|ini|cfg|conf)$/.test(entry.name) &&
      !SYSTEM_FILES.has(entry.name),
  },
  {
    name: "Media",
    emoji: "🖼️",
    desc: "Images, vidéos, audio",
    test: (entry) =>
      !entry.isDirectory() &&
      /\.(jpg|jpeg|png|gif|svg|webp|mp4|mov|avi|mp3|wav|flac)$/.test(entry.name),
  },
  {
    name: "Misc",
    emoji: "🗂️",
    desc: "Autres fichiers non classifiés",
    test: () => true,
  },
];

// ─── Analyse un répertoire ────────────────────────────────────────────────────

function analyzeDirectory(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const result = {
    path: dir,
    items: [],
    suggestions: [],
    stats: { total: 0, protected: 0, classifiable: 0 },
  };

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    if (SYSTEM_FILES.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    result.stats.total++;

    if (PROTECTED_DIRS.has(entry.name)) {
      result.stats.protected++;
      result.items.push({
        name: entry.name,
        type: "protected",
        category: null,
        isDir: entry.isDirectory(),
        reason: "Dossier système protégé — jamais déplacé",
      });
      continue;
    }

    // Vérifie si c'est un projet actif (dossier avec signaux projet)
    if (entry.isDirectory()) {
      const isProject = PROJECT_SIGNALS.some((s) =>
        fs.existsSync(path.join(fullPath, s))
      );
      if (isProject) {
        result.stats.protected++;
        result.items.push({
          name: entry.name,
          type: "project",
          category: "Projects",
          isDir: true,
          reason: "Projet actif détecté — ne sera pas déplacé, juste classifié",
        });
        continue;
      }
    }

    // Classifie selon les règles
    let matchedCategory = null;
    for (const rule of CATEGORY_RULES) {
      if (rule.test(entry, fullPath)) {
        matchedCategory = rule;
        break;
      }
    }

    result.stats.classifiable++;
    result.items.push({
      name: entry.name,
      type: "classifiable",
      category: matchedCategory?.name || "Misc",
      emoji: matchedCategory?.emoji || "🗂️",
      isDir: entry.isDirectory(),
      currentPath: fullPath,
      suggestedPath: path.join(dir, matchedCategory?.name || "Misc", entry.name),
    });
  }

  // Génère les suggestions de réorganisation
  const byCategory = {};
  for (const item of result.items.filter((i) => i.type === "classifiable")) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }

  for (const [cat, items] of Object.entries(byCategory)) {
    const rule = CATEGORY_RULES.find((r) => r.name === cat);
    const alreadyInFolder = items.every(
      (i) => path.dirname(i.currentPath) === path.join(dir, cat)
    );

    if (!alreadyInFolder && items.length > 0) {
      result.suggestions.push({
        category: cat,
        emoji: rule?.emoji || "🗂️",
        desc: rule?.desc || "",
        items,
        targetDir: path.join(dir, cat),
        action: `Déplacer ${items.length} élément(s) → ${cat}/`,
      });
    }
  }

  return result;
}

// ─── Affiche le plan sans rien faire ─────────────────────────────────────────

export function previewOrganize(dir, C) {
  const analysis = analyzeDirectory(dir);
  if (!analysis) {
    console.log(`${C.error}  ❌ Impossible de lire : ${dir}${C.reset}`);
    return null;
  }

  console.log(`\n  📊 Analyse de ${C.primary}${dir}${C.reset}`);
  console.log(`  ${C.dim}${analysis.stats.total} éléments trouvés · ${analysis.stats.protected} protégés · ${analysis.stats.classifiable} classifiables${C.reset}\n`);

  if (analysis.suggestions.length === 0) {
    console.log(`  ${C.success}✅ Rien à réorganiser — tout est déjà bien rangé.${C.reset}`);
    return analysis;
  }

  console.log(`  ${C.primary}Plan de réorganisation suggéré :${C.reset}\n`);
  for (const sug of analysis.suggestions) {
    console.log(`  ${sug.emoji}  ${C.bold}${sug.category}/${C.reset}  ${C.dim}${sug.desc}${C.reset}`);
    for (const item of sug.items.slice(0, 5)) {
      const icon = item.isDir ? "📁" : "📄";
      console.log(`     ${icon} ${C.dim}${item.name}${C.reset}`);
    }
    if (sug.items.length > 5) {
      console.log(`     ${C.dim}... et ${sug.items.length - 5} autre(s)${C.reset}`);
    }
    console.log();
  }

  return analysis;
}

// ─── Exécute la réorganisation ────────────────────────────────────────────────

export function executeOrganize(analysis, C) {
  if (!analysis || analysis.suggestions.length === 0) return;

  const log = [];

  for (const sug of analysis.suggestions) {
    // Crée le dossier cible si inexistant
    if (!fs.existsSync(sug.targetDir)) {
      fs.mkdirSync(sug.targetDir, { recursive: true });
      console.log(`  ${C.success}✅ Créé : ${sug.category}/${C.reset}`);
    }

    for (const item of sug.items) {
      try {
        fs.renameSync(item.currentPath, item.suggestedPath);
        log.push({ from: item.currentPath, to: item.suggestedPath, ok: true });
        console.log(`  ${C.success}→${C.reset} ${item.name}  ${C.dim}→ ${sug.category}/${C.reset}`);
      } catch (e) {
        log.push({ from: item.currentPath, to: item.suggestedPath, ok: false, err: e.message });
        console.log(`  ${C.error}✗ ${item.name} : ${e.message}${C.reset}`);
      }
    }
  }

  // Sauvegarde un log
  const logPath = path.join(analysis.path, ".ai-organize-log.json");
  fs.writeFileSync(logPath, JSON.stringify({ date: new Date().toISOString(), actions: log }, null, 2));
  console.log(`\n  ${C.dim}Log sauvegardé : .ai-organize-log.json${C.reset}`);

  return log;
}
