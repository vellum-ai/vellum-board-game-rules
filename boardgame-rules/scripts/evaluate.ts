import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { askRules } from "../src/retrieve.ts";
import { checkScenario } from "../src/scenario.ts";
import {
  STALE_AFTER_MS,
  clearAllSittings,
  deleteSitting,
  getSitting,
  purgeStaleSittings,
  setStorageDir,
  sittingStoreDir,
  startSitting,
  updateSitting,
} from "../src/sitting.ts";
import type { AskResult, Sitting } from "../src/types.ts";
import { loadPluginConfig } from "../src/config.ts";
import postToolUseHook from "../hooks/post-tool-use.ts";
import { guardAskRulesResult } from "../src/result-guard.ts";
import askRulesTool from "../tools/boardgame_ask_rules.ts";
import listSupportedGamesTool from "../tools/boardgame_list_supported_games.ts";
import checkScenarioTool from "../tools/boardgame_check_scenario.ts";
import startSittingTool from "../tools/boardgame_start_sitting.ts";
import updateSittingTool from "../tools/boardgame_update_sitting.ts";

type EvalTest = {
  label?: string;
  game?: string;
  /** Optional strict edition filter, passed to askRules as editionId. */
  edition?: string;
  query: string;
  limit?: number;
  known_games?: string[];
  expect_ids?: string[];
  expect_hit_1?: boolean;
  expect_hit_3?: boolean;
  expect_hit_5?: boolean;
  expect_abstention?: boolean;
  expect_summary_contains?: string[];
  expect_summary_not_contains?: string[];
  expect_analog_known_game_ids?: string[];
  expect_analog_empty?: boolean;
  /** Scenario-mode only: assert substrings appear in the top match's expected_outcome. */
  expect_outcome_contains?: string[];
  /** Scenario-mode only: assert substrings appear anywhere in the top match's decomposition. */
  expect_decomposition_contains?: string[];
  known_limitation?: boolean;
};

type EvalSuite = {
  game: string;
  /** Which retrieval mode to route through. Defaults to "ask". */
  mode?: "ask" | "scenario";
  tests: EvalTest[];
};

const evalPath = fileURLToPath(new URL("../corpora/eval.json", import.meta.url));
const evalData = JSON.parse(readFileSync(evalPath, "utf8")) as { suites: EvalSuite[] };

// Strict keys: a misspelled or stale key in eval.json must fail loudly, not
// silently pass. (A dead suite-level `edition` once read as an applied filter
// for months; this makes that class impossible.)
const SUITE_KEYS = new Set(["game", "mode", "tests"]);
const TEST_KEYS = new Set([
  "label", "game", "edition", "query", "limit", "known_games",
  "expect_ids", "expect_hit_1", "expect_hit_3", "expect_hit_5", "expect_abstention",
  "expect_summary_contains", "expect_summary_not_contains",
  "expect_analog_known_game_ids", "expect_analog_empty",
  "expect_outcome_contains", "expect_decomposition_contains", "known_limitation",
]);
{
  const schemaErrors: string[] = [];
  evalData.suites.forEach((suite, si) => {
    for (const key of Object.keys(suite)) {
      if (!SUITE_KEYS.has(key)) schemaErrors.push(`suites[${si}] (${String(suite.game)}): unknown suite key "${key}"`);
    }
    (suite.tests ?? []).forEach((test, ti) => {
      for (const key of Object.keys(test)) {
        if (!TEST_KEYS.has(key)) schemaErrors.push(`suites[${si}].tests[${ti}] (${test.label ?? test.query}): unknown test key "${key}"`);
      }
    });
  });
  if (schemaErrors.length > 0) {
    console.error("eval.json schema errors:");
    for (const err of schemaErrors) console.error(`  ${err}`);
    process.exit(1);
  }
}
const gameFilterArg = process.argv.find((arg) => arg.startsWith("--game="))?.slice("--game=".length);
const gameFlagIndex = process.argv.indexOf("--game");
const gameFilter = gameFilterArg ?? (gameFlagIndex >= 0 ? process.argv[gameFlagIndex + 1] : undefined);

let total = 0;
let passed = 0;
let failed = 0;
let knownGaps = 0;

for (const suite of evalData.suites) {
  if (gameFilter && suite.game !== gameFilter) continue;
  const mode = suite.mode ?? "ask";
  console.log(`\n=== ${suite.game} [${mode}] ===`);
  for (const test of suite.tests) {
    total += 1;
    const gameId = test.game ?? suite.game;
    const messages: string[] = [];
    let ok = true;
    const expectedIds = new Set(test.expect_ids ?? []);

    if (mode === "scenario") {
      const result = checkScenario({
        query: test.query,
        gameId,
        editionId: test.edition,
        limit: test.limit ?? 3,
      });
      const topId = result.matches[0]?.entry_id;
      const hitIds = result.matches.map((m) => m.entry_id);
      const topOutcome = result.matches[0]?.expected_outcome ?? "";
      const topDecomp = (result.matches[0]?.decomposition ?? []).join(" | ");

      if (test.expect_abstention !== undefined && result.abstention !== test.expect_abstention) {
        ok = false;
        messages.push(`abstention: expected ${test.expect_abstention}, got ${result.abstention}`);
      }
      if (test.expect_hit_1 !== undefined) {
        const hit1 = expectedIds.size > 0 && !!topId && expectedIds.has(topId);
        if (hit1 !== test.expect_hit_1) {
          ok = false;
          messages.push(`hit@1: expected ${test.expect_hit_1}, got ${hit1} (got ${topId ?? "none"})`);
        }
        // A scenario hit@1 decided purely by the alphabetical title tiebreak
        // is a latent misroute (review on #21): require a real score margin
        // over the runner-up whenever one exists.
        const runnerUp = result.matches[1];
        if (hit1 && runnerUp && result.matches[0] && runnerUp.score >= result.matches[0].score) {
          ok = false;
          messages.push(`hit@1 won only by title tiebreak: ${topId}@${result.matches[0].score} vs ${runnerUp.entry_id}@${runnerUp.score}`);
        }
      }
      if (test.expect_hit_3 !== undefined) {
        const hit3 = hitIds.slice(0, 3).some((id) => expectedIds.has(id));
        if (hit3 !== test.expect_hit_3) {
          ok = false;
          messages.push(`hit@3: expected ${test.expect_hit_3}, got ${hit3}`);
        }
      }
      if (test.expect_outcome_contains && !result.abstention && topOutcome) {
        const lower = topOutcome.toLowerCase();
        for (const phrase of test.expect_outcome_contains) {
          if (!lower.includes(phrase.toLowerCase())) {
            ok = false;
            messages.push(`outcome missing "${phrase}"`);
          }
        }
      }
      if (test.expect_decomposition_contains && !result.abstention && topDecomp) {
        const lower = topDecomp.toLowerCase();
        for (const phrase of test.expect_decomposition_contains) {
          if (!lower.includes(phrase.toLowerCase())) {
            ok = false;
            messages.push(`decomposition missing "${phrase}"`);
          }
        }
      }
    } else {
      const result = askRules({
        query: test.query,
        gameId,
        editionId: test.edition,
        limit: test.limit ?? 5,
        knownGames: test.known_games,
      });

      if (test.expect_abstention !== undefined && result.abstention !== test.expect_abstention) {
        ok = false;
        messages.push(`abstention: expected ${test.expect_abstention}, got ${result.abstention}`);
      }
      if (test.expect_hit_1 !== undefined) {
        const hit1 = expectedIds.size > 0 && expectedIds.has(result.evidence[0]?.entry_id);
        if (hit1 !== test.expect_hit_1) {
          ok = false;
          messages.push(`hit@1: expected ${test.expect_hit_1}, got ${hit1} (got ${result.evidence[0]?.entry_id ?? "none"})`);
        }
      }
      if (test.expect_hit_3 !== undefined) {
        const hit3 = result.evidence.slice(0, 3).some((item) => expectedIds.has(item.entry_id));
        if (hit3 !== test.expect_hit_3) {
          ok = false;
          messages.push(`hit@3: expected ${test.expect_hit_3}, got ${hit3}`);
        }
      }
      if (test.expect_hit_5 !== undefined) {
        const hit5 = result.evidence.slice(0, 5).some((item) => expectedIds.has(item.entry_id));
        if (hit5 !== test.expect_hit_5) {
          ok = false;
          messages.push(`hit@5: expected ${test.expect_hit_5}, got ${hit5}`);
        }
      }

      // Factual correctness: check summary content of the top hit
      if (test.expect_summary_contains && !result.abstention && result.evidence.length > 0) {
        const summary = result.evidence[0].summary.toLowerCase();
        for (const phrase of test.expect_summary_contains) {
          if (!summary.includes(phrase.toLowerCase())) {
            ok = false;
            messages.push(`summary missing "${phrase}"`);
          }
        }
      }
      if (test.expect_summary_not_contains && !result.abstention && result.evidence.length > 0) {
        const summary = result.evidence[0].summary.toLowerCase();
        for (const phrase of test.expect_summary_not_contains) {
          if (summary.includes(phrase.toLowerCase())) {
            ok = false;
            messages.push(`summary should not contain "${phrase}"`);
          }
        }
      }

      // Analog hooks: exact set match on returned known-game ids, or explicitly empty.
      const analogIds = result.analog_hooks.map((hook) => hook.known_game_id).sort();
      if (test.expect_analog_known_game_ids) {
        const expected = [...test.expect_analog_known_game_ids].sort();
        if (JSON.stringify(analogIds) !== JSON.stringify(expected)) {
          ok = false;
          messages.push(`analog_hooks: expected [${expected.join(", ")}], got [${analogIds.join(", ")}]`);
        }
        for (const hook of result.analog_hooks) {
          if (!hook.likeness || !hook.exception) {
            ok = false;
            messages.push(`analog hook for "${hook.known_game_id}" missing likeness or exception`);
          }
        }
      }
      if (test.expect_analog_empty && result.analog_hooks.length > 0) {
        ok = false;
        messages.push(`analog_hooks: expected [], got [${analogIds.join(", ")}]`);
      }
    }

    if (ok) {
      passed += 1;
      console.log(`  ok   ${test.label ?? test.query}`);
    } else if (test.known_limitation) {
      knownGaps += 1;
      console.log(`  gap  ${test.label ?? test.query}`);
      for (const message of messages) console.log(`       ${message}`);
    } else {
      failed += 1;
      console.log(`  FAIL ${test.label ?? test.query}`);
      for (const message of messages) console.log(`       ${message}`);
    }
  }
}

// ─── Sitting store and first-play tool flow ────────────────────────────
// Runs against a temp dir so eval never touches real sitting rows.

function check(label: string, ok: boolean, detail?: string): void {
  total += 1;
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}`);
    if (detail) console.log(`       ${detail}`);
  }
}

console.log(`\n=== sittings (store + tool flow) ===`);
const sittingTempDir = mkdtempSync(join(tmpdir(), "boardgame-sittings-"));
setStorageDir(sittingTempDir);

try {
  // Store round-trip.
  const conv = "eval-conversation-1";
  const started = startSitting({
    conversationId: conv,
    gameId: "wingspan",
    editionId: "base-en-1st-2020",
    knownGames: ["Catan"],
  });
  const readBack = getSitting(conv);
  check(
    "sitting start/get round-trip",
    !started.resumed &&
      readBack?.game_id === "wingspan" &&
      readBack?.edition_id === "base-en-1st-2020" &&
      JSON.stringify(readBack?.known_games) === JSON.stringify(["catan"]),
    `got ${JSON.stringify(readBack)}`,
  );

  const resumedStart = startSitting({
    conversationId: conv,
    gameId: "wingspan",
    knownGames: ["Ticket to Ride"],
  });
  check(
    "restarting the same game resumes and merges known games",
    resumedStart.resumed &&
      JSON.stringify(resumedStart.sitting.known_games) ===
        JSON.stringify(["catan", "ticket-to-ride"]),
    `got resumed=${resumedStart.resumed} known=${JSON.stringify(resumedStart.sitting.known_games)}`,
  );

  const updated = updateSitting({
    conversationId: conv,
    lastRuling: { entry_id: "wingspan-turn-002", title: "Gain Food Action", locator: "rulebook p.5-6" },
  });
  check(
    "update records last ruling",
    updated?.last_ruling?.entry_id === "wingspan-turn-002",
    `got ${JSON.stringify(updated?.last_ruling)}`,
  );

  // Stale sittings are treated as gone, and purged.
  const staleConv = "eval-conversation-stale";
  const stale = startSitting({ conversationId: staleConv, gameId: "wingspan" }).sitting;
  stale.updated_at = new Date(Date.now() - STALE_AFTER_MS - 60_000).toISOString();
  writeFileSync(join(sittingStoreDir(), `${staleConv}.json`), JSON.stringify(stale));
  check("stale sitting is ignored on read", getSitting(staleConv) === null);

  writeFileSync(join(sittingStoreDir(), `${staleConv}.json`), JSON.stringify(stale));
  const purged = purgeStaleSittings();
  check(
    "purge removes stale rows and keeps live ones",
    purged === 1 && getSitting(conv) !== null,
    `purged=${purged}`,
  );

  check("deleteSitting removes the row", deleteSitting(conv) && getSitting(conv) === null);
  startSitting({ conversationId: "a", gameId: "wingspan" });
  startSitting({ conversationId: "b", gameId: "cribbage" });
  check("clearAllSittings wipes every row (conversations-cleared path)", clearAllSittings() === 2);

  // Demo flow through the actual tools, keyed by ToolContext.conversationId.
  const toolCtx = (conversationId: string) =>
    ({ workingDir: ".", conversationId }) as Parameters<typeof askRulesTool.execute>[1];
  const parse = (result: { content: string }) => JSON.parse(result.content) as AskResult;

  const demoConv = "eval-demo-teach-wingspan";
  const startResult = await startSittingTool.execute(
    { game_id: "wingspan", known_games: ["Catan"] },
    toolCtx(demoConv),
  );
  check("demo: teach-me-wingspan starts a sitting", startResult.isError === false);

  const gainFood = parse(await askRulesTool.execute({ query: "how do I gain food" }, toolCtx(demoConv)));
  check(
    "demo: gain food cites wingspan and analogizes to catan",
    !gainFood.abstention &&
      gainFood.game_id === "wingspan" &&
      gainFood.evidence[0]?.entry_id === "wingspan-turn-002" &&
      gainFood.analog_hooks.length === 1 &&
      gainFood.analog_hooks[0].known_game_id === "catan",
    `got ${gainFood.evidence[0]?.entry_id} analogs=[${gainFood.analog_hooks.map((h) => h.known_game_id).join(", ")}]`,
  );
  check(
    "demo: ask_rules recorded the ruling on the sitting",
    getSitting(demoConv)?.last_ruling?.entry_id === "wingspan-turn-002",
  );

  const playBird = parse(
    await askRulesTool.execute({ query: "wait how do I play a bird" }, toolCtx(demoConv)),
  );
  check(
    "demo: mid-sitting question defaults to the sitting's game",
    playBird.game_id === "wingspan" && playBird.evidence[0]?.entry_id === "wingspan-turn-005",
    `got game=${playBird.game_id} top=${playBird.evidence[0]?.entry_id}`,
  );

  const swapResult = await updateSittingTool.execute(
    { add_known_games: ["Ticket to Ride"] },
    toolCtx(demoConv),
  );
  const drawCards = parse(
    await askRulesTool.execute({ query: "draw bird cards action" }, toolCtx(demoConv)),
  );
  check(
    "demo: newly known game unlocks its own hook",
    swapResult.isError === false &&
      drawCards.analog_hooks.some((hook) => hook.known_game_id === "ticket-to-ride"),
    `analogs=[${drawCards.analog_hooks.map((h) => h.known_game_id).join(", ")}]`,
  );

  const abstained = parse(
    await askRulesTool.execute({ query: "quantum entanglement scoring rule" }, toolCtx(demoConv)),
  );
  check(
    "demo: abstention returns no analogs even with known games",
    abstained.abstention === true && abstained.analog_hooks.length === 0,
  );

  const unknownConv = "eval-demo-unknown-games";
  await startSittingTool.execute({ game_id: "wingspan", known_games: ["chess"] }, toolCtx(unknownConv));
  const citeOnly = parse(await askRulesTool.execute({ query: "how do I gain food" }, toolCtx(unknownConv)));
  check(
    "demo: unhooked known game cites without analogizing",
    !citeOnly.abstention && citeOnly.analog_hooks.length === 0,
  );

  // check_scenario sitting integration (playtest bug: hard "no game_id" error
  // during an active sitting instead of using the sitting's game).
  const scenarioConv = "eval-demo-scenario-sitting";
  await startSittingTool.execute({ game_id: "cribbage" }, toolCtx(scenarioConv));
  const scenarioHit = JSON.parse(
    (await checkScenarioTool.execute(
      { scenario: "hand of 8 7 7 6 with a 2 starter, how many points" },
      toolCtx(scenarioConv),
    )).content,
  );
  check(
    "check_scenario uses the sitting's game when game_id is omitted",
    scenarioHit.game_id === "cribbage" && scenarioHit.abstention === false && scenarioHit.matches.length > 0,
    `got game=${scenarioHit.game_id} abstention=${scenarioHit.abstention}`,
  );

  // Ark Nova has no worked examples (Flip 7 gained some), so it is the
  // graceful-abstention case: the sitting supplies the game, and the reply
  // is "no worked examples", never "no game specified".
  const noExConv = "eval-demo-scenario-no-examples";
  await startSittingTool.execute({ game_id: "ark-nova" }, toolCtx(noExConv));
  const noExScenario = JSON.parse(
    (await checkScenarioTool.execute(
      { scenario: "did I score my zoo right" },
      toolCtx(noExConv),
    )).content,
  );
  check(
    "check_scenario in a sitting without worked examples abstains gracefully",
    noExScenario.game_id === "ark-nova" &&
      noExScenario.abstention === true &&
      (noExScenario.abstention_reason ?? "").includes("No worked examples") &&
      !(noExScenario.abstention_reason ?? "").includes("No game specified"),
    `got game=${noExScenario.game_id} reason=${noExScenario.abstention_reason}`,
  );

  const noSittingScenario = JSON.parse(
    (await checkScenarioTool.execute(
      { scenario: "some scenario" },
      toolCtx("eval-demo-scenario-no-sitting"),
    )).content,
  );
  check(
    "check_scenario without sitting or game_id abstains listing games",
    noSittingScenario.abstention === true &&
      (noSittingScenario.abstention_reason ?? "").includes("No game specified"),
  );

  // Web fallback: attached only on coverage abstentions; fail-open outside
  // the daemon (plugin API unavailable here), so attempted=true, used=false,
  // abstention stays true. Answered results carry web_fallback: null.
  const fbConv = "eval-demo-web-fallback";
  await startSittingTool.execute({ game_id: "wingspan" }, toolCtx(fbConv));
  const fbAbstain = parse(
    await askRulesTool.execute(
      { query: "best starting hand strategy opening food picks" },
      toolCtx(fbConv),
    ),
  ) as AskResult & { web_fallback?: { attempted: boolean; used: boolean; disclaimer?: string } | null };
  check(
    "web fallback attaches on coverage abstention and fails open in eval env",
    fbAbstain.abstention === true &&
      fbAbstain.abstention_kind === "coverage" &&
      fbAbstain.web_fallback?.attempted === true &&
      fbAbstain.web_fallback?.used === false &&
      (fbAbstain.web_fallback?.disclaimer ?? "").includes("never as a cited ruling"),
    `got abstention=${fbAbstain.abstention} fallback=${JSON.stringify(fbAbstain.web_fallback)}`,
  );
  const fbOffDomain = parse(
    await askRulesTool.execute({ query: "how do I castle my king" }, toolCtx(fbConv)),
  ) as AskResult & { web_fallback?: { attempted: boolean; note?: string } | null };
  check(
    "web fallback skips off-domain abstentions with zero evidence",
    fbOffDomain.abstention === true &&
      fbOffDomain.abstention_kind === "coverage" &&
      fbOffDomain.web_fallback?.attempted === false &&
      (fbOffDomain.web_fallback?.note ?? "").includes("off-domain"),
    `got ${JSON.stringify(fbOffDomain.web_fallback)}`,
  );

  // Per-sitting cap: exhaust the budget with on-domain uncovered questions,
  // then confirm the next one is skipped rather than searched.
  const capConv = "eval-demo-web-fallback-cap";
  await startSittingTool.execute({ game_id: "wingspan" }, toolCtx(capConv));
  let lastCapResult: (AskResult & { web_fallback?: { attempted: boolean; note?: string } | null }) | null = null;
  // The same on-domain uncovered question each time: only the sitting's
  // attempt count changes between iterations, so the 6th call must skip.
  for (let i = 0; i < 6; i += 1) {
    lastCapResult = parse(
      await askRulesTool.execute(
        { query: "best starting hand strategy opening food picks" },
        toolCtx(capConv),
      ),
    ) as typeof lastCapResult;
  }
  check(
    "web fallback is capped per sitting (6th on-domain miss is skipped)",
    lastCapResult?.web_fallback?.attempted === false &&
      (lastCapResult?.web_fallback?.note ?? "").includes("live searches") &&
      (getSitting(capConv)?.web_fallback_attempts ?? 0) === 5,
    `attempts=${getSitting(capConv)?.web_fallback_attempts} fallback=${JSON.stringify(lastCapResult?.web_fallback)}`,
  );

  const fbAnswer = parse(
    await askRulesTool.execute({ query: "how do I gain food" }, toolCtx(fbConv)),
  ) as AskResult & { web_fallback?: unknown };
  check(
    "answered results carry web_fallback null",
    fbAnswer.abstention === false && fbAnswer.web_fallback === null,
  );
  const fbInputError = parse(
    await askRulesTool.execute({ query: "settlement rules", game_id: "catan" }, toolCtx("eval-demo-web-fallback-2")),
  ) as AskResult & { web_fallback?: unknown };
  check(
    "input-error abstentions keep the plain abstention (no fallback attempt)",
    fbInputError.abstention === true &&
      fbInputError.abstention_kind === "input" &&
      fbInputError.web_fallback === null,
  );

  // Semantic fusion safety properties (deterministic: simulated similarity
  // maps, since the harness has no embedding backend). The PARAPHRASE suite in
  // eval.json owns the claim that fusion lifts real paraphrases live; what is
  // pinned here is the other half: fusion must never lift what it should not.
  const simMap = (ids: string[], boost: string | null, value: number) => {
    const m = new Map<string, number>(ids.map((id) => [id, 0.3]));
    if (boost) m.set(boost, value);
    return m;
  };
  const evidenceIds = (game: string, query: string) =>
    askRules({ query, gameId: game }).evidence.map((e) => e.entry_id);
  const offDomain: Array<[string, string]> = [
    ["wingspan", "quantum entanglement scoring rule"],
    ["cribbage", "quantum entanglement scoring rule"],
    ["flip-7", "can I trade resources with another player during my turn for cards"],
  ];
  for (const [game, query] of offDomain) {
    const ids = evidenceIds(game, query);
    const uniform = askRules({ query, gameId: game, semanticScores: simMap(ids, null, 0.3) });
    const brushed = askRules({ query, gameId: game, semanticScores: simMap(ids, ids[0] ?? null, 0.42) });
    check(
      `semantic fusion does not lift off-domain query (uniform + mild brush): ${query.slice(0, 32)}`,
      uniform.abstention === true && brushed.abstention === true,
      `uniform=${uniform.abstention} brushed=${brushed.abstention} score=${brushed.evidence[0]?.score}`,
    );
  }
  const oneHit = askRules({ query: "who wins if we have the same score", gameId: "wingspan", semanticScores: new Map([["wingspan-rule-001", 0.9]]) });
  check("1-hit semantic map cannot lift (no background to stand out from)", oneHit.abstention === true, `got score=${oneHit.evidence[0]?.score}`);
  const twoHitGap = askRules({ query: "who wins if we have the same score", gameId: "wingspan", semanticScores: new Map([["wingspan-rule-001", 0.7], ["wingspan-rule-002", 0.3]]) });
  check("2-hit map with a clear gap lifts the stand-out (fusion is live, not dead)", !twoHitGap.abstention && twoHitGap.evidence[0]?.entry_id === "wingspan-rule-001", `got abstention=${twoHitGap.abstention}`);

  // Cost gate stays lexical under fusion: an entry that shares no vocabulary
  // but gets a similarity lift must not count as evidence for the web-fallback
  // off-domain check.
  const semOnly = askRules({ query: "how do I castle my king", gameId: "flip-7", semanticScores: new Map([["flip-7-bust", 0.8], ["flip-7-round-end", 0.3], ["flip-7-game-end", 0.3]]) });
  check(
    "lexical_evidence_count stays 0 when only similarity scored anything",
    semOnly.lexical_evidence_count === 0,
    `got lexical_evidence_count=${semOnly.lexical_evidence_count} evidence=${semOnly.evidence.length}`,
  );

  // Config loader: one validated read, unknown/invalid keys reported not
  // swallowed. The repo ships no config.json, so exercise the defaults path
  // and the effective-config echo on list_supported_games.
  const cfg = loadPluginConfig();
  check(
    "config defaults when config.json is absent",
    cfg.source === "defaults" && cfg.web_fallback === true && cfg.known_games.length === 0 && cfg.unknown_keys.length === 0,
    `got ${JSON.stringify(cfg)}`,
  );
  const listed = JSON.parse((await listSupportedGamesTool.execute({}, toolCtx("eval-cfg"))).content) as { config?: { source: string; web_fallback: boolean } };
  check(
    "list_supported_games echoes effective config",
    listed.config?.source === "defaults" && listed.config?.web_fallback === true,
  );
  // Result guard: the machine-checkable half of the cite-first invariants,
  // enforced on the serialized payload the model reads.
  const clean = JSON.stringify({ abstention: false, abstention_kind: null, analog_hooks: [{ known_game_id: "catan" }], web_fallback: null });
  check("guard passes a clean answered result through untouched", guardAskRulesResult(clean).corrections.length === 0);
  const abstainWithAnalog = guardAskRulesResult(
    JSON.stringify({ abstention: true, abstention_kind: "coverage", analog_hooks: [{ known_game_id: "catan" }], web_fallback: null }),
  );
  check(
    "guard strips analog_hooks from an abstention",
    abstainWithAnalog.corrections.includes("analog_hooks_on_abstention_stripped") &&
      (JSON.parse(abstainWithAnalog.content) as { analog_hooks: unknown[] }).analog_hooks.length === 0,
  );
  const usedNoSources = guardAskRulesResult(
    JSON.stringify({ abstention: true, abstention_kind: "coverage", analog_hooks: [], web_fallback: { attempted: true, used: true, answer: "from memory", sources: [], note: "", disclaimer: "" } }),
  );
  const usedNoSourcesParsed = JSON.parse(usedNoSources.content) as { web_fallback: { used: boolean; answer: unknown } };
  check(
    "guard downgrades web_fallback used:true without sources",
    usedNoSources.corrections.includes("web_fallback_used_without_sources_downgraded") &&
      usedNoSourcesParsed.web_fallback.used === false &&
      usedNoSourcesParsed.web_fallback.answer === null,
  );
  const fallbackOnAnswer = guardAskRulesResult(
    JSON.stringify({ abstention: false, abstention_kind: null, analog_hooks: [], web_fallback: { attempted: true, used: true, answer: "x", sources: [{ url: "https://e.x" }] } }),
  );
  check(
    "guard strips web_fallback from an answered result",
    fallbackOnAnswer.corrections.includes("web_fallback_on_answer_stripped") &&
      (JSON.parse(fallbackOnAnswer.content) as { web_fallback: unknown }).web_fallback === null,
  );
  const fallbackOnInput = guardAskRulesResult(
    JSON.stringify({ abstention: true, abstention_kind: "input", analog_hooks: [], web_fallback: { attempted: true, used: true, answer: "x", sources: [{ url: "https://e.x" }] } }),
  );
  check(
    "guard strips web_fallback from an input-error abstention",
    fallbackOnInput.corrections.includes("web_fallback_on_non_coverage_stripped"),
  );
  check("guard passes non-JSON and non-ask payloads through", guardAskRulesResult("not json").corrections.length === 0 && guardAskRulesResult(JSON.stringify({ games: [] })).corrections.length === 0);

  // Hook self-gate: only our own tool's results are touched.
  const hookLog = { warn: () => {}, info: () => {}, debug: () => {}, error: () => {} };
  const violating = JSON.stringify({ abstention: true, abstention_kind: "coverage", analog_hooks: [{ known_game_id: "catan" }], web_fallback: null });
  const ownCtx = {
    conversationId: "eval-hook",
    logger: hookLog,
    toolResponse: { type: "tool_result", tool_use_id: "tu-1", content: violating },
    messages: [{ role: "assistant", content: [{ type: "tool_use", id: "tu-1", name: "boardgame_ask_rules", input: {} }] }],
  };
  await postToolUseHook(ownCtx as unknown as Parameters<typeof postToolUseHook>[0]);
  check(
    "post-tool-use hook corrects our own tool's violating result",
    (JSON.parse(ownCtx.toolResponse.content) as { analog_hooks: unknown[] }).analog_hooks.length === 0,
  );
  const otherCtx = {
    conversationId: "eval-hook",
    logger: hookLog,
    toolResponse: { type: "tool_result", tool_use_id: "tu-2", content: violating },
    messages: [{ role: "assistant", content: [{ type: "tool_use", id: "tu-2", name: "some_other_tool", input: {} }] }],
  };
  await postToolUseHook(otherCtx as unknown as Parameters<typeof postToolUseHook>[0]);
  check("post-tool-use hook leaves other tools' results untouched", otherCtx.toolResponse.content === violating);

  // Title-vs-id (review): the tool resolves game_id (which may be an exact
  // title) to the canonical corpus_id before the semantic lookup. Outside the
  // daemon the lookup fails open, so pin the resolution itself: a title must
  // route to the same corpus and produce the same result as the id.
  const byTitle = parse(await askRulesTool.execute({ query: "how do I gain food", game_id: "Wingspan" }, toolCtx("eval-title-1")));
  const byId = parse(await askRulesTool.execute({ query: "how do I gain food", game_id: "wingspan" }, toolCtx("eval-title-2")));
  check(
    "ask by exact title resolves to the canonical corpus (semantic lookup keyed by corpus_id)",
    byTitle.game_id === "wingspan" && byTitle.game_id === byId.game_id && byTitle.evidence[0]?.entry_id === byId.evidence[0]?.entry_id,
    `title->${byTitle.game_id} id->${byId.game_id}`,
  );

  const noGame = askRules({ query: "how do I gain food" });
  check(
    "no game specified abstains and lists supported games",
    noGame.abstention === true && (noGame.abstention_reason ?? "").includes("wingspan"),
  );

  const noSittingUpdate = await updateSittingTool.execute(
    { add_known_games: ["catan"] },
    toolCtx("eval-demo-no-sitting"),
  );
  check("demo: update without a sitting is an explicit error", noSittingUpdate.isError === true);
} finally {
  setStorageDir(null);
  rmSync(sittingTempDir, { recursive: true, force: true });
}

const gapNote = knownGaps > 0 ? `, ${knownGaps} known gaps` : "";
console.log(`\n=== Results: ${passed}/${total} passed (${failed} failed${gapNote}) ===`);
process.exit(failed > 0 ? 1 : 0);
