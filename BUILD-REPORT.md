# codescout — Build Report

MCP Rebuild 1000, Batch 19. Original program build from the
packages-100 plan (cluster H #94), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch19/codescout.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `codescout`, npm `@reneturcios/codescout`,
MCP name `io.github.CloudCorpRecords/codescout`, version
`0.1.0`, bin `codescout` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Rank
  supplied codebase search hits by relevance and recency,
  with file-owner context." — 85 chars, verified by
  count; npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/codescout:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/codescout"`),
  `tsconfig.json` (byte-identical to the reference,
  diff-verified), `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27),
  `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`rank --input <args.json>`
  where the file holds the full arguments object, `mcp`,
  `--version`; exit 2 usage / 1 runtime error, argument
  validation before any file read), `src/mcp.ts`,
  `src/types.ts`, `src/codescout.ts` (core,
  `VERSION = "0.1.0"`, `formatPayload`)
- `test/codescout.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (ci, publish, and registry-publish byte-identical to the
  reference, diff-verified; publish-container
  `IMAGE = ghcr.io/cloudcorprecords/codescout`, smoke-test
  server-name assertion `codescout`)

Plus the parity fixture at
`harness/fixtures/codescout-tools-original.json`, labelled
as a program spec from the packages-100 plan cluster H #94.

## Tools implemented (1)

- `rank_search_results` — arguments: `hits` (array,
  required, at least 1 item) and `limit` (integer,
  optional, >= 1, default 10). Each hit item: `path`
  (string, required, non-empty), `matches` (integer,
  required, >= 1), `last_modified_days` (integer,
  required, >= 0), and `owner` (string, optional).
  Required is exactly `["hits"]` at the top level and
  `["path", "matches", "last_modified_days"]` per item.

  Score is pinned: `score = matches * 100 -
  last_modified_days`, an integer, possibly negative,
  echoed as-is. Ranking order is pinned: score
  descending; ties break by matches descending; then by
  last_modified_days ascending; then by path code-unit
  ascending.

  Returns `{results, counts}`, where `results` holds the
  top `limit` hits in ranking order, one `{path, matches,
  last_modified_days, owner, score, rank}` per hit with
  keys in that order (owner null when unowned; rank
  1-based by position in the returned list), and
  `counts` is `{hits, returned}` in that key order.

  The fixture literal
  (`harness/fixtures/codescout-tools-original.json`) and
  the `src/mcp.ts` literal are identical, with no
  `$schema` and no `additionalProperties` — confirmed by
  the parity run below.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation; the core takes the full
  arguments object.
- Validation is path-naming and total: a missing,
  non-array, or empty `hits`; a non-object item; a
  missing, empty, or non-string `path`; a missing,
  non-integer, or sub-1 `matches`; a missing,
  non-integer, or negative `last_modified_days`; a
  non-string `owner`; or a present-but-non-integer-or-
  sub-1 `limit` throws an Error naming the offending
  path (e.g. `hits[0].matches must be an integer >= 1`)
  and produces no partial result (MCP: `isError`; CLI:
  exit 1). Duplicate `path` values throw
  `duplicate hit path: <path>`. Unknown extra fields are
  ignored, including inside items; a non-object
  top-level argument is treated as {}.

## Verification (foreground, this session)

- `npm test` (`tsx --test test/*.test.ts`): **49 tests,
  49 pass, 0 fail** — the score formula (including exact
  0, a negative score of −150, and a deeply negative
  −99800 echoed unclamped) with the pinned entry key
  order; the ranking levels each exercised in isolation
  (score descending regardless of input order; an
  equal-score pair decided by matches descending alone;
  an equal-matches set ordered by last_modified_days
  ascending; a fully identical set ordered by path
  code-unit ascending, including uppercase-before-
  lowercase); ranking independence from input order;
  owner playing no part in ranking; limit slicing with
  rank numbering in the returned list, limit 1, limit
  equal to and greater than the hit count, the default
  limit of 10 against 12 supplied hits (returned matches
  12..3, ranks 1..10), and exactly 10 hits unclipped;
  owner semantics (absent / empty / whitespace-only
  owners unowned and echoing null, verbatim echo of an
  owned owner with surrounding spaces, owner echo
  surviving ranking and slicing); counts with and
  without slicing; duplicate-path errors naming the
  path, a shared-prefix non-duplicate, and no partial
  result; and every validation path (hits missing /
  non-array / empty, non-object items, path missing /
  empty / non-string, matches missing / 0 rejected /
  negative / fractional / string / boolean / null /
  array / object plus 1 valid, last_modified_days
  missing / negative / fractional / string plus 0
  valid, owner non-string, limit 0 rejected / negative /
  fractional / string plus 1 valid, non-object top-level
  treated as {}, unknown extras ignored, no partial
  result).
- `npx tsc --noEmit` → exit 0; `npm run build` produced
  `dist/` with all 15 outputs.
- `dist/cli.js --version` (via node) → `0.1.0`; unknown
  command exits 2 with usage; `rank` with no `--input`
  exits 2; `rank --input <valid file>` exits 0 and prints
  the hand-checked ranking for the input `{"hits":
  [{"path": "src/search/rank.ts", "matches": 14,
  "last_modified_days": 2, "owner": "alice"}, {"path":
  "src/legacy/old-index.ts", "matches": 1,
  "last_modified_days": 240}, {"path":
  "src/search/tokenize.ts", "matches": 9,
  "last_modified_days": 30, "owner": "bob"}], "limit":
  2}` — rank.ts first with score 1398, tokenize.ts
  second with score 870, the −140 legacy hit cut by the
  limit, counts hits 3 / returned 2; `rank --input
  <invalid file>` (second hit's `matches` the number 0)
  exits 1 with `error: hits[1].matches must be an
  integer >= 1`.
- Parity: `harness/parity.py` vs
  `harness/fixtures/codescout-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (run with
  the rebuild path as an absolute path; the harness does
  not expand a `~` inside the quoted stdio command
  string). Report saved under `parity-out/`.

## Lockfile status

`package-lock.json` generated clean via Route 3 (in the
build directory with no `node_modules` present, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/codescout`, **128 package entries**. The
subsequent offline `npm install --ignore-scripts
--offline`, build, tests, and parity all ran against
this lockfile's tree.

## Gaps / honest notes

- **Pinned judgement calls** (each with a dedicated test
  where applicable): (1) an owner that is absent, empty,
  or whitespace-only means the file is unowned and echoes
  as null — the spec pins this call explicitly (the
  treeman precedent) and it is tested for absent, empty,
  and several whitespace-only values; an owned owner
  echoes verbatim, surrounding spaces included; (2) the
  last_modified_days-ascending tie-break level: with
  matches fixed, a smaller last_modified_days is exactly
  a larger score, and with score and matches both fixed
  the days are determined — so this comparator level can
  never reorder beyond what the score already decided.
  It is implemented exactly as the spec pins it and
  exercised by a dedicated equal-matches test rather
  than omitted; the path tie-break is the level that
  actually separates fully identical hits; (3) the
  inputSchema literal follows the fleet precedent
  (treeman): it carries type / description / properties
  / required only — the >= 1, >= 0, and default-10
  bounds live in the field descriptions and are enforced
  by the core's validation, not encoded as JSON Schema
  `minimum` / `default` keywords; (4) error-message
  wording follows the fleet's path-naming pattern,
  distinguishing a missing field (`hits[0].matches is
  required`) from a malformed one (`hits[0].matches
  must be an integer >= 1`), matching the spec's
  example; (5) unknown extra fields are ignored rather
  than rejected, at the top level and inside items (the
  spec says so); (6) a non-object top-level arguments
  value is treated as an empty object, so it fails as
  `hits is required`. No other spec ambiguity was found
  in the core behaviour.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
