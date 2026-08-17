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
import askRulesTool from "../tools/boardgame_ask_rules.ts";
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

  const flipConv = "eval-demo-scenario-flip7";
  await startSittingTool.execute({ game_id: "flip-7" }, toolCtx(flipConv));
  const flipScenario = JSON.parse(
    (await checkScenarioTool.execute(
      { scenario: "I flipped a seventh unique card, do I bank the bonus" },
      toolCtx(flipConv),
    )).content,
  );
  check(
    "check_scenario in a sitting without worked examples abstains gracefully",
    flipScenario.game_id === "flip-7" &&
      flipScenario.abstention === true &&
      (flipScenario.abstention_reason ?? "").includes("No worked examples") &&
      !(flipScenario.abstention_reason ?? "").includes("No game specified"),
    `got game=${flipScenario.game_id} reason=${flipScenario.abstention_reason}`,
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
