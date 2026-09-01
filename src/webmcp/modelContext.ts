/**
 * Type declarations for the proposed WebMCP standard.
 * Spec: https://webmachinelearning.github.io/webmcp/
 * Chrome docs: https://developer.chrome.com/docs/ai/webmcp/imperative-api
 */

export interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    untrustedContentHint?: boolean;
    [key: string]: unknown;
  };
  execute: (input: Record<string, unknown>) => Promise<string | unknown> | string | unknown;
}

export interface WebMCPRegisterOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

export interface ModelContext {
  registerTool(tool: WebMCPToolDefinition, options?: WebMCPRegisterOptions): Promise<void> | void;
  getTools(options?: { fromOrigins?: string[] }): Promise<WebMCPToolDefinition[]>;
  executeTool(
    tool: WebMCPToolDefinition,
    jsonArgs: string,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
  addEventListener(type: "toolchange", listener: () => void): void;
  removeEventListener(type: "toolchange", listener: () => void): void;
}

declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}

