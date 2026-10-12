import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initTheme } from "@earendil-works/pi-coding-agent";
import pretty from "../extensions/pretty.ts";

initTheme();

/**
 * The pi >= 1.0.1 path: a stub pi that offers registerToolRenderer(). Pretty
 * must register exactly one resolver, never re-register a tool, answer for the
 * built-ins (including a bash another extension owns), fill in MCP tools that
 * draw nothing of their own, and let a /pretty toggle change the answer
 * without touching the registry.
 */

type Handler = (...args: unknown[]) => unknown;
type Renderers = Record<string, unknown> | undefined;
type Resolver = (toolName: string, next: () => Renderers) => Renderers;

function makeEnv(cwd: string, getAllTools: () => Array<Record<string, unknown>>) {
  const registered: string[] = [];
  const resolvers: Resolver[] = [];
  const handlers = new Map<string, Handler>();
  const notifications: string[] = [];
  let commandHandler: Handler | undefined;
  let repaints = 0;

  const pi = {
    registerTool: (t: { name: string }) => registered.push(t.name),
    registerToolRenderer: (r: Resolver) => resolvers.push(r),
    registerCommand: (_name: string, opts: { handler: Handler }) => {
      commandHandler = opts.handler;
    },
    registerShortcut: () => {},
    appendEntry: () => {},
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    getAllTools,
  };
  const ctx = {
    cwd,
    hasUI: true,
    ui: {
      notify: (msg: string) => notifications.push(msg),
      getToolsExpanded: () => false,
      setToolsExpanded: () => {
        repaints++;
      },
    },
    sessionManager: { getBranch: () => [] },
  };
  pretty(pi as never);
  return {
    registered,
    resolvers,
    notifications,
    repaints: () => repaints,
    resolve: (name: string, next: () => Renderers = () => undefined) => resolvers[0]!(name, next),
    sessionStart: async () => handlers.get("session_start")!({}, ctx),
    beforeAgentStart: async () => handlers.get("before_agent_start")!({}, ctx),
    runCommand: async (args: string) => commandHandler!(args, ctx),
  };
}

const FOREIGN_BASH = [{ name: "bash", sourceInfo: { source: "npm", path: "<npm:@pify/shell-background>" } }];

async function withTmp<T>(fn: (cwd: string) => Promise<T>): Promise<T> {
  const cwd = mkdtempSync(join(tmpdir(), "pify-wire-"));
  try {
    return await fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("resolver path: one resolver, no tool re-registered, built-ins answered", async () => {
  await withTmp(async (cwd) => {
    const env = makeEnv(cwd, () => FOREIGN_BASH);
    await env.sessionStart();
    await env.beforeAgentStart();
    assert.equal(env.resolvers.length, 1);
    assert.deepEqual(env.registered, [], "nothing is re-registered under the resolver");
    const read = env.resolve("read", () => ({ renderShell: "self", renderCall: () => "pi" }));
    assert.equal(typeof read?.renderCall, "function");
    assert.equal(typeof read?.renderResult, "function");
    assert.equal(read?.renderShell, "self", "the base renderShell is kept");
    const piCall = () => "pi";
    const over = env.resolve("read", () => ({ renderCall: piCall }));
    assert.notEqual(over?.renderCall, piCall, "pretty's renderCall replaced pi's");
  });
});

test("resolver path: a foreign bash is drawn by pretty and the owner is named in status", async () => {
  await withTmp(async (cwd) => {
    const env = makeEnv(cwd, () => FOREIGN_BASH);
    await env.sessionStart();
    await env.beforeAgentStart();
    const theirs = () => "theirs";
    const bash = env.resolve("bash", () => ({ renderCall: theirs }));
    assert.notEqual(bash?.renderCall, theirs);
    await env.runCommand("status");
    const status = env.notifications.at(-1) ?? "";
    assert.match(status, /bash: owned by npm:@pify\/shell-background; pretty draws it/);
    assert.match(status, /tool-renderer resolver/);
    assert.doesNotMatch(status, /MCP tool rendering: unavailable/);
  });
});

test("resolver path: /pretty off bash defers to the base without re-registering; the toggle repaints", async () => {
  await withTmp(async (cwd) => {
    const env = makeEnv(cwd, () => FOREIGN_BASH);
    await env.sessionStart();
    await env.beforeAgentStart();
    await env.runCommand("off bash");
    assert.equal(env.repaints(), 1);
    assert.deepEqual(env.registered, []);
    const base = { renderCall: () => "theirs" };
    assert.equal(env.resolve("bash", () => base), base, "turned off: exactly what would draw without pretty");
    assert.equal(env.resolve("bash"), undefined);
    assert.match(env.notifications.at(-1) ?? "", /^pretty bash: off$/);
    await env.runCommand("bash");
    assert.equal(typeof env.resolve("bash")?.renderResult, "function");
  });
});

test("resolver path: MCP tools draw compactly unless they draw themselves", async () => {
  await withTmp(async (cwd) => {
    const env = makeEnv(cwd, () => FOREIGN_BASH);
    await env.sessionStart();
    const mcp = env.resolve("mcp__radius__search");
    assert.equal(typeof mcp?.renderCall, "function", "an unregistered MCP tool still gets renderers");
    const own = { renderResult: () => "own" };
    assert.equal(env.resolve("mcp__radius__search", () => own), own);
    const other = { renderCall: () => "x" };
    assert.equal(env.resolve("subagent", () => other), other, "non-MCP, non-builtin tools pass through");
  });
});
