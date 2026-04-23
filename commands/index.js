// commands/index.js — Commandes spécialisées de l'agent

import { ask } from "../modules/llm/index.js";
import { buildProjectContext, detectProjectType } from "../modules/scanner/index.js";
import { readFile, writeFile, gitStatus, gitDiff } from "../modules/tools/index.js";
import { createPlan, executeStep } from "../modules/planner/index.js";

// ─── ANALYZE ─────────────────────────────────────────────────────────────────

const ANALYST_SYSTEM = `You are a senior software architect doing a code review.
Analyze the project and give:
1. Architecture overview (2-3 sentences)
2. Tech debt / issues found (bullet list, be specific)
3. Security concerns (if any)
4. Top 3 improvements recommended
5. Scalability assessment
Be direct and technical. No fluff.`;

export async function analyzeProject(dir = ".", history = []) {
  const context = buildProjectContext(dir, { maxFiles: 25, maxCharsPerFile: 1500 });
  const types   = detectProjectType(dir);

  const messages = [
    ...history.slice(-4),
    { role: "user", content: `Analyze this ${types.join(" + ")} project:\n\n${context}` },
  ];

  return await ask(messages, ANALYST_SYSTEM, { useCache: false });
}

// ─── DEBUG ────────────────────────────────────────────────────────────────────

const DEBUG_SYSTEM = `You are an expert debugger.
1. Identify the likely root cause (file + line if possible)
2. Explain why it's happening
3. Provide the exact fix with code
4. Mention related issues to watch out for
Output the fix immediately.`;

export async function debugIssue(bugDescription, dir = ".", history = []) {
  const context  = buildProjectContext(dir, { maxFiles: 15, maxCharsPerFile: 2000 });
  const messages = [
    ...history.slice(-6),
    { role: "user", content: `BUG: ${bugDescription}\n\nPROJECT:\n${context}` },
  ];
  return await ask(messages, DEBUG_SYSTEM, { useCache: false });
}

// ─── PLAN FEATURE ─────────────────────────────────────────────────────────────

export async function planFeature(featureDescription, dir = ".", history = []) {
  const context = buildProjectContext(dir, { maxFiles: 20, maxCharsPerFile: 1500 });
  return await createPlan(`Add feature: ${featureDescription}`, context, history);
}

// ─── REFACTOR ─────────────────────────────────────────────────────────────────

const REFACTOR_SYSTEM = `You are a senior engineer doing a refactor.
Produce a clean, improved version that:
- Follows best practices for the tech stack
- Has proper separation of concerns
- Has clear naming
- Removes duplication
- Adds JSDoc comments where useful
Output ONLY the refactored code, no explanation.`;

export async function refactorFile(filePath, instruction = "", history = []) {
  const content  = readFile(filePath);
  const messages = [
    ...history.slice(-4),
    { role: "user", content: `Refactor this file${instruction ? ` (focus: ${instruction})` : ""}:\n\n${content}` },
  ];
  return await ask(messages, REFACTOR_SYSTEM, { useCache: false });
}

// ─── GENERATE TESTS ──────────────────────────────────────────────────────────

const TEST_SYSTEM = `You are a senior engineer writing tests.
Write comprehensive tests:
- Unit tests for each function/method
- Edge cases
- Jest syntax (describe/it/expect)
- Mock external dependencies properly
Output ONLY the test file content.`;

export async function generateTests(filePath, history = []) {
  const content  = readFile(filePath);
  const messages = [
    ...history.slice(-4),
    { role: "user", content: `Write tests for:\n\n${content}` },
  ];
  return await ask(messages, TEST_SYSTEM, { useCache: false });
}

// ─── EXPLAIN CODE ─────────────────────────────────────────────────────────────

export async function explainCode(filePath, history = []) {
  const content  = readFile(filePath);
  const messages = [
    ...history.slice(-4),
    { role: "user", content: `Explain this code:\n\n${content}` },
  ];
  return await ask(messages, "Explain code clearly. Focus on: what it does, how it works, potential issues.", { useCache: true });
}

// ─── GENERATE FILE ────────────────────────────────────────────────────────────

const GENERATOR_SYSTEM = `You are a senior full-stack developer.
Generate complete, production-ready code files.
Rules:
- Write COMPLETE files, no placeholders
- Follow best practices for the tech stack
- Include proper error handling
- Add brief comments only for complex logic
Output ONLY the file content, no markdown, no explanation.`;

export async function generateFile(description, targetPath, dir = ".", history = []) {
  const context  = buildProjectContext(dir, { maxFiles: 10, maxCharsPerFile: 1000 });
  const types    = detectProjectType(dir);
  const messages = [
    ...history.slice(-6),
    {
      role:    "user",
      content: `Tech stack: ${types.join(", ")}\nProject context:\n${context.slice(0, 2000)}\n\nGenerate file: ${targetPath}\nDescription: ${description}`,
    },
  ];
  return await ask(messages, GENERATOR_SYSTEM, { useCache: false });
}

// ─── SECURITY AUDIT ──────────────────────────────────────────────────────────

const SECURITY_SYSTEM = `You are a security engineer doing a code audit.
Look for: SQL injection, XSS, CSRF, insecure auth, exposed secrets, missing validation,
rate limiting issues, privilege escalation.
Cite file names and line patterns.
Rate overall risk: LOW / MEDIUM / HIGH.`;

export async function securityAudit(dir = ".", history = []) {
  const context  = buildProjectContext(dir, { maxFiles: 20, maxCharsPerFile: 1500 });
  const messages = [
    ...history.slice(-2),
    { role: "user", content: `Security audit:\n${context}` },
  ];
  return await ask(messages, SECURITY_SYSTEM, { useCache: false });
}

// ─── GIT SUMMARY ─────────────────────────────────────────────────────────────

export async function gitSummary(dir = ".") {
  const [status, diff] = await Promise.all([gitStatus(dir), gitDiff(dir)]);
  const messages = [{
    role:    "user",
    content: `Write a conventional commit message for these changes:\n\nSTATUS:\n${status}\n\nDIFF:\n${diff}`,
  }];
  return await ask(messages, "Write a conventional commit message. Be concise and clear.");
}
// ─── DIFF ─────────────────────────────────────────────────────────────────────

const DIFF_SYSTEM = `You are an expert code reviewer. Analyze this git diff and provide:
1. Summary of what changed (2-3 sentences max)
2. Impact assessment (breaking changes? new features? refactor?)
3. Files most affected
4. Potential risks or issues spotted
Be concise and technical. Reply in the same language as the system prompt.`;

export async function diffSummary(dir = ".", history = []) {
  const { run } = await import("../modules/tools/index.js");
  const branch = (await run("git branch --show-current", { cwd: dir })).output.trim();
  const diff    = (await run("git diff HEAD", { cwd: dir })).output;
  const staged  = (await run("git diff --cached", { cwd: dir })).output;
  const combined = (diff + staged).slice(0, 6000);
  if (!combined.trim()) return "Aucun changement détecté dans le répertoire courant.";
  const messages = [
    ...history.slice(-2),
    { role: "user", content: `Branch: ${branch}\n\nDIFF:\n${combined}` },
  ];
  return await ask(messages, DIFF_SYSTEM, { useCache: false });
}

// ─── CODE REVIEW ─────────────────────────────────────────────────────────────

const REVIEW_SYSTEM = `You are a senior code reviewer doing a thorough PR review.
For each issue found, format as:
[SEVERITY] File:line — description

Severity levels:
🔴 CRITICAL — security hole, data loss risk, crashes
🟡 WARNING  — bug potential, bad practice, performance issue  
🟢 SUGGEST  — improvement, style, readability

After the issues, add a brief overall assessment (2-3 sentences).
Be specific about file and line when possible.`;

export async function reviewCode(dir = ".", targetBranch = "main", history = []) {
  const { run } = await import("../modules/tools/index.js");
  const currentBranch = (await run("git branch --show-current", { cwd: dir })).output.trim();
  let diff;
  if (currentBranch !== targetBranch) {
    diff = (await run(`git diff ${targetBranch}...HEAD`, { cwd: dir })).output;
  } else {
    diff = (await run("git diff HEAD~1 HEAD", { cwd: dir })).output;
  }
  if (!diff.trim()) return "Aucun changement à reviewer.";
  const messages = [
    ...history.slice(-2),
    { role: "user", content: `Review this code change (branch: ${currentBranch} vs ${targetBranch}):\n\n${diff.slice(0, 8000)}` },
  ];
  return await ask(messages, REVIEW_SYSTEM, { useCache: false });
}
