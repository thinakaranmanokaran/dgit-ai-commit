import axios from "axios";
import { execSync } from "child_process";

export async function generateCommitOptions(apiKey) {
    let diff = execSync("git diff --cached --no-color").toString();

    // 🚫 Remove binary files (VERY IMPORTANT)
    diff = diff
        .split("\n")
        .filter(line => !line.includes("Binary files"))
        .join("\n");

    // ✂️ Limit size (safe ~8k–12k chars)
    const MAX_DIFF = 10000;

    if (diff.length > MAX_DIFF) {
        diff = diff.slice(0, MAX_DIFF);
    }

    // 🧠 If still too big → fallback early
    if (!diff.trim()) {
        return [{ title: "chore: update files", description: "" }];
    }

    const prompt = `
You are a Git commit generator.

Return ONLY JSON.

Format:
[
  { "title": "short commit title", "description": "optional description" }
]

Rules:
- Max 3 options
- Title < 60 chars
- Conventional commits
- No explanation

Diff:
${diff}
`;

    try {
        const res = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.1-8b-instant",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.4
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            }
        );

        return JSON.parse(res.data.choices[0].message.content);

    } catch (err) {
        // 🎯 HANDLE 413 nicely
        if (err.response?.status === 413) {
            console.log("❌ Too many changes. Cannot generate AI commit.");
            return [{ title: "chore: large update", description: "" }];
        }

        console.log("⚠ AI failed, using fallback.");
        return [{ title: "chore: update files", description: "" }];
    }
}