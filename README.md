<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=28&duration=3000&pause=1000&color=FFB700&center=true&vCenter=true&width=600&lines=Zero-to-One+AI;CLI+Agent+for+Developers;Build+faster.+Ship+smarter." alt="Zero-to-One AI" />

<br/>

[![npm version](https://img.shields.io/npm/v/zero-to-one-ai?color=FFB700&label=npm&style=flat-square)](https://www.npmjs.com/package/zero-to-one-ai)
[![npm downloads](https://img.shields.io/npm/dm/zero-to-one-ai?color=FFB700&style=flat-square)](https://www.npmjs.com/package/zero-to-one-ai)
[![GitHub Stars](https://img.shields.io/github/stars/GBOHOUILI/ai-agent?color=FFB700&style=flat-square&logo=github)](https://github.com/GBOHOUILI/ai-agent/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-FFB700.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-FFB700?style=flat-square)](https://nodejs.org)

</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     🇬🇧  ENGLISH VERSION
═══════════════════════════════════════════════════════════════ -->

<details open>
<summary><b>🇬🇧 English</b></summary>

<br/>

**The open-source CLI agent that turns your terminal into an AI-powered dev environment.**  
Multi-provider · Roadmap tracker · File organizer · Fully customizable.

## Why Zero-to-One AI?

Most AI coding tools are either locked inside an IDE, require a subscription, or only work with one provider.

**Zero-to-One AI is different:**

- 🆓 **100% free** — works with free-tier API keys (Gemini, Groq, OpenRouter, Mistral...)
- 🔌 **7 providers** — automatic rotation when quota hits, local mode with Ollama (zero internet)
- 🧠 **Knows your project** — reads your codebase, tracks your roadmap, remembers your history
- ⚙️ **Fully yours** — your name, your language, your style, your system prompt
- 📋 **Roadmap-aware** — compares your plan vs your actual code and tells you what's drifting

> Built in public by [Eldo-Moréo GBOHOUILI](https://github.com/GBOHOUILI) · Zero to One · No VC. No budget. Just code.

## Install

```bash
npm install -g zero-to-one-ai
ai
```

First time? Type `setup` — the wizard configures everything in 2 minutes.

## Demo

```
╔══════════════════════════════════════════════╗
║   Zero-to-One AI  —  V1                      ║
║   by Eldo-Moréo GBOHOUILI                    ║
╚══════════════════════════════════════════════╝

  Hello Eldo 👋
  Project   /home/eldo/Projects/ElitCoach
  Stack     NestJS, Docker, Prisma
  Model     ✅ Gemini (3 keys)
  Roadmap   ElitCoach_Roadmap.csv detected

  Eldo › debug JWT tokens not refreshing after 24h

  ⠹ Thinking...

  Root cause: The refresh token TTL in auth.service.ts (line 47)
  is set to '24h' but the Redis TTL on the blacklist is '23h'.
  Tokens expire from Redis before they expire from JWT — so
  revoked tokens become valid again for up to 1 hour.

  Fix: Set Redis TTL to 25h or match JWT TTL exactly.
```

## Supported providers

| Provider | Free | Key required | Speed | Quality |
|---|---|---|---|---|
| **Gemini** | ✅ 15 req/min | Yes | ⚡⚡⚡ | ⭐⭐⭐⭐ |
| **Groq** | ✅ 14 400 req/day | Yes | ⚡⚡⚡⚡ | ⭐⭐⭐ |
| **Mistral** | ✅ Free tier | Yes | ⚡⚡⚡ | ⭐⭐⭐⭐ |
| **OpenRouter** | ✅ 50+ models | Yes | ⚡⚡ | ⭐⭐⭐ |
| **Cohere** | ✅ Free tier | Yes | ⚡⚡⚡ | ⭐⭐⭐ |
| **Ollama** | ✅ 100% local | ❌ None | ⚡⚡ | ⭐⭐⭐ |
| **Claude** | 💰 Paid | Yes | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ |

**Multi-token pool:** Add `GEMINI_API_KEY_2`, `_3`... to multiply your quota. When one key hits its limit, the agent silently rotates to the next — zero interruption.

## Getting free API keys

**Gemini (recommended — 15 req/min, free)**
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) → **Create API Key**

**Groq (fastest — 14 400 req/day, free)**
1. Go to [console.groq.com](https://console.groq.com) → Sign up → **API Keys** → **Create**

**OpenRouter (50+ free models)**
1. Go to [openrouter.ai](https://openrouter.ai) → Sign up → **Keys** → **Create Key**

Then paste your keys during `setup` or in `~/.ai-agent/.env`.

## Commands

### ⚙️ Configuration
| Command | Description |
|---|---|
| `setup` | Interactive wizard — name, language, style, theme, API keys |
| `profile` | View and edit your profile |
| `config` | Show and reload API keys live |
| `tokens` | Detailed status of all LLM providers |

### 🔍 Code & Project
| Command | Description |
|---|---|
| `analyze` | Full project analysis — architecture, tech debt, security |
| `debug <issue>` | Debug — root cause + exact fix |
| `build <feature>` | Plan and build a feature step by step |
| `refactor <file>` | Refactor with visual diff before applying |
| `generate <file> <desc>` | Generate a complete file |
| `tests <file>` | Generate unit tests |
| `explain <file>` | Explain a file in plain English |
| `security` | Full security audit |

### 🔀 Git & Review
| Command | Description |
|---|---|
| `diff` | Summarize Git changes in plain language |
| `review [branch]` | Full code review with severity levels 🔴🟡🟢 |
| `git` | Suggest a conventional commit message |
| `history` | Browse past conversations for this project |

### 📋 Roadmap
| Command | Description |
|---|---|
| `roadmap` | Analyze roadmap vs actual code |
| `roadmap update` | Auto-update task statuses in the CSV |
| `roadmap next` | Next tasks + copy-ready AI prompts |
| `roadmap deps` | Dependencies and blockers |
| `roadmap marketing` | Ready-to-post LinkedIn / Twitter / Facebook content |
| `roadmap generate` | Generate a full roadmap from your codebase |

### 📁 Organization
| Command | Description |
|---|---|
| `organize` | Preview a smart file reorganization |
| `organize go` | Execute the reorganization (with confirmation) |
| `tree` | Project file tree |

## Customization

Profile stored in `~/.ai-agent/profile.json`:

```json
{
  "name": "Eldo",
  "language": "en",
  "style": "technical",
  "theme": "gold",
  "preferredProvider": "gemini",
  "systemPrompt": "You are a NestJS expert. Always respond in TypeScript."
}
```

**Themes:** `gold` · `blue` · `green` · `purple` · `mono`  
**Styles:** `concise` · `balanced` · `detailed` · `technical`

## Using Ollama (offline, zero API key)

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.2
ollama serve
ai   # Ollama auto-detected
```

## FAQ

**Do I need to pay?** No. The agent is free. Providers have generous free tiers.

**Does it send my code online?** Only a summarized context (file structure + key files). Never your full codebase.

**One key hits quota — what happens?** Silent rotation to the next key. If all keys for one provider are exhausted, falls back to the next provider.

**Can I use this offline?** Yes, with Ollama.

## Changelog

### v1.1.0
- **New** `diff`, `review`, `history` commands
- **New** providers: Mistral, Cohere, Ollama
- **Fix** `y/n` confirmations, `Ctrl+C`, `roadmap update`, auto key loading

### v1.0.0 — Initial release
- 7 LLM providers with multi-token pool and auto-rotation
- 24 commands · Enriched roadmap · Setup wizard · Per-project memory

## Contributing

```bash
git clone https://github.com/GBOHOUILI/ai-agent
cd ai-agent && npm install && node agent.js
```

Issues and PRs are very welcome.

<div align="center">

**If this saves you time, a ⭐ on GitHub means the world.**

[⭐ Star on GitHub](https://github.com/GBOHOUILI/ai-agent) · [🐛 Report a bug](https://github.com/GBOHOUILI/ai-agent/issues) · [💬 Discussions](https://github.com/GBOHOUILI/ai-agent/discussions)

*Built in public · Zero to One · No VC. No budget. Just code.*  
*by [Eldo-Moréo GBOHOUILI](https://github.com/GBOHOUILI) — [LinkedIn](https://linkedin.com/in/gbohouili-eldo-moreo)*

</div>

</details>

---

<!-- ═══════════════════════════════════════════════════════════════
     🇫🇷  VERSION FRANÇAISE
═══════════════════════════════════════════════════════════════ -->

<details>
<summary><b>🇫🇷 Français</b></summary>

<br/>

**L'agent CLI open-source qui transforme ton terminal en environnement de développement IA.**  
Multi-provider · Suivi de roadmap · Organiseur de fichiers · 100% personnalisable.

## Pourquoi Zero-to-One AI ?

La plupart des outils IA pour développeurs sont soit enfermés dans un IDE, soit payants, soit limités à un seul provider.

**Zero-to-One AI est différent :**

- 🆓 **100% gratuit** — fonctionne avec les clés API gratuites (Gemini, Groq, OpenRouter, Mistral...)
- 🔌 **7 providers** — rotation automatique quand le quota est atteint, mode local avec Ollama (zéro internet)
- 🧠 **Connaît ton projet** — lit ta codebase, suit ton roadmap, garde l'historique de tes conversations
- ⚙️ **100% à toi** — ton prénom, ta langue, ton style, ton prompt système
- 📋 **Roadmap intégré** — compare ton plan vs ton code réel et te dit ce qui dérive

> Construit en public par [Eldo-Moréo GBOHOUILI](https://github.com/GBOHOUILI) · Zero to One · Sans capital. Sans budget. Juste du code.

## Installation

```bash
npm install -g zero-to-one-ai
ai
```

Première utilisation ? Tape `setup` — le wizard configure tout en 2 minutes.

## Démo

```
╔══════════════════════════════════════════════╗
║   Zero-to-One AI  —  V1                      ║
║   by Eldo-Moréo GBOHOUILI                    ║
╚══════════════════════════════════════════════╝

  Bonjour Eldo 👋
  Projet    /home/eldo/Projects/ElitCoach
  Stack     NestJS, Docker, Prisma
  Modèle    ✅ Gemini (3 clés)
  Roadmap   ElitCoach_Roadmap.csv détecté

  Eldo › debug les tokens JWT ne se rafraîchissent pas après 24h

  ⠹ Réflexion...

  Cause : Le TTL du refresh token dans auth.service.ts (ligne 47)
  est '24h' mais le TTL Redis sur la blacklist est '23h'.
  Les tokens révoqués redeviennent valides pendant 1 heure.

  Fix : Aligne le TTL Redis sur le TTL JWT (25h).
  Fichier : src/auth/auth.service.ts, lignes 47 et 89.
```

## Providers supportés

| Provider | Gratuit | Clé requise | Vitesse | Qualité |
|---|---|---|---|---|
| **Gemini** | ✅ 15 req/min | Oui | ⚡⚡⚡ | ⭐⭐⭐⭐ |
| **Groq** | ✅ 14 400 req/jour | Oui | ⚡⚡⚡⚡ | ⭐⭐⭐ |
| **Mistral** | ✅ Free tier | Oui | ⚡⚡⚡ | ⭐⭐⭐⭐ |
| **OpenRouter** | ✅ 50+ modèles | Oui | ⚡⚡ | ⭐⭐⭐ |
| **Cohere** | ✅ Free tier | Oui | ⚡⚡⚡ | ⭐⭐⭐ |
| **Ollama** | ✅ 100% local | ❌ Aucune | ⚡⚡ | ⭐⭐⭐ |
| **Claude** | 💰 Payant | Oui | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ |

**Multi-token pool :** Ajoute `GEMINI_API_KEY_2`, `_3`... pour multiplier tes quotas. Rotation silencieuse automatique.

## Obtenir les clés gratuites

**Gemini (recommandé — 15 req/min, gratuit)**
1. [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) → **Create API Key**

**Groq (plus rapide — 14 400 req/jour, gratuit)**
1. [console.groq.com](https://console.groq.com) → Crée un compte → **API Keys** → **Create**

**OpenRouter (50+ modèles gratuits)**
1. [openrouter.ai](https://openrouter.ai) → Crée un compte → **Keys** → **Create Key**

## Commandes

### ⚙️ Configuration
| Commande | Description |
|---|---|
| `setup` | Wizard interactif — prénom, langue, style, thème, clés API |
| `profile` | Voir et modifier ton profil |
| `config` | Afficher et recharger les clés API en live |
| `tokens` | Statut détaillé de tous les providers LLM |

### 🔍 Code & Projet
| Commande | Description |
|---|---|
| `analyze` | Analyse complète — architecture, dette technique, sécurité |
| `debug <problème>` | Débugger — cause racine + fix exact |
| `build <feature>` | Planifier et construire une feature pas à pas |
| `refactor <fichier>` | Refactoriser avec diff visuel avant d'appliquer |
| `generate <fichier> <desc>` | Générer un fichier complet |
| `tests <fichier>` | Générer des tests unitaires |
| `explain <fichier>` | Expliquer un fichier en langage naturel |
| `security` | Audit de sécurité complet |

### 🔀 Git & Review
| Commande | Description |
|---|---|
| `diff` | Résumer les changements Git en langage naturel |
| `review [branche]` | Code review complète avec niveaux de sévérité 🔴🟡🟢 |
| `git` | Suggérer un message de commit conventionnel |
| `history` | Historique des conversations du projet |

### 📋 Roadmap
| Commande | Description |
|---|---|
| `roadmap` | Analyser le roadmap vs le code réel |
| `roadmap update` | Mettre à jour les statuts dans le CSV |
| `roadmap next` | Prochaines tâches + Prompts IA prêts à copier |
| `roadmap deps` | Dépendances et bloqueurs |
| `roadmap marketing` | Posts LinkedIn / Twitter / Facebook prêts à publier |
| `roadmap generate` | Générer un roadmap depuis ta codebase |

### 📁 Organisation
| Commande | Description |
|---|---|
| `organize` | Prévisualiser une réorganisation intelligente |
| `organize go` | Exécuter la réorganisation (avec confirmation) |
| `tree` | Arborescence du projet |

## Personnalisation

Profil stocké dans `~/.ai-agent/profile.json` :

```json
{
  "name": "Eldo",
  "language": "fr",
  "style": "technical",
  "theme": "gold",
  "preferredProvider": "gemini",
  "systemPrompt": "Tu es expert NestJS. Réponds toujours en TypeScript."
}
```

**Thèmes :** `gold` · `blue` · `green` · `purple` · `mono`  
**Styles :** `concise` · `balanced` · `detailed` · `technical`

## Utiliser Ollama (hors ligne, zéro clé)

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.2
ollama serve
ai   # Ollama détecté automatiquement
```

## FAQ

**Dois-je payer ?** Non. L'agent est gratuit. Les providers ont des offres gratuites généreuses.

**Mon code est-il envoyé sur internet ?** Seulement un contexte résumé (structure + fichiers clés). Jamais ta codebase complète.

**Une clé atteint son quota — que se passe-t-il ?** Rotation silencieuse vers la clé suivante, puis vers le provider suivant.

**Peut-on utiliser ça hors ligne ?** Oui, avec Ollama.

## Changelog

### v1.1.0
- **Nouveau** commandes `diff`, `review`, `history`
- **Nouveau** providers : Mistral, Cohere, Ollama
- **Fix** confirmations `y/n`, `Ctrl+C`, `roadmap update`, chargement auto des clés

### v1.0.0 — Publication initiale
- 7 providers LLM avec pool multi-tokens et rotation automatique
- 24 commandes · Roadmap enrichi · Wizard de configuration · Mémoire par projet

## Contribuer

```bash
git clone https://github.com/GBOHOUILI/ai-agent
cd ai-agent && npm install && node agent.js
```

Les issues et PRs sont les bienvenues.

<div align="center">

**Si cet outil te fait gagner du temps, une ⭐ sur GitHub suffit à me motiver à continuer.**

[⭐ Star sur GitHub](https://github.com/GBOHOUILI/ai-agent) · [🐛 Signaler un bug](https://github.com/GBOHOUILI/ai-agent/issues) · [💬 Discussions](https://github.com/GBOHOUILI/ai-agent/discussions)

*Construit en public · Zero to One · Sans capital. Sans budget. Juste du code.*  
*par [Eldo-Moréo GBOHOUILI](https://github.com/GBOHOUILI) — [LinkedIn](https://linkedin.com/in/gbohouili-eldo-moreo)*

</div>

</details>

---

MIT License · [Eldo-Moréo GBOHOUILI](https://github.com/GBOHOUILI)
