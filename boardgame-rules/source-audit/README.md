# Board Game Rules Source Audit

Version `1.3.0` is the discovery layer for the board-game rules plugin. It records the fixed top 50 from BoardGameGeek Geeklist 372705 and audits publisher/developer source availability without redistributing rulebook text.

## Files

- `data/source-audit-registry.v1.3.0.json`: versioned registry with list provenance, derived rank, source records, rights status, edition fields, negative search results, and fallback policy.
- `data/bgg-top50-derived.v1.0.0.json`: the 50-game identity snapshot derived from the public BGG API response.
- `scripts/merge_sources.py`: reproducible merge script for this audit snapshot.

## Current audit result

The registry records every game in the fixed #1-#50 snapshot. It distinguishes three outcomes: official rules/download material located, official publisher/developer source located but rules not confirmed, and no official rules source located after this pass. The current registry summary is 28 found, 15 official leads, and 7 gaps. Counts are stored in the JSON summary and are intentionally bounded to this search pass.

Explicit permission to index and redistribute full text is `0`. This is intentional. A public publisher page or PDF is not treated as permission.

## Ranking provenance

The BGG HTML page is Cloudflare-protected in the research environment. The registry uses the public JSON endpoints:

- `https://api.geekdo.com/api/geeklists/372705`
- `https://api.geekdo.com/api/listitems?page={page}&listid=372705`

The list metadata reports `ordinalDirection: descending` and `sortType: user`. The four API pages contain 100 items in user-defined order. The final item, The Castles of Burgundy, says it is the author's number 1. Therefore the derived list rank is `101 - one_based_api_sequence_position`. This is distinct from each game's global BGG rank. Do not sort by postdate or numeric list-item ID.

## Rights boundary

A publicly reachable publisher page or PDF is a source lead, not permission to copy, index, or redistribute full text. Full-text ingestion requires explicit permission or a license that permits it. User-submitted material remains quarantined until provenance, edition, identity, stable URL or checksum, and permission status are reviewed.

The Wingspan proof of concept formerly at `wingspan-rules/` has been merged into `../corpora/wingspan.json` (its unique FAQ/errata entries; see that corpus's `migration` block). This registry is unchanged by that merge.

## Location note

This audit registry originally lived at the repo root as `source-audit/`; it moved under `boardgame-rules/` when the repo unified into a single package. `data/game-index.json` and `data/catalogue-manifest.v1.0.0.json` moved here from the former `interpreters/data/` for the same reason.
