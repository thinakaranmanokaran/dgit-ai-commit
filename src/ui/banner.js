/**
 * src/ui/banner.js
 *
 * Displays the DGit ASCII banner once per CLI session.
 *
 * ⚠️ Moved here verbatim from components/logo.js as part of the
 * src/commands · src/core · src/ui restructure. The banner art,
 * colors, and behavior are UNCHANGED — do not edit the glyphs below.
 */

import fs from "fs";
import os from "os";
import path from "path";
import chalk from "chalk";
import stripAnsi from "strip-ansi";

const SESSION_FILE = path.join(os.tmpdir(), `dg-banner-${process.pid}`);

// 🎨 Colors
const PRIMARY = "#FF653F";
const SECONDARY = "#57595B";
const ACCENT = "#ffffff";

const primary = chalk.hex(PRIMARY);
const secondary = chalk.hex(SECONDARY);
const accent = chalk.hex(ACCENT);

// 📏 Center function
const MAX_WIDTH = 100;

function centerText(text) {
    const width = process.stdout.columns || 80;

    return text
        .split("\n")
        .map(line => {
            const visibleLength = stripAnsi(line).length; // ✅ FIX
            const padding = Math.max(0, Math.floor((width - visibleLength) / 2));
            return " ".repeat(padding) + line;
        })
        .join("\n");
}

// 🎯 Build logo correctly
function buildLogo() {
    return [
        secondary("▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄"),
        secondary("█                                                                                       █"),
        secondary("█                                                                                       █"),

        secondary("█     ") +
        primary("██████████     █████████ ") +
        secondary("              █████████  ██████   ██████   █████████ ") +
        secondary("    █"),

        secondary("█    ") +
        primary("░░███░░░░███   ███░░░░░███") +
        secondary("             ███░░░░░███░░██████ ██████   ███░░░░░███") +
        secondary("    █"),

        secondary("█    ") +
        primary(" ░███   ░░███ ███     ░░░ ") +
        secondary("            ███     ░░░  ░███░█████░███  ███     ░░░ ") +
        secondary("    █"),

        secondary("█    ") +
        primary(" ░███    ░███░███         ") +
        secondary("   ██████  ░███          ░███░░███ ░███ ░███         ") +
        secondary("    █"),

        secondary("█    ") +
        primary(" ░███    ░███░███    █████") +
        secondary("  ░░░░░░   ░███          ░███ ░░░  ░███ ░███    █████") +
        secondary("    █"),

        secondary("█    ") +
        primary(" ░███    ███ ░░███  ░░███ ") +
        secondary("           ░░███     ███ ░███      ░███ ░░███  ░░███ ") +
        secondary("    █"),

        secondary("█    ") +
        primary(" ██████████   ░░█████████ ") +
        secondary("            ░░█████████  █████     █████ ░░█████████ ") +
        secondary("    █"),

        secondary("█    ") +
        primary("░░░░░░░░░░     ░░░░░░░░░  ") +
        secondary("             ░░░░░░░░░  ░░░░░     ░░░░░   ░░░░░░░░░  ") +
        secondary("    █"),

        secondary("█                                                                                       █"),
        secondary("█                                                                                       █"),
        secondary("▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀")
    ].join("\n");
}

// 👤 Author
function getAuthor() {
    return centerText(
        chalk.gray("\nAuthor :") +
        chalk.white(" Thinakaran Manokaran ") +
        chalk.gray("(https://thinakaran.dev/)\n")
    );
}

/**
 * Prints the DGit banner exactly once per process (tracked via a
 * temp file keyed by PID). Never throws — a banner failure must
 * never block the actual CLI command from running.
 */
export function showBannerOnce() {
    try {
        if (!fs.existsSync(SESSION_FILE)) {
            console.log(
                centerText(buildLogo()) +
                getAuthor()
            );

            fs.writeFileSync(SESSION_FILE, "shown");
        }
    } catch (e) {
        // never break CLI
    }
}
