import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { askRules } from "../src/retrieve.ts";

type EvalTest = {
  label?: string;
  game?: string;
  query: string;
  limit?: number;
  expect_ids?: string[];
  expect_hit_1?: boolean;
  expect_hit_3?: boolean;
  expect_hit_5?: boolean;
  expect_abstention?: boolean;
  known_limitation?: boolean;
};

type EvalSuite = {
  game: string;
  edition?: string;
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
  console.log(`\n=== ${suite.game} (${suite.edition ?? "default"}) ===`);
  for (const test of suite.tests) {
    total += 1;
    const result = askRules({
      query: test.query,
      gameId: test.game ?? suite.game,
      limit: test.limit ?? 5,
    });
    const expectedIds = new Set(test.expect_ids ?? []);
    const messages: string[] = [];
    let ok = true;

    if (test.expect_abstention !== undefined && result.abstention !== test.expect_abstention) {
      ok = false;
      messages.push(`abstention: expected ${test.expect_abstention}, got ${result.abstention}`);
    }
    if (test.expect_hit_1 !== undefined) {
      const hit1 = expectedIds.size > 0 && expectedIds.has(result.evidence[0]?.entry_id);
      if (hit1 !== test.expect_hit_1) {
        ok = false;
        messages.push(`hit@1: expected ${test.expect_hit_1}, got ${hit1}`);
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

    if (ok) {
      passed += 1;
      console.log(`  ok ${test.label ?? test.query}`);
    } else if (test.known_limitation) {
      knownGaps += 1;
      console.log(`  known-gap ${test.label ?? test.query}`);
      for (const message of messages) console.log(`     ${message}`);
    } else {
      failed += 1;
      console.log(`  fail ${test.label ?? test.query}`);
      for (const message of messages) console.log(`     ${message}`);
    }
  }
}

const gapNote = knownGaps > 0 ? `, ${knownGaps} known gaps` : "";
console.log(`\n=== Results: ${passed}/${total} passed (${failed} failed${gapNote}) ===`);
process.exit(failed > 0 ? 1 : 0);
