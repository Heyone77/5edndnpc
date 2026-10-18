import assert from "node:assert/strict";
import { test } from "node:test";
import { createTokenArtProvider } from "../scripts/token-art.js";

const imageResponse = () => ({ ok: true, headers: { get: () => "image/webp" } });
function fixtureFetch(files, calls = []) {
  return async (url, options = {}) => {
    calls.push({ url, method: options.method ?? "GET" });
    if (options.method === "HEAD") return imageResponse();
    const category = decodeURIComponent(url.split("/").at(-1).replace(/\.txt$/, ""));
    return { ok: true, text: async () => files[category] ?? "" };
  };
}

test("selects class-appropriate art for the exact race and encodes image URLs", async () => {
  const provider = createTokenArtProvider({ random: () => 0, fetch: fixtureFetch({
    Mage: "Prompts.txt\r\nMageHalfelf (1).webp\r\nMageElfFemale (2).webp\r\nMageHumanMale (1).webp\r\n"
  }) });
  const src = await provider({ race: "Elf", role: "Wizard" });
  assert.equal(src, "https://raw.githubusercontent.com/IsThisMyRealName/too-many-tokens-dnd/main/Mage/MageElfFemale%20(2).webp");
});

test("falls back to the same race in a broader category instead of substituting another race", async () => {
  const provider = createTokenArtProvider({ random: () => 0, fetch: fixtureFetch({
    Druid: "DruidHuman (1).webp", Commoner: "CommonerHalfElfFemale (1).webp\nCommonerElfFemale (1).webp"
  }) });
  assert.match(await provider({ race: "Half-Elf", role: "Druid" }), /CommonerHalfElfFemale/);
});

test("caches category lists and successful image checks", async () => {
  const calls = [];
  const provider = createTokenArtProvider({ random: () => 0, fetch: fixtureFetch({ Mage: "MageHuman (1).webp" }, calls) });
  await provider({ race: "Human", role: "Wizard" });
  await provider({ race: "Human", role: "Sorcerer" });
  assert.equal(calls.filter(call => call.method === "GET").length, 1);
  assert.equal(calls.filter(call => call.method === "HEAD").length, 1);
});

test("ignores non-image, path-traversal and absolute URL entries", async () => {
  const calls = [];
  const provider = createTokenArtProvider({ random: () => 0, fetch: fixtureFetch({
    Commoner: "Prompts.txt\nhttps://example.org/Human.webp\n../Human.webp\nCommonerHuman (1).webp"
  }, calls) });
  assert.match(await provider({ race: "Human", role: "Bard" }), /CommonerHuman/);
  assert.ok(calls.every(call => call.url.startsWith("https://raw.githubusercontent.com/IsThisMyRealName/")));
});

test("network errors do not break generation and failed requests can be retried", async () => {
  let online = false;
  const validFetch = fixtureFetch({ Mage: "MageTiefling (1).webp" });
  const provider = createTokenArtProvider({ random: () => 0, fetch: (...args) => {
    if (!online) throw new Error("offline");
    return validFetch(...args);
  } });
  assert.equal(await provider({ race: "Tiefling", role: "Warlock" }), null);
  online = true;
  assert.match(await provider({ race: "Tiefling", role: "Warlock" }), /MageTiefling/);
});

test("a missing image is skipped in favor of another matching image", async () => {
  const baseFetch = fixtureFetch({ Scout: "ScoutGnome (1).webp\nScoutGnome (2).webp" });
  const provider = createTokenArtProvider({ random: () => 0, fetch: (url, options) => {
    if (options?.method === "HEAD" && url.endsWith("(1).webp")) return { ok: false, status: 404 };
    return baseFetch(url, options);
  } });
  assert.match(await provider({ race: "Gnome", role: "Ranger" }), /\(2\)\.webp$/);
});

test("times out stalled requests and returns a placeholder result", async () => {
  let requests = 0;
  const provider = createTokenArtProvider({ timeoutMs: 15, fetch: (_url, { signal }) => {
    requests++;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("timeout"))));
  } });
  assert.equal(await provider({ race: "Human", role: "Fighter" }), null);
  assert.equal(requests, 1);
});
