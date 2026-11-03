# codescout

A codebase search is only half the job: once a search
returns dozens of files, someone still has to decide
which ones to open first. codescout makes that decision
with one fixed, inspectable rule. You hand it the hits
you already have — for each one, the file it is in, how
many matches the file holds, how many days have passed
since the file last changed, and, when you know it, who
owns the file — and it hands back the hits ranked, best
first, each with its score and the owner context
attached. It runs no search of its own and touches no
index; the ranking rule is the whole tool.

Every hit is scored the same way: `matches * 100 -
last_modified_days`. A hundred points per match means
relevance dominates, while each day of age quietly
drags a file down — an old file with a single match can
score below zero, and that negative score is reported
as-is rather than clamped. Ranking follows the score,
and ties are settled in a fixed order: more matches
first, then the more recently changed file, then the
path in code-unit order. Because the rule never
changes, the same set of hits always produces the same
ranked list, whatever order you supplied them in.

Only the top of the list comes back: `limit` caps how
many results are returned and defaults to 10. Each
returned entry carries a `rank`, its 1-based position
in the returned list, alongside the echoed `path`,
`matches`, `last_modified_days`, and `owner`. Ownership
has one pinned judgement call: an owner that is absent,
empty, or only whitespace means the file is unowned,
and its owner is reported as `null`; any other owner
string is echoed exactly as supplied. The counts report
how many hits went in and how many came back.

Malformed input — a missing or empty hit list, a hit
that is not an object, a missing, empty, or non-string
`path`, a `matches` count that is missing, fractional,
or below 1, a `last_modified_days` that is missing,
fractional, or negative, a non-string `owner`, or a
`limit` below 1 — is a validation error naming the
offending path, with no partial result. Two hits for
the same path are an error naming the duplicated path.
Unknown extra fields are ignored.

## CLI

```bash
npx @reneturcios/codescout rank --input args.json
npx @reneturcios/codescout --version
```

`args.json` contains the full arguments object:

```json
{
  "hits": [
    {
      "path": "src/search/rank.ts",
      "matches": 14,
      "last_modified_days": 2,
      "owner": "alice"
    },
    {
      "path": "src/legacy/old-index.ts",
      "matches": 1,
      "last_modified_days": 240
    },
    {
      "path": "src/search/tokenize.ts",
      "matches": 9,
      "last_modified_days": 30,
      "owner": "bob"
    }
  ],
  "limit": 2
}
```

The ranked list is printed as JSON:

```json
{
  "results": [
    {
      "path": "src/search/rank.ts",
      "matches": 14,
      "last_modified_days": 2,
      "owner": "alice",
      "score": 1398,
      "rank": 1
    },
    {
      "path": "src/search/tokenize.ts",
      "matches": 9,
      "last_modified_days": 30,
      "owner": "bob",
      "score": 870,
      "rank": 2
    }
  ],
  "counts": {
    "hits": 3,
    "returned": 2
  }
}
```

The third hit scores `1 * 100 - 240 = -140`, so the
limit of 2 leaves it out entirely.

Exit codes: `0` on success, `1` on a runtime error
(including an unreadable or invalid input file, or
invalid input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/codescout mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "codescout": {
      "command": "npx",
      "args": ["-y", "@reneturcios/codescout", "mcp"]
    }
  }
}
```

### Tools

- `rank_search_results` — Rank caller-supplied codebase
  search hits by a pinned relevance and recency score,
  with file-owner context attached.
  - `hits` (array, required, at least 1 item) — the
    search hits to rank, in the caller's order; each
    item:
    - `path` (string, required, non-empty) — file the
      hit is in
    - `matches` (integer, required, at least 1) —
      number of matches in the file
    - `last_modified_days` (integer, required, at
      least 0) — days since the file last changed
    - `owner` (string, optional) — file owner; absent,
      empty, or whitespace-only means unowned
  - `limit` (integer, optional, at least 1, default
    10) — maximum results to return

  Returns `{results, counts}`, where `results` holds
  one `{path, matches, last_modified_days, owner,
  score, rank}` per returned hit in ranking order
  (`owner` is `null` when unowned, `score` is
  `matches * 100 - last_modified_days`, and `rank` is
  1-based by position in the returned list), and
  `counts` is `{hits, returned}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/codescout
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/codescout rank --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
