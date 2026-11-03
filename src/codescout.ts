/**
 * codescout core: rank caller-supplied codebase search
 * hits by a pinned relevance and recency score, with
 * file-owner context attached.
 *
 *   rankSearchResults(args) -> { results, counts }
 *
 * Score (pinned): score = matches * 100 -
 * last_modified_days, an integer, possibly negative;
 * echoed as-is.
 *
 * Ranking order (pinned): score descending; ties break
 * by matches descending; then by last_modified_days
 * ascending; then by path code-unit ascending. (Once
 * matches and last_modified_days are both fixed the
 * score is determined, so the last two tie-breaks only
 * ever order hits identical on both — which the
 * duplicate rule below still allows across different
 * paths.)
 *
 * Ownership (pinned judgement call): an `owner` that is
 * absent, or a string that is empty or whitespace-only,
 * means the file is UNOWNED and its owner echoes as
 * null. An owned file's owner echoes verbatim.
 *
 * The result list is the top `limit` hits in ranking
 * order (limit defaults to 10); each entry is {path,
 * matches, last_modified_days, owner, score, rank}
 * with keys in that order, rank 1-based by position in
 * the returned list. counts is {hits, returned} with
 * keys in that order.
 *
 * Duplicate `path` values across hits are an error
 * naming the duplicated path. Validation is strict and
 * path-naming: any malformed input throws an Error
 * naming the offending path and no partial result is
 * produced. Unknown extra fields are ignored, including
 * inside items; a non-object top-level argument is
 * treated as {}.
 */
import type { CodescoutResult, RankedHit } from "./types.js";

export const VERSION = "0.1.0";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface HitFacts {
  path: string;
  matches: number;
  lastModifiedDays: number;
  owner: string | null;
  score: number;
}

function parseHit(item: unknown, index: number): HitFacts {
  const at = `hits[${index}]`;
  if (!isRecord(item)) throw new Error(`${at} must be an object`);

  if (item.path === undefined) throw new Error(`${at}.path is required`);
  if (typeof item.path !== "string" || item.path.length === 0) {
    throw new Error(`${at}.path must be a non-empty string`);
  }

  if (item.matches === undefined) throw new Error(`${at}.matches is required`);
  if (
    typeof item.matches !== "number" ||
    !Number.isInteger(item.matches) ||
    item.matches < 1
  ) {
    throw new Error(`${at}.matches must be an integer >= 1`);
  }

  if (item.last_modified_days === undefined) {
    throw new Error(`${at}.last_modified_days is required`);
  }
  if (
    typeof item.last_modified_days !== "number" ||
    !Number.isInteger(item.last_modified_days) ||
    item.last_modified_days < 0
  ) {
    throw new Error(`${at}.last_modified_days must be an integer >= 0`);
  }

  let owner: string | null = null;
  if (item.owner !== undefined) {
    if (typeof item.owner !== "string") {
      throw new Error(`${at}.owner must be a string`);
    }
    owner = item.owner.trim().length === 0 ? null : item.owner;
  }

  return {
    path: item.path,
    matches: item.matches,
    lastModifiedDays: item.last_modified_days,
    owner,
    score: item.matches * 100 - item.last_modified_days,
  };
}

function compareHits(a: HitFacts, b: HitFacts): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.matches !== b.matches) return b.matches - a.matches;
  if (a.lastModifiedDays !== b.lastModifiedDays) {
    return a.lastModifiedDays - b.lastModifiedDays;
  }
  if (a.path < b.path) return -1;
  if (a.path > b.path) return 1;
  return 0;
}

/** Rank caller-supplied codebase search hits. */
export function rankSearchResults(args: unknown): CodescoutResult {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};

  if (raw.hits === undefined) throw new Error("hits is required");
  if (!Array.isArray(raw.hits) || raw.hits.length === 0) {
    throw new Error("hits must be a non-empty array");
  }

  let limit = 10;
  if (raw.limit !== undefined) {
    if (
      typeof raw.limit !== "number" ||
      !Number.isInteger(raw.limit) ||
      raw.limit < 1
    ) {
      throw new Error("limit must be an integer >= 1");
    }
    limit = raw.limit;
  }

  const facts = raw.hits.map((item, i) => parseHit(item, i));

  const seen = new Set<string>();
  for (const f of facts) {
    if (seen.has(f.path)) {
      throw new Error(`duplicate hit path: ${f.path}`);
    }
    seen.add(f.path);
  }

  const ranked = [...facts].sort(compareHits);
  const results: RankedHit[] = ranked.slice(0, limit).map((f, i) => ({
    path: f.path,
    matches: f.matches,
    last_modified_days: f.lastModifiedDays,
    owner: f.owner,
    score: f.score,
    rank: i + 1,
  }));

  return {
    results,
    counts: { hits: facts.length, returned: results.length },
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
