# 🚀 dgit-ai-commit — Project Documentation

> **AI-powered Git CLI** — Generate clean, meaningful, conventional commit
> messages using GROQ AI, and run natural-language git operations.
> CLI command: `dg`

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture](#-architecture)
3. [Commands & Usage](#-commands--usage)
4. [Source Code Breakdown](#-source-code-breakdown)
5. [Data Flow](#-data-flow)
6. [Configuration](#-configuration)
7. [Dependencies](#-dependencies)
8. [Security Notes](#-security-notes)
9. [Known Issues & TODOs](#-known-issues--todos)
10. [Future Roadmap](#-future-roadmap)
11. [Development Guide](#-development-guide)

---

## 🎯 Project Overview

**dgit-ai-commit** is a Node.js CLI tool that automates Git commit message
generation using AI (GROQ API), and — as of v1.1 — translates plain-English
requests into concrete, confirmed git command plans. It analyzes staged Git
diffs to generate conventional commit messages, and analyzes repo context
(log, status, branches) to plan multi-step git operations from a single
natural-language sentence.

### Core Philosophy

- **Speed** — Generate commit messages in seconds; skip the network entirely
  when the diff hasn't changed (disk cache)
- **Convention** — Enforce [Conventional Commits](https://www.conventionalcommits.org/) format
- **Simplicity** — Single command (`dg push`) for the full workflow
- **Interactivity** — Edit, regenerate, or select from AI-suggested options
- **Safety first** — every git operation runs without a shell, and anything
  the agent (`dg -a`) wants to run is shown and confirmed before it happens

### Current Status

- **Version:** 1.1.0
- **Status:** Actively developed
- **Node.js:** >= 18 (ESM)
- **License:** MIT

---

## 🏗 Architecture

```
dgit-ai-commit/
├── bin/
│   └── dg.js              # CLI entry point — Commander wiring ONLY,
│                           # routes to src/commands/*, wraps every
│                           # action in an error boundary
├── src/
│   ├── commands/           # One file per CLI command
│   │   ├── init.js
│   │   ├── add.js
│   │   ├── commit.js
│   │   ├── push.js
│   │   └── agent.js        # dg -a "<prompt>" — the natural-language agent
│   ├── core/                # No UI code lives here — pure logic + I/O
│   │   ├── git.js          # Safe git wrapper (execFileSync, array args)
│   │   ├── ai.js            # GROQ integration (commit options + agent plans)
│   │   ├── config.js        # ~/.dgconfig.json read/write
│   │   └── cache.js         # Disk cache for repeated diffs
│   └── ui/                  # Everything the user sees
│       ├── banner.js        # ASCII banner — UNCHANGED art, moved from components/logo.js
│       ├── theme.js         # Shared colors/icons/panel renderer
│       ├── prompts.js       # spinner, F2 listener, confirm, confirmTyped
│       ├── setup.js         # First-run API key prompt
│       ├── guards.js        # ensureGitRepo()
│       └── commitFlow.js    # The interactive AI-commit selection flow
├── public/
│   └── preview.gif          # Demo preview
├── .banner                  # Raw ASCII art reference (unchanged)
├── package.json             # Project manifest
├── CLAUDE.md                # This file
├── IDEA.md                  # Original idea notes
├── TODO.md                  # Task list (kept up to date by whoever's working)
├── COMMENTS.md              # Per-module function reference
└── README.md                # Public-facing README
```

> The old flat `src/ai.js` / `src/git.js` / `src/config.js` / `src/utils.js`
> and the `components/` directory have been fully migrated into
> `src/core/` and `src/ui/` respectively — there is no longer a parallel
> "old" and "planned" structure, this *is* the structure.

### Layer Architecture

```
┌─────────────────────────────────────────────┐
│              CLI Layer (bin/dg.js)           │
│     Commander.js command definitions only    │
├─────────────────────────────────────────────┤
│         Command Layer (src/commands/)        │
│  init | add | commit | push | agent          │
├─────────────────────────────────────────────┤
│            UI Layer (src/ui/)                 │
│  banner | theme | prompts | setup | commitFlow│
├─────────────────────────────────────────────┤
│           Core Layer (src/core/)              │
│   git.js  |  ai.js  |  config.js  |  cache.js│
├─────────────────────────────────────────────┤
│         External Services                    │
│   GROQ API  |  Git CLI  |  File System       │
└─────────────────────────────────────────────┘
```

---

## 📟 Commands & Usage

### `dg init`
Initialize a new Git repository in the current directory.

### `dg add`
Stage all changed files (`git add .`).

### `dg commit`
Generate AI commit messages and commit staged changes.

```bash
dg commit
# → Checks for staged changes (prompts to stage if none)
# → Ensures API key is configured
# → Hashes the diff; reuses a cached suggestion if it's < 10 min old
# → Calls GROQ API with staged diff (cache miss only)
# → Shows up to 3 AI-generated options in a themed list
# → User can: Select, Edit (F2), or Regenerate
# → Commits with chosen message
```

### `dg push [branch]`
Full workflow: stage → commit → push.

```bash
dg push                    # Interactive branch selection
dg push main               # Push to specific branch
# → Checks for changes
# → Prompts to stage unstaged changes
# → Runs the commit flow directly if anything is staged (works for
#   the very first commit too — no special-casing needed)
# → Verifies remote repository
# → Pushes to selected branch
```

### `dg -a "<prompt>"` / `dg agent "<prompt>"` — 🆕 the natural-language agent

```bash
dg -a "undo my last commit but keep the changes staged"
dg agent "find the commit from 21/06/2026 and reset to it"
```

Flow:
1. Gathers real repo context: current branch, last ~30 commits
   (`hash | dd/mm/yyyy | subject`), working-tree status, local branches,
   remotes.
2. Sends the prompt + context to GROQ, asking for strict JSON:
   `{ explanation, riskLevel, commands: [{ command, description }] }`.
3. Renders the plan in a themed panel with a risk badge.
4. Confirms before running anything:
   - `safe` / `caution` → a normal y/N confirm
   - `destructive` (either the model's own label, OR our own regex
     heuristics in `core/git.js#isDestructiveCommand` — whichever is
     more cautious wins) → must type the literal word `CONFIRM`
5. Executes each command via `execFileSync("git", args)` — **never**
   a shell, and **never** anything that doesn't tokenize to a `git ...`
   command (see `core/git.js#tokenizeGitCommand`). Stops immediately
   on the first failure or refusal.

### Interactive Features (commit flow)

| Feature | Trigger | Description |
|---------|---------|-------------|
| **Select** | Enter/Click | Choose an AI-generated commit message |
| **Edit** | F2 key | Manually edit the selected commit message |
| **Regenerate** | Arrow + Enter | Force a fresh AI call, bypassing the cache |
| **Edit (menu)** | Arrow + Enter | Same as F2, via menu option |

---

## 🔍 Source Code Breakdown

### `bin/dg.js` — CLI Entry Point

Defines all commands with Commander and routes each to `src/commands/*`.
Every action is wrapped in `withErrorBoundary()` so a thrown error prints
`✖ <message>` instead of a raw stack trace. Uses `program.parseAsync()` and
exits explicitly afterward as a safety net against any interactive flow
leaving stdin in a state that would otherwise keep the process alive.

### `src/core/git.js` — Git Operations

| Function | Git Command | Description |
|----------|-------------|-------------|
| `gitInit()` | `git init` | Initialize repository |
| `gitAddAll()` | `git add .` | Stage all changes |
| `gitCommit(title, description)` | `git commit -m ... -m ...` | Commit, each part its own arg — no shell |
| `gitPush(branch, opts)` | `git push origin <branch>` | Push to remote |
| `getBranches()` | `git branch` | List local branches |
| `getCurrentBranch()` | `git branch --show-current` | Current branch name |
| `hasCommits()` | `git rev-parse HEAD` | Check if any commits exist |
| `isGitRepo()` | `git rev-parse --is-inside-work-tree` | Check CWD is a repo |
| `hasChanges()` / `hasStagedChanges()` / `hasUnstagedChanges()` / `hasUnpushedCommits()` / `verifyRemoteRepo()` | various | Status checks used by `push` |
| `getStagedDiff()` | `git diff --cached` | Diff used for AI commit generation |
| `getRecentLog(n)` | `git log -n --date=format:%d/%m/%Y ...` | Dated log used as agent context |
| `getStatusPorcelain()` / `getRemotes()` | `git status --porcelain` / `git remote -v` | More agent context |
| `runGitArgs(args)` | `git <...args>` | The only execution path the agent uses |
| `isDestructiveCommand(str)` | — | Regex safety net over the AI's own risk label |
| `tokenizeGitCommand(str)` | — | Returns `null` for anything not starting with `git` |

**Security note (fixed in v1.1):** every function uses `execFileSync(cmd, argsArray)`.
There is no shell string interpolation anywhere in this file — a commit
message or an AI-suggested command can never break out into the shell
because there is no shell.

### `src/core/ai.js` — GROQ AI Integration

```javascript
generateCommitOptions(apiKey, { diff }) → Array<{title, description}>
planGitOperations(apiKey, userPrompt, context) → { explanation, riskLevel, commands }
```

Both share a `callGroq()` helper. `generateCommitOptions` keeps the original
behavior (diff → 3 conventional-commit options, `llama-3.1-8b-instant` by
default). `planGitOperations` is new: it asks for strict JSON
(`{explanation, riskLevel, commands}`), strips markdown code fences before
parsing, and falls back to an empty-commands response (with an explanation)
on any network or parse failure rather than throwing.

### `src/core/config.js` — Configuration

- **Storage:** `~/.dgconfig.json`
- **Format:** `{ "apiKey": "...", "model": "...", "agentModel": "..." }`
- `getAPIKey()` / `setAPIKey()` — unchanged from v1.0
- `getCommitModel()` / `getAgentModel()` — new, default to
  `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` respectively, both
  overridable by hand-editing the config file

### `src/core/cache.js` — Diff Cache

`hashContent()`, `getCached(key)`, `setCached(key, value)` — a tiny disk
cache under `os.tmpdir()/dgit-cache`, 10-minute TTL. Used by
`commitFlow.js` to skip the network call when re-running `dg commit`
against an unchanged staged diff. "Regenerate" always bypasses it.

### `src/ui/theme.js` — Shared Visual Language

`COLORS` / `color` — the same hex values the banner uses (`#FF653F` /
`#57595B` / `#FFFFFF`), so every screen feels consistent.
`icon` — a small consistent glyph set (✔ ✖ ⚠ ℹ ➜ ● 🤖 ✨).
`panel(title, lines, opts)` — a thin-border box (┌─┐│└┘), word-wrapped and
width-padded with `wrap-ansi` / `string-width` so the border always lines
up even with emoji or long lines. Used for the agent's plan display.
`divider(label)` — a plain horizontal rule, used outside of panels.
`riskBadge(level)` — colored `SAFE` / `CAUTION` / `DESTRUCTIVE` badge.

### `src/ui/banner.js` — ASCII Banner

Moved verbatim from `components/logo.js` — **the art, colors, and
once-per-session behavior are byte-for-byte unchanged.** Do not edit the
glyphs in this file.

### `src/ui/commitFlow.js` — Interactive Commit UI

Same proven control flow as the original `components/commit.js`
(stage check → generate → display → F2-race → select/edit/regenerate),
now backed by the disk cache and a themed `ora` spinner instead of a
hand-rolled text loader.

### `src/commands/agent.js` — The Natural-Language Agent

See [Commands & Usage](#-commands--usage) above for the full flow. This is
the file implementing the "killer feature" from `IDEA.md`.

---

## 🔄 Data Flow

### Commit Flow Diagram

```
User runs: dg commit
         │
         ▼
  Check staged changes?
  ├── No → Prompt to stage all?
  │        ├── Yes → git add .
  │        └── No  → Abort
  └── Yes
         │
         ▼
  Ensure API key configured?
  ├── No → Prompt for key → Save to ~/.dgconfig.json
  └── Yes
         │
         ▼
  ┌─── Loop ──────────────────────────────────┐
  │                                            │
  │  Hash diff → cache hit (< 10 min)?         │
  │  ├── Yes → reuse cached options            │
  │  └── No  → GROQ API call → cache result    │
  │       │                                    │
  │       ▼                                    │
  │  Display options + Edit + Regenerate       │
  │       │                                    │
  │       ▼                                    │
  │  Wait for user input (race)                │
  │  ├── F2 key → Edit mode                    │
  │  ├── Select option → Commit & return       │
  │  ├── Edit menu → Edit mode                 │
  │  └── Regenerate → force-bypass cache, loop  │
  │                                            │
  └────────────────────────────────────────────┘
```

### Agent Flow Diagram

```
User runs: dg -a "<prompt>"
         │
         ▼
  Ensure API key configured
         │
         ▼
  Gather context: branch, dated log, status, branches, remotes
         │
         ▼
  GROQ: plan { explanation, riskLevel, commands[] }
         │
         ▼
  Escalate riskLevel if any command matches a destructive regex
         │
         ▼
  Show panel: explanation + numbered commands + risk badge
         │
         ▼
  Confirm
  ├── destructive → must type "CONFIRM"
  └── safe/caution → y/N
         │
   No ──┴── cancel, nothing runs
         │ Yes
         ▼
  For each command:
    tokenize → must start with "git", else refuse & stop
    execFileSync("git", args) → on failure, stop & report
         │
         ▼
  ✨ Done
```

### Push Flow Diagram

```
User runs: dg push [branch]
         │
         ▼
  Any changes or unpushed commits?
  ├── No → Error: "No changes"
  └── Yes
         │
         ▼
  Unstaged changes?
  ├── Yes → Prompt to stage?
  │        ├── Yes → git add .
  │        └── No  → Abort
  └── No
         │
         ▼
  Staged changes?
  ├── Yes → Run commit flow (handles first commit too)
  └── No
         │
         ▼
  Remote configured?
  ├── No → Warning: "Add remote URL"
  └── Yes
         │
         ▼
  Branch provided?
  ├── No → Prompt to select branch
  └── Yes
         │
         ▼
  git push origin <branch>
```

---

## ⚙️ Configuration

### API Key & Model Storage

- **File:** `~/.dgconfig.json`
- **Format:** `{ "apiKey": "gsk_...", "model": "...", "agentModel": "..." }`
- **Setup:** First use prompts for the API key
- **Get Key:** [GROQ Console](https://console.groq.com/keys)

### Diff Cache

- **Dir:** `os.tmpdir()/dgit-cache`
- **TTL:** 10 minutes
- **Bypass:** always on "Regenerate"

### Session Banner

- **File:** `os.tmpdir()/dg-banner-{process.pid}`
- **Purpose:** Ensures banner shows only once per CLI session
- **Cleanup:** Lives in the OS temp dir, doesn't need explicit cleanup

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `axios` | ^1.6.0 | HTTP client for GROQ API |
| `chalk` | ^5.3.0 | Terminal string coloring |
| `commander` | ^11.0.0 | CLI framework |
| `enquirer` | ^2.4.1 | Alternative prompt (Input, used for commit-message edit) |
| `inquirer` | ^9.2.0 | Interactive prompts |
| `ora` | ^7.0.0 | Spinner — now actually used (replaced the hand-rolled loader) |
| `string-width` | ^4.2.3 | Emoji/ANSI-aware width calc for panel borders |
| `strip-ansi` | ^7.2.0 | Strip ANSI for text width calc |
| `wrap-ansi` | ^6.2.0 | Word-wraps panel content without breaking ANSI color codes |

`gradient-string` was removed in v1.1 — it was never imported anywhere.

---

## 🔐 Security Notes

- **No shell, anywhere.** Every git invocation goes through
  `execFileSync(cmd, argsArray)`. There is no template string built from
  user or AI input that ever reaches a shell.
- **The agent only runs `git ...`.** `tokenizeGitCommand()` returns `null`
  for anything that doesn't start with the literal word `git`; the agent
  refuses and stops the whole plan if that happens, even mid-execution.
- **Two-source risk assessment.** The model's own `riskLevel` and a local
  regex check (`isDestructiveCommand`) are both consulted; the more
  cautious of the two wins.
- **Typed confirmation for destructive plans.** A literal `CONFIRM` is
  required — pressing Enter on a y/N prompt is not enough.
- **The model can't invent state.** The prompt explicitly tells it to use
  only the commit hashes/branches/dates given in the real repo context,
  and to prefer a lookup command (e.g. `git log`) over guessing.

---

## 🐛 Known Issues & TODOs

### Performance
- [x] No caching mechanism for repeated diffs — fixed via `src/core/cache.js`
- [x] Loader animation is text-based, not a spinner — now uses `ora`

### Code Quality
- [x] `gitCommit()` used string interpolation — fixed, all git calls use `execFileSync` with array args
- [x] `src/commands/`, `src/core/`, `src/ui/` were empty placeholders — now the real structure
- [x] `gradient-string` was unused — removed
- [x] No JSDoc — added to all exported functions in `src/core/*` and `src/ui/*`
- [ ] Still no automated test suite (manual smoke tests only — see Development Guide)
- [ ] No input validation for commit messages beyond "non-empty"

### Features Missing
- [x] `dg -a "PROMPT"` — the natural-language agent (see `src/commands/agent.js`)
- [ ] No rollback/revert *command* (the agent can do this conversationally, e.g. "undo my last commit", but there's no dedicated `dg undo`)
- [ ] No support for partial staging (`dg add <file>`)
- [ ] No commit history viewer
- [ ] No multi-repo support
- [ ] No configuration for commit conventions beyond the AI prompt itself

### Documentation
- [x] `COMMENTS.md` filled in with a per-module function reference
- [ ] No contribution guidelines

---

## 🗺 Future Roadmap

### Done in v1.1 (this pass)
- [x] Full restructure into `src/commands/`, `src/core/`, `src/ui/`
- [x] Fixed shell injection risk in all git operations
- [x] Implemented `dg -a "PROMPT"` natural-language agent
- [x] Added a disk cache for repeated diffs
- [x] Spinner + themed panels (banner itself untouched)
- [x] Removed unused dependency, added JSDoc, added error boundaries

### Next up (v1.2)
- [ ] `dg log` — commit history viewer, optionally AI-summarized
- [ ] `dg config set <key> <value>` instead of hand-editing `~/.dgconfig.json`
- [ ] `dg add <files...>` for partial staging
- [ ] Basic automated tests (the manual smoke-test scripts used during
      this pass are a good starting point — see Development Guide)

### Long-term (v2.0)
- [ ] Plugin system for alternate AI providers (OpenAI/Anthropic alongside GROQ)
- [ ] Interactive diff viewer
- [ ] Multi-language commit messages
- [ ] Git hooks integration (pre-commit auto-suggest)

---

## 🛠 Development Guide

### Setup

```bash
git clone https://github.com/thinakaranmanokaran/dgit-ai-commit.git
cd dgit-ai-commit
npm install
npm link
```

### Testing

There's no automated test suite yet. For manual smoke testing:

```bash
cd /path/to/test-repo
dg add
dg commit
dg push
dg -a "undo my last commit"
```

To test the AI-dependent paths without hitting the real GROQ API (e.g. in
a sandboxed/offline environment), monkeypatch `axios.post` and
`inquirer.prompt` before importing the relevant module — this is how the
v1.1 rewrite was validated end-to-end, including the destructive-command
confirmation path and the "AI suggests a non-git command" refusal path.

### Project Conventions

- **Language:** JavaScript (ESM)
- **Node:** >= 18
- **Style:** No linter configured yet
- **Commits:** Should use the tool itself (dogfooding)
- **Structure rule:** `src/core/*` has no `console.log`/prompt code;
  `src/ui/*` has no direct `child_process` calls; `src/commands/*` just
  wires the two together for one CLI command.

### Adding a New Command

1. Add the implementation in `src/commands/<name>.js`, exporting an
   async `run<Name>()` function.
2. Wire it up in `bin/dg.js` with `program.command(...)`, wrapped in
   `withErrorBoundary()`.
3. Reuse `src/ui/theme.js` (`color`, `icon`, `panel`) for any new output
   instead of hand-rolling colors, so it stays visually consistent.
4. If it needs git, add the operation to `src/core/git.js` rather than
   calling `child_process` directly from the command file.

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GROQ_API_KEY` | Not used (uses config file) | No |

---

## 📄 Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `bin/dg.js` | CLI entry point | ✅ Active |
| `src/commands/*.js` | One per CLI command | ✅ Active |
| `src/core/git.js` | Git operations (safe, no shell) | ✅ Active |
| `src/core/ai.js` | GROQ API integration | ✅ Active |
| `src/core/config.js` | API key + model config | ✅ Active |
| `src/core/cache.js` | Diff cache | ✅ Active |
| `src/ui/banner.js` | Banner display (unchanged art) | ✅ Active |
| `src/ui/theme.js` | Colors/icons/panel renderer | ✅ Active |
| `src/ui/prompts.js` | Spinner, F2 listener, confirms | ✅ Active |
| `src/ui/setup.js` | First-run API key prompt | ✅ Active |
| `src/ui/guards.js` | `ensureGitRepo()` | ✅ Active |
| `src/ui/commitFlow.js` | Interactive commit UI | ✅ Active |
| `IDEA.md` | Original idea | 📝 Notes |
| `TODO.md` | Task list | 📝 Notes |
| `COMMENTS.md` | Per-module function reference | ✅ Filled in |
| `CLAUDE.md` | This file | ✅ Active |

---

## 👨‍💻 Author

**Thinakaran Manokaran**
- Website: [https://thinakaran.dev](https://thinakaran.dev)
- GitHub: [@thinakaranmanokaran](https://github.com/thinakaranmanokaran)

---

## 📜 License

MIT License — See [LICENSE](LICENSE) for details.
