import fs from "fs";
import os from "os";
import path from "path";

const CONFIG_PATH = path.join(os.homedir(), ".dgconfig.json");

export function getAPIKey() {
    if (!fs.existsSync(CONFIG_PATH)) return null;

    const data = JSON.parse(fs.readFileSync(CONFIG_PATH));
    return data.apiKey;
}

export function setAPIKey(apiKey) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ apiKey }, null, 2));
}