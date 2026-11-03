import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankSearchResults } from "../src/codescout.js";

/**
 * All tests are pure local computation over inline search
 * hits: no search, no filesystem, no network. The pinned
 * score formula (including a negative score), each of
 * the four ranking levels exercised in isolation, limit
 * slicing with rank numbering after slicing, the default
 * limit of 10, the owner null semantics (absent, empty,
 * whitespace-only, verbatim echo), the duplicate-path
 * error, and every validation path are each pinned.
 */

type H = Record<string, unknown>;

const hit = (over: H = {}): H => ({
  path: "src/a.ts",
  matches: 3,
  last_modified_days: 10,
  owner: "alice",
  ...over,
});

const rank = (hits: unknown, over: H = {}) =>
  rankSearchResults({ hits, ...over });

const one = (over: H = {}) => rank([hit(over)]).results[0];

describe("rankSearchResults — score formula (pinned)", () => {
  it("score is matches * 100 - last_modified_days", () => {
    assert.equal(one({ matches: 3, last_modified_days: 10 }).score, 290);
    assert.equal(one({ matches: 1, last_modified_days: 0 }).score, 100);
    assert.equal(one({ matches: 12, last_modified_days: 45 }).score, 1155);
  });

  it("a score of exactly 0 is echoed as 0", () => {
    assert.equal(one({ matches: 1, last_modified_days: 100 }).score, 0);
  });

  it("a negative score is possible and echoed as-is", () => {
    const out = one({ matches: 1, last_modified_days: 250 });
    assert.equal(out.score, -150);
  });

  it("a deeply negative score is echoed as-is, never clamped", () => {
    const out = one({ matches: 2, last_modified_days: 100000 });
    assert.equal(out.score, -99800);
  });

  it("a single hit echoes every field with rank 1 and keys in the pinned order", () => {
    const out = rank([hit({})]);
    assert.deepEqual(out.results[0], {
      path: "src/a.ts",
      matches: 3,
      last_modified_days: 10,
      owner: "alice",
      score: 290,
      rank: 1,
    });
    assert.deepEqual(Object.keys(out.results[0]), [
      "path",
      "matches",
      "last_modified_days",
      "owner",
      "score",
      "rank",
    ]);
    assert.deepEqual(Object.keys(out), ["results", "counts"]);
    assert.deepEqual(Object.keys(out.counts), ["hits", "returned"]);
  });
});

describe("rankSearchResults — ranking order", () => {
  it("primary level: higher score ranks first, regardless of input order", () => {
    const out = rank([
      hit({ path: "src/low.ts", matches: 1, last_modified_days: 0 }),
      hit({ path: "src/high.ts", matches: 5, last_modified_days: 0 }),
      hit({ path: "src/mid.ts", matches: 3, last_modified_days: 0 }),
    ]);
    assert.deepEqual(
      out.results.map((r) => r.path),
      ["src/high.ts", "src/mid.ts", "src/low.ts"],
    );
    assert.deepEqual(
      out.results.map((r) => r.score),
      [500, 300, 100],
    );
  });

  it("recency matters within the score: same matches, fewer days ranks first", () => {
    const out = rank([
      hit({ path: "src/old.ts", matches: 2, last_modified_days: 90 }),
      hit({ path: "src/new.ts", matches: 2, last_modified_days: 5 }),
    ]);
    assert.deepEqual(
      out.results.map((r) => r.path),
      ["src/new.ts", "src/old.ts"],
    );
  });

  it("tie-break level 2 in isolation: equal scores break by matches descending", () => {
    // Both score 100: 2 matches aged 100 days vs 1 match aged 0 days.
    // Score is tied, so matches alone decides — the 2-match hit wins
    // even though it is far older.
    const out = rank([
      hit({ path: "src/one.ts", matches: 1, last_modified_days: 0 }),
      hit({ path: "src/two.ts", matches: 2, last_modified_days: 100 }),
    ]);
    assert.deepEqual(
      out.results.map((r) => r.score),
      [100, 100],
    );
    assert.deepEqual(
      out.results.map((r) => r.path),
      ["src/two.ts", "src/one.ts"],
    );
  });

  it("tie-break level 3 in isolation: equal matches order by last_modified_days ascending", () => {
    // Matches are equal, so after the score the only remaining
    // discriminator before path is last_modified_days: the fresher
    // file comes first. (With matches fixed, a smaller
    // last_modified_days is exactly a larger score, so this level
    // can only ever confirm the score order — pinned here so the
    // comparator level is exercised on its own terms.)
    const out = rank([
      hit({ path: "src/stale.ts", matches: 4, last_modified_days: 40 }),
      hit({ path: "src/fresh.ts", matches: 4, last_modified_days: 4 }),
      hit({ path: "src/mid.ts", matches: 4, last_modified_days: 20 }),
    ]);
    assert.deepEqual(
      out.results.map((r) => r.path),
      ["src/fresh.ts", "src/mid.ts", "src/stale.ts"],
    );
    assert.deepEqual(
      out.results.map((r) => r.last_modified_days),
      [4, 20, 40],
    );
  });

  it("tie-break level 4 in isolation: identical matches and days order by path code-unit ascending", () => {
    const out = rank([
      hit({ path: "src/zeta.ts", matches: 2, last_modified_days: 7 }),
      hit({ path: "src/alpha.ts", matches: 2, last_modified_days: 7 }),
      hit({ path: "src/mid.ts", matches: 2, last_modified_days: 7 }),
    ]);
    assert.deepEqual(
      out.results.map((r) => r.path),
      ["src/alpha.ts", "src/mid.ts", "src/zeta.ts"],
    );
    assert.deepEqual(
      out.results.map((r) => r.rank),
      [1, 2, 3],
    );
  });

  it("path tie-break is code-unit order: uppercase sorts before lowercase", () => {
    const out = rank([
      hit({ path: "src/a.ts", matches: 1, last_modified_days: 1 }),
      hit({ path: "src/B.ts", matches: 1, last_modified_days: 1 }),
    ]);
    // "B" is code unit 66, "a" is 97: B.ts first, not locale order.
    assert.deepEqual(
      out.results.map((r) => r.path),
      ["src/B.ts", "src/a.ts"],
    );
  });

  it("the full ranking is independent of the caller's input order", () => {
    const hits = [
      hit({ path: "src/a.ts", matches: 1, last_modified_days: 300 }),
      hit({ path: "src/b.ts", matches: 6, last_modified_days: 10 }),
      hit({ path: "src/c.ts", matches: 6, last_modified_days: 10 }),
      hit({ path: "src/d.ts", matches: 2, last_modified_days: 100 }),
    ];
    const forward = rank(hits).results.map((r) => r.path);
    const reversed = rank([...hits].reverse()).results.map((r) => r.path);
    assert.deepEqual(forward, ["src/b.ts", "src/c.ts", "src/d.ts", "src/a.ts"]);
    assert.deepEqual(reversed, forward);
  });

  it("owner plays no part in the ranking", () => {
    const { owner: _drop, ...unowned } = hit({
      path: "src/unowned.ts",
      matches: 5,
      last_modified_days: 0,
    });
    const out = rank([
      hit({ path: "src/owned.ts", matches: 5, last_modified_days: 0 }),
      unowned,
    ]);
    // Identical score-relevant fields: path order decides, and the
    // owned file does not outrank the unowned one.
    assert.deepEqual(
      out.results.map((r) => r.path),
      ["src/owned.ts", "src/unowned.ts"],
    );
  });
});

describe("rankSearchResults — limit and rank numbering", () => {
  const many = (n: number): H[] =>
    Array.from({ length: n }, (_, i) => ({
      path: `src/f${String(i).padStart(2, "0")}.ts`,
      matches: i + 1,
      last_modified_days: 0,
    }));

  it("limit slices the ranked list to the top hits only", () => {
    const out = rank(
      [
        hit({ path: "src/a.ts", matches: 1, last_modified_days: 0 }),
        hit({ path: "src/b.ts", matches: 9, last_modified_days: 0 }),
        hit({ path: "src/c.ts", matches: 5, last_modified_days: 0 }),
      ],
      { limit: 2 },
    );
    assert.deepEqual(
      out.results.map((r) => r.path),
      ["src/b.ts", "src/c.ts"],
    );
    assert.deepEqual(out.counts, { hits: 3, returned: 2 });
  });

  it("rank is 1-based by position in the returned (sliced) list", () => {
    const out = rank(many(6), { limit: 3 });
    assert.deepEqual(
      out.results.map((r) => r.path),
      ["src/f05.ts", "src/f04.ts", "src/f03.ts"],
    );
    assert.deepEqual(
      out.results.map((r) => r.rank),
      [1, 2, 3],
    );
  });

  it("limit 1 returns only the single best hit with rank 1", () => {
    const out = rank(many(4), { limit: 1 });
    assert.equal(out.results.length, 1);
    assert.equal(out.results[0].path, "src/f03.ts");
    assert.equal(out.results[0].rank, 1);
    assert.deepEqual(out.counts, { hits: 4, returned: 1 });
  });

  it("a limit equal to the hit count returns everything", () => {
    const out = rank(many(3), { limit: 3 });
    assert.equal(out.results.length, 3);
    assert.deepEqual(out.counts, { hits: 3, returned: 3 });
  });

  it("a limit larger than the hit count returns everything, no padding", () => {
    const out = rank(many(2), { limit: 50 });
    assert.equal(out.results.length, 2);
    assert.deepEqual(out.counts, { hits: 2, returned: 2 });
  });

  it("the default limit is 10 when more than 10 hits are supplied", () => {
    const out = rank(many(12));
    assert.equal(out.results.length, 10);
    assert.deepEqual(out.counts, { hits: 12, returned: 10 });
    // matches run 1..12 at 0 days, so the top 10 are matches 12..3.
    assert.deepEqual(
      out.results.map((r) => r.matches),
      [12, 11, 10, 9, 8, 7, 6, 5, 4, 3],
    );
    assert.deepEqual(
      out.results.map((r) => r.rank),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    );
    assert.equal(out.results[0].path, "src/f11.ts");
    assert.equal(out.results[9].path, "src/f02.ts");
  });

  it("exactly 10 hits with no limit returns all 10", () => {
    const out = rank(many(10));
    assert.equal(out.results.length, 10);
    assert.deepEqual(out.counts, { hits: 10, returned: 10 });
  });
});

describe("rankSearchResults — owner semantics (pinned judgement call)", () => {
  it("an absent owner means unowned and echoes as null", () => {
    const { owner: _drop, ...rest } = hit();
    const out = rank([rest]).results[0];
    assert.equal(out.owner, null);
    assert.equal(out.path, "src/a.ts");
  });

  it("an empty-string owner means unowned and echoes as null", () => {
    assert.equal(one({ owner: "" }).owner, null);
  });

  it("a whitespace-only owner means unowned and echoes as null", () => {
    for (const owner of [" ", "   ", "\t", " \t\n "]) {
      assert.equal(one({ owner }).owner, null);
    }
  });

  it("an owned file's owner echoes verbatim, including surrounding spaces", () => {
    assert.equal(one({ owner: " alice " }).owner, " alice ");
    assert.equal(one({ owner: "team/search" }).owner, "team/search");
  });

  it("owner echoes ride along through ranking and slicing unchanged", () => {
    const out = rank(
      [
        hit({ path: "src/a.ts", matches: 1, last_modified_days: 0, owner: "zed" }),
        hit({ path: "src/b.ts", matches: 8, last_modified_days: 0, owner: "amy" }),
      ],
      { limit: 1 },
    );
    assert.equal(out.results[0].owner, "amy");
  });
});

describe("rankSearchResults — counts", () => {
  it("counts report hits supplied and returned with no slicing", () => {
    const out = rank([hit({}), hit({ path: "src/b.ts" })]);
    assert.deepEqual(out.counts, { hits: 2, returned: 2 });
  });

  it("counts.hits counts every supplied hit even when the limit cuts", () => {
    const out = rank(
      [hit({}), hit({ path: "src/b.ts" }), hit({ path: "src/c.ts" })],
      { limit: 1 },
    );
    assert.deepEqual(out.counts, { hits: 3, returned: 1 });
  });
});

describe("rankSearchResults — duplicate paths", () => {
  it("duplicate path values are an error naming the duplicated path", () => {
    assert.throws(() => rank([hit({}), hit({ matches: 9 })]), {
      message: "duplicate hit path: src/a.ts",
    });
  });

  it("the error names the second occurrence's path when several hits are present", () => {
    assert.throws(
      () =>
        rank([
          hit({ path: "src/a.ts" }),
          hit({ path: "src/b.ts" }),
          hit({ path: "src/b.ts", matches: 7 }),
        ]),
      { message: "duplicate hit path: src/b.ts" },
    );
  });

  it("paths that merely share a prefix are not duplicates", () => {
    const out = rank([hit({ path: "src/a.ts" }), hit({ path: "src/a.ts.bak" })]);
    assert.equal(out.counts.hits, 2);
  });

  it("no partial result is produced on a duplicate", () => {
    assert.throws(() => rank([hit({}), hit({})]));
  });
});

describe("rankSearchResults — validation", () => {
  const throws = (args: unknown, message: string) =>
    assert.throws(() => rankSearchResults(args), { message });

  it("hits missing is an error naming hits", () => {
    throws({}, "hits is required");
    throws({ limit: 3 }, "hits is required");
  });

  it("a non-object top-level argument is treated as {} and fails on hits", () => {
    throws(null, "hits is required");
    throws([], "hits is required");
    throws("x", "hits is required");
    throws(42, "hits is required");
    throws(undefined, "hits is required");
  });

  it("hits not an array or empty names hits", () => {
    throws({ hits: "x" }, "hits must be a non-empty array");
    throws({ hits: {} }, "hits must be a non-empty array");
    throws({ hits: 3 }, "hits must be a non-empty array");
    throws({ hits: [] }, "hits must be a non-empty array");
  });

  it("an item that is not an object names its index", () => {
    throws({ hits: ["x"] }, "hits[0] must be an object");
    throws({ hits: [null] }, "hits[0] must be an object");
    throws({ hits: [[]] }, "hits[0] must be an object");
    throws({ hits: [hit({}), 7] }, "hits[1] must be an object");
  });

  it("path missing, empty, or non-string names hits[i].path", () => {
    const { path: _p, ...noPath } = hit();
    throws({ hits: [noPath] }, "hits[0].path is required");
    throws(
      { hits: [hit({ path: "" })] },
      "hits[0].path must be a non-empty string",
    );
    throws(
      { hits: [hit({ path: 42 })] },
      "hits[0].path must be a non-empty string",
    );
    throws(
      { hits: [hit({}), hit({ path: null })] },
      "hits[1].path must be a non-empty string",
    );
  });

  it("matches missing names hits[i].matches as required", () => {
    const { matches: _m, ...noMatches } = hit();
    throws({ hits: [noMatches] }, "hits[0].matches is required");
    throws(
      { hits: [hit({}), (() => { const { matches: _x, ...r } = hit({ path: "src/b.ts" }); return r; })()] },
      "hits[1].matches is required",
    );
  });

  it("matches 0 is rejected: matches must be an integer >= 1", () => {
    throws(
      { hits: [hit({ matches: 0 })] },
      "hits[0].matches must be an integer >= 1",
    );
  });

  it("matches negative, fractional, or non-numeric names hits[i].matches", () => {
    for (const bad of [-1, -100, 1.5, 0.5, "3", true, null, [], {}]) {
      throws(
        { hits: [hit({ matches: bad })] },
        "hits[0].matches must be an integer >= 1",
      );
    }
    throws(
      { hits: [hit({}), hit({ path: "src/b.ts", matches: "yes" })] },
      "hits[1].matches must be an integer >= 1",
    );
  });

  it("matches of 1 is valid (the minimum)", () => {
    assert.equal(one({ matches: 1 }).matches, 1);
  });

  it("last_modified_days missing names hits[i].last_modified_days as required", () => {
    const { last_modified_days: _l, ...noDays } = hit();
    throws(
      { hits: [noDays] },
      "hits[0].last_modified_days is required",
    );
  });

  it("last_modified_days non-integer or negative names hits[i].last_modified_days", () => {
    for (const bad of [-1, -100, 1.5, 0.5, "3", true, null, [], {}]) {
      throws(
        { hits: [hit({ last_modified_days: bad })] },
        "hits[0].last_modified_days must be an integer >= 0",
      );
    }
  });

  it("last_modified_days of 0 is valid", () => {
    assert.equal(one({ last_modified_days: 0 }).last_modified_days, 0);
  });

  it("owner present but not a string names hits[i].owner", () => {
    for (const bad of [42, true, null, [], {}]) {
      throws(
        { hits: [hit({ owner: bad })] },
        "hits[0].owner must be a string",
      );
    }
  });

  it("limit 0 is rejected: limit must be an integer >= 1", () => {
    throws({ hits: [hit({})], limit: 0 }, "limit must be an integer >= 1");
  });

  it("limit negative, fractional, or non-numeric names limit", () => {
    for (const bad of [-1, -10, 2.5, "10", true, null, [], {}]) {
      throws(
        { hits: [hit({})], limit: bad },
        "limit must be an integer >= 1",
      );
    }
  });

  it("limit of 1 is valid (the minimum)", () => {
    assert.equal(rank([hit({})], { limit: 1 }).results.length, 1);
  });

  it("unknown extra fields are ignored, including inside items", () => {
    const out = rankSearchResults({
      hits: [hit({ snippet: "const x = 1", line: 42 })],
      generated_by: "test",
    });
    assert.equal(out.results[0].path, "src/a.ts");
    assert.deepEqual(out.counts, { hits: 1, returned: 1 });
  });

  it("no partial result is produced on invalid input deep in the list", () => {
    assert.throws(() =>
      rank([
        hit({}),
        hit({ path: "src/b.ts" }),
        hit({ path: "src/c.ts", matches: 0 }),
      ]),
    );
  });
});
