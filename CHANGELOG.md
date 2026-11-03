# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `rank_search_results` MCP tool and
  `rank` CLI command ranking caller-supplied codebase
  search hits; no search is run — the caller supplies
  every hit.
- Pinned score `matches * 100 - last_modified_days`
  (integer, possibly negative, echoed as-is) and pinned
  ranking order: score descending, matches descending,
  `last_modified_days` ascending, then path code-unit
  ascending. The result is the top `limit` hits
  (default 10), each carrying a 1-based `rank` by
  position in the returned list.
- File-owner context attached per hit: an owner that is
  absent, empty, or whitespace-only means the file is
  unowned and echoes as `null`; an owned file's owner
  echoes verbatim. Counts report the hits supplied and
  the number returned.
- Path-naming validation errors for malformed input and
  a duplicate-path error naming the duplicated path; no
  partial results on invalid input.
