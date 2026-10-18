import assert from "node:assert/strict";
import { test } from "node:test";
import { runFoundrySmokeChecks } from "./foundry-smoke.mjs";

// Reproduce the documented DataModel ownership/cleaning boundary, not the
// full dnd5e engine. Production runtime verification still requires Foundry.
async function runWithActorBoundary(defect) {
  let id = 0;
  globalThis.game = { system: { id: "dnd5e" }, packs: new Map() };
  globalThis.foundry = { utils: { randomID: () => String(++id).padStart(16, "0") } };
  globalThis.CONFIG = { Actor: { documentClass: class {
    constructor(source) {
      this.system = structuredClone(source.system);
      for (const [key, slot] of Object.entries(this.system.spells)) {
        slot.max = slot.override;
        if (key === "pact") {
          if (slot.override) slot.level = Math.min(5, Math.ceil(this.system.attributes.spell.level / 2));
          else if (!this.system.attributes.spell.level) delete slot.max;
          if (slot.override && defect === "pact-level") slot.level = 9;
          if (slot.override && defect === "pact-max") delete slot.max;
        }
      }
      this.items = source.items.map(input => ({
        id: input._id, name: input.name, type: input.type,
        system: { ...structuredClone(input.system), activities: {
          size: input.name === "Unarmed Strike" && defect === "activity" ? 0 : 1
        } },
        validate() {}
      }));
      this.items.size = this.items.length;
      // Foundry owns and cleans the object handed to its constructor.
      delete source.system.spells.pact.level;
      for (const item of source.items) delete item.system.actionType;
    }
    validate() {}
  } } };
  const originalTable = console.table;
  const originalWarn = console.warn;
  let rows;
  let error;
  console.table = value => { rows = value; };
  console.warn = () => {};
  try { await runFoundrySmokeChecks(); }
  catch (caught) { error = caught; }
  finally { console.table = originalTable; console.warn = originalWarn; }
  return { rows, error };
}

test("smoke check preserves expectations across constructor cleaning and accepts absent zero pact max", async () => {
  const { rows, error } = await runWithActorBoundary();
  assert.equal(error, undefined);
  assert.equal(rows.length, 48);
  assert.ok(rows.every(row => row.result === "PASS"));
});

test("smoke check still rejects an incorrect nonzero pact level", async () => {
  const { rows, error } = await runWithActorBoundary("pact-level");
  assert.match(error.message, /4 Foundry smoke checks failed/);
  assert.ok(rows.filter(row => row.result === "FAIL").every(row => row.role === "Warlock"));
});

test("smoke check still rejects an absent nonzero pact maximum", async () => {
  const { rows, error } = await runWithActorBoundary("pact-max");
  assert.match(error.message, /4 Foundry smoke checks failed/);
  assert.ok(rows.filter(row => row.result === "FAIL").every(row => row.role === "Warlock"));
});

test("constructor pruning cannot hide an attack that failed to acquire an activity", async () => {
  const { rows } = await runWithActorBoundary("activity");
  const monks = rows.filter(row => row.role === "Monk");
  assert.ok(monks.every(row => row.result === "FAIL" && /legacy action/.test(row.error)));
});
