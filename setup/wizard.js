#!/usr/bin/env node
// setup/wizard.js — Assistant de configuration interactif
// Zero-to-One AI by Eldo-Moréo GBOHOUILI

import { select, input, confirm, password, checkbox } from "@inquirer/prompts";
import { createHash } from "crypto";
import { hostname, platform, arch } from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const GLOBAL_CONFIG_DIR = join(process.env.HOME || "~", ".ai-agent");
const GLOBAL_ENV_PATH = join(GLOBAL_CONFIG_DIR, ".env");
const GLOBAL_PROFILE_PATH = join(GLOBAL_CONFIG_DIR, "profile.json");

// ─── Couleurs ─────────────────────────────────────────────────────────────────

const C = {
  gold:  "\x1b[33m",
  gray:  "\x1b[90m",
  green: "\x1b[32m",
  red:   "\x1b[31m",
  cyan:  "\x1b[36m",
  white: "\x1b[97m",
  bold:  "\x1b[1m",
  reset: "\x1b[0m",
  dim:   "\x1b[2m",
};

function p(text, color = C.reset) {
  console.log(`${color}${text}${C.reset}`);
}

function div() {
  p("─".repeat(60), C.gray);
}

// ─── Header ───────────────────────────────────────────────────────────────────

function printHeader() {
  console.clear();
  p("");
  p("  ╔══════════════════════════════════════════════╗", C.gold);
  p("  ║   Zero-to-One AI  —  Setup V10               ║", C.gold);
  p("  ║   by Eldo-Moréo GBOHOUILI                    ║", C.gold);
  p("  ╚══════════════════════════════════════════════╝", C.gold);
  p("");
  p("  Bienvenue ! Ce wizard va configurer ton agent en 2 minutes.", C.gray);
  p("  Tu pourras tout changer plus tard avec la commande 'profile'.", C.gray);
  p("");
}

// ─── Test live d'une clé API ──────────────────────────────────────────────────

async function testApiKey(provider, key) {
  if (!key) return false;
  try {
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      return res.ok;
    }
    if (provider === "groq") {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      return res.ok;
    }
    if (provider === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      return res.ok;
    }
    if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
      });
      return res.ok;
    }
  } catch {
    return false;
  }
  return true;
}

// ─── Wizard principal ─────────────────────────────────────────────────────────

async function runWizard() {
  printHeader();

  // ── Étape 1 : Identité ────────────────────────────────────────────────────
  div();
  p("  ÉTAPE 1/6 — Ton identité", C.bold + C.white);
  div();

  const firstName = await input({
    message: "Comment tu t'appelles ? (prénom ou pseudo)",
    default: "Dev",
    validate: (v) => v.trim().length > 0 || "Donne-moi au moins un prénom !",
  });

  const language = await select({
    message: "Quelle langue pour les réponses de l'agent ?",
    choices: [
      { name: "🇫🇷 Français", value: "fr" },
      { name: "🇬🇧 English", value: "en" },
      { name: "🇪🇸 Español", value: "es" },
      { name: "🇩🇪 Deutsch", value: "de" },
      { name: "🇵🇹 Português", value: "pt" },
    ],
  });

  // ── Étape 2 : Style ───────────────────────────────────────────────────────
  p("");
  div();
  p("  ÉTAPE 2/6 — Style de réponse", C.bold + C.white);
  div();

  const style = await select({
    message: "Comment tu veux que l'agent te réponde ?",
    choices: [
      { name: "⚡ Concis — Réponses courtes, droit au but", value: "concise" },
      { name: "⚖️  Équilibré — Détails pertinents sans noyer", value: "balanced" },
      { name: "🔍 Détaillé — Tout expliquer, rien omettre", value: "detailed" },
      { name: "🤓 Technique — Jargon OK, maximise la précision", value: "technical" },
    ],
  });

  // ── Étape 3 : Thème ───────────────────────────────────────────────────────
  p("");
  div();
  p("  ÉTAPE 3/6 — Thème visuel", C.bold + C.white);
  div();

  const theme = await select({
    message: "Choisis ton thème de couleur :",
    choices: [
      { name: "✨ Gold   — Doré, prestige (défaut)", value: "gold" },
      { name: "🔵 Blue   — Bleu, professionnel",     value: "blue" },
      { name: "🟢 Green  — Vert, naturel",            value: "green" },
      { name: "⬜ Mono   — Blanc pur, minimaliste",   value: "mono" },
    ],
  });

  // ── Étape 4 : Prompt système custom ──────────────────────────────────────
  p("");
  div();
  p("  ÉTAPE 4/6 — Prompt système", C.bold + C.white);
  div();
  p("  Le prompt système définit le comportement général de l'agent.", C.gray);
  p("  Exemple : 'Tu es un expert NestJS, réponds toujours en TypeScript'", C.gray);
  p("");

  const useCustomPrompt = await confirm({
    message: "Veux-tu personnaliser le prompt système ?",
    default: false,
  });

  let systemPrompt = "";
  if (useCustomPrompt) {
    systemPrompt = await input({
      message: "Ton prompt système :",
      default: `Tu es un expert en développement logiciel. Tu réponds en ${language === "fr" ? "français" : "anglais"}.`,
    });
  }

  // ── Étape 5 : Clés API ────────────────────────────────────────────────────
  p("");
  div();
  p("  ÉTAPE 5/6 — Clés API", C.bold + C.white);
  div();
  p("  L'agent supporte plusieurs providers. Chaque clé est optionnelle.", C.gray);
  p("  Providers gratuits : Gemini (20 req/j), Groq (illimité), OpenRouter", C.gray);
  p("");

  const providers = await checkbox({
    message: "Quels providers veux-tu configurer ?",
    choices: [
      { name: "🟣 Gemini     (Google — gratuit, 20 req/jour/clé)", value: "gemini", checked: true },
      { name: "⚡ Groq       (Meta LLaMA — gratuit, très rapide)",  value: "groq",   checked: true },
      { name: "🔀 OpenRouter (50+ modèles, dont gratuits)",         value: "openrouter" },
      { name: "🔶 Claude     (Anthropic — payant, meilleure qualité)", value: "claude" },
    ],
  });

  const keys = {};

  for (const provider of providers) {
    const links = {
      gemini:      "aistudio.google.com/app/apikey",
      groq:        "console.groq.com → API Keys",
      openrouter:  "openrouter.ai → Keys",
      claude:      "console.anthropic.com → API Keys",
    };

    p(`\n  ${C.cyan}${provider.toUpperCase()}${C.reset}  →  ${C.dim}${links[provider]}${C.reset}`);

    const key1 = await password({
      message: `  Clé principale ${provider} :`,
      mask: "●",
    });

    if (key1) {
      process.stdout.write(`  ${C.dim}Test de la clé...${C.reset}`);
      const valid = await testApiKey(provider, key1);
      if (valid) {
        process.stdout.write(`\r  ${C.green}✅ Clé valide !${C.reset}         \n`);
      } else {
        process.stdout.write(`\r  ${C.dim}⚠  Impossible de vérifier (quota ou réseau) — clé sauvegardée quand même.${C.reset}\n`);
      }
      keys[`${provider.toUpperCase()}_API_KEY`] = key1;

      const addMore = await confirm({
        message: `  Ajouter une 2e clé ${provider} ? (multiplie les quotas)`,
        default: false,
      });

      if (addMore) {
        const key2 = await password({ message: `  Clé 2 ${provider} :`, mask: "●" });
        if (key2) keys[`${provider.toUpperCase()}_API_KEY_2`] = key2;
      }
    }
  }

  // ── Étape 6 : Analytics anonymes ─────────────────────────────────────────
  p("");
  div();
  p("  ÉTAPE 6/6 — Améliorer l'agent", C.bold + C.white);
  div();
  p("  Pour améliorer l'agent, je collecte des données anonymes :", C.gray);
  p("  • Commandes utilisées (pas leur contenu)", C.gray);
  p("  • Stack détectée (React, NestJS, Docker...)", C.gray);
  p("  • Provider préféré", C.gray);
  p("");
  p("  🔒 ID anonyme = hash SHA-256 non réversible de ta machine.", C.gray);
  p("  Aucun nom, email, contenu de code, ou donnée personnelle.", C.gray);
  p("");

  const analytics = await confirm({
    message: "Activer l'envoi anonyme pour améliorer l'agent ?",
    default: true,
  });

  // ─── Sauvegarde ───────────────────────────────────────────────────────────

  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }

  // Profil
  const profile = {
    name: firstName.trim(),
    language,
    style,
    theme,
    systemPrompt,
    preferredProvider: providers[0] || "auto",
    analytics,
    analyticsId: analytics
      ? createHash("sha256")
          .update(`${hostname()}:${platform()}:${arch()}`)
          .digest("hex")
          .slice(0, 16)
      : null,
    createdAt: new Date().toISOString(),
    version: "10.0.0",
  };

  fs.writeFileSync(GLOBAL_PROFILE_PATH, JSON.stringify(profile, null, 2));

  // .env
  let envContent = `# Zero-to-One AI — Configuration\n# Généré le ${new Date().toLocaleDateString("fr-FR")}\n\n`;
  for (const [k, v] of Object.entries(keys)) {
    envContent += `${k}=${v}\n`;
  }
  if (analytics && process.env.SUPABASE_URL) {
    envContent += `\nSUPABASE_URL=${process.env.SUPABASE_URL}\n`;
    envContent += `SUPABASE_ANON_KEY=${process.env.SUPABASE_ANON_KEY}\n`;
  }
  fs.writeFileSync(GLOBAL_ENV_PATH, envContent);

  // ─── Résumé final ─────────────────────────────────────────────────────────

  console.clear();
  p("");
  p("  ╔══════════════════════════════════════════════╗", C.gold);
  p("  ║   Zero-to-One AI  —  Configuration terminée  ║", C.gold);
  p("  ╚══════════════════════════════════════════════╝", C.gold);
  p("");
  p(`  Bonjour ${C.gold}${firstName}${C.reset} ! Voici ta configuration :`, C.white);
  p("");
  p(`  Langue       ${C.cyan}${language}${C.reset}`, C.gray);
  p(`  Style        ${C.cyan}${style}${C.reset}`, C.gray);
  p(`  Thème        ${C.cyan}${theme}${C.reset}`, C.gray);
  p(`  Providers    ${C.cyan}${providers.join(", ")}${C.reset}`, C.gray);
  p(`  Analytics    ${analytics ? C.green + "✅ activé (anonyme)" : C.gray + "désactivé"}${C.reset}`, C.gray);
  p(`  Config       ${C.cyan}${GLOBAL_CONFIG_DIR}${C.reset}`, C.gray);
  p("");
  div();
  p(`  ${C.green}✅ Tout est prêt !${C.reset}`, C.white);
  p("");
  p(`  Pour lancer l'agent :  ${C.gold}ai${C.reset}`, C.gray);
  p(`  Pour modifier :        ${C.gold}ai${C.reset}  puis  ${C.gold}profile${C.reset}`);
  p(`  Pour pointer un projet : ${C.gold}ai /chemin/du/projet${C.reset}`, C.gray);
  p("");
}

runWizard().catch((e) => {
  if (e.name === "ExitPromptError") {
    console.log("\n\n  Setup annulé. Lance 'ai-setup' pour recommencer.\n");
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});
