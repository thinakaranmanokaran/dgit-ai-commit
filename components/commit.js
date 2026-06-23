#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import { generateCommitOptions } from "../src/ai.js";
import { gitAddAll, gitCommit, gitPush, getBranches, gitInit, commitToOwn, hasCommits } from "../src/git.js";
import { execSync } from "child_process";
import { formatChoice, listenForF2, VerifyRemoteRepo, hasChanges, hasUnstagedChanges, ensureAPIKey, isGitRepo, ensureGitRepo, startLoader, stopLoader } from "../src/utils.js";
import enquirer from "enquirer";

const { Input } = enquirer;

export async function commitMessage() {
    const diff = execSync("git diff --cached").toString();
    if (!diff.trim()) {
        console.log(chalk.yellow("⚠ No staged changes. Use 'dg add' to stage files first."));

        const { addNow } = await inquirer.prompt([
            {
                type: "confirm",
                name: "addNow",
                message: "Do you want to stage all files now?",
                default: true
            }
        ]);

        if (addNow) {
            await gitAddAll();
            console.log(chalk.green("✔ Files staged"));
        } else {
            console.log(chalk.red("❌ Commit aborted."));
            return;
        }
    }

    const key = await ensureAPIKey();

    let options = [];

    // 🔁 LOOP for regenerate
    while (true) {
        // Loader frames defined once — not re-created on every iteration
        const LOADER_FRAMES = [
            "Generating commit options.  ",
            "Generating commit options.. ",
            "Generating commit options..."
        ];

        while (true) {

            // ── Generate (runs once per iteration, including regen) ───────────────
            const loadingInterval = startLoader(LOADER_FRAMES);
            options = await generateCommitOptions(key);
            stopLoader(loadingInterval);
            // ↑ stopLoader already clears the line — the dead clearInterval below is removed

            let currentSelection = options[0];

            console.log(
                chalk.green("✔ Commit options ready ") +
                chalk.gray("(press F2 to edit)\n")
            );

            const choices = [
                ...options.map(opt => ({
                    name: formatChoice(opt),
                    value: { type: "select", data: opt },
                    short: opt.title
                })),
                new inquirer.Separator(),
                { name: chalk.yellow("✏️  Edit message"), value: { type: "edit" } },
                { name: chalk.cyan("🔄 Regenerate"), value: { type: "regen" } }
            ];

            // ── F2 race ───────────────────────────────────────────────────────────
            let stopListening;

            const f2Promise = new Promise(resolve => {
                stopListening = listenForF2(() => resolve({ type: "edit" }));
                // promptUI.close() removed — listenForF2 resolving the race is enough;
                // inquirer cleans up when the outer prompt promise is abandoned.
            });

            const promptPromise = inquirer
                .prompt([{
                    type: "list",
                    name: "selected",
                    message: "",
                    choices,
                    loop: true,
                    prefix: "",
                    pageSize: 10,
                    // onRender removed — writing to stdout inside onRender fires on
                    // every keypress and causes duplicate lines / visual glitches.
                    // Description is shown via formatChoice() in the choice label instead.
                }])
                .then(res => res.selected);

            const result = await Promise.race([f2Promise, promptPromise]);
            stopListening();

            // ── Regen — no extra API call here, continue hits the top ─────────────
            if (result.type === "regen") {
                continue;   // ← loop top calls generateCommitOptions() exactly once
            }

            // ── Edit ──────────────────────────────────────────────────────────────
            if (result.type === "edit") {
                const defaultMsg =
                    currentSelection?.title ||
                    options[0]?.title ||
                    "chore: update files";

                console.log(chalk.gray(`\nselected: ${defaultMsg}\n`));

                const input = new Input({
                    message: "✏️  Edit commit message (press tab):",
                    initial: defaultMsg,
                    prefix: ""
                });

                const custom = await input.run();

                if (!custom.trim()) {
                    console.log(chalk.red("❌ Empty message.\n"));
                    continue;
                }

                await gitCommit(custom);
                console.log(chalk.green("✅ Commit successful"));
                return;
            }

            // ── Select ────────────────────────────────────────────────────────────
            if (result.type === "select") {
                const { title, description } = result.data;
                const body = description?.trim() || "update project files";
                await gitCommit(`${title}\n\n${body}`);
                console.log(chalk.green("✅ Commit successful"));
                return;
            }
        }
    }
}