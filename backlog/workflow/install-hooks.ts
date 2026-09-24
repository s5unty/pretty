import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function git(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}
export function installHooks(root: string): void {
  let configured = "";
  try { configured = git(root, ["config", "--get", "core.hooksPath"]).trim(); }
  catch (error) { if ((error as { status?: number }).status !== 1) throw error; }
  const hooksPath = "backlog/workflow/hooks";
  if (configured === ".githooks") {
    // Migrate only our previous installation (or its now-empty former path).
    const legacy = join(root, ".githooks");
    const entries = existsSync(legacy) ? readdirSync(legacy) : [];
    if (entries.some((name) => name !== "post-commit") ||
        (entries.includes("post-commit") && !readFileSync(join(legacy, "post-commit"), "utf8").includes("# pretty-readme-hook:"))) {
      throw new Error("Existing .githooks contains other hooks; refusing to replace it. See AGENTS.md.");
    }
  } else if (configured && configured !== hooksPath) {
    throw new Error(`Existing core.hooksPath=${configured}; refusing to replace it. See AGENTS.md for integration.`);
  }
  if (!configured) {
    const original = resolve(root, git(root, ["rev-parse", "--git-path", "hooks"]).trim());
    const custom = existsSync(original) ? readdirSync(original).filter((name) => !name.endsWith(".sample")) : [];
    if (custom.length) throw new Error(`Existing Git hooks (${custom.join(", ")}); refusing to hide them. Integrate manually.`);
  }
  const hook = join(root, hooksPath, "post-commit");
  if (!readFileSync(hook, "utf8").includes("# pretty-readme-hook:")) throw new Error("Project hook missing or not recognized");
  chmodSync(hook, 0o755);
  git(root, ["config", "--local", "core.hooksPath", hooksPath]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
    installHooks(root);
    console.log("Installed post-commit README generator for this clone. README will NOT be staged or committed automatically.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
