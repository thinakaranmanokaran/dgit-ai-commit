/**
 * src/commands/push.js — `dg push [branch]`
 *
 * Workflow:
 *   1. Bail if there's nothing to commit or push
 *   2. Offer to stage unstaged changes
 *   3. Run the commit flow if there are staged changes (works for the
 *      very first commit just as well as any later one — git doesn't
 *      need special handling for "no history yet")
 *   4. Verify a remote is configured
 *   5. Push (prompting for a branch if not given)
 *
 * NOTE: the original implementation called `execSync("dg commit")` —
 * spawning a brand-new dg process — for the "no commits yet" case.
 * That's fragile (requires `dg` to already be globally resolvable on
 * PATH, doubles startup cost, and can hang if that child process ever
 * needs interactive input in a non-TTY context). It's also redundant:
 * the very next check already calls the same commit flow in-process
 * for staged changes. Removed in favor of one direct call.
 */

import inquirer from "inquirer";
import {
    gitAddAll,
    gitPush,
    getBranches,
    hasChanges,
    hasUnstagedChanges,
    hasStagedChanges,
    hasUnpushedCommits,
    verifyRemoteRepo,
} from "../core/git.js";
import { commitMessage } from "../ui/commitFlow.js";
import { confirm } from "../ui/prompts.js";
import { color, icon } from "../ui/theme.js";

/** @param {string} [branchArg] */
export async function runPush(branchArg) {
    if (!hasChanges() && !hasUnpushedCommits()) {
        console.log(color.error(`${icon.fail} No changes to commit or push.`));
        return;
    }

    if (hasUnstagedChanges()) {
        const addNow = await confirm("Unstaged changes found. Add all files?");
        if (addNow) {
            await gitAddAll();
            console.log(`${icon.ok} Files staged`);
        } else {
            console.log(color.error(`${icon.fail} Push aborted.`));
            return;
        }
    }

    if (hasStagedChanges()) {
        await commitMessage();
    }

    if (!verifyRemoteRepo()) {
        console.log(
            color.error(
                "Changes committed but no remote is configured. Run 'git remote add origin <url>' and try again."
            )
        );
        return;
    }

    let branch = branchArg;

    if (!branch) {
        const branches = await getBranches();
        const answer = await inquirer.prompt([
            { type: "list", name: "branch", message: "Select branch:", choices: branches },
        ]);
        branch = answer.branch;
    }

    gitPush(branch);
    console.log(color.success(`🚀 Pushed to ${branch}`));
}
