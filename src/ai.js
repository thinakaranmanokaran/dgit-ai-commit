import axios from "axios";
import { execSync } from "child_process";

export async function generateCommitOptions(apiKey) {
    const diff = execSync("git diff --cached").toString();

    if (!diff.trim()) {
        return [
            { title: "chore: update files", description: "" }
        ];
    }

    const prompt = `
You are a Git commit generator.

Return ONLY JSON (no explanation).

Format:
[
  { "title": "short commit title", "description": "optional description" },
  { "title": "short commit title", "description": "optional description" }
]

Rules:
- Max 3 options
- Title must be under 60 chars
- Use conventional commits (feat, fix, chore, etc)
- No extra text

Diff:
${diff}
`;

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

    try {
        return JSON.parse(res.data.choices[0].message.content);
    } catch {
        return [
            { title: "chore: update files", description: "" }
        ];
    }
}