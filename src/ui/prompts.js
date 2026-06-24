/**
 * src/ui/prompts.js
 *
 * Shared interactive-UI building blocks. Pulled out of the old
 * src/utils.js "grab bag" so each piece has one job:
 *  - spinner(): themed ora spinner (replaces the old hand-rolled
 *    text loader — same idea, nicer rendering, still brand-colored)
 *  - formatChoice(): renders a single AI commit option as a list item
 *  - listenForF2(): raw-mode keypress listener used to race against
 *    inquirer's own prompt (unchanged behavior from the original CLI)
 *  - confirmTyped(): "type CONFIRM to proceed" gate for destructive
 *    AI agent operations
 */

import readline from "readline";
import ora from "ora";
import inquirer from "inquirer";
import { color, icon } from "./theme.js";

/**
 * Starts a themed spinner. Returns the ora instance — call
 * `.succeed(text)`, `.fail(text)`, or `.stop()` on it when done.
 * @param {string} text
 */
export function spinner(text) {
    return ora({
        text: color.muted(text),
        color: "yellow", // closest ora named color to the brand orange
        spinner: "dots",
    }).start();
}

/** Renders one AI-generated commit option for the inquirer list prompt. */
export function formatChoice(opt) {
    return (
        icon.bullet +
        " " +
        color.accent.bold(opt.title) +
        (opt.description ? color.muted("\n   " + opt.description) : "")
    );
}

/**
 * Listens for an F2 keypress and invokes `onF2` exactly once.
 * Returns a cleanup function that removes the listener and restores
 * the terminal's raw mode state. Unchanged from the original
 * implementation — this is load-bearing for the commit-edit race.
 * @param {() => void} onF2
 */
export function listenForF2(onF2) {
    readline.emitKeypressEvents(process.stdin);

    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
    }

    const handler = (str, key) => {
        if (key && key.name === "f2") {
            onF2();
        }
    };

    process.stdin.on("keypress", handler);

    return () => {
        process.stdin.removeListener("keypress", handler);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        // Without this, the 'data' listener readline attaches internally
        // keeps stdin in flowing mode and can prevent the process from
        // exiting on its own once the command finishes.
        process.stdin.pause();
    };
}

/**
 * Standard yes/no confirmation.
 * @param {string} message
 * @param {boolean} [defaultValue]
 */
export async function confirm(message, defaultValue = true) {
    const { ok } = await inquirer.prompt([
        { type: "confirm", name: "ok", message, default: defaultValue },
    ]);
    return ok;
}

/**
 * Extra-strict confirmation for destructive operations: the user
 * must type the literal word CONFIRM (case-insensitive), not just
 * press Enter. Used before executing a "destructive" AI agent plan.
 * @param {string} message
 */
export async function confirmTyped(message) {
    console.log(color.error.bold(`\n${icon.warn} ${message}`));
    const { typed } = await inquirer.prompt([
        {
            type: "input",
            name: "typed",
            message: `Type ${color.accent.bold("CONFIRM")} to proceed, or anything else to cancel:`,
        },
    ]);
    return typed.trim().toUpperCase() === "CONFIRM";
}
