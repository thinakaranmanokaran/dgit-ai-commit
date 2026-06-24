# DGit — Task Plan

> Source plan derived from `IDEA.md` + `CLAUDE.md` roadmap. Assigned and executed by Claude.

## Assigned Tasks

- [x] **1. Restructure codebase** into `src/commands/`, `src/core/`, `src/ui/` (per CLAUDE.md long-term roadmap). Retired the flat `src/*.js` + `components/` layout.
- [x] **2. Fix shell-injection risk** in `gitCommit()` — replaced all `execSync` string interpolation with `execFileSync(cmd, argsArray)` across git operations (no shell string ever built from dynamic input).
- [x] **3. Implement the killer feature**: `dg -a "PROMPT"` / `dg agent "PROMPT"` — natural language → Git operations. Gathers repo context (log w/ dates, status, branch, remotes), asks AI to propose a command plan + risk level, shows it for confirmation, then executes safely (git-only, tokenized, destructive ops need typed "CONFIRM").
- [x] **4. Optimize speed** — added a short-TTL disk cache keyed by diff hash so re-running `dg commit` on an unchanged diff doesn't re-hit the API. Regenerate always bypasses cache.
- [x] **5. UI pass (opencode-inspired, banner untouched)** — added `src/ui/theme.js` with a consistent palette/icon set matching the existing banner colors, thin-border panels for AI output, replaced the manual text loader with a themed `ora` spinner. **Banner art in `.banner` / `src/ui/banner.js` is byte-for-byte unchanged.**
- [x] **6. Remove unused deps** — dropped `gradient-string` (never used). Kept `ora` (now actually used for the spinner).
- [x] **7. Add JSDoc** to all exported functions in `src/core/*` and `src/ui/*`.
- [x] **8. Add error boundaries** — top-level try/catch in `bin/dg.js` around every command action so failures print a clean message instead of a raw stack trace.
- [x] **9. Document everything in `COMMENTS.md`** — module-by-module reference of every exported function.
- [x] **10. Update `README.md` / `CLAUDE.md`** to reflect the new structure and the new `agent` command.

## Verification

Everything above was actually run, not just written:
- Full CLI smoke-tested in scratch git repos (`init`/`add`/`commit`/`push`/`agent`)
- `generateCommitOptions` and `planGitOperations` tested against mocked GROQ
  responses, including markdown-fenced JSON
- Confirmed a model mislabeling a destructive plan as "safe" still gets
  escalated to the typed-`CONFIRM` path by the local regex check
- Confirmed a hallucinated non-`git` command anywhere in a plan halts
  execution immediately
- Found and fixed a real hang risk: the F2 keypress listener was leaving
  stdin in flowing mode, which could prevent the process from exiting;
  also replaced a fragile `execSync("dg commit")` self-spawn in `push`
  with a direct in-process call
- Clean-room test: fresh `npm install` + `npm link` from the zip contents,
  confirmed `dg --version` / `dg --help` work with no leftover local state

## Still open (good next steps, not done in this pass)

- [ ] Commit history viewer (`dg log` with AI summaries)
- [ ] Plugin system for alternate AI providers (OpenAI/Anthropic as alternatives to GROQ)
- [ ] Config command (`dg config set model ...`) instead of hand-editing `~/.dgconfig.json`
- [ ] Multi-language commit message output
- [ ] Git hooks integration (auto-suggest on `pre-commit`)
