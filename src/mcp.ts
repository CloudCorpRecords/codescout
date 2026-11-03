/**
 * codescout MCP server. Tools: rank_search_results.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The computation is pure and local: no search is run, no
 * filesystem, no network, and no configuration — the caller
 * supplies every search hit the ranking is based on.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { formatPayload, rankSearchResults, VERSION } from "./codescout.js";

const TOOLS = [
  {
    name: "rank_search_results",
    description:
      "Rank caller-supplied codebase search hits by a pinned relevance and recency score, with file-owner context attached. Returns the ranked list only; no search is run.",
    inputSchema: {
      type: "object" as const,
      properties: {
        hits: {
          type: "array",
          description: "Search hits to rank, in the caller's order",
          items: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "File the hit is in",
              },
              matches: {
                type: "integer",
                description: "Number of matches in the file",
              },
              last_modified_days: {
                type: "integer",
                description: "Days since the file last changed",
              },
              owner: {
                type: "string",
                description: "File owner (optional)",
              },
            },
            required: ["path", "matches", "last_modified_days"],
          },
        },
        limit: {
          type: "integer",
          description: "Maximum results to return (optional, default 10)",
        },
      },
      required: ["hits"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "codescout", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "rank_search_results") {
      out = rankSearchResults(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
