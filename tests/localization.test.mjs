import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { generateRandomNpc, CLASSES, RACES } from "../scripts/npc-generator.js";

function setup(lang) {
  const strings = JSON.parse(readFileSync(new URL(`../lang/${lang}.json`, import.meta.url), "utf8"));
  globalThis.game = { packs: new Map(), i18n: {
    lang, localize: key => strings[key] ?? key,
    format: (key, data) => (strings[key] ?? key).replace(/\{(\w+)\}/g, (_match, name) => String(data[name]))
  } };
  let id = 0;
  globalThis.foundry = { utils: { randomID: () => String(++id).padStart(16, "0") } };
}

test("Russian NPC text uses Cyrillic names, biographies and generated features without changing rolls", async () => {
  setup("ru");
  const npc = await generateRandomNpc({ race: "Human", role: "Rogue", level: 11 });
  assert.match(npc.name, /^[А-ЯЁа-яё -]+$/);
  assert.equal(npc.prototypeToken.name, npc.name);
  assert.match(npc.system.details.biography.value, /Раса: Человек, класс: Плут/);
  assert.doesNotMatch(npc.system.details.biography.value.replace(/<[^>]*>/g, ""), /[A-Za-z]/);
  const feature = npc.items.find(item => item.type === "feat");
  assert.equal(feature.name, "Скрытая атака");
  assert.match(feature.system.description.value, /6к6/);
  assert.deepEqual(feature.system.damage.parts, [["6d6", "piercing"]]);
  assert.equal(npc.system.details.source.custom, "Плут");
});

test("English generated names and feature text retain their original language", async () => {
  setup("en");
  const npc = await generateRandomNpc({ race: "Human", role: "Rogue", level: 1 });
  assert.match(npc.name, /^[A-Za-z -]+$/);
  assert.match(npc.system.details.biography.value, /Race: Human, Class: Rogue/);
  assert.equal(npc.items.find(item => item.type === "feat").name, "Sneak Attack");
});

test("language dictionaries provide identical keys and template placeholders", () => {
  const en = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));
  const ru = JSON.parse(readFileSync(new URL("../lang/ru.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    assert.deepEqual((ru[key].match(/\{\w+\}/g) ?? []).sort(), (en[key].match(/\{\w+\}/g) ?? []).sort(), key);
    assert.ok(!ru[key].includes("??"), `Invalid encoding: ${key}`);
    if (key.startsWith("5edndnpc.names.") && ru[key]) assert.match(ru[key], /^[А-ЯЁа-яё -]+$/, key);
  }
});

test("switching languages changes display text without changing generated mechanics", async () => {
  const originalRandom = Math.random;
  const originalWarn = console.warn;
  console.warn = () => {};
  const mechanics = npc => ({
    abilities: npc.system.abilities, attributes: npc.system.attributes,
    spells: npc.system.spells, traits: npc.system.traits,
    items: npc.items.map(item => {
      const { description, ...system } = item.system;
      return { type: item.type, system };
    })
  });
  try {
    for (const role of CLASSES) for (const race of RACES) for (const level of [1, 20]) {
      const samples = [];
      for (const language of ["en", "ru"]) {
        setup(language);
        let seed = level * 8191 + CLASSES.indexOf(role) * 97 + RACES.indexOf(race);
        Math.random = () => {
          seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        samples.push(await generateRandomNpc({ role, race, level }));
      }
      assert.deepEqual(mechanics(samples[1]), mechanics(samples[0]), `${role}/${race}/${level}`);
      assert.match(samples[1].name, /^[А-ЯЁа-яё -]+$/);
      assert.doesNotMatch(samples[1].system.details.biography.value.replace(/<[^>]*>/g, ""), /[A-Za-z]/);
      for (const item of samples[1].items) assert.doesNotMatch(item.name, /[A-Za-z]/);
    }
  } finally {
    Math.random = originalRandom;
    console.warn = originalWarn;
  }
});
