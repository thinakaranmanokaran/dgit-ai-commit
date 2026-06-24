/**
 * src/core/cache.js
 *
 * Tiny disk cache for AI commit suggestions, keyed by a hash of the
 * staged diff. Addresses the "No caching mechanism for repeated diffs"
 * item in CLAUDE.md: if you run `dg commit`, back out, and run it
 * again seconds later against the *same* staged diff, we skip the
 * network round-trip entirely.
 *
 * Explicit "regenerate" always bypasses this cache — it exists to
 * avoid redundant calls, not to dedupe an intentional retry.
 */

import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.join(os.tmpdir(), "dgit-cache");
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function ensureDir() {
    try {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    } catch {
        // ignore — cache is best-effort
    }
}

/** Hashes arbitrary content into a cache key. */
export function hashContent(content) {
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Returns cached commit options for `key`, or null if missing/expired.
 * @param {string} key
 */
export function getCached(key) {
    try {
        const file = path.join(CACHE_DIR, `${key}.json`);
        if (!fs.existsSync(file)) return null;

        const { timestamp, value } = JSON.parse(fs.readFileSync(file, "utf8"));
        if (Date.now() - timestamp > TTL_MS) return null;

        return value;
    } catch {
        return null;
    }
}

/**
 * Stores `value` under `key` with the current timestamp.
 * @param {string} key
 * @param {*} value
 */
export function setCached(key, value) {
    try {
        ensureDir();
        const file = path.join(CACHE_DIR, `${key}.json`);
        fs.writeFileSync(file, JSON.stringify({ timestamp: Date.now(), value }));
    } catch {
        // ignore — cache is best-effort, never break the CLI over it
    }
}
