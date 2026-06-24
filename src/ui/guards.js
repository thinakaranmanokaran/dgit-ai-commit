/**
 * src/ui/guards.js
 *
 * Small pre-flight checks shared by every command.
 */

import { isGitRepo } from "../core/git.js";
import { color, icon } from "./theme.js";

/** Exits the process with an error message if the CWD isn't a Git repo. */
export function ensureGitRepo() {
    if (!isGitRepo()) {
        console.log(color.error(`${icon.fail} Not a Git repository. Run 'git init' first.`));
        process.exit(1);
    }
}
