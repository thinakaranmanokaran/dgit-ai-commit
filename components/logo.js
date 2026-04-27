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

// 🚀 Exported function
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