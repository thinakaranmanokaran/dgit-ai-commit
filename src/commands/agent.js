/**
 * src/commands/agent.js — `dg -a "<prompt>"` / `dg agent "<prompt>"`
 *
 * The "killer feature" called out in IDEA.md and CLAUDE.md's roadmap:
 * the user describes what they want in plain language, e.g.
 *
 *   dg -a "Need to reverse all current commits and need the last one
 *           I had on 21/06/2026"
 *
 * and DGit:
 *   1. Gathers real repo context (log with dates, status, branches)
 *   2. Asks the AI to translate that into an ordered git command plan
 *   3. Shows the plan + a plain-English explanation + a risk badge
 *   4. Requires confirmation before touching anything — destructive
 *      plans require typing "CONFIRM", not just pressing Enter
 *   5. Executes each command via execFileSync (no shell, git-only —
 *      see core/git.js's tokenizeGitCommand/isDestructiveCommand)
 */

import {
    getCurrentBranch,
    getRecentLog,
    getStatusPorcelain,
    getBranches,
    getRemotes,
    runGitArgs,
    isDestructiveCommand,
    tokenizeGitCommand,
} from "../core/git.js";
import { planGitOperations } from "../core/ai.js";
import { ensureAPIKey } from "../ui/setup.js";
import { spinner, confirm, confirmTyped } from "../ui/prompts.js";
import { color, icon, panel, riskBadge } from "../ui/theme.js";

/** @param {string} userPrompt */
export async function runAgent(userPrompt) {
    if (!userPrompt || !userPrompt.trim()) {
        console.log(color.error(`${icon.fail} Tell the agent what you want, e.g. dg -a "undo my last commit"`));
        return;
    }

    const key = await ensureAPIKey();

    const context = {
        branch: getCurrentBranch(),
        log: getRecentLog(30),
        status: getStatusPorcelain(),
        branches: getBranches().join(", "),
        remotes: getRemotes(),
    };

    const spin = spinner("Analyzing your repository and request...");
    let plan;
    try {
        plan = await planGitOperations(key, userPrompt, context);
    } finally {
        spin.stop();
    }

    if (!plan.commands.length) {
        console.log(panel("🤖 AI Git Agent", [
            color.accent(plan.explanation || "No commands were generated."),
        ], { borderColor: color.secondary }));
        return;
    }

    // Escalate risk if our own heuristics see something the AI didn't flag.
    const heuristicDestructive = plan.commands.some((c) => isDestructiveCommand(c.command));
    const riskLevel = heuristicDestructive ? "destructive" : plan.riskLevel;

    const lines = [
        color.accent(plan.explanation),
        "",
        color.muted("Proposed commands:"),
        ...plan.commands.flatMap((c, i) => [
            `${color.primary.bold(`${i + 1}.`)} ${color.accent(c.command)}`,
            color.muted(`   ${c.description || ""}`),
        ]),
        "",
        `Risk: ${riskBadge(riskLevel)}`,
    ];

    console.log(panel("🤖 AI Git Agent — proposed plan", lines, { borderColor: color.primary }));

    let proceed;
    if (riskLevel === "destructive") {
        proceed = await confirmTyped("This plan can permanently rewrite history or discard work.");
    } else {
        proceed = await confirm("Run this plan?", riskLevel === "safe");
    }

    if (!proceed) {
        console.log(color.warn(`${icon.warn} Agent plan cancelled. Nothing was changed.`));
        return;
    }

    console.log(); // spacing before execution output

    for (const [i, cmd] of plan.commands.entries()) {
        const args = tokenizeGitCommand(cmd.command);

        if (!args) {
            console.log(color.error(`${icon.fail} Refusing to run non-git command: ${cmd.command}`));
            console.log(color.error("Stopping here — remaining steps were skipped for safety."));
            return;
        }

        console.log(color.muted(`${icon.arrow} [${i + 1}/${plan.commands.length}] ${cmd.command}`));

        try {
            runGitArgs(args);
            console.log(`${icon.ok} ${color.success("done")}`);
        } catch (err) {
            console.log(`${icon.fail} ${color.error("failed")} — ${err.message}`);
            console.log(color.error("Stopping here — remaining steps were skipped."));
            return;
        }
    }

    console.log(color.success(`\n${icon.spark} Agent plan completed.`));
}
