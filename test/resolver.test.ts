import { test } from "node:test";
import assert from "node:assert/strict";
import { drawsItself, isPrettyTool, resolveRenderers, type Renderers } from "../src/resolver.ts";

const mine = (tool: string): Renderers => ({ renderCall: () => `pretty ${tool}`, renderResult: () => `pretty ${tool}` });
const generic = (label: string): Renderers => ({ renderCall: () => `generic ${label}`, renderResult: () => `generic ${label}` });
const base = (name: string, extra: Renderers = {}): Renderers => ({
  renderCall: () => `base ${name}`,
  renderResult: () => `base ${name}`,
  ...extra,
});
const call = (r: Renderers | undefined) => (r?.renderCall as (() => string) | undefined)?.();

function resolve(toolName: string, next: () => Renderers | undefined, over: Partial<Parameters<typeof resolveRenderers>[0]> = {}) {
  return resolveRenderers({ toolName, disabled: [], mcpTools: true, next, builtin: mine, generic, ...over });
}

test("a built-in draws with pretty over whatever would otherwise draw it, keeping its renderShell", () => {
  const r = resolve("edit", () => base("edit", { renderShell: "self" }));
  assert.equal(call(r), "pretty edit");
  assert.equal(r?.renderShell, "self");
  // A replacement under the same name (shell-background's bash) is drawn the same way.
  assert.equal(call(resolve("bash", () => base("shell-background bash"))), "pretty bash");
  // Not registered at all: pretty still draws it.
  assert.equal(call(resolve("read", () => undefined)), "pretty read");
});

test("a built-in turned off draws exactly as it would without pretty", () => {
  const r = resolve("bash", () => base("bash"), { disabled: ["bash"] });
  assert.equal(call(r), "base bash");
  assert.equal(resolve("bash", () => undefined, { disabled: ["bash"] }), undefined);
});

test("an MCP tool gets the compact renderers only when nothing draws it already", () => {
  assert.equal(call(resolve("mcp__radius__search", () => undefined)), "generic Radius Search");
  assert.equal(call(resolve("mcp__radius__search", () => ({ renderShell: "self" }))), "generic Radius Search", "renderShell alone is not a renderer");
  assert.equal(call(resolve("mcp__radius__search", () => base("own"))), "base own", "its own renderer wins");
  assert.equal(call(resolve("mcp__radius__search", () => base("own"), { mcpTools: false })), "base own");
  assert.equal(call(resolve("mcp__radius__search", () => undefined, { mcpTools: false })), undefined);
});

test("other extensions' tools pass through untouched", () => {
  assert.equal(call(resolve("subagent", () => base("subagent"))), "base subagent");
  assert.equal(resolve("subagent", () => undefined), undefined);
  assert.equal(isPrettyTool("grep"), true);
  assert.equal(isPrettyTool("subagent"), false);
  assert.equal(drawsItself(undefined), false);
  assert.equal(drawsItself({ renderResult: () => 1 }), true);
});
