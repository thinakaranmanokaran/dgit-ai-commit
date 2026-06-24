/**
 * src/commands/init.js — `dg init`
 */

import { isGitRepo, gitInit } from "../core/git.js";
import { color, icon } from "../ui/theme.js";

/** Initializes a new Git repository if one doesn't already exist here. */
export async function runInit() {
    if (isGitRepo()) {
        console.log(color.warn(`${icon.warn} Already a Git repository.`));
    } else {
        gitInit();
    }
    console.log(`${icon.ok} Git Initiated`);
}
