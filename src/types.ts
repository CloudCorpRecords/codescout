/**
 * codescout types.
 *
 * codescout ranks caller-supplied codebase search hits.
 * For each hit the caller supplies the file it is in, how
 * many matches the file holds, how many days have passed
 * since the file last changed, and optionally who owns
 * the file. From that data alone, as pure local
 * computation, codescout reports:
 *
 *   - the top hits in pinned ranking order, each with
 *     its owner (null when unowned), its score, and a
 *     1-based rank by position in the returned list
 *   - counts: how many hits were supplied and how many
 *     were returned
 *
 * The score is pinned: matches * 100 -
 * last_modified_days, an integer that may be negative.
 * No search is run and no filesystem, beyond the CLI's
 * input file, is ever touched.
 */

/** One ranked search hit in the returned list. */
export interface RankedHit {
  /** File the hit is in, echoed from the input. */
  path: string;
  /** Number of matches in the file, echoed. */
  matches: number;
  /** Days since the file last changed, echoed. */
  last_modified_days: number;
  /** Owner name echoed verbatim, or null when unowned. */
  owner: string | null;
  /** Pinned score: matches * 100 - last_modified_days. */
  score: number;
  /** 1-based position in the returned list. */
  rank: number;
}

/** Hit tallies for one ranking. */
export interface CodescoutCounts {
  /** Number of hits supplied. */
  hits: number;
  /** Number of hits returned (after the limit). */
  returned: number;
}

/** The full ranking result. */
export interface CodescoutResult {
  /** The top hits in ranking order, up to the limit. */
  results: RankedHit[];
  /** Hit tallies: supplied and returned. */
  counts: CodescoutCounts;
}
