# 🚀 dgit-ai-commit — Project Documentation

> **AI-powered Git Commit CLI** — Generate clean, meaningful, and conventional commit messages using GROQ AI.
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
8. [Known Issues & TODOs](#-known-issues--todos)
9. [Future Roadmap](#-future-roadmap)
10. [Development Guide](#-development-guide)

---

## 🎯 Project Overview

**dgit-ai-commit** is a Node.js CLI tool that automates Git commit message generation using AI (GROQ API). It analyzes staged Git diffs and generates conventional commit messages with descriptions. The tool provides an interactive workflow for staging, committing, and pushing changes.

### Core Philosophy

- **Speed** — Generate commit messages in seconds
- **Convention** — Enforce [Conventional Commits](https://www.conventionalcommits.org/) format
- **Simplicity** — Single command (`dg push`) for the full workflow
- **Interactivity** — Edit, regenerate, or select from AI-suggested options

### Current Status

- **Version:** 1.0.2
- **Status:** Under Development
- **Node.js:** >= 18 (ESM)
- **License:** MIT

---

## 🏗 Architecture

```
dgit-ai-commit/
├── bin/
│   └── dg.js              # CLI entry point (Commander.js)
├── src/
│   ├── ai.js              # GROQ API integration
│   ├── git.js             # Git operations wrapper
│   ├── config.js          # API key persistence
│   ├── utils.js           # Shared utilities & checks
│   ├── commands/          # [PLANNED] Command modules
│   ├── core/              # [PLANNED] Core logic
│   └── ui/                # [PLANNED] UI components
├── components/
│   ├── commit.js          # Interactive commit flow UI
│   └── logo.js            # ASCII banner display
├── public/
│   └── preview.gif        # Demo preview
├── .banner                # Raw ASCII art
├── package.json           # Project manifest
├── CLAUDE.md              # This file
├── IDEA.md                # Original idea notes
├── TODO.md                # Task list
├── COMMENTS.md            # [PLANNED] Code comments doc
└── README.md              # Public-facing README
```

### Layer Architecture

```
┌─────────────────────────────────────────────┐
│              CLI Layer (bin/dg.js)           │
│     Commander.js command definitions         │
├─────────────────────────────────────────────┤
│           UI Layer (components/)             │
│   commit.js  |  logo.js                      │
├─────────────────────────────────────────────┤
│          Service Layer (src/)                │
│   ai.js  |  git.js  |  config.js  |  utils.js│
├─────────────────────────────────────────────┤
│         External Services                    │
│   GROQ API  |  Git CLI  |  File System       │
└─────────────────────────────────────────────┘
```

---

## 📟 Commands & Usage

### `dg init`
Initialize a new Git repository in the current directory.

```bash
dg init
# → Checks if already a Git repo
# → Runs `git init` if not
```

### `dg add`
Stage all changed files.

```bash
dg add
# → Ensures we're in a Git repo
# → Runs `git add .`
```

### `dg commit`
Generate AI commit messages and commit staged changes.

```bash
dg commit
# → Checks for staged changes (prompts to stage if none)
# → Ensures API key is configured
# → Calls GROQ API with staged diff
# → Shows 3 AI-generated options
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
# → Ensures initial commit exists
# → Runs commit flow if staged changes
# → Verifies remote repository
# → Pushes to selected branch
```

### Interactive Features

| Feature | Trigger | Description |
|---------|---------|-------------|
| **Select** | Enter/Click | Choose an AI-generated commit message |
| **Edit** | F2 key | Manually edit the selected commit message |
| **Regenerate** | Arrow + Enter | Generate new AI suggestions |
| **Edit (menu)** | Arrow + Enter | Same as F2, via menu option |

---

## 🔍 Source Code Breakdown

### `bin/dg.js` — CLI Entry Point

**Role:** Defines all CLI commands using Commander.js.

**Key Functions:**
- `program.command("init")` — Git init wrapper
- `program.command("add")` — Stage all files
- `program.command("commit")` — AI commit flow
- `program.command("push [branch]")` — Full commit+push workflow

**Flow for `push`:**
1. Check for any changes or unpushed commits
2. Handle unstaged changes (prompt to stage)
3. Ensure at least one commit exists (create initial if needed)
4. Run commit flow if staged changes exist
5. Verify remote repository exists
6. Prompt for branch selection (if not provided)
7. Push to remote

### `src/ai.js` — GROQ AI Integration

**Role:** Communicates with GROQ API to generate commit message suggestions.

**Key Function:**
```javascript
generateCommitOptions(apiKey) → Array<{title, description}>
```

**Process:**
1. Gets staged diff via `git diff --cached --no-color`
2. Filters out binary file references
3. Truncates diff to ~10,000 characters (safety limit)
4. Sends prompt to GROQ API (`llama-3.1-8b-instant` model)
5. Parses JSON response into commit options
6. Falls back to generic message on failure

**Prompt Design:**
- Instructs model to return ONLY JSON
- Max 3 options
- Title under 60 chars
- Conventional commit format
- Includes meaningful description

**Error Handling:**
- HTTP 413 (payload too large) → generic fallback
- Parse errors → generic fallback
- Empty diff → generic fallback

### `src/git.js` — Git Operations

**Role:** Thin wrapper around Git CLI commands.

| Function | Git Command | Description |
|----------|-------------|-------------|
| `gitInit()` | `git init` | Initialize repository |
| `gitAddAll()` | `git add .` | Stage all changes |
| `gitCommit(message)` | `git commit -m` | Commit with title + description |
| `gitPush(access, branch)` | `git push origin <branch>` | Push to remote |
| `getBranches()` | `git branch` | List local branches |
| `commitToOwn()` | `dg commit` | Delegate to own commit flow |
| `hasCommits()` | `git rev-parse HEAD` | Check if any commits exist |

**Security Note:** `gitCommit()` uses string interpolation for commit messages — potential shell injection risk if message contains special characters.

### `src/config.js` — API Key Management

**Role:** Persists GROQ API key to disk.

- **Storage:** `~/.dgconfig.json`
- **Format:** `{ "apiKey": "gsk_..." }`
- **Functions:**
  - `getAPIKey()` — Read key from config file
  - `setAPIKey(key)` — Write key to config file

### `src/utils.js` — Shared Utilities

**Git Status Checks:**
| Function | Description |
|----------|-------------|
| `isGitRepo()` | Check if CWD is a Git repo |
| `ensureGitRepo()` | Exit with error if not a Git repo |
| `hasChanges()` | Check for any changes (staged or unstaged) |
| `hasStagedChanges()` | Check for staged changes |
| `hasUnstagedChanges()` | Check for unstaged + untracked files |
| `hasUnpushedCommits()` | Check for commits not pushed to remote |
| `VerifyRemoteRepo()` | Check if remote URL is configured |

**UI Helpers:**
| Function | Description |
|----------|-------------|
| `formatChoice(opt)` | Format commit option with colors |
| `listenForF2(callback)` | Listen for F2 keypress (raw mode) |
| `startLoader(textArr)` | Start animated text loader |
| `stopLoader(interval)` | Stop loader and clear line |
| `sleep(ms)` | Promise-based delay |

**API Key Management:**
| Function | Description |
|----------|-------------|
| `ensureAPIKey()` | Prompt user for key if not configured |

### `components/commit.js` — Interactive Commit UI

**Role:** Manages the interactive commit message selection flow.

**Flow:**
1. Check for staged changes (prompt to stage if none)
2. Ensure API key is configured
3. **Loop:**
   a. Show loading animation
   b. Call `generateCommitOptions()`
   c. Display options with formatting
   d. **Race:** Wait for F2 keypress OR inquirer selection
   e. Handle result:
      - **Regenerate** → Continue loop
      - **Edit (F2/menu)** → Show Input prompt, commit custom message
      - **Select** → Commit with chosen title + description

**Key Design Decisions:**
- Uses `Promise.race()` between F2 listener and inquirer prompt
- F2 handler resolves immediately, bypassing inquirer
- Loader frames defined once outside the inner loop
- `stopLoader()` clears the line completely

### `components/logo.js` — ASCII Banner

**Role:** Displays a styled "DGit" ASCII art banner once per session.

**Features:**
- Session tracking via temp file (`/tmp/dg-banner-{pid}`)
- Centered text based on terminal width
- Color scheme: Primary (#FF653F), Secondary (#57595B), Accent (#FFFFFF)
- Shows author name and website
- Silent failure (never breaks CLI)

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
  │  Show loading animation                    │
  │       │                                    │
  │       ▼                                    │
  │  GROQ API: Generate commit options         │
  │  (git diff --cached → prompt → parse JSON) │
  │       │                                    │
  │       ▼                                    │
  │  Display 3 options + Edit + Regenerate     │
  │       │                                    │
  │       ▼                                    │
  │  Wait for user input (race)                │
  │  ├── F2 key → Edit mode                    │
  │  ├── Select option → Commit & return       │
  │  ├── Edit menu → Edit mode                 │
  │  └── Regenerate → Continue loop            │
  │                                            │
  └────────────────────────────────────────────┘
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
  Any commits exist?
  ├── No → Create initial commit (dg commit)
  └── Yes
         │
         ▼
  Staged changes?
  ├── Yes → Run commit flow
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

### API Key Storage

- **File:** `~/.dgconfig.json`
- **Format:** `{ "apiKey": "gsk_your_groq_api_key" }`
- **Setup:** First use prompts for key
- **Get Key:** [GROQ Console](https://console.groq.com/keys)

### Session Banner

- **File:** `/tmp/dg-banner-{process.pid}`
- **Purpose:** Ensures banner shows only once per CLI session
- **Cleanup:** Automatically cleaned on process exit (temp dir)

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `axios` | ^1.6.0 | HTTP client for GROQ API |
| `chalk` | ^5.3.0 | Terminal string coloring |
| `commander` | ^11.0.0 | CLI framework |
| `enquirer` | ^2.4.1 | Alternative prompt (Input) |
| `gradient-string` | ^3.0.0 | Gradient text (unused?) |
| `inquirer` | ^9.2.0 | Interactive prompts |
| `ora` | ^7.0.0 | Spinner (unused, custom loader used) |
| `strip-ansi` | ^7.2.0 | Strip ANSI for text width calc |

---

## 🐛 Known Issues & TODOs

### Performance
- [ ] AI generation is slow (network latency + model inference)
- [ ] No caching mechanism for repeated diffs
- [ ] Loader animation is text-based, not a spinner

### Code Quality
- [ ] `gitCommit()` uses string interpolation — shell injection risk
- [ ] No input validation for commit messages
- [ ] Error handling is minimal in some paths
- [ ] `src/commands/`, `src/core/`, `src/ui/` are empty placeholders
- [ ] `gradient-string` and `ora` dependencies may be unused
- [ ] No TypeScript types or JSDoc annotations

### Features Missing
- [ ] `dg -a "PROMPT"` — AI-driven git operations (the "killer feature")
- [ ] No rollback/revert capability
- [ ] No support for partial staging
- [ ] No commit history viewer
- [ ] No multi-repo support
- [ ] No configuration for commit conventions

### Documentation
- [ ] `COMMENTS.md` is empty (planned for inline code comments doc)
- [ ] No API documentation for internal modules
- [ ] No contribution guidelines

---

## 🗺 Future Roadmap

### Short-term (v1.1)
- [ ] Optimize AI prompt for faster responses
- [ ] Fix shell injection in `gitCommit()`
- [ ] Add proper error boundaries
- [ ] Remove unused dependencies
- [ ] Add JSDoc to all functions

### Medium-term (v1.2)
- [ ] Implement `dg -a "PROMPT"` — natural language git operations
  - Example: `dg -a "Need to reverse all current commits and need the last one on i had in 21/06/2026"`
  - AI analyzes intent, suggests git commands, confirms with user
- [ ] Add commit history viewer
- [ ] Support for conventional commit types config
- [ ] Add spinner loader (ora)

### Long-term (v2.0)
- [ ] Full code restructuring into `src/commands/`, `src/core/`, `src/ui/`
- [ ] Plugin system for custom AI providers
- [ ] Interactive diff viewer
- [ ] Multi-language commit messages
- [ ] Git hooks integration

---

## 🛠 Development Guide

### Setup

```bash
# Clone the repository
git clone https://github.com/thinakaranmanokaran/dgit-ai-commit.git
cd dgit-ai-commit

# Install dependencies
npm install

# Link globally for testing
npm link
```

### Testing

```bash
# Test in any Git repo
cd /path/to/test-repo
dg add
dg commit
dg push
```

### Project Conventions

- **Language:** JavaScript (ESM)
- **Node:** >= 18
- **Style:** No linter configured yet
- **Commits:** Should use the tool itself (dogfooding)

### Adding a New Command

1. Add command definition in `bin/dg.js` using `program.command()`
2. Implement business logic in `src/` (or planned `src/commands/`)
3. Add UI components in `components/` if needed
4. Export and import as ESM module

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GROQ_API_KEY` | Not used (uses config file) | No |

---

## 📄 Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `bin/dg.js` | CLI entry point | ✅ Active |
| `src/ai.js` | GROQ API integration | ✅ Active |
| `src/git.js` | Git operations | ✅ Active |
| `src/config.js` | API key config | ✅ Active |
| `src/utils.js` | Utilities | ✅ Active |
| `components/commit.js` | Commit UI flow | ✅ Active |
| `components/logo.js` | Banner display | ✅ Active |
| `src/commands/` | Command modules | 📁 Empty |
| `src/core/` | Core logic | 📁 Empty |
| `src/ui/` | UI components | 📁 Empty |
| `IDEA.md` | Original idea | 📝 Notes |
| `TODO.md` | Task list | 📝 Notes |
| `COMMENTS.md` | Code comments doc | 📝 Empty |
| `CLAUDE.md` | This file | ✅ Active |

---

## 👨‍💻 Author

**Thinakaran Manokaran**
- Website: [https://thinakaran.dev](https://thinakaran.dev)
- GitHub: [@thinakaranmanokaran](https://github.com/thinakaranmanokaran)

---

## 📜 License

MIT License — See [LICENSE](LICENSE) for details.