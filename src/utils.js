import chalk from "chalk";
import { execSync } from "child_process";
import readline from "readline";
import { getAPIKey, setAPIKey } from "./config.js";
import inquirer from "inquirer";

export function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

export function formatChoice(opt) {
    return (
        chalk.gray("● ") +
        chalk.white.bold(opt.title) +
        (opt.description
            ? chalk.gray("\n   " + opt.description)
            : "")
    );
}

export function listenForF2(onF2) {
    readline.emitKeypressEvents(process.stdin);

    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
    }

    const handler = (str, key) => {
        if (key.name === "f2") {
            onF2();
        }
    };

    process.stdin.on("keypress", handler);

    return () => {
        process.stdin.removeListener("keypress", handler);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
    };
}

export function VerifyRemoteRepo() {
    // verify repo url if url not exist this is repo so return true else false
    try {
        const output = execSync("git remote -v").toString().trim();

        // If no remote configured
        if (!output) return false;

        return true;
    } catch {
        return false;
    }
}

export function hasChanges() {
    const status = execSync("git status --porcelain").toString().trim();
    return !!status;
}

export function hasStagedChanges() {
    return !!execSync("git diff --cached").toString().trim();
}

export function hasUnstagedChanges() {
    const diff = execSync("git diff").toString().trim();
    const untracked = execSync("git ls-files --others --exclude-standard")
        .toString()
        .trim();

    return !!diff || !!untracked;
}

// 🔑 First-time setup
export async function ensureAPIKey() {
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
export function isGitRepo() {
    try {
        execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

// ✅ Reusable guard
export function ensureGitRepo() {
    if (!isGitRepo()) {
        console.log(chalk.red("❌ Not a Git repository. Run 'git init' first."));
        process.exit(1);
    }
}

export function startLoader(textArr) {
    let i = 0;

    const interval = setInterval(() => {
        process.stdout.write(`\r${chalk.cyan(textArr[i % textArr.length])}`);
        i++;
    }, 400);

    return interval;
}

export function stopLoader(interval) {
    clearInterval(interval);
    process.stdout.write("\r" + " ".repeat(60) + "\r");
}

export function hasUnpushedCommits() {
    try {
        const result = execSync("git log @{u}..HEAD").toString().trim();
        return !!result;
    } catch {
        return false;
    }
}