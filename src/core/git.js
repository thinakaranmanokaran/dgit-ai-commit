/**
 * src/core/git.js
 *
 * Thin wrapper around the Git CLI.
 *
 * SECURITY: every function here uses execFileSync(cmd, argsArray) —
 * never a shell string built via interpolation. This is the fix for
 * the "gitCommit() uses string interpolation — shell injection risk"
 * item from CLAUDE.md: a commit message or AI-suggested command can
 * never break out into the shell because there is no shell.
 */

import { execFileSync } from "child_process";

/**
 * Runs `git <args>` safely and returns stdout as a trimmed string.
 * @param {string[]} args
 * @param {{ stdio?: "inherit" | "pipe", cwd?: string }} [opts]
 * @returns {string}
 */
function git(args, opts = {}) {
    const result = execFileSync("git", args, {
        stdio: opts.stdio || "pipe",
        encoding: "utf8",
        cwd: opts.cwd,
    });
    return result ? result.toString().trim() : "";
}

/** Initializes a new Git repository in the current directory. */
export function gitInit() {
    execFileSync("git", ["init"], { stdio: "inherit" });
}

/** Stages every change in the working tree (`git add .`). */
export function gitAddAll() {
    execFileSync("git", ["add", "."], { stdio: "inherit" });
}

/**
 * Commits with a title and optional description, each passed as a
 * separate, unescaped argument — no shell quoting involved at all.
 * @param {string} title
 * @param {string} [description]
 */
export function gitCommit(title, description = "") {
    const args = ["commit", "-m", title];
    if (description && description.trim()) {
        args.push("-m", description.trim());
    }
    execFileSync("git", args, { stdio: "inherit" });
}

/**
 * Pushes to a remote branch.
 * @param {string} branch
 * @param {{ remote?: string }} [opts]
 */
export function gitPush(branch, opts = {}) {
    const remote = opts.remote || "origin";
    execFileSync("git", ["push", remote, branch], { stdio: "inherit" });
}

/** Returns local branch names (current branch's `*` marker stripped). */
export function getBranches() {
    const output = git(["branch"]);
    if (!output) return [];

    return output
        .split("\n")
        .map((b) => b.replace("*", "").trim())
        .filter(Boolean);
}

/** Returns the name of the currently checked-out branch, or "" if detached/none. */
export function getCurrentBranch() {
    try {
        return git(["branch", "--show-current"]);
    } catch {
        return "";
    }
}

/** True if the repo has at least one commit. */
export function hasCommits() {
    try {
        execFileSync("git", ["rev-parse", "--verify", "HEAD"], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

/** True if the current directory is inside a Git work tree. */
export function isGitRepo() {
    try {
        execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

/** True if there's any change at all (staged, unstaged, or untracked). */
export function hasChanges() {
    return !!git(["status", "--porcelain"]);
}

/** True if there are staged changes ready to commit. */
export function hasStagedChanges() {
    return !!git(["diff", "--cached"]);
}

/** True if there are unstaged modifications or untracked files. */
export function hasUnstagedChanges() {
    const diff = git(["diff"]);
    const untracked = git(["ls-files", "--others", "--exclude-standard"]);
    return !!diff || !!untracked;
}

/** True if local HEAD has commits not yet pushed to its upstream. */
export function hasUnpushedCommits() {
    try {
        return !!git(["log", "@{u}..HEAD"]);
    } catch {
        return false;
    }
}

/** True if at least one remote is configured. */
export function verifyRemoteRepo() {
    try {
        return !!git(["remote", "-v"]);
    } catch {
        return false;
    }
}

/** Returns the staged diff (binary file lines stripped), used for AI commit generation. */
export function getStagedDiff() {
    const raw = git(["diff", "--cached", "--no-color"]);
    return raw
        .split("\n")
        .filter((line) => !line.includes("Binary files"))
        .join("\n");
}

/**
 * Returns recent commit history formatted as `hash | dd/mm/yyyy | subject`
 * — used as context for the natural-language AI agent so it can resolve
 * references like "the commit from 21/06/2026".
 * @param {number} [count]
 */
export function getRecentLog(count = 30) {
    try {
        return git([
            "log",
            `-${count}`,
            "--date=format:%d/%m/%Y",
            "--pretty=format:%h | %ad | %s",
        ]);
    } catch {
        return "";
    }
}

/** Returns `git status --porcelain` output, used as AI agent context. */
export function getStatusPorcelain() {
    try {
        return git(["status", "--porcelain"]);
    } catch {
        return "";
    }
}

/** Returns configured remotes, used as AI agent context. */
export function getRemotes() {
    try {
        return git(["remote", "-v"]);
    } catch {
        return "";
    }
}

/**
 * Executes an arbitrary `git <...args>` command safely (array args,
 * no shell). This is the ONLY execution path the AI agent is allowed
 * to use — see src/commands/agent.js for the safety gate that makes
 * sure args[0] is always a known-safe git subcommand.
 * @param {string[]} args
 */
export function runGitArgs(args) {
    return execFileSync("git", args, { stdio: "inherit" });
}

// Patterns that rewrite history, discard work, or force a remote —
// flagged regardless of what the AI's own risk assessment said.
const DESTRUCTIVE_PATTERNS = [
    /\breset\b.*--hard/,
    /\bpush\b.*(--force|-f\b)/,
    /\bclean\b.*-[a-z]*f/i,
    /\bfilter-branch\b/,
    /\brebase\b/,
    /\bbranch\b.*-D\b/,
    /\bgc\b.*--prune/,
    /\bcheckout\b.*--\s/, // checkout -- <path> discards local edits
];

/**
 * Heuristic safety check for a proposed `git ...` command string.
 * Used as a second opinion on top of the AI's own risk label — the
 * AI agent in src/commands/agent.js takes the *more cautious* of the
 * two assessments.
 * @param {string} commandStr - e.g. "git reset --hard HEAD~1"
 * @returns {boolean}
 */
export function isDestructiveCommand(commandStr) {
    return DESTRUCTIVE_PATTERNS.some((re) => re.test(commandStr));
}

/**
 * Splits a "git ..." command string into safe execFileSync args.
 * Returns null if the command doesn't start with `git` — the agent
 * refuses to run anything else, no matter what the AI suggested.
 * @param {string} commandStr
 * @returns {string[] | null}
 */
export function tokenizeGitCommand(commandStr) {
    const trimmed = commandStr.trim();
    if (!/^git\s+/.test(trimmed)) return null;

    // Minimal tokenizer: respects "double" and 'single' quoted segments.
    const tokens = trimmed.match(/"[^"]*"|'[^']*'|\S+/g) || [];
    return tokens.slice(1).map((t) => t.replace(/^["']|["']$/g, ""));
}
