import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const client = readFileSync(join(root, "lib", "client.js"), "utf8");
const host = readFileSync(join(root, "lib", "index.js"), "utf8");

const mustHave = [
  ["client ModuleLoader", /__ModuleLoader__\.load/],
  ["needs cue", /needsOn|pendingInteraction/],
  ["done cue", /doneOn|completed/],
  ["new client status source", /uiSession/],
  ["new client completion field", /completionUnread/],
  ["debug surface", /__dshSoundCue/],
  ["host apply", /export function apply/],
];

for (const [label, pattern] of mustHave) {
  const hay = label.startsWith("host") ? host : client;
  if (!pattern.test(hay)) {
    console.error("smoke failed:", label);
    process.exit(1);
  }
}

console.log("smoke ok");
