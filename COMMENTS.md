# COMMENTS.md — Code Reference

A function-by-function reference for every module in `src/`. This is the
"what does this actually do" companion to `CLAUDE.md` (which covers the
bigger architectural picture and data flow).

---

## `src/core/git.js`

Safe wrapper around the Git CLI. **Every** function here calls
`execFileSync(cmd, argsArray)` — never a shell string — so nothing passed
through (a commit message, an AI-suggested command) can ever be interpreted
by a shell.

| Function | Returns | Notes |
|---|---|---|
| `gitInit()` | — | `git init`, output inherited to the terminal |
| `gitAddAll()` | — | `git add .` |
| `gitCommit(title, description?)` | — | `title` and `description` are each their own `-m` argument |
| `gitPush(branch, opts?)` | — | `opts.remote` defaults to `"origin"` |
| `getBranches()` | `string[]` | Local branches, `*` marker stripped |
| `getCurrentBranch()` | `string` | `""` if detached/no branch |
| `hasCommits()` | `boolean` | `git rev-parse --verify HEAD` |
| `isGitRepo()` | `boolean` | `git rev-parse --is-inside-work-tree` |
| `hasChanges()` | `boolean` | Any staged, unstaged, or untracked change |
| `hasStagedChanges()` | `boolean` | `git diff --cached` is non-empty |
| `hasUnstagedChanges()` | `boolean` | Unstaged diff OR untracked files |
| `hasUnpushedCommits()` | `boolean` | `git log @{u}..HEAD`; `false` if no upstream |
| `verifyRemoteRepo()` | `boolean` | At least one remote configured |
| `getStagedDiff()` | `string` | Binary-file lines filtered out, used for AI commit generation |
| `getRecentLog(count = 30)` | `string` | `hash \| dd/mm/yyyy \| subject` lines, used as agent context |
| `getStatusPorcelain()` | `string` | `git status --porcelain` |
| `getRemotes()` | `string` | `git remote -v` |
| `runGitArgs(args)` | — | Generic safe executor; the **only** path `agent.js` uses to run git |
| `isDestructiveCommand(commandStr)` | `boolean` | Regex check (`reset --hard`, `push --force`, `rebase`, `branch -D`, etc.) — a second opinion alongside the AI's own risk label |
| `tokenizeGitCommand(commandStr)` | `string[] \| null` | Splits a `"git ..."` string into args; `null` if it doesn't start with `git` |

---

## `src/core/ai.js`

All GROQ API communication. Internally shares one `callGroq(apiKey, model, prompt, temperature)` helper and one `parseJsonResponse(text)` helper that strips ```` ```json ```` fences before `JSON.parse`.

| Function | Returns | Notes |
|---|---|---|
| `generateCommitOptions(apiKey, opts?)` | `Promise<Array<{title, description}>>` | `opts.diff` lets a caller pass a pre-fetched diff (used by the cache layer); diff truncated to 10,000 chars; falls back to a generic `chore: update files` option on any error |
| `planGitOperations(apiKey, userPrompt, context)` | `Promise<{explanation, riskLevel, commands}>` | `context` is `{ branch, log, status, branches, remotes }`; falls back to an empty-commands response with an explanation on any network/parse failure rather than throwing |

---

## `src/core/config.js`

Reads/writes `~/.dgconfig.json`. All functions are synchronous.

| Function | Returns | Notes |
|---|---|---|
| `getAPIKey()` | `string \| null` | |
| `setAPIKey(key)` | — | Merges into existing config, doesn't clobber other keys |
| `getCommitModel()` | `string` | Defaults to `llama-3.1-8b-instant` |
| `getAgentModel()` | `string` | Defaults to `llama-3.3-70b-versatile` |

---

## `src/core/cache.js`

Best-effort disk cache under `os.tmpdir()/dgit-cache`. Every function
swallows its own errors — a cache failure must never break the actual CLI
command.

| Function | Returns | Notes |
|---|---|---|
| `hashContent(content)` | `string` | First 16 hex chars of a SHA-256 hash |
| `getCached(key)` | `* \| null` | `null` if missing or older than the 10-minute TTL |
| `setCached(key, value)` | — | |

---

## `src/ui/theme.js`

The shared visual language. Nothing here touches the banner.

| Export | Type | Notes |
|---|---|---|
| `COLORS` | object | Hex values matching the banner's palette |
| `color` | object of chalk functions | `color.primary`, `color.muted`, `color.error`, etc. |
| `icon` | object of strings | Pre-colored single glyphs: `ok`, `fail`, `warn`, `info`, `arrow`, `bullet`, `robot`, `spark` |
| `panel(title, lines, opts?)` | function → `string` | Thin-border box; flattens `\n` inside any line and word-wraps with `wrap-ansi` so the border always lines up, even with emoji titles |
| `divider(label?)` | function → `string` | A plain horizontal rule (not boxed) |
| `riskBadge(level)` | function → `string` | Colored `SAFE` / `CAUTION` / `DESTRUCTIVE` background badge |

---

## `src/ui/banner.js`

Moved verbatim from `components/logo.js`. `showBannerOnce()` is the only
export — prints the ASCII banner once per process (tracked via a temp file
keyed by PID), and never throws (a banner failure must never block the
actual command). **Do not edit the art inside this file.**

---

## `src/ui/prompts.js`

| Function | Returns | Notes |
|---|---|---|
| `spinner(text)` | `ora` instance | Themed `ora` spinner; call `.succeed()`/`.fail()`/`.stop()` on it |
| `formatChoice(opt)` | `string` | Renders one AI commit option for the inquirer list |
| `listenForF2(onF2)` | cleanup function | Raw-mode keypress listener; the returned function removes the listener, restores cooked mode, **and pauses stdin** so the process can exit cleanly afterward |
| `confirm(message, defaultValue?)` | `Promise<boolean>` | Standard y/N |
| `confirmTyped(message)` | `Promise<boolean>` | True only if the user types the literal word `CONFIRM` |

---

## `src/ui/setup.js`

| Function | Returns | Notes |
|---|---|---|
| `ensureAPIKey()` | `Promise<string>` | Returns the saved key, or prompts for and saves one if missing |

---

## `src/ui/guards.js`

| Function | Returns | Notes |
|---|---|---|
| `ensureGitRepo()` | — | `process.exit(1)` with a message if the CWD isn't a git repo |

---

## `src/ui/commitFlow.js`

| Function | Returns | Notes |
|---|---|---|
| `commitMessage()` | `Promise<void>` | The full interactive flow: stage check → cache check → generate → display → F2-race → select/edit/regenerate loop |

---

## `src/commands/*.js`

Thin glue — each file exports one `run<Name>()` async function that
`bin/dg.js` calls. They contain no `child_process` calls of their own
(delegating to `core/git.js`) and no raw `console.log` color codes
(delegating to `ui/theme.js`).

| File | Export | Notes |
|---|---|---|
| `init.js` | `runInit()` | |
| `add.js` | `runAdd()` | |
| `commit.js` | `runCommit()` | Just calls `commitFlow.js#commitMessage()` |
| `push.js` | `runPush(branchArg?)` | Stage → commit (if staged) → verify remote → push |
| `agent.js` | `runAgent(userPrompt)` | The natural-language agent — see `CLAUDE.md` for the full flow diagram |

---

## `bin/dg.js`

Not a module others import from — the CLI entry point itself. Defines
Commander commands, wraps every action in `withErrorBoundary()`, and uses
`parseAsync()` + an explicit `process.exit()` at the end so the process
always terminates cleanly once its work is actually done.
