// config/themes/index.js — Thèmes de couleur pour l'agent

export const THEMES = {
  gold: {
    primary:   "\x1b[33m",
    secondary: "\x1b[90m",
    success:   "\x1b[32m",
    error:     "\x1b[31m",
    info:      "\x1b[36m",
    bold:      "\x1b[1m",
    dim:       "\x1b[2m",
    reset:     "\x1b[0m",
    name:      "Gold",
  },
  blue: {
    primary:   "\x1b[34m",
    secondary: "\x1b[90m",
    success:   "\x1b[32m",
    error:     "\x1b[31m",
    info:      "\x1b[36m",
    bold:      "\x1b[1m",
    dim:       "\x1b[2m",
    reset:     "\x1b[0m",
    name:      "Blue",
  },
  green: {
    primary:   "\x1b[32m",
    secondary: "\x1b[90m",
    success:   "\x1b[32m",
    error:     "\x1b[31m",
    info:      "\x1b[36m",
    bold:      "\x1b[1m",
    dim:       "\x1b[2m",
    reset:     "\x1b[0m",
    name:      "Green",
  },
  mono: {
    primary:   "\x1b[97m",
    secondary: "\x1b[90m",
    success:   "\x1b[97m",
    error:     "\x1b[91m",
    info:      "\x1b[97m",
    bold:      "\x1b[1m",
    dim:       "\x1b[2m",
    reset:     "\x1b[0m",
    name:      "Mono",
  },
};

export function getTheme(name = "gold") {
  return THEMES[name] || THEMES.gold;
}
