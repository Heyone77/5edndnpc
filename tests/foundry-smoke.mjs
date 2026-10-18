import { CLASSES, generateRandomNpc } from "../scripts/npc-generator.js";

/** Run from a loaded dnd5e world. Creates only in-memory Documents, never saves. */
export async function runFoundrySmokeChecks() {
  if (game.system.id !== "dnd5e") throw new Error("Load a dnd5e world first.");
  const results = [];
  for (const role of CLASSES) {
    for (const level of [1, 5, 11, 20]) {
      try {
        const source = await generateRandomNpc({ role, level, race: "Human" });
        // DataModel takes ownership and prunes/migrates its input in place.
        // Keep the original expectations, including pact.level and actionType.
        const actor = new CONFIG.Actor.documentClass(structuredClone(source));
        actor.validate({ strict: true });
        if (actor.items.size !== source.items.length) throw new Error("Embedded Items were lost.");
        for (const item of actor.items) {
          item.validate({ strict: true });
          const input = source.items.find(i => i._id === item.id);
          if (input?.system.actionType && !item.system.activities?.size) {
            throw new Error(`${item.name}: legacy action did not become an activity.`);
          }
          if (item.type === "spell" && "method" in CONFIG.Item.dataModels.spell.schema.fields) {
            if (item.system.method !== "spell" || item.system.prepared !== 1) {
              throw new Error(`${item.name}: spell is not prepared.`);
            }
          }
        }
        for (const [key, slot] of Object.entries(source.system.spells)) {
          const prepared = actor.system.spells[key];
          // dnd5e may leave max unset when an NPC has no pact progression.
          if ((prepared?.max ?? 0) !== slot.override || (prepared?.value ?? 0) !== slot.value) {
            throw new Error(`${key}: expected value/max ${slot.value}/${slot.override}, got ${prepared?.value}/${prepared?.max}.`);
          }
          if (key === "pact" && slot.override && prepared.level !== slot.level) {
            throw new Error(`Pact slot level: expected ${slot.level}, got ${prepared.level}.`);
          }
        }
        results.push({ role, level, result: "PASS" });
      } catch (error) {
        results.push({ role, level, result: "FAIL", error: error.message });
      }
    }
  }
  console.table(results);
  const failures = results.filter(r => r.result === "FAIL");
  if (failures.length) throw new Error(`${failures.length} Foundry smoke checks failed. See the table above.`);
  return results;
}
