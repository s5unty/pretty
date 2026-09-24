import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { END, START, generate, git, linkPath, loadSnapshot, renderBlock, type Snapshot } from "./readme.ts";
import { installHooks } from "./install-hooks.ts";

const workflow = dirname(fileURLToPath(import.meta.url));
const CONFIG = "backlog/workflow/readme.config.json";
const HOOKS = "backlog/workflow/hooks";
const config = JSON.stringify({ upstream: "https://github.com/pifydev/pretty", version: "0.12.0", commit: "a".repeat(40),
  backlogDirectory: "backlog", doneStatuses: ["Done"] });
const blank = `# My fork\n\nhandwritten\n\n${START}\n${END}\n\nfooter\n`;
function task(id: string, status: string, extra = ""): string {
  return `---\nid: ${id}\ntitle: 'Change ${id}'\nstatus: ${status}\ntype: bug\npriority: medium\nlabels: [rendering]\n${extra}---\n\n<!-- SECTION:DESCRIPTION:BEGIN -->\nWhy this change matters.\n<!-- SECTION:DESCRIPTION:END -->\n<!-- AC:BEGIN -->\n- [x] #1 tested\n- [ ] #2 pending\n<!-- AC:END -->\n<!-- SECTION:FINAL_SUMMARY:BEGIN -->\nDelivered and verified.\n<!-- SECTION:FINAL_SUMMARY:END -->\n`;
}
function snapshot(): Snapshot {
  return new Map([[CONFIG, config], ["backlog/config.yml", 'statuses: ["To Do", "In Progress", "Done"]'],
    ["README.md", blank], ["backlog/tasks/bp-1 - 中文 (a).md", task("BP-1", "Done")],
    ["backlog/tasks/bp-2.md", task("BP-2", "In Progress", "dependencies: [BP-1, BP-404]\n")],
    ["backlog/tasks/bp-3.md", task("BP-3", "To Do")]]);
}
function write(root: string, path: string, text: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}
function withRepo(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "pretty-readme-"));
  try {
    git(root, ["init", "-q"]);
    git(root, ["config", "user.name", "README test"]);
    git(root, ["config", "user.email", "readme@example.invalid"]);
    git(root, ["config", "commit.gpgsign", "false"]);
    git(root, ["config", "core.autocrlf", "false"]);
    for (const [p, text] of snapshot()) write(root, p, text);
    write(root, "package.json", '{"type":"module"}\n');
    git(root, ["add", "."]);
    git(root, ["commit", "-qm", "fixture"]);
    generate(root, "write");
    git(root, ["add", "README.md"]);
    git(root, ["commit", "-qm", "initial README"]);
    fn(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
function enableHook(root: string) {
  mkdirSync(join(root, HOOKS), { recursive: true });
  copyFileSync(join(workflow, "readme.ts"), join(root, "backlog/workflow/readme.ts"));
  copyFileSync(join(workflow, "hooks/post-commit"), join(root, HOOKS, "post-commit"));
  symlinkSync(join(workflow, "node_modules"), join(root, "backlog/workflow/node_modules"), "junction");
  installHooks(root);
}

test("README overview is only a completed-task bullet list with linked ID, name and type", () => {
  const out = renderBlock(snapshot());
  assert.match(out, /0\.12\.0/);
  assert.ok(out.includes(`/commit/${"a".repeat(40)}`));
  const overview = out.split("## 变更概览\n\n")[1]!.split("\n\n## ")[0];
  assert.equal(overview, "- [BP-1](backlog/tasks/bp-1%20-%20%E4%B8%AD%E6%96%87%20%28a%29.md) · Change BP-1 · bug");
  for (const hidden of ["BP-2", "BP-3", "已完成 **", "进行中", "准备做", "## 已完成的变更", "## 正在进行", "Delivered and verified", "验收：", "优先级："]) {
    assert.ok(!out.includes(hidden), `${hidden} must not appear`);
  }
});

test("README keeps completed history, links docs/decisions and ignores drafts/archives", () => {
  const s = snapshot();
  const old = "backlog/tasks/bp-1 - 中文 (a).md";
  s.set("backlog/completed/bp-1 - 中文 (a).md", s.get(old)!); s.delete(old);
  s.set("backlog/drafts/bp-9.md", task("BP-9", "To Do"));
  s.set("backlog/archive/tasks/bp-10.md", task("BP-10", "Done"));
  s.set("backlog/docs/doc-1 - guide.md", "---\nid: doc-1\ntitle: Guide\n---\nText\n");
  s.set("backlog/decisions/decision-1.md", "---\nid: decision-1\ntitle: Choice\n---\nText\n");
  const out = renderBlock(s);
  assert.ok(out.includes("backlog/completed/bp-1"));
  assert.ok(!out.includes("BP-9")); assert.ok(!out.includes("BP-10"));
  assert.ok(out.includes("backlog/docs/doc-1%20-%20guide.md"));
  assert.ok(out.includes("backlog/decisions/decision-1.md"));
});

test("README is deterministic, defaults missing type and escapes task content", () => {
  const s = snapshot();
  s.set("backlog/tasks/bp-4.md", "---\nid: BP-4\ntitle: '<script>[x](url) | test'\nstatus: Done\n---\n");
  s.set("backlog/tasks/bp-5.md", task("BP-5", "Blocked"));
  const out = renderBlock(s);
  assert.equal(out, renderBlock(new Map([...s].reverse())));
  assert.match(out, / · 未分类/);
  assert.match(out, /&lt;script&gt;/);
  assert.ok(!out.includes("[x](url)"));
  assert.ok(!out.includes("BP-5"));
  assert.equal(linkPath("x [a](b)#%.md"), "x%20%5Ba%5D%28b%29%23%25.md");
  const unfinished = new Map([...s].filter(([p]) => !["backlog/tasks/bp-1 - 中文 (a).md", "backlog/tasks/bp-4.md"].includes(p)));
  assert.match(renderBlock(unfinished), /## 变更概览\n\n暂无已完成的变更。/);
  assert.ok(!renderBlock(unfinished).includes("[BP-"));
});

test("README rejects duplicate IDs, invalid YAML and invalid configuration", () => {
  const s = snapshot();
  s.set("backlog/completed/duplicate.md", task("BP-1", "Done"));
  assert.throws(() => renderBlock(s), /Duplicate/);
  s.delete("backlog/completed/duplicate.md");
  s.set("backlog/tasks/broken.md", "---\nid: [bad\n---\n");
  assert.throws(() => renderBlock(s));
  s.delete("backlog/tasks/broken.md");
  s.set(CONFIG, config.replace('"backlog"', '"../escape"'));
  assert.throws(() => renderBlock(s), /Invalid/);
});

test("generation is idempotent, preserves manual outer content, and never touches the index", () => withRepo((root) => {
  const path = join(root, "README.md");
  const before = readFileSync(path, "utf8");
  const mtime = statSync(path).mtimeMs;
  assert.equal(generate(root, "write"), false);
  assert.equal(readFileSync(path, "utf8"), before);
  assert.equal(statSync(path).mtimeMs, mtime);
  writeFileSync(path, before.replace("handwritten", "my uncommitted prose"));
  write(root, "backlog/tasks/bp-3.md", task("BP-3", "Done"));
  write(root, "unrelated.txt", "staged unrelated content");
  git(root, ["add", "unrelated.txt"]);
  const index = git(root, ["ls-files", "--stage"]);
  assert.equal(generate(root, "write"), true);
  assert.match(readFileSync(path, "utf8"), /my uncommitted prose/);
  assert.equal(git(root, ["ls-files", "--stage"]), index);
  assert.equal(generate(root, "check"), false);
}));

test("manual edits inside the generated region require explicit acceptance", () => withRepo((root) => {
  const path = join(root, "README.md");
  writeFileSync(path, readFileSync(path, "utf8").replace("Change BP-1", "Hand edited!"));
  assert.throws(() => generate(root, "write"), /manual edits/);
  assert.match(readFileSync(path, "utf8"), /Hand edited!/);
  assert.equal(generate(root, "accept"), true);
}));

test("staged README changes are protected even in explicit accept mode", () => withRepo((root) => {
  write(root, "README.md", readFileSync(join(root, "README.md"), "utf8") + "staged footer\n");
  git(root, ["add", "README.md"]);
  write(root, "backlog/tasks/bp-3.md", task("BP-3", "Done"));
  const before = readFileSync(join(root, "README.md"), "utf8");
  assert.throws(() => generate(root, "accept"), /staged changes/);
  assert.equal(readFileSync(join(root, "README.md"), "utf8"), before);
}));

test("stale check/malformed source fail without changing README; missing markers fail closed", () => withRepo((root) => {
  const path = join(root, "README.md"), before = readFileSync(path, "utf8");
  write(root, "backlog/tasks/bp-3.md", task("BP-3", "Done"));
  assert.throws(() => generate(root, "check"), /stale/);
  assert.equal(readFileSync(path, "utf8"), before);
  write(root, "backlog/tasks/bp-3.md", "invalid task");
  assert.throws(() => generate(root, "write"), /frontmatter/);
  assert.equal(readFileSync(path, "utf8"), before);
  writeFileSync(path, "manual README without markers");
  write(root, "backlog/tasks/bp-3.md", task("BP-3", "Done"));
  assert.throws(() => generate(root, "write"), /exactly one/);
}));

test("real post-commit generates from HEAD without committing or staging README or unrelated changes", () => withRepo((root) => {
  enableHook(root);
  write(root, "unrelated.txt", "keep me staged"); git(root, ["add", "unrelated.txt"]);
  // An uncommitted task must not leak into the automatic summary.
  write(root, "backlog/tasks/bp-2.md", task("BP-2", "Done"));
  const beforeCount = Number(git(root, ["rev-list", "--count", "HEAD"]).trim());
  write(root, "backlog/tasks/bp-3.md", task("BP-3", "Done"));
  git(root, ["commit", "--only", "-qm", "complete BP-3", "--", "backlog/tasks/bp-3.md"]);
  const out = readFileSync(join(root, "README.md"), "utf8");
  assert.equal(out.match(/^- \[BP-/gm)?.length, 2);
  assert.ok(out.includes("[BP-3]"));
  assert.ok(!out.includes("[BP-2]"));
  assert.equal(Number(git(root, ["rev-list", "--count", "HEAD"]).trim()), beforeCount + 1);
  assert.equal(git(root, ["diff", "--cached", "--name-only"]).trim(), "unrelated.txt");
  assert.ok(git(root, ["diff", "--name-only"]).includes("README.md"));
  // Another task commit updates the previous generated (still uncommitted) README safely.
  git(root, ["commit", "--only", "-qm", "complete BP-2", "--", "backlog/tasks/bp-2.md"]);
  assert.equal(readFileSync(join(root, "README.md"), "utf8").match(/^- \[BP-/gm)?.length, 3);
  assert.equal(git(root, ["diff", "--cached", "--name-only"]).trim(), "unrelated.txt");
}));

test("post-commit logs failures without undoing a successful task commit", () => withRepo((root) => {
  enableHook(root);
  const path = join(root, "README.md");
  writeFileSync(path, readFileSync(path, "utf8").replace("Change BP-1", "manual change"));
  write(root, "backlog/tasks/bp-3.md", task("BP-3", "Done"));
  git(root, ["commit", "--only", "-qm", "task succeeded", "--", "backlog/tasks/bp-3.md"]);
  assert.match(git(root, ["log", "-1", "--format=%s"]), /task succeeded/);
  assert.match(readFileSync(path, "utf8"), /manual change/);
  assert.match(readFileSync(join(root, ".git/pretty-readme-hook.log"), "utf8"), /manual edits/);
}));

test("installer is repeatable and refuses to replace existing hook configuration", () => withRepo((root) => {
  git(root, ["config", "core.hooksPath", "custom-hooks"]);
  assert.throws(() => installHooks(root), /refusing to replace/);
  git(root, ["config", "--unset", "core.hooksPath"]);
  write(root, ".git/hooks/pre-commit", "#!/bin/sh\nexit 0\n");
  assert.throws(() => installHooks(root), /refusing to hide/);
  rmSync(join(root, ".git/hooks/pre-commit"));
  enableHook(root); installHooks(root);
  assert.equal(git(root, ["config", "--get", "core.hooksPath"]).trim(), HOOKS);
  assert.ok(existsSync(join(root, HOOKS, "post-commit")));
}));

test("installer migrates the former Pretty hooks path after its files move", () => withRepo((root) => {
  enableHook(root);
  git(root, ["config", "core.hooksPath", ".githooks"]);
  installHooks(root);
  assert.equal(git(root, ["config", "--get", "core.hooksPath"]).trim(), HOOKS);
}));

test("installer recognizes its legacy hook without accepting unrelated hooks", () => withRepo((root) => {
  enableHook(root);
  write(root, ".githooks/post-commit", readFileSync(join(workflow, "hooks/post-commit"), "utf8"));
  git(root, ["config", "core.hooksPath", ".githooks"]);
  installHooks(root);
  assert.equal(git(root, ["config", "--get", "core.hooksPath"]).trim(), HOOKS);

  git(root, ["config", "core.hooksPath", ".githooks"]);
  write(root, ".githooks/pre-commit", "#!/bin/sh\nexit 0\n");
  assert.throws(() => installHooks(root), /other hooks/);
  assert.equal(git(root, ["config", "--get", "core.hooksPath"]).trim(), ".githooks");
}));

test("installer refuses an unrelated legacy post-commit", () => withRepo((root) => {
  enableHook(root);
  write(root, ".githooks/post-commit", "#!/bin/sh\necho not-pretty\n");
  git(root, ["config", "core.hooksPath", ".githooks"]);
  assert.throws(() => installHooks(root), /other hooks/);
}));

test("HEAD snapshot ignores working-tree config and task mutations", () => withRepo((root) => {
  const before = renderBlock(loadSnapshot(root, "head"));
  write(root, CONFIG, "invalid json");
  write(root, "backlog/tasks/bp-3.md", "invalid yaml");
  assert.equal(renderBlock(loadSnapshot(root, "head")), before);
}));
