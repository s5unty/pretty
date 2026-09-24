import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

export const START = "<!-- BACKLOG:START -->";
export const END = "<!-- BACKLOG:END -->";
const CONFIG = "backlog/workflow/readme.config.json";
export type Snapshot = Map<string, string>;
type Config = {
  upstream: string; version: string; commit: string; backlogDirectory: string;
  doneStatuses: string[];
};
type Task = { id: string; title: string; status: string; path: string; type: string };

export function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}
function configFrom(text: string): Config {
  const c = JSON.parse(text) as Config;
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(c.upstream ?? "") ||
      !/^[a-f0-9]{40}$/.test(c.commit ?? "") || typeof c.version !== "string" || !c.version ||
      !/^[\w.-]+(?:\/[\w.-]+)*$/.test(c.backlogDirectory ?? "") ||
      c.backlogDirectory.split("/").some((s) => s === "." || s === "..")) {
    throw new Error("Invalid upstream baseline or backlogDirectory in backlog/workflow/readme.config.json");
  }
  if (!Array.isArray(c.doneStatuses) || !c.doneStatuses.length || c.doneStatuses.some((s) => typeof s !== "string" || !s)) {
    throw new Error("Configure a non-empty doneStatuses array");
  }
  return c;
}
function required(snapshot: Snapshot, path: string): string {
  const text = snapshot.get(path);
  if (text === undefined) throw new Error(`Missing source: ${path}`);
  return text;
}
function relevant(path: string, dir: string): boolean {
  return path === CONFIG || path === "README.md" || path === `${dir}/config.yml` ||
    ["tasks", "completed", "docs", "decisions"].some((part) => path.startsWith(`${dir}/${part}/`) && path.endsWith(".md"));
}

/** HEAD mode is intentionally independent of the real or Backlog's temporary index. */
export function loadSnapshot(root: string, source: "head" | "worktree"): Snapshot {
  if (source === "head") {
    const rows = git(root, ["ls-tree", "-r", "-z", "HEAD"]).split("\0").filter(Boolean);
    const entries = rows.map((row) => {
      const tab = row.indexOf("\t");
      const [mode, , oid] = row.slice(0, tab).split(" ");
      return { mode, oid: oid!, path: row.slice(tab + 1) };
    });
    const configEntry = entries.find((e) => e.path === CONFIG);
    if (!configEntry) throw new Error("Commit backlog/workflow/readme.config.json before using HEAD generation");
    const read = (e: (typeof entries)[number]) => {
      if (e.mode !== "100644" && e.mode !== "100755") throw new Error(`Not a regular source file: ${e.path}`);
      return git(root, ["cat-file", "blob", e.oid]);
    };
    const c = configFrom(read(configEntry));
    return new Map(entries.filter((e) => relevant(e.path, c.backlogDirectory)).map((e) => [e.path, read(e)]));
  }
  const files = new Map<string, string>();
  const read = (path: string) => {
    if (!lstatSync(join(root, path)).isFile()) throw new Error(`Not a regular source file: ${path}`);
    files.set(path, readFileSync(join(root, path), "utf8"));
  };
  read(CONFIG);
  read("README.md");
  const c = configFrom(required(files, CONFIG));
  read(`${c.backlogDirectory}/config.yml`);
  function walk(path: string) {
    if (!existsSync(join(root, path))) return;
    if (!lstatSync(join(root, path)).isDirectory()) throw new Error(`Not a regular source directory: ${path}`);
    for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
      const child = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symlink source not supported: ${child}`);
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith(".md")) read(child);
    }
  }
  for (const part of ["tasks", "completed", "docs", "decisions"]) walk(`${c.backlogDirectory}/${part}`);
  return files;
}

function frontmatter(text: string, path: string): { meta: Record<string, unknown> } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new Error(`Missing YAML frontmatter: ${path}`);
  const meta: unknown = parse(match[1]!, { uniqueKeys: true });
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) throw new Error(`Invalid frontmatter: ${path}`);
  return { meta: meta as Record<string, unknown> };
}
function scalar(meta: Record<string, unknown>, key: string): string {
  const value = meta[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
/** Treat task-supplied prose as text, never as Markdown/HTML/link syntax. */
export function escapeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/[\\`*_{}\[\]()#!|~]/g, "\\$&");
}
export function linkPath(path: string): string {
  return path.split("/").map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");
}
function taskFrom(path: string, text: string): Task {
  const { meta } = frontmatter(text, path);
  const id = scalar(meta, "id"), title = scalar(meta, "title"), status = scalar(meta, "status");
  if (!id || !title || !status) throw new Error(`Missing task id/title/status: ${path}`);
  return { id, title, status, path, type: scalar(meta, "type") || "未分类" };
}
function order(a: Task, b: Task): number {
  // No locale or wall-clock dependencies; natural task-number ordering.
  const na = Number(a.id.match(/(\d+)$/)?.[1]), nb = Number(b.id.match(/(\d+)$/)?.[1]);
  return (Number.isFinite(na) && Number.isFinite(nb) ? na - nb : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function renderBlock(snapshot: Snapshot): string {
  const c = configFrom(required(snapshot, CONFIG));
  const backlogConfig = parse(required(snapshot, `${c.backlogDirectory}/config.yml`)) as { statuses?: unknown };
  const configuredStatuses = strings(backlogConfig?.statuses);
  for (const status of c.doneStatuses) {
    if (!configuredStatuses.includes(status)) throw new Error(`Status ${status} not found in Backlog config; update backlog/workflow/readme.config.json`);
  }
  const tasks = [...snapshot].filter(([p]) =>
    (p.startsWith(`${c.backlogDirectory}/tasks/`) || p.startsWith(`${c.backlogDirectory}/completed/`)) && p.endsWith(".md"))
    .map(([p, text]) => taskFrom(p, text)).sort(order);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  if (byId.size !== tasks.length) throw new Error("Duplicate task IDs; run backlog doctor before generating README");
  const done = tasks.filter((t) => c.doneStatuses.includes(t.status));
  const changes = done.map((t) => `- [${escapeText(t.id)}](${linkPath(t.path)}) · ${escapeText(t.title)} · ${escapeText(t.type)}`).join("\n") || "暂无已完成的变更。";
  const resources = [...snapshot].filter(([p]) => ["docs", "decisions"].some((part) => p.startsWith(`${c.backlogDirectory}/${part}/`)) && p.endsWith(".md"))
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([p, text]) => { const { meta } = frontmatter(text, p); return `- [${escapeText(scalar(meta, "id") || p)} · ${escapeText(scalar(meta, "title") || "未命名")}](${linkPath(p)})`; });
  return `${START}\n## 上游基线\n\n- 上游：[${escapeText(c.upstream.replace("https://github.com/", ""))}](${c.upstream})\n- 基线版本：**${escapeText(c.version)}**（该提交的 package.json 版本，不假定存在同名 tag）\n- 基线提交：[${c.commit.slice(0, 7)}](${c.upstream}/commit/${c.commit})\n- [上游使用说明（基线版本）](${c.upstream}/blob/${c.commit}/README.md)\n\n## 变更概览\n\n${changes}\n\n## Backlog 文档与决策\n\n${resources.length ? resources.join("\n") : "暂无独立文档或决策；实施计划、验收证据和经验总结保留在各任务中。"}\n${END}`;
}

export function managedBlock(text: string): { block: string; start: number; end: number } {
  const start = text.indexOf(START), end = text.indexOf(END);
  if (start < 0 || end < start || text.indexOf(START, start + START.length) >= 0 || text.indexOf(END, end + END.length) >= 0) {
    throw new Error("README must contain exactly one ordered BACKLOG:START/END pair");
  }
  return { start, end: end + END.length, block: text.slice(start, end + END.length) };
}
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function atomicWrite(path: string, text: string): void {
  const temp = `${path}.pretty-${process.pid}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, path);
}

/** Never stages, commits or pushes. Only the marked region in the working README is owned. */
export function generate(root: string, mode: "hook" | "write" | "check" | "accept"): boolean {
  const snapshot = loadSnapshot(root, mode === "hook" ? "head" : "worktree");
  const nextBlock = renderBlock(snapshot);
  const readmePath = join(root, "README.md");
  if (!lstatSync(readmePath).isFile()) throw new Error("README.md must be a regular file");
  const current = readFileSync(readmePath, "utf8");
  const region = managedBlock(current);
  if (mode === "check") {
    if (region.block !== nextBlock) throw new Error("README is stale; run npm --prefix backlog/workflow run generate");
    return false;
  }
  const statePath = resolve(root, git(root, ["rev-parse", "--git-path", "pretty-readme-state.json"]).trim());
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) as { blockHash?: string } : {};
  // Compare the worktree to either the last generated region or committed README.
  // Outside-region prose is preserved; hand-edited generated content is never silently erased.
  let committed = "";
  try { committed = managedBlock(git(root, ["show", "HEAD:README.md"])).block; } catch { /* first bootstrap */ }
  if (region.block !== nextBlock) {
    if (git(root, ["diff", "--cached", "--name-only", "--", "README.md"]).trim()) {
      throw new Error("README.md has staged changes; commit/unstage it before regenerating");
    }
    if (mode !== "accept" && region.block !== committed && hash(region.block) !== state.blockHash) {
      throw new Error("Generated README region has manual edits; move them outside the markers, then run npm --prefix backlog/workflow run accept to explicitly replace it");
    }
    atomicWrite(readmePath, current.slice(0, region.start) + nextBlock + current.slice(region.end));
  }
  mkdirSync(dirname(statePath), { recursive: true });
  atomicWrite(statePath, JSON.stringify({ blockHash: hash(nextBlock) }) + "\n");
  return region.block !== nextBlock;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv[2]?.replace(/^--/, "");
  if (!["hook", "write", "check", "accept"].includes(mode ?? "")) {
    console.error("Usage: node backlog/workflow/readme.ts --hook|--write|--check|--accept");
    process.exitCode = 1;
  } else {
    try {
      const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
      const changed = generate(root, mode as "hook" | "write" | "check" | "accept");
      if (changed) console.log("[pretty README] Updated README.md (working tree only; not staged, committed or pushed).");
    } catch (error) {
      console.error(`[pretty README] ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
}
