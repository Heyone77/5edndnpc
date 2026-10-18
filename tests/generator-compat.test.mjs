import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { generateRandomNpc } from "../scripts/npc-generator.js";

let nextId = 0;
function setup({ modern = true, spells = [], items = [] } = {}) {
  globalThis.CONFIG = {
    Item: { dataModels: { spell: { schema: { fields: modern ? { method: {}, prepared: {} } : { preparation: {} } } } } }
  };
  globalThis.foundry = { utils: { randomID: () => String(++nextId).padStart(16, "0") } };
  const packs = new Map();
  if (spells.length) packs.set("dnd5e.spells24", { getDocuments: async () => spells.map(document) });
  if (items.length) packs.set("dnd5e.equipment24", {
    getIndex: async () => items.map(({ _id, name }) => ({ _id, name })),
    getDocument: async (id) => document(items.find(i => i._id === id))
  });
  globalThis.game = { system: { id: "dnd5e", version: modern ? "6.0.6" : "5.0.0" }, packs };
}
function document(source) {
  return { ...source, toObject: () => structuredClone(source) };
}
function spell() {
  return { _id: "spell00000000001", name: "Test spell", type: "spell", effects: [],
    system: { level: 1, method: "innate", prepared: 0, activities: {} } };
}

test("custom attacks include the full Item source required by dnd5e activity migration", async () => {
  setup();
  const npc = await generateRandomNpc({ role: "Monk", race: "Human", level: 1 });
  const attack = npc.items.find(i => i.name === "Unarmed Strike");
  assert.match(attack._id ?? "", /^[A-Za-z0-9]{16}$/);
  assert.deepEqual(attack.effects, []);
  // Activity migration calls Array helpers before model cleaning runs.
  assert.deepEqual(attack.system.properties, ["fin"]);
  assert.equal(attack.system.actionType, "mwak");
  assert.deepEqual(attack.system.damage.parts, [["1d4+2", "bludgeoning"]]);
});

test("current spell preparation replaces compendium method and state without changing its source", async () => {
  const source = spell();
  setup({ spells: [source] });
  const npc = await generateRandomNpc({ role: "Wizard", race: "Elf", level: 3 });
  const generated = npc.items.find(i => i.type === "spell");
  assert.equal(generated.system.method, "spell");
  assert.equal(generated.system.prepared, 1);
  assert.equal(generated.system.preparation, undefined);
  assert.equal(source.system.method, "innate");
  assert.equal(source.system.prepared, 0);
});

test("optional token art sets both portrait and prototype token without changing the chosen race", async () => {
  setup();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => options?.method === "HEAD"
    ? { ok: true, headers: { get: () => "image/webp" } }
    : { ok: true, text: async () => "MageHumanFemale (1).webp\nMageHalfelfMale (1).webp" };
  try {
    const npc = await generateRandomNpc({ role: "Wizard", race: "Human", level: 1, useTokenArt: true });
    assert.match(npc.img, /MageHumanFemale%20\(1\)\.webp$/);
    assert.equal(npc.prototypeToken.texture.src, npc.img);
    assert.equal(npc.prototypeToken.randomImg, false);
    assert.equal(npc.system.details.race, "Human");
  } finally { globalThis.fetch = originalFetch; }
});

test("optional art failure preserves normal NPC creation data", async () => {
  setup();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    const npc = await generateRandomNpc({ role: "Fighter", race: "Elf", level: 5, useTokenArt: true });
    assert.equal(npc.img, "icons/svg/mystery-man.svg");
    assert.equal(npc.prototypeToken.texture, undefined);
    assert.equal(npc.type, "npc");
    assert.ok(npc.items.length > 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("older spell schemas retain legacy preparation fields", async () => {
  const source = spell();
  delete source.system.method;
  delete source.system.prepared;
  setup({ modern: false, spells: [source] });
  const npc = await generateRandomNpc({ role: "Cleric", race: "Human", level: 3 });
  assert.deepEqual(npc.items.find(i => i.type === "spell").system.preparation,
    { mode: "prepared", prepared: true });
});

test("slot overrides preserve the existing wizard and warlock progression", async () => {
  setup({ spells: [spell()] });
  const wizard = await generateRandomNpc({ role: "Wizard", race: "Human", level: 5 });
  assert.equal(wizard.system.spells.spell1.override, 4);
  assert.equal(wizard.system.spells.spell2.override, 3);
  assert.equal(wizard.system.spells.spell3.override, 2);
  assert.equal(wizard.system.spells.spell4.override, 0);
  const warlock = await generateRandomNpc({ role: "Warlock", race: "Human", level: 11 });
  assert.equal(warlock.system.spells.pact.override, 3);
  assert.equal(warlock.system.attributes.spell.level, 11);
});

test("upgraded compendium armor stores its bonus in the equipment schema", async () => {
  const armor = { _id: "armor00000000001", name: "Chain Mail", type: "equipment", effects: [],
    system: { armor: { value: 16 }, type: { value: "heavy" }, properties: [] } };
  setup({ items: [armor] });
  const npc = await generateRandomNpc({ role: "Fighter", race: "Human", level: 17 });
  const generated = npc.items.find(i => i._id === armor._id || i.name.startsWith("Chain Mail"));
  assert.equal(generated.system.armor.magicalBonus, 2);
  assert.ok(generated.system.properties.includes("mgc"));
  assert.equal(armor.system.armor.magicalBonus, undefined);
  assert.deepEqual(armor.system.properties, []);
});

test("repeated compendium items get distinct Item IDs while keeping activity/effect links", async () => {
  const source = { _id: "item000000000001", name: "Quarterstaff", type: "weapon",
    effects: [{ _id: "effect0000000001", name: "Test effect" }],
    system: { properties: [], activities: { activity00000001: {
      _id: "activity00000001", type: "attack", effects: [{ _id: "effect0000000001" }]
    } } } };
  setup({ items: [source], spells: [spell()] });
  const pack = game.packs.get("dnd5e.equipment24");
  pack.getIndex = async () => ["Quarterstaff", "Staff", "Wand", "Rod", "Dagger"].map(name => ({ _id: source._id, name }));
  const npc = await generateRandomNpc({ role: "Wizard", race: "Human", level: 5 });
  const copies = npc.items.filter(i => i.system.activities?.activity00000001);
  assert.ok(copies.length >= 2);
  assert.equal(new Set(npc.items.map(i => i._id)).size, npc.items.length);
  for (const copy of copies) {
    assert.notEqual(copy._id, source._id);
    assert.deepEqual(copy.effects, source.effects);
    assert.deepEqual(copy.system.activities, source.system.activities);
  }
  assert.equal(source._id, "item000000000001");
});

test("all classes retain original gameplay at levels 1, 5, 11 and 20", async () => {
  const fixtures = JSON.parse(readFileSync(new URL("./fixtures/generator-v1.json", import.meta.url), "utf8"));
  const random = Math.random;
  const warn = console.warn;
  console.warn = () => {}; // These fixtures deliberately have no spell compendium.
  try {
    for (const { role, level, sha256 } of fixtures) {
      setup();
      let seed = 123456;
      Math.random = () => {
        seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const npc = await generateRandomNpc({ role, level, race: "Human" });
      const a = npc.system.attributes;
      // Values recorded from the original generator at git HEAD, before migration.
      const fingerprint = {
        name: npc.name, details: npc.system.details, abilities: npc.system.abilities,
        ac: a.ac, hp: a.hp, prof: a.prof, spellcasting: a.spellcasting,
        traits: npc.system.traits, token: npc.prototypeToken,
        slots: Object.fromEntries(Object.entries(npc.system.spells).map(([k, s]) =>
          [k, { value: s.value, max: s.override, level: s.level }])),
        items: npc.items.map(i => ({ name: i.name, type: i.type, img: i.img,
          damage: i.system.damage?.parts, armor: i.system.armor?.value,
          activation: i.system.activation, description: i.system.description }))
      };
      assert.equal(createHash("sha256").update(JSON.stringify(fingerprint)).digest("hex"), sha256, `${role} ${level}`);
    }
  } finally {
    Math.random = random;
    console.warn = warn;
  }
});
