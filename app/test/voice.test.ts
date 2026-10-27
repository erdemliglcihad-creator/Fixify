/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { levelFromDb, speakable, toBase64, vadStart, vadStep, type VadEvent, type VadState } from "../src/core/voice.ts";

/** Feeds dB samples every 80 ms and returns the first event that is not "none". */
function run(samples: number[], every = 80): { event: VadEvent; at: number } {
  let state: VadState = vadStart(0);
  for (let i = 0; i < samples.length; i++) {
    const r = vadStep(state, samples[i], i * every);
    state = r.state;
    if (r.event !== "none") return { event: r.event, at: i * every };
  }
  return { event: "none", at: -1 };
}

const repeat = (db: number, ms: number) => Array.from({ length: Math.round(ms / 80) }, () => db);

test("speech then silence ends the turn after about 1.1 s", () => {
  const r = run([...repeat(-50, 800), ...repeat(-22, 1500), ...repeat(-50, 2000)]);
  assert.equal(r.event, "end");
  assert.ok(r.at >= 2300 + 1000 && r.at <= 2300 + 1300, `ended at ${r.at}`);
});

test("short clicks do not count as speech", () => {
  const clicks = [...repeat(-50, 800), -15, -50, -50, -50, -15, ...repeat(-50, 2000)];
  assert.equal(run(clicks).event, "none");
});

test("a pause in the middle of a sentence keeps listening", () => {
  const r = run([...repeat(-50, 500), ...repeat(-25, 900), ...repeat(-50, 600), ...repeat(-25, 900), ...repeat(-50, 1500)]);
  assert.equal(r.event, "end");
  assert.ok(r.at > 2900, `ended too early at ${r.at}`);
});

test("noisy room: a loud floor still detects speech above it", () => {
  const r = run([...repeat(-32, 1000), ...repeat(-12, 1200), ...repeat(-32, 1600)]);
  assert.equal(r.event, "end");
});

test("nothing said stops after the no-speech timeout, the cap ends long speech", () => {
  assert.equal(run(repeat(-50, 16_000)).event, "noSpeech");
  assert.equal(run([...repeat(-50, 400), ...repeat(-20, 31_000)]).event, "cap");
});

test("levels map to 0…1", () => {
  assert.equal(levelFromDb(undefined), 0);
  assert.equal(levelFromDb(-160), 0);
  assert.equal(levelFromDb(0), 1);
  assert.ok(levelFromDb(-30) > 0.4 && levelFromDb(-30) < 0.6);
});

test("speakable strips markdown", () => {
  const text = "## Check\n1. **Restart** the router\n- Look at the `WAN` light\n[Guide](https://x.y)";
  assert.equal(speakable(text), "Check\n1. Restart the router\nLook at the WAN light\nGuide");
});

test("base64 matches Node", () => {
  for (const n of [0, 1, 2, 3, 4, 5, 255, 1000]) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256);
    assert.equal(toBase64(bytes), Buffer.from(bytes).toString("base64"));
  }
});
