import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";
import { createAnalyzer } from "./analyze.mjs";
import { RateLimiter } from "./ratelimit.mjs";
import { recognizeLines } from "./ocr.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");

// The app token keeps other devices on the network from spending the API key.
// Generated once and persisted in .env next to the key.
function ensureAppToken() {
  if (process.env.FIXIFY_APP_TOKEN) return process.env.FIXIFY_APP_TOKEN;
  const token = randomBytes(18).toString("base64url");
  fs.appendFileSync(envFile, `${fs.existsSync(envFile) ? "\n" : ""}FIXIFY_APP_TOKEN=${token}\n`);
  return token;
}

const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  model: process.env.FIXIFY_MODEL ?? "claude-opus-5-5",
  effort: process.env.FIXIFY_EFFORT ?? "medium",
  timeoutMs: Number(process.env.FIXIFY_TIMEOUT_MS ?? 120_000),
  perMinute: Number(process.env.FIXIFY_RATE_PER_MINUTE ?? 6),
  perDay: Number(process.env.FIXIFY_RATE_PER_DAY ?? 200),
};

const appToken = ensureAppToken();
const configured = Boolean(process.env.ANTHROPIC_API_KEY);

const handler = createApp({
  appToken,
  limiter: new RateLimiter({ perMinute: config.perMinute, perDay: config.perDay }),
  analyze: createAnalyzer({ model: config.model, effort: config.effort, timeoutMs: config.timeoutMs }),
  ocr: recognizeLines,
  ocrLimiter: new RateLimiter({ perMinute: 30, perDay: 2000 }),
  info: { version: "1.0.0", model: config.model, configured },
});

const server = http.createServer(handler);
server.requestTimeout = config.timeoutMs + 15_000;
server.listen(config.port, config.host, () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => `http://${i.address}:${config.port}`);
  console.log("\nFixify proxy running");
  console.log(`  Model:       ${config.model} (effort ${config.effort})`);
  console.log(`  API key:     ${configured ? "set" : "MISSING – add ANTHROPIC_API_KEY to server/.env"}`);
  console.log(`  Limits:      ${config.perMinute}/min, ${config.perDay}/day`);
  console.log("  OCR:         Tesseract (deu+eng), local – language data downloads on first use");
  console.log("\nEnter in Fixify → Settings → AI service:");
  for (const url of lan) console.log(`  Server URL:  ${url}`);
  console.log(`  App token:   ${appToken}\n`);
});
