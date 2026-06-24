/**
 * src/core/ai.js
 *
 * All communication with the GROQ API lives here:
 *  - generateCommitOptions(): the original feature — turn a staged
 *    diff into 3 conventional-commit suggestions.
 *  - planGitOperations(): the new feature from IDEA.md — turn a
 *    natural-language request ("dg -a ...") into a concrete, ordered
 *    list of git commands plus a plain-English explanation.
 */

import axios from "axios";
import { getStagedDiff } from "./git.js";
import { getCommitModel, getAgentModel } from "./config.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MAX_DIFF_CHARS = 10000;

/**
 * Calls the GROQ chat completions endpoint and returns the raw
 * message content string. Centralizes auth/error handling so each
 * feature (commit, agent) doesn't duplicate axios boilerplate.
 * @param {string} apiKey
 * @param {string} model
 * @param {string} prompt
 * @param {number} [temperature]
 * @returns {Promise<string>}
 */
async function callGroq(apiKey, model, prompt, temperature = 0.4) {
    const res = await axios.post(
        GROQ_ENDPOINT,
        {
            model,
            messages: [{ role: "user", content: prompt }],
            temperature,
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
        }
    );

    return res.data.choices[0].message.content;
}

/**
 * Strips markdown code fences (```json ... ```) some models wrap
 * JSON responses in, then parses. Throws if the result still isn't
 * valid JSON — callers decide the fallback.
 * @param {string} text
 */
function parseJsonResponse(text) {
    const cleaned = text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "");

    return JSON.parse(cleaned);
}

/**
 * Generates up to 3 conventional-commit message options for the
 * currently staged diff.
 * @param {string} apiKey
 * @param {{ diff?: string }} [opts] - pass a pre-fetched diff to avoid
 *   re-running `git diff` (used by the disk-cache layer in commitFlow.js)
 * @returns {Promise<Array<{title: string, description: string}>>}
 */
export async function generateCommitOptions(apiKey, opts = {}) {
    let diff = opts.diff ?? getStagedDiff();

    if (diff.length > MAX_DIFF_CHARS) {
        diff = diff.slice(0, MAX_DIFF_CHARS);
    }

    if (!diff.trim()) {
        return [{ title: "chore: update files", description: "" }];
    }

    const prompt = `
You are a Git commit generator.

Return ONLY JSON.

Format:
[
  { "title": "short commit title", "description": "optional description" }
]

Rules:
- Max 3 options
- Title must be under 60 chars
- Use conventional commits
- ALWAYS include a meaningful description (1 short sentence)
- No extra text

Diff:
${diff}
`;

    try {
        const content = await callGroq(apiKey, getCommitModel(), prompt, 0.4);
        return parseJsonResponse(content);
    } catch (err) {
        if (err.response?.status === 413) {
            return [{ title: "chore: large update", description: "" }];
        }
        return [{ title: "chore: update files", description: "" }];
    }
}

/**
 * Turns a natural-language request into a concrete, ordered plan of
 * git commands. This is the engine behind `dg -a "<prompt>"`.
 *
 * @param {string} apiKey
 * @param {string} userPrompt - what the user typed, e.g.
 *   "Need to reverse all current commits and need the last one I had on 21/06/2026"
 * @param {{ log: string, status: string, branch: string, branches: string, remotes: string }} context
 * @returns {Promise<{ explanation: string, riskLevel: "safe"|"caution"|"destructive", commands: Array<{command: string, description: string}> }>}
 */
export async function planGitOperations(apiKey, userPrompt, context) {
    const prompt = `
You are a senior Git operator embedded in a CLI tool. A developer will
describe what they want in plain language. Your job is to translate
that into a precise, ordered list of git commands that accomplish it
in THIS repository, using the real context below (real commit hashes,
dates, and branch names — never invent a hash or date).

Return ONLY JSON, no prose outside the JSON, in this exact shape:
{
  "explanation": "1-3 plain-English sentences describing what will happen and why",
  "riskLevel": "safe" | "caution" | "destructive",
  "commands": [
    { "command": "git <subcommand> ...", "description": "what this specific step does" }
  ]
}

Rules:
- Every "command" MUST start with the literal word "git".
- Never invent a commit hash, branch name, or date that isn't visible in the context below — if you need one that isn't there, prefer a safe lookup command first (e.g. "git log") instead of guessing.
- If the request is destructive (history rewrite, force-push, discarding uncommitted work, deleting branches), set "riskLevel" to "destructive" and say so plainly in "explanation".
- If you are uncertain which commit/branch the user means, pick the most reasonable single interpretation and state your assumption in "explanation" rather than asking a question (this is a non-interactive JSON response).
- Keep the command list as short as possible — only the steps actually needed.
- No extra text outside the JSON object.

Repository context:
Current branch: ${context.branch || "(unknown)"}

Recent commits (hash | date | subject):
${context.log || "(no commits yet)"}

Working tree status (porcelain):
${context.status || "(clean)"}

Local branches:
${context.branches || "(none)"}

Remotes:
${context.remotes || "(none configured)"}

User request:
"${userPrompt}"
`;

    const fallback = {
        explanation:
            "I couldn't reach the AI service or parse its response, so no commands were generated. Please try again or run the git commands manually.",
        riskLevel: "caution",
        commands: [],
    };

    try {
        const content = await callGroq(apiKey, getAgentModel(), prompt, 0.2);
        const parsed = parseJsonResponse(content);

        if (!Array.isArray(parsed.commands)) {
            return fallback;
        }
        return {
            explanation: parsed.explanation || "",
            riskLevel: ["safe", "caution", "destructive"].includes(parsed.riskLevel)
                ? parsed.riskLevel
                : "caution",
            commands: parsed.commands.filter((c) => c && typeof c.command === "string"),
        };
    } catch (err) {
        if (err.response?.status === 413) {
            return {
                ...fallback,
                explanation: "The repository context was too large to send to the AI service.",
            };
        }
        return fallback;
    }
}
