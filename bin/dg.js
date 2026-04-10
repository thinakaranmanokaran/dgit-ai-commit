#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { generateCommitOptions } from "../src/ai.js";
import { gitAddAll, gitCommit, gitPush, getBranches, gitInit, commitToOwn, hasCommits } from "../src/git.js";
import { getAPIKey, setAPIKey } from "../src/config.js";
import { execSync } from "child_process";
import { formatChoice, listenForF2, VerifyRemoteRepo, hasChanges, hasUnstagedChanges, ensureAPIKey, isGitRepo, ensureGitRepo, startLoader, stopLoader, hasStagedChanges, hasUnpushedCommits } from "../src/utils.js";
import enquirer from "enquirer";
import { showBannerOnce } from "../components/logo.js";
import { commitMessage } from "../components/commit.js";

const { Input } = enquirer;
const program = new Command();

program
    .name("dg")
    .description("AI-powered Git CLI")
    .version("1.0.0");


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
        await commitMessage();

    });

// 📌 PUSH
program.command("push [branch]")
    .description("Commit + Push with AI message")
    .action(async (branchArg) => {
        ensureGitRepo();
        showBannerOnce();

        //Verify Git add. 
        if (!hasChanges() && !hasUnpushedCommits()) {
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
            await commitToOwn();
        }

        //Staged changes not commited 
        if (hasStagedChanges()) {
            await commitMessage();
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
                
                // console.log("Branches:", branches);
                // console.log("Selected:", branch);
            }
            
            await gitPush("-o", branch);

            console.log(chalk.green(`🚀 Pushed to ${branch}`));
        }
    });

// 📌 HELP DEFAULT
program.action(() => {
    showBannerOnce();
    program.help();
});

program.parse(process.argv);