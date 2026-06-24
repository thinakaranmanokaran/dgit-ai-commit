/**
 * src/core/config.js
 *
 * Persists user configuration to ~/.dgconfig.json.
 * Format: { "apiKey": "gsk_...", "model": "...", "agentModel": "..." }
 *
 * Kept intentionally simple (no `dg config` command yet — see TODO.md)
 * but structured so one could be added without a format migration.
 */

import fs from "fs";
import os from "os";
import path from "path";

const CONFIG_PATH = path.join(os.homedir(), ".dgconfig.json");

const DEFAULT_COMMIT_MODEL = "llama-3.1-8b-instant";
const DEFAULT_AGENT_MODEL = "llama-3.3-70b-versatile";

/** Reads the full config object, or `{}` if no config file exists yet. */
function readConfig() {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch {
        return {};
    }
}

/** Writes the full config object to disk. */
function writeConfig(data) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

/** Returns the saved GROQ API key, or null if not configured. */
export function getAPIKey() {
    return readConfig().apiKey ?? null;
}

/** Saves the GROQ API key (merges into existing config). */
export function setAPIKey(apiKey) {
    writeConfig({ ...readConfig(), apiKey });
}

/** Returns the model used for commit-message generation. */
export function getCommitModel() {
    return readConfig().model || DEFAULT_COMMIT_MODEL;
}

/** Returns the model used for the natural-language `dg -a` agent. */
export function getAgentModel() {
    return readConfig().agentModel || DEFAULT_AGENT_MODEL;
}
