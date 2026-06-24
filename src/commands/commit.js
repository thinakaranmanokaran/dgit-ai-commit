/**
 * src/commands/commit.js — `dg commit`
 */

import { commitMessage } from "../ui/commitFlow.js";

/** Runs the interactive AI commit-message flow. */
export async function runCommit() {
    await commitMessage();
}
