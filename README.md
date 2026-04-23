<div align="center">

# Zero-to-One AI

**Agent CLI intelligent multi-provider — du projet à la production**

[![npm version](https://img.shields.io/npm/v/ai-agent?color=gold&label=npm)](https://www.npmjs.com/package/ai-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-gold)](https://nodejs.org)
[![GitHub Stars](https://img.shields.io/github/stars/GBOHOUILI/ai-agent?style=social)](https://github.com/GBOHOUILI/ai-agent)

*par [Eldo-Moréo GBOHOUILI](https://github.com/GBOHOUILI)*

</div>

---

## Installation en une commande

```bash
npm install -g ai-agent
```

Puis lance l'agent :

```bash
ai
```

> **Première utilisation ?** Tape `setup` dans l'agent — le wizard te guide en 2 minutes.

---

## Providers supportés

| Provider | Gratuit | Clé requise | Lien |
|---|---|---|---|
| **Gemini** (Google) | ✅ 15 req/min | Oui | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| **Groq** | ✅ 14 400 req/jour | Oui | [console.groq.com](https://console.groq.com) |
| **Mistral** | ✅ Free tier | Oui | [platform.mistral.ai](https://platform.mistral.ai) |
| **OpenRouter** | ✅ 50+ modèles | Oui | [openrouter.ai](https://openrouter.ai) |
| **Cohere** | ✅ Free tier | Oui | [cohere.com](https://cohere.com) |
| **Ollama** | ✅ 100% local | ❌ Aucune | [ollama.ai](https://ollama.ai) |
| **Claude** (Anthropic) | 💰 Payant | Oui | [console.anthropic.com](https://console.anthropic.com) |

> **Multi-tokens** : ajoute `GEMINI_API_KEY_2`, `_3`... pour multiplier tes quotas.  
> Si une clé est épuisée, rotation automatique vers la suivante.

---

## Configuration rapide

### Option 1 — Setup interactif (recommandé)

```bash
ai
> setup
```

Le wizard te pose 6 questions simples : prénom, langue, style, thème, clés API.

### Option 2 — Manuel

```bash
cp ~/.ai-agent/.env.example ~/.ai-agent/.env
nano ~/.ai-agent/.env  # Colle tes clés
ai
```

### Option 3 — Ollama (zéro clé API, zéro internet)

```bash
# Installe Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.2

# Lance l'agent — Ollama sera détecté automatiquement
ai
```

---

## Commandes

### Configuration

| Commande | Description |
|---|---|
| `setup` | Wizard de configuration interactif |
| `profile` | Voir / modifier ton profil |
| `config` | Gérer les clés API |
| `tokens` | Statut de tous les providers |

### Développement

| Commande | Description |
|---|---|
| `analyze` | Analyse complète du projet (architecture, dette technique, sécurité) |
| `debug <bug>` | Débugger un problème — cause + fix |
| `build <feature>` | Planifier et construire une feature pas à pas |
| `refactor <file>` | Refactoriser un fichier avec diff visuel avant confirmation |
| `generate <file> <desc>` | Générer un fichier complet |
| `tests <file>` | Générer des tests unitaires |
| `explain <file>` | Expliquer un fichier en langage naturel |
| `security` | Audit de sécurité complet |

### Git & Review

| Commande | Description |
|---|---|
| `diff` | Résumer les changements Git en langage naturel |
| `review [branch]` | Code review complète (🔴 critique / 🟡 warning / 🟢 suggestion) |
| `git` | Suggérer un message de commit |
| `history` | Historique des conversations du projet |

### Roadmap

| Commande | Description |
|---|---|
| `roadmap` | Analyser le roadmap vs le code réel |
| `roadmap update` | Mettre à jour les statuts automatiquement |
| `roadmap next` | Prochaines tâches disponibles + Prompt IA |
| `roadmap deps` | Visualiser les dépendances et conflits |
| `roadmap marketing [pf]` | Posts LinkedIn / Twitter / Facebook prêts à copier |
| `roadmap generate` | Générer un roadmap enrichi depuis le code |

### Organisation

| Commande | Description |
|---|---|
| `organize` | Analyser et suggérer une réorganisation intelligente |
| `organize go` | Exécuter la réorganisation (avec confirmation) |
| `tree` | Arborescence du projet |

---

## Format roadmap enrichi

L'agent supporte un format CSV enrichi avec posts marketing intégrés :

```csv
Phase,Version,Domaine,ID_Tache,Titre,Description,Prompt_IA,Dependances,Statut,Priorite,Post_Marketing,LinkedIn,Twitter_X,Facebook
MVP,1.0,Backend,T001,Auth JWT,"Impl. auth","Crée un module auth NestJS...",,À faire,HAUTE,...
```

---

## Personnalisation

### Profil

Ton profil est stocké dans `~/.ai-agent/profile.json` :

```json
{
  "name": "Eldo",
  "language": "fr",
  "style": "technical",
  "theme": "gold",
  "systemPrompt": "Tu es expert NestJS. Réponds toujours en TypeScript.",
  "preferredProvider": "gemini"
}
```

### Thèmes

| Thème | Description |
|---|---|
| `gold` | Doré — prestige (défaut) |
| `blue` | Bleu — professionnel |
| `green` | Vert — naturel |
| `mono` | Blanc pur — minimaliste |

### Variables d'environnement

```bash
OLLAMA_FIRST=true      # Utiliser Ollama en priorité
OLLAMA_MODEL=llama3.2  # Modèle Ollama (défaut: llama3.2)
OLLAMA_HOST=http://localhost:11434  # Adresse Ollama
DEBUG=true             # Logs détaillés
```

---

## Architecture

```
ai-agent/
├── agent.js              ← Entry point REPL
├── setup/wizard.js       ← Assistant de configuration
├── commands/index.js     ← analyze, debug, diff, review...
├── modules/
│   ├── llm/              ← 7 providers + pool multi-tokens
│   ├── roadmap/          ← Roadmap enrichi + marketing
│   ├── organizer/        ← Organisation intelligente
│   ├── scanner/          ← Analyse du projet
│   ├── planner/          ← Plan + exécution pas à pas
│   ├── analytics/        ← Stats anonymes (opt-in)
│   └── cache/            ← Cache LRU
└── memory/               ← Mémoire persistante par projet
```

---

## FAQ

**Q : Mes clés ne sont pas rechargées au démarrage ?**  
A : Tape `config` depuis l'agent — les pools LLM se rechargent automatiquement.

**Q : Puis-je utiliser plusieurs clés du même provider ?**  
A : Oui. `GEMINI_API_KEY=clé1`, `GEMINI_API_KEY_2=clé2`... jusqu'à `_10`. Rotation automatique en cas de quota.

**Q : Ollama ne fonctionne pas ?**  
A : Lance `ollama serve` dans un terminal, puis `ollama pull llama3.2`. L'agent détecte Ollama automatiquement.

**Q : L'agent accède-t-il à mon code ?**  
A : L'analyse du code se fait **localement**. Seules les questions et le contexte du projet sont envoyés au provider LLM choisi — jamais à un serveur tiers.

**Q : Les analytics collectent quoi ?**  
A : Seulement si tu as activé l'option durant le setup. Uniquement : commandes utilisées (pas leur contenu), stack détectée, provider préféré. ID anonyme non réversible. Zéro donnée personnelle.

---

## Contribuer

```bash
git clone https://github.com/GBOHOUILI/ai-agent
cd ai-agent
npm install
node agent.js
```

Les issues et PRs sont les bienvenues !

---

## Licence

MIT — [Eldo-Moréo GBOHOUILI](https://github.com/GBOHOUILI)

---

<div align="center">

**Si cet outil t'aide, une ⭐ sur GitHub suffit à me motiver à continuer.**

[⭐ Star sur GitHub](https://github.com/GBOHOUILI/ai-agent) · [🐛 Signaler un bug](https://github.com/GBOHOUILI/ai-agent/issues) · [💬 Discuter](https://github.com/GBOHOUILI/ai-agent/discussions)

</div>
