// modules/scanner/index.js — Deep project scanner

import fs from "fs";
import path from "path";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", ".nuxt",
  "coverage", ".cache", "__pycache__", ".venv", "venv", ".idea", ".vscode",
]);

const IGNORE_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  ".DS_Store", "Thumbs.db", ".env", ".env.local", ".env.production",
]);

const TEXT_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
  ".json", ".yaml", ".yml", ".toml", ".env.example",
  ".md", ".txt", ".html", ".css", ".scss", ".sass",
  ".prisma", ".graphql", ".sql",
  ".sh", ".bash", ".zsh",
  ".py", ".go", ".rs", ".java", ".php", ".rb",
]);

// ─── Tree scan ────────────────────────────────────────────────────────────────

export function scanTree(dir = ".", depth = 3, level = 0) {
  if (level > depth) return "";

  let output = "";
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return ""; }

  for (const item of items) {
    if (IGNORE_DIRS.has(item.name) || IGNORE_FILES.has(item.name)) continue;
    if (item.name.startsWith(".") && level > 0) continue;

    const indent = "  ".repeat(level);
    output += `${indent}${item.isDirectory() ? "📁" : "📄"} ${item.name}\n`;

    if (item.isDirectory()) {
      output += scanTree(path.join(dir, item.name), depth, level + 1);
    }
  }

  return output;
}

// ─── File reader ──────────────────────────────────────────────────────────────

export function readFileContent(filePath, maxChars = 3000) {
  try {
    const ext = path.extname(filePath);
    if (!TEXT_EXTENSIONS.has(ext) && ext !== "") return "[fichier binaire]";
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.length > maxChars) {
      return content.slice(0, maxChars) + `\n... [tronqué, ${content.length} chars au total]`;
    }
    return content;
  } catch (e) {
    return `[erreur lecture: ${e.message}]`;
  }
}

// ─── Project context builder ──────────────────────────────────────────────────

export function buildProjectContext(dir = ".", options = {}) {
  const { maxFiles = 20, maxCharsPerFile = 2000, priorityFiles = [] } = options;

  const tree  = scanTree(dir, 3);
  const files = collectFiles(dir, 3);

  const priority = [
    "package.json", "README.md", "docker-compose.yml", "Dockerfile",
    "schema.prisma", "next.config.js", "nest-cli.json",
    "tsconfig.json", ".env.example", "main.ts", "app.module.ts",
    ...priorityFiles,
  ];

  const sorted = [...files].sort((a, b) => {
    const pA = priority.indexOf(path.basename(a));
    const pB = priority.indexOf(path.basename(b));
    if (pA === -1 && pB === -1) return 0;
    if (pA === -1) return 1;
    if (pB === -1) return -1;
    return pA - pB;
  });

  const topFiles = sorted.slice(0, maxFiles);

  let context = `=== STRUCTURE DU PROJET ===\n${tree}\n\n`;
  context += `=== FICHIERS CLÉS ===\n`;

  for (const file of topFiles) {
    const relative = path.relative(dir, file);
    const content  = readFileContent(file, maxCharsPerFile);
    context += `\n--- ${relative} ---\n${content}\n`;
  }

  return context;
}

function collectFiles(dir, maxDepth, depth = 0, results = []) {
  if (depth > maxDepth) return results;

  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }

  for (const item of items) {
    if (IGNORE_DIRS.has(item.name) || IGNORE_FILES.has(item.name)) continue;
    if (item.name.startsWith(".")) continue;

    const full = path.join(dir, item.name);

    if (item.isDirectory()) {
      collectFiles(full, maxDepth, depth + 1, results);
    } else if (TEXT_EXTENSIONS.has(path.extname(item.name))) {
      results.push(full);
    }
  }

  return results;
}

// ─── Detect project type ──────────────────────────────────────────────────────

export function detectProjectType(dir = ".") {
  const files = fs.readdirSync(dir).map((f) => f.toLowerCase());
  const types = [];

  if (files.includes("package.json")) {
    try {
      const pkg  = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps["next"])           types.push("Next.js");
      if (deps["@nestjs/core"])   types.push("NestJS");
      if (deps["react"])          types.push("React");
      if (deps["vue"])            types.push("Vue");
      if (deps["express"])        types.push("Express");
      if (deps["@prisma/client"]) types.push("Prisma");
      if (deps["stripe"])         types.push("Stripe");
      if (deps["socket.io"])      types.push("Socket.io");
    } catch {}
  }

  if (files.includes("docker-compose.yml") || files.includes("dockerfile")) types.push("Docker");
  if (files.includes("requirements.txt"))  types.push("Python");
  if (files.includes("go.mod"))            types.push("Go");

  return types.length > 0 ? types : ["Unknown"];
}