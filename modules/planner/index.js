// modules/planner/index.js — PLAN → EXECUTE → VERIFY

import { ask } from "../llm/index.js";

// ─── Planner ──────────────────────────────────────────────────────────────────

const PLANNER_SYSTEM = `You are an expert software architect and autonomous agent.
Decompose a user task into clear, executable steps.

Rules:
- Each step must be specific and actionable
- Steps in logical order (dependencies first)
- Type: ANALYZE | CREATE_FILE | MODIFY_FILE | RUN_CMD | VERIFY | EXPLAIN
- 3 to 8 steps max
- Output ONLY valid JSON, no markdown

Output format:
{
  "goal": "short description",
  "steps": [
    {
      "id": 1,
      "type": "ANALYZE|CREATE_FILE|MODIFY_FILE|RUN_CMD|VERIFY|EXPLAIN",
      "title": "Short step title",
      "description": "What to do exactly",
      "file": "path/to/file (if applicable)",
      "command": "command (if RUN_CMD)",
      "depends_on": []
    }
  ]
}`;

export async function createPlan(task, projectContext, history = []) {
  const messages = [
    ...history.slice(-4),
    {
      role:    "user",
      content: `PROJECT CONTEXT:\n${projectContext.slice(0, 3000)}\n\nTASK: ${task}\n\nCreate an execution plan as JSON.`,
    },
  ];

  const response = await ask(messages, PLANNER_SYSTEM, { useCache: false });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      goal:  task,
      steps: [{ id: 1, type: "EXPLAIN", title: "Execute task", description: task, depends_on: [] }],
    };
  }
}

// ─── Executor ─────────────────────────────────────────────────────────────────

const EXECUTOR_SYSTEM = `You are an expert software engineer executing a specific task step.

Rules:
- Be precise and complete
- For CREATE_FILE or MODIFY_FILE: output the COMPLETE file content, no truncation
- NEVER use placeholder comments like "// ... rest of code" — write real, complete code
- Output format depends on step type:
  - CREATE_FILE / MODIFY_FILE: output ONLY the file content
  - RUN_CMD: confirm the command and expected result
  - ANALYZE/EXPLAIN/VERIFY: clear prose response`;

export async function executeStep(step, projectContext, history = []) {
  const messages = [
    ...history.slice(-6),
    {
      role:    "user",
      content: `PROJECT CONTEXT:\n${projectContext.slice(0, 3000)}\n\nSTEP:\nType: ${step.type}\nTitle: ${step.title}\nDescription: ${step.description}\n${step.file ? `Target file: ${step.file}` : ""}\n${step.command ? `Command: ${step.command}` : ""}\n\nExecute this step now.`,
    },
  ];

  return await ask(messages, EXECUTOR_SYSTEM, { useCache: false });
}

// ─── Verifier ─────────────────────────────────────────────────────────────────

export async function verifyStep(step, result) {
  const messages = [
    {
      role:    "user",
      content: `STEP: ${step.title}\nDESCRIPTION: ${step.description}\nRESULT:\n${result.slice(0, 1000)}\n\nDid this step succeed? Output PASS or FAIL and why (1-2 sentences).`,
    },
  ];

  return await ask(messages, "You are a code reviewer. Be concise. Output PASS or FAIL then reason.", { useCache: false });
}