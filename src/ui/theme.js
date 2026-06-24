/**
 * src/ui/theme.js
 *
 * Single source of truth for DGit's visual language.
 *
 * The colors here are pulled directly from the existing banner
 * (src/ui/banner.js) so every screen — banner, prompts, AI panels,
 * spinners — feels like one consistent product instead of a CLI
 * that was bolted together command by command. Nothing in this file
 * touches the banner itself.
 */

import chalk from "chalk";
import stripAnsi from "strip-ansi";
import wrapAnsi from "wrap-ansi";
import stringWidth from "string-width";

// 🎨 Brand palette (kept identical to the banner colors)
export const COLORS = {
    primary: "#FF653F",   // brand orange — headings, key actions
    secondary: "#57595B", // muted gray — borders, secondary text
    accent: "#FFFFFF",    // white — emphasis
    success: "#3FB950",
    error: "#F85149",
    warn: "#E3B341",
    info: "#58A6FF",
};

export const color = {
    primary: chalk.hex(COLORS.primary),
    secondary: chalk.hex(COLORS.secondary),
    accent: chalk.hex(COLORS.accent),
    success: chalk.hex(COLORS.success),
    error: chalk.hex(COLORS.error),
    warn: chalk.hex(COLORS.warn),
    info: chalk.hex(COLORS.info),
    muted: chalk.hex(COLORS.secondary),
};

/** Small consistent icon set used across all command output. */
export const icon = {
    ok: color.success("✔"),
    fail: color.error("✖"),
    warn: color.warn("⚠"),
    info: color.info("ℹ"),
    arrow: color.primary("➜"),
    bullet: color.secondary("●"),
    robot: color.primary("🤖"),
    spark: color.primary("✨"),
};

/**
 * Draws a thin-bordered panel (opencode/modern-TUI style box) around
 * a block of text. Deliberately a *different* visual weight from the
 * thick block-character banner so the banner stays the one "splash"
 * moment, and panels stay light/functional for repeated use.
 *
 * Each entry in `lines` may itself contain "\n" (e.g. a command plus
 * an indented description) — it's flattened and word-wrapped to fit
 * the panel width before the border is drawn, so the border always
 * lines up cleanly.
 *
 * @param {string} title - Panel title shown in the top border.
 * @param {string[]} lines - Pre-formatted (already chalk-colored) lines.
 * @param {{ borderColor?: (s:string)=>string, width?: number }} [opts]
 * @returns {string} The full panel as a printable string.
 */
export function panel(title, lines, opts = {}) {
    const borderColor = opts.borderColor || color.secondary;
    const termWidth = process.stdout.columns || 80;
    const width = Math.min(opts.width || 78, Math.max(40, termWidth - 2));
    const innerWidth = width - 4; // "│ " + content + " │"

    const titleVisible = title ? stringWidth(stripAnsi(title)) : 0;
    const top = title
        ? borderColor("┌─ ") + color.primary.bold(title) + " " +
          borderColor("─".repeat(Math.max(0, width - titleVisible - 5)) + "┐")
        : borderColor("┌" + "─".repeat(width - 2) + "┐");

    const bottom = borderColor("└" + "─".repeat(width - 2) + "┘");

    // Flatten: split every entry on real newlines, then word-wrap each
    // resulting row to innerWidth so nothing can ever overflow the border.
    const rows = lines
        .flatMap((line) => String(line).split("\n"))
        .flatMap((row) => (row === "" ? [""] : wrapAnsi(row, innerWidth, { trim: false }).split("\n")));

    const body = rows.map((row) => {
        const pad = Math.max(0, innerWidth - stringWidth(stripAnsi(row)));
        return borderColor("│ ") + row + " ".repeat(pad) + borderColor(" │");
    });

    return [top, ...body, bottom].join("\n");
}

/** A single horizontal divider matching the panel border style. */
export function divider(label = "") {
    const termWidth = process.stdout.columns || 80;
    const width = Math.min(78, Math.max(20, termWidth - 2));
    if (!label) return color.secondary("─".repeat(width));

    const left = "── " + label + " ";
    return color.secondary(left + "─".repeat(Math.max(0, width - stringWidth(left))));
}

/** Colored risk badge used by the AI agent confirmation screen. */
export function riskBadge(level) {
    switch (level) {
        case "destructive":
            return chalk.bgHex(COLORS.error).black.bold(" DESTRUCTIVE ");
        case "caution":
            return chalk.bgHex(COLORS.warn).black.bold(" CAUTION ");
        default:
            return chalk.bgHex(COLORS.success).black.bold(" SAFE ");
    }
}
