#!/usr/bin/env node

/**
 * bin/dg.js — CLI entry point.
 *
 * This file used to contain all the business logic inline. It now
 * only does two things: define commands with Commander, and route
 * each one to its implementation in src/commands/*. Every action is
 * wrapped in a try/catch so a failure prints a clean message instead
 * of a raw Node stack trace (CLAUDE.md roadmap: "Add proper error
 * boundaries").
 */

import { Command } from "commander";
import { showBannerOnce } from "../src/ui/banner.js";
import { ensureGitRepo } from "../src/ui/guards.js";
import { color, icon } from "../src/ui/theme.js";

import { runInit } from "../src/commands/init.js";
import { runAdd } from "../src/commands/add.js";
import { runCommit } from "../src/commands/commit.js";
import { runPush } from "../src/commands/push.js";
import { runAgent } from "../src/commands/agent.js";

const program = new Command();

program
    .name("dg")
    .description("AI-powered Git CLI")
    .version("1.1.0")
    .option("-a, --agent <prompt>", 'Natural language git operations, e.g. dg -a "undo my last commit"');

/** Wraps a command action so any thrown error prints cleanly instead of a raw stack trace. */
function withErrorBoundary(action) {
    return async (...args) => {
        try {
            await action(...args);
        } catch (err) {
            console.log(color.error(`\n${icon.fail} ${err?.message || err}`));
            process.exitCode = 1;
        }
    };
}

// 📌 INIT
program
    .command("init")
    .description("Initialize a new Git repository")
    .action(withErrorBoundary(async () => {
        showBannerOnce();
        await runInit();
    }));

// 📌 ADD
program
    .command("add")
    .description("Stage all files")
    .action(withErrorBoundary(async () => {
        ensureGitRepo();
        showBannerOnce();
        await runAdd();
    }));

// 📌 COMMIT
program
    .command("commit")
    .description("Generate AI commit message & commit")
    .action(withErrorBoundary(async () => {
        ensureGitRepo();
        showBannerOnce();
        await runCommit();
    }));

// 📌 PUSH
program
    .command("push [branch]")
    .description("Commit + Push with AI message")
    .action(withErrorBoundary(async (branchArg) => {
        ensureGitRepo();
        showBannerOnce();
        await runPush(branchArg);
    }));

// 📌 AGENT — explicit subcommand form: dg agent "prompt with spaces"
program
    .command("agent <prompt...>")
    .description('AI-powered natural language git operations, e.g. dg agent "undo my last commit"')
    .action(withErrorBoundary(async (promptParts) => {
        ensureGitRepo();
        showBannerOnce();
        await runAgent(promptParts.join(" "));
    }));

// 📌 DEFAULT — handles both `dg -a "..."` and bare `dg` (help)
program.action(
    withErrorBoundary(async () => {
        const opts = program.opts();

        if (opts.agent) {
            ensureGitRepo();
            showBannerOnce();
            await runAgent(opts.agent);
            return;
        }

        showBannerOnce();
        program.help();
    })
);

await program.parseAsync(process.argv);

// Safety net: some interactive flows (the F2 listener in particular)
// can leave stdin in a state that would otherwise keep the event loop
// alive. Exit explicitly now that the command has actually finished.
process.exit(process.exitCode ?? 0);
