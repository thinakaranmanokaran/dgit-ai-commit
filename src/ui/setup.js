/**
 * src/ui/setup.js
 *
 * First-run setup: prompts for and persists the GROQ API key.
 * Split out of the old src/utils.js grab-bag.
 */

import inquirer from "inquirer";
import { getAPIKey, setAPIKey } from "../core/config.js";
import { color, icon } from "./theme.js";

/**
 * Returns the saved API key, prompting the user to enter (and save)
 * one if it isn't configured yet.
 * @returns {Promise<string>}
 */
export async function ensureAPIKey() {
    let key = getAPIKey();

    if (!key) {
        const { apiKey } = await inquirer.prompt([
            {
                type: "input",
                name: "apiKey",
                message: "Enter your GROQ API Key (Get it from https://console.groq.com/keys):",
            },
        ]);

        setAPIKey(apiKey);
        console.log(`${icon.ok} ${color.success("API Key saved!")}`);
        return apiKey;
    }

    return key;
}
