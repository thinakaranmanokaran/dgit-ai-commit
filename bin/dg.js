#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { generateCommitOptions } from "../src/ai.js";
import { gitAddAll, gitCommit, gitPush, getBranches, gitInit, commitToOwn, hasCommits } from "../src/git.js";
import { getAPIKey, setAPIKey } from "../src/config.js";
import { execSync } from "child_process";
import { formatChoice, listenForF2, VerifyRemoteRepo, hasChanges, hasUnstagedChanges } from "../src/utils.js";
import gradient from "gradient-string";
import enquirer from "enquirer";
import fs from "fs";
import os from "os";
import path from "path";
const { Input } = enquirer;

const program = new Command();
const SESSION_FILE = path.join(os.tmpdir(), "dg-banner-shown");

// 🎨 Gradient (pink → purple)
const gradientText = gradient(["#ff00cc", "#3333ff"]);

// 📏 Center function
function centerText(text) {
    const width = process.stdout.columns || 80;
    return text
        .split("\n")
        .map(line => {
            const padding = Math.max(0, Math.floor((width - line.length) / 2));
            return " ".repeat(padding) + line;
        })
        .join("\n");
}

// 🎯 Your ASCII Logo
const logo = `
   █████████   ███   █████         █████████   █████                                                       ███   █████   
  ███░░░░░███ ░░░   ░░███         ███░░░░░███ ░░███                                                       ░░░   ░░███    
 ███     ░░░  ████  ███████      ░███    ░███  ░███      ██████   ██████  █████████████   █████████████   ████  ███████  
░███         ░░███ ░░░███░       ░███████████  ░███     ███░░███ ███░░███░░███░░███░░███ ░░███░░███░░███ ░░███ ░░░███░   
░███    █████ ░███   ░███        ░███░░░░░███  ░███    ░███ ░░░ ░███ ░███ ░███ ░███ ░███  ░███ ░███ ░███  ░███   ░███    
░░███  ░░███  ░███   ░███ ███    ░███    ░███  ░███    ░███  ███░███ ░███ ░███ ░███ ░███  ░███ ░███ ░███  ░███   ░███ ███
 ░░█████████  █████  ░░█████     █████   █████ █████   ░░██████ ░░██████  █████░███ █████ █████░███ █████ █████  ░░█████ 
  ░░░░░░░░░  ░░░░░    ░░░░░     ░░░░░   ░░░░░ ░░░░░     ░░░░░░   ░░░░░░  ░░░░░ ░░░ ░░░░░ ░░░░░ ░░░ ░░░░░ ░░░░░    ░░░░░  
`;

// 👤 Author line
const author1 = chalk.gray("\nAuthor :");
const author2 = chalk.white(" Thinakaran Manokaran ");
const author3 = chalk.gray("(https://thinakaran.dev/)\n");

// 🎨 Print
function showBannerOnce() {
    if (!fs.existsSync(SESSION_FILE)) {
        console.log(
            gradientText(centerText(logo)) +
            centerText(author1 + author2 + author3)
        );

        fs.writeFileSync(SESSION_FILE, "shown");
    }
}

// console.log(chalk.cyan.bold("\n🚀 DG - AI Git Assistant\n"));

program
    .name("dg")
    .description("AI-powered Git CLI")
    .version("1.0.0");

// 🔑 First-time setup
async function ensureAPIKey() {
    let key = getAPIKey();

    if (!key) {
        const answer = await inquirer.prompt([
            {
                type: "input",
                name: "apiKey",
                message: "Enter your GROQ API Key (Get it from https://console.groq.com/keys):"
            }
        ]);

        setAPIKey(answer.apiKey);
        console.log(chalk.green("✅ API Key saved!"));
        return answer.apiKey;
    }

    return key;
}

// ✅ Sync check (no async needed)
function isGitRepo() {
    try {
        execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

// ✅ Reusable guard
function ensureGitRepo() {
    if (!isGitRepo()) {
        console.log(chalk.red("❌ Not a Git repository. Run 'git init' first."));
        process.exit(1);
    }
}

function startLoader(textArr) {
    let i = 0;

    const interval = setInterval(() => {
        process.stdout.write(`\r${chalk.cyan(textArr[i % textArr.length])}`);
        i++;
    }, 400);

    return interval;
}

function stopLoader(interval) {
    clearInterval(interval);
    process.stdout.write("\r" + " ".repeat(60) + "\r");
}

// 📌 INIT
program.command("init")
    .description("Initialize a new Git repository")
    .action(async () => {
        if (isGitRepo()) {
            console.log(chalk.yellow("⚠ Already a Git repository."));
        } else {
            await gitInit();
        }
        console.log(chalk.green("✔ Git Initiated"));
    });

// 📌 ADD
program.command("add")
    .description("Stage all files")
    .action(async () => {
        ensureGitRepo();
        showBannerOnce();
        await gitAddAll();
        console.log(chalk.green("✔ Files staged"));
    });

// 📌 COMMIT
program.command("commit")
    .description("Generate AI commit message & commit")
    .action(async () => {
        ensureGitRepo();
        showBannerOnce();

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

            options = await generateCommitOptions(key);

            stopLoader(loadingInterval);

            options = await generateCommitOptions(key);
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

                const finalMessage = opt.description
                    ? `${opt.title}\n\n${opt.description}`
                    : opt.title;

                await gitCommit(finalMessage);
                console.log(chalk.green("✅ Commit successful"));
                return;
            }
        }
    });

// 📌 PUSH
program.command("push [branch]")
    .description("Commit + Push with AI message")
    .action(async (branchArg) => {
        ensureGitRepo();
        showBannerOnce();

        //Verify Git add. 
        if (!hasChanges()) {
            console.log(chalk.red("❌ No changes to commit or push."));
            return;
        }

        // 👉 Handle unstaged changes
        if (hasUnstagedChanges()) {
            const { addNow } = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "addNow",
                    message: "Unstaged changes found. Add all files?",
                    default: true
                }
            ]);

            if (addNow) {
                await gitAddAll();
                console.log(chalk.green("✔ Files staged"));
            } else {
                console.log(chalk.red("❌ Push aborted."));
                return;
            }
        }

        // Ensure committed 
        if (!hasCommits()) {
            console.log(chalk.yellow("⚠ No commits found. Creating initial commit..."));

            const { commitNow } = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "commitNow",
                    message: "Do you want to create initial commit?",
                    default: true
                }
            ]);

            if (commitNow) {
                await gitAddAll();

                await ensureAPIKey();
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

                    options = await generateCommitOptions(key);

                    stopLoader(loadingInterval);

                    options = await generateCommitOptions(key);
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

                        const finalMessage = opt.description
                            ? `${opt.title}\n\n${opt.description}`
                            : opt.title;

                        await gitCommit(finalMessage);
                        console.log(chalk.green("✅ Commit successful"));
                        return;
                    }
                }

                // await gitCommit(message || "initial commit");

                console.log(chalk.green("✅ Initial commit created"));
            } else {
                console.log(chalk.red("❌ Push aborted."));
                return;
            }
        }
        console.log("Repo :" + VerifyRemoteRepo());
        if (!VerifyRemoteRepo()) {
            console.log(chalk.red("Changes committed but Remote repository cannot be push. U need to add remote repository url. Use 'git remote add origin <url>' to add remote repository."));
        } else {
            let branch = branchArg;

            if (!branch) {
                const branches = await getBranches();

                const answer = await inquirer.prompt([
                    {
                        type: "list",
                        name: "branch",
                        message: "Select branch:",
                        choices: branches
                    }
                ]);

                branch = answer.branch;
            }

            await gitPush(branch);

            console.log(chalk.green(`🚀 Pushed to ${branch}`));
        }
    });

// 📌 HELP DEFAULT
program.action(() => {
    showBannerOnce();
    program.help();
});

program.parse(process.argv);