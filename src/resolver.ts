/**
 * Choosing renderers through pi's tool-renderer resolver (pi >= 1.0.1).
 *
 * `pi.registerToolRenderer((toolName, next) => renderers)` lets an extension
 * choose how calls to ANY tool are drawn without re-registering the tool: no
 * second definition, no tool-registry refresh, nothing the model is told
 * changes, and the tool may be one that is not registered yet (an MCP tool in
 * a resumed session before its server connects). `next()` is what the
 * remaining resolvers, then the registered tool with pi's built-in renderers
 * filled in, would draw with. This is the pure decision; the extension
 * supplies the theme-dependent renderer factories. Zero dependencies.
 */
import { humanizeToolName, isMcpTool } from "./generic.ts";
import { PRETTY_TOOLS, type PrettyTool } from "./types.ts";

export interface Renderers {
  renderShell?: unknown;
  renderCall?: unknown;
  renderResult?: unknown;
  [key: string]: unknown;
}

export interface ResolveInput {
  toolName: string;
  /** Built-ins the user turned off with `/pretty off <tool>`. */
  disabled: readonly string[];
  /** The `mcpTools` setting. */
  mcpTools: boolean;
  next: () => Renderers | undefined;
  builtin: (tool: PrettyTool) => Renderers;
  generic: (label: string) => Renderers;
}

export function isPrettyTool(name: string): name is PrettyTool {
  return (PRETTY_TOOLS as readonly string[]).includes(name);
}

/** True when a definition draws itself: it carries a call or result renderer of its own. */
export function drawsItself(renderers: Renderers | undefined): boolean {
  return !!renderers && (typeof renderers.renderCall === "function" || typeof renderers.renderResult === "function");
}

/**
 * Pretty's renderers over whatever would otherwise draw the tool. A built-in,
 * or a replacement under the same name such as shell-background's bash, keeps
 * everything but `renderCall`/`renderResult` (`renderShell` included) unless
 * it is turned off, in which case it draws as it would without pretty. An MCP
 * tool gets the compact generic renderers only when nothing registered any
 * for it: renderers of its own, from the server bridge or another extension,
 * always win.
 */
export function resolveRenderers(input: ResolveInput): Renderers | undefined {
  const { toolName } = input;
  if (isPrettyTool(toolName)) {
    if (input.disabled.includes(toolName)) return input.next();
    return { ...input.next(), ...input.builtin(toolName) };
  }
  if (!input.mcpTools || !isMcpTool(toolName)) return input.next();
  const base = input.next();
  if (drawsItself(base)) return base;
  return { ...base, ...input.generic(humanizeToolName(toolName)) };
}
