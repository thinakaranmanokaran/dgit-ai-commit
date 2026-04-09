import chalk from "chalk";
import { execSync } from "child_process";
import readline from "readline";

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
    return !!execSync("git diff").toString().trim();
}