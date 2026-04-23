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

        // 🔄 Loader
        const loading = [
            "Generating commit options.  ",
            "Generating commit options.. ",
            "Generating commit options..."
        ];

        const loadingInterval = startLoader(loading);

        // async call
        options = await generateCommitOptions(key);

        stopLoader(loadingInterval);
        let currentSelection = options[0];

        clearInterval(() => loadingInterval(loading));
        process.stdout.write("\r" + " ".repeat(60) + "\r");

        console.log(
            chalk.green("✔ Commit options ready ") +
            chalk.gray("(press F2 to edit)\n")
        );

        // 🎯 Add special options
        const choices = [
            ...options.map(opt => ({
                name: formatChoice(opt),
                value: { type: "select", data: opt },
                short: opt.title
            })),
            new inquirer.Separator(),
            {
                name: chalk.yellow("✏️  Edit message"),
                value: { type: "edit" }
            },
            {
                name: chalk.cyan("🔄 Regenerate"),
                value: { type: "regen" }
            }
        ];


        let stopListening;
        let promptUI;

        const f2Promise = new Promise((resolve) => {
            stopListening = listenForF2(() => {
                if (promptUI) {
                    promptUI.close(); // 🔥 force close inquirer
                }
                resolve({ type: "edit" });
            });
        });

        const prompt = inquirer.prompt([
            {
                type: "list",
                name: "selected",
                message: "",
                choices,
                loop: true,
                prefix: "",
                pageSize: 10,
                onRender() {
                    const val = this.getCurrentValue();

                    if (val?.type === "select") {
                        currentSelection = val.data;

                        process.stdout.write(
                            "\n" +
                            chalk.gray("Description: ") +
                            chalk.white(currentSelection.description || "No description") +
                            "\n"
                        );
                    }
                }
            }
        ]);

        promptUI = prompt.ui; // 🔥 IMPORTANT

        const promptPromise = prompt.then(res => res.selected);

        // 🧠 Race: F2 vs selection
        const result = await Promise.race([
            f2Promise,
            promptPromise
        ]);

        // 🛑 stop key listener
        stopListening();

        // ✅ HANDLE CASES

        // 🔄 Regenerate
        if (result.type === "regen") {
            // console.log(chalk.gray("\n
            // cted: 🔄 Regenerate\n"));

            const regenLoading = [
                "Regenerating.  ",
                "Regenerating.. ",
                "Regenerating..."
            ];

            const regenInterval = startLoader(regenLoading);

            options = await generateCommitOptions(key);

            stopLoader(regenInterval);

            continue; // 🔥 go back to loop → prints ONCE
        }

        if (result.type === "edit") {
            const defaultMsg =
                currentSelection?.title ||
                options[0]?.title ||
                "chore: update files";

            console.log(chalk.gray(`\nselected: ${defaultMsg}\n`));

            const prompt = new Input({
                message: "✏️  Edit commit message (press tab):",
                initial: defaultMsg, // 🔥 REAL editable prefill
                prefix: ""
            });

            const custom = await prompt.run();

            if (!custom.trim()) {
                console.log(chalk.red("❌ Empty message.\n"));
                continue;
            }

            await gitCommit(custom);
            console.log(chalk.green("✅ Commit successful"));
            return;
        }

        if (result.type === "select") {
            const opt = result.data;

            const description =
                opt.description && opt.description.trim()
                    ? opt.description
                    : "update project files";

            const finalMessage = `${opt.title}\n\n${description}`;

            await gitCommit(finalMessage);
            console.log(chalk.green("✅ Commit successful"));
            return;
        }
    }
}