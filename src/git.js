import { execSync } from "child_process";

export function gitInit() {
    execSync("git init", { stdio: "inherit" });
}

export function gitAddAll() {
    execSync("git add .", { stdio: "inherit" });
}

export function gitCommit(message) {
    execSync(`git commit -m "${message}"`, { stdio: "inherit" });
}

export function gitPush(access, branch) {
    let command;

    if (access === "-o") {
        command = `git push origin ${branch}`;
    } else {
        command = `git push ${branch}`;
    }

    execSync(command, { stdio: "inherit" });
}

export function getBranches() {
    const output = execSync("git branch").toString();

    return output
        .split("\n")
        .map(b => b.replace("*", "").trim())
        .filter(Boolean);
}

export function commitToOwn() {
    execSync("dg commit", { stdio: "inherit" });
}

export function hasCommits() {
    try {
        execSync("git rev-parse --verify HEAD", { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}