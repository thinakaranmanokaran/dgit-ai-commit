/**
 * src/ui/commitFlow.js
 *
 * The interactive "pick an AI commit message" flow. Behavior is the
 * same proven design as the original components/commit.js:
 *   1. Ensure something is staged
 *   2. Generate options (now disk-cached per diff hash)
 *   3. Show them in a themed list
 *   4. Race an F2 keypress against the inquirer selection
 *   5. Handle select / edit / regenerate
 *
 * What changed is purely presentational (spinner instead of a manual
 * text loader, a themed panel header) plus the caching layer — the
 * control flow and keybindings are intentionally untouched so existing
 * muscle memory still works.
 */

import inquirer from "inquirer";
import enquirer from "enquirer";
import chalk from "chalk";
import { generateCommitOptions } from "../core/ai.js";
import { gitAddAll, gitCommit, getStagedDiff } from "../core/git.js";
import { ensureAPIKey } from "./setup.js";
import { spinner, formatChoice, listenForF2, confirm } from "./prompts.js";
import { getCached, setCached, hashContent } from "../core/cache.js";
import { color, icon, divider } from "./theme.js";

const { Input } = enquirer;

/** Runs the full interactive commit flow; resolves once a commit lands. */
export async function commitMessage() {
    let diff = getStagedDiff();

    if (!diff.trim()) {
        console.log(color.warn(`${icon.warn} No staged changes. Use 'dg add' to stage files first.`));

        const addNow = await confirm("Do you want to stage all files now?");
        if (addNow) {
            await gitAddAll();
            console.log(`${icon.ok} Files staged`);
            diff = getStagedDiff();
        } else {
            console.log(color.error(`${icon.fail} Commit aborted.`));
            return;
        }
    }

    const key = await ensureAPIKey();

    let options = [];
    let forceRegenerate = false;

    // 🔁 LOOP for regenerate
    while (true) {
        const diffHash = hashContent(diff);

        const spin = spinner("Generating commit options...");

        if (!forceRegenerate) {
            const cached = getCached(diffHash);
            if (cached) {
                options = cached;
                spin.succeed(color.muted("Loaded suggestions (cached — diff unchanged)"));
            }
        }

        if (!options.length || forceRegenerate) {
            options = await generateCommitOptions(key, { diff });
            setCached(diffHash, options);
            spin.succeed(color.success("Commit options ready"));
        }

        forceRegenerate = false;

        let currentSelection = options[0];

        console.log(color.muted(`${divider("AI suggestions")}  (press F2 to edit)\n`));

        const choices = [
            ...options.map((opt) => ({
                name: formatChoice(opt),
                value: { type: "select", data: opt },
                short: opt.title,
            })),
            new inquirer.Separator(),
            { name: chalk.yellow("✏️  Edit message"), value: { type: "edit" } },
            { name: chalk.cyan("🔄 Regenerate"), value: { type: "regen" } },
        ];

        // ── F2 race ───────────────────────────────────────────────────────
        let stopListening;

        const f2Promise = new Promise((resolve) => {
            stopListening = listenForF2(() => resolve({ type: "edit" }));
        });

        const promptPromise = inquirer
            .prompt([
                {
                    type: "list",
                    name: "selected",
                    message: "",
                    choices,
                    loop: true,
                    prefix: "",
                    pageSize: 10,
                },
            ])
            .then((res) => res.selected);

        const result = await Promise.race([f2Promise, promptPromise]);
        stopListening();

        // ── Regen ────────────────────────────────────────────────────────
        if (result.type === "regen") {
            forceRegenerate = true;
            continue;
        }

        // ── Edit ─────────────────────────────────────────────────────────
        if (result.type === "edit") {
            const defaultMsg = currentSelection?.title || options[0]?.title || "chore: update files";

            console.log(color.muted(`\nselected: ${defaultMsg}\n`));

            const input = new Input({
                message: "✏️  Edit commit message (press tab):",
                initial: defaultMsg,
                prefix: "",
            });

            const custom = await input.run();

            if (!custom.trim()) {
                console.log(color.error(`${icon.fail} Empty message.\n`));
                continue;
            }

            gitCommit(custom.trim());
            console.log(`${icon.ok} Commit successful`);
            return;
        }

        // ── Select ───────────────────────────────────────────────────────
        if (result.type === "select") {
            const { title, description } = result.data;
            const body = description?.trim() || "update project files";
            gitCommit(title, body);
            console.log(`${icon.ok} Commit successful`);
            return;
        }
    }
}
