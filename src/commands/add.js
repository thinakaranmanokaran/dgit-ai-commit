/**
 * src/commands/add.js — `dg add`
 */

import { gitAddAll } from "../core/git.js";
import { icon } from "../ui/theme.js";

/** Stages every change in the working tree and reports success. */
export async function runAdd() {
    await gitAddAll();
    console.log(`${icon.ok} Files staged`);
}
