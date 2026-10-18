import { createTokenArtProvider } from "../scripts/token-art.js";

/** Read-only network check. No world Documents or settings are changed. */
export async function runTokenArtLiveChecks() {
  const provider = createTokenArtProvider({ random: () => 0 });
  const cases = [
    ["Barbarian", "Halfling"], ["Bard", "Tiefling"], ["Cleric", "Dwarf"],
    ["Druid", "Dragonborn"], ["Fighter", "Human"], ["Monk", "Half-Elf"],
    ["Paladin", "Half-Orc"], ["Ranger", "Gnome"], ["Rogue", "Elf"],
    ["Sorcerer", "Halfling"], ["Warlock", "Tiefling"], ["Wizard", "Dragonborn"]
  ];
  const results = [];
  for (const [role, race] of cases) {
    const src = await provider({ role, race });
    results.push({ role, race, result: src ? "PASS" : "FAIL", src });
  }
  console.table(results);
  if (results.some(row => row.result === "FAIL")) throw new Error("Live token-art check failed. See results above.");
  return results;
}
