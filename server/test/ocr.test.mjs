import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { recognizeLines, shutdownOcr } from "../src/ocr.mjs";
import { createApp } from "../src/app.mjs";
import { RateLimiter } from "../src/ratelimit.mjs";

const fixture = fs.readFileSync(new URL("./fixtures/error-screen.png", import.meta.url));

after(() => shutdownOcr());

// Real Tesseract run. Needs the language data (downloaded once into server/.tesseract-cache).
test("recognizes text lines with normalized top-left boxes", { skip: process.env.FIXIFY_SKIP_OCR === "1", timeout: 180_000 }, async () => {
  const blocks = await recognizeLines(fixture, { width: 1200, height: 800 });
  const title = blocks.find((b) => /printer\s*offline/i.test(b.text));
  assert.ok(title, `expected "Printer offline" in ${JSON.stringify(blocks.map((b) => b.text))}`);
  // Drawn at x=100, y≈120 on a 1200x800 image.
  assert.ok(Math.abs(title.box.x - 100 / 1200) < 0.03, `x=${title.box.x}`);
  assert.ok(title.box.y > 0.12 && title.box.y < 0.22, `y=${title.box.y}`);
  const code = blocks.find((b) => /0x8007/.test(b.text));
  assert.ok(code && code.box.y > title.box.y + 0.4, "second line is further down");
  assert.deepEqual(blocks.map((b) => b.id), blocks.map((_, i) => `t${i + 1}`));
});

test("HTTP /v1/ocr: token, validation, CORS and result", async () => {
  let received;
  const server = http.createServer(
    createApp({
      appToken: "tok",
      limiter: new RateLimiter({ perMinute: 10, perDay: 10 }),
      analyze: async () => {
        throw new Error("not used");
      },
      ocr: async (buffer, size) => {
        received = { bytes: buffer.length, size };
        return [{ id: "t1", text: "Hi", confidence: 0.9, box: { x: 0, y: 0, width: 0.1, height: 0.1 } }];
      },
      info: { version: "test", model: "m", configured: false },
      log: { info() {}, warn() {}, error() {} },
    }),
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, token = "tok") =>
    fetch(`${base}/v1/ocr`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  try {
    const pre = await fetch(`${base}/v1/ocr`, { method: "OPTIONS" });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get("access-control-allow-origin"), "*");

    assert.equal((await post({}, "bad")).status, 401);
    assert.equal((await post({ mediaType: "image/gif", data: "x", width: 1, height: 1 })).status, 400);

    // OCR works even when no Anthropic key is configured: it never leaves this computer.
    const ok = await post({ mediaType: "image/png", data: fixture.toString("base64"), width: 1200, height: 800 });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).blocks[0].text, "Hi");
    assert.deepEqual(received, { bytes: fixture.length, size: { width: 1200, height: 800 } });
  } finally {
    server.close();
  }
});
