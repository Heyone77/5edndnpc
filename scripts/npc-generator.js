import { FIRST_NAMES_BY_RACE } from "./data/first-names.js";
import { LAST_NAMES_BY_RACE, RACES_WITH_SURNAMES } from "./data/last-names.js";
import { FIRST_NAME_SYLLABLES, LAST_NAME_SYLLABLES } from "./data/name-syllables.js";
import { BACKSTORY_TABLE } from "./data/backstories.js";
import { localizeText, localizeItemName } from "./localization.js";
import { getNpcTokenImage } from "./token-art.js";

export const RACES = ["Human", "Elf", "Dwarf", "Halfling", "Gnome", "Half-Orc", "Half-Elf", "Tiefling", "Dragonborn"];
export const CLASSES = ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"];
const ALIGNMENTS = ["lawful good", "neutral good", "lawful neutral", "neutral", "chaotic neutral", "neutral evil"];

const RACE_LANGUAGES = {
  Human: ["common"],
  Elf: ["common", "elvish"],
  Dwarf: ["common", "dwarvish"],
  Halfling: ["common", "halfling"],
  Gnome: ["common", "gnomish"],
  "Half-Orc": ["common", "orc"],
  "Half-Elf": ["common", "elvish"],
  Tiefling: ["common", "infernal"],
  Dragonborn: ["common", "draconic"]
};

const ARMOR_OPTIONS = [
  { name: "None", ac: 10, dexCap: null, type: "unarmored" },
  { name: "Leather Armor", ac: 11, dexCap: null, type: "light" },
  { name: "Studded Leather Armor", ac: 12, dexCap: null, type: "light" },
  { name: "Hide Armor", ac: 12, dexCap: 2, type: "medium" },
  { name: "Scale Mail", ac: 14, dexCap: 2, type: "medium" },
  { name: "Chain Mail", ac: 16, dexCap: 0, type: "heavy" }
];

const WEAPON_OPTIONS = [
  { name: "Club", die: "1d4", damageType: "bludgeoning", ability: "str", range: "m" },
  { name: "Dagger", die: "1d4", damageType: "piercing", ability: "dex", range: "r" },
  { name: "Quarterstaff", die: "1d6", damageType: "bludgeoning", ability: "str", range: "m" },
  { name: "Mace", die: "1d6", damageType: "bludgeoning", ability: "str", range: "m" },
  { name: "Shortsword", die: "1d6", damageType: "piercing", ability: "dex", range: "m" },
  { name: "Spear", die: "1d6", damageType: "piercing", ability: "str", range: "m" },
  { name: "Handaxe", die: "1d6", damageType: "slashing", ability: "str", range: "m" },
  { name: "Greataxe", die: "1d12", damageType: "slashing", ability: "str", range: "m" },
  { name: "Longsword", die: "1d8", damageType: "slashing", ability: "str", range: "m" },
  { name: "Longbow", die: "1d8", damageType: "piercing", ability: "dex", range: "r" },
  { name: "Shortbow", die: "1d6", damageType: "piercing", ability: "dex", range: "r" },
  { name: "Light Crossbow", die: "1d8", damageType: "piercing", ability: "dex", range: "r" }
];

const GEAR_OPTIONS = [
  "Traveler's Clothes",
  "Explorer's Pack",
  "Priest's Pack",
  "Scholar's Pack",
  "Dungeoneer's Pack",
  "Cloak",
  "Hooded Lantern",
  "Rations (1 day)",
  "Waterskin",
  "Rope (50 feet)"
];

export async function generateRandomNpc({ level = 1, race, role, useTokenArt = false } = {}) {
  const levelSafe = Math.max(1, Math.min(20, Number(level) || 1));
  const chosenRace = race ?? pick(RACES);
  const chosenClass = role ?? pick(CLASSES);
  const alignmentValue = pick(ALIGNMENTS);
  const alignment = localizeText(`alignments.${alignmentValue}`, alignmentValue);
  const name = pickNameForRace(chosenRace);

  const abilities = buildAbilitiesForClass(chosenClass, levelSafe);
  const dexMod = abilityMod(abilities.dex.value);

  const { armor, weapon, shield } = chooseLoadout(chosenClass);
  const ac = calculateAc(armor, dexMod, shield);
  const hitDice = levelSafe;
  const conMod = abilityMod(abilities.con.value);
  const hp = Math.max(1, rollHp(hitDice, conMod));
  const hpFormula = `${hitDice}d8${formatModifier(hitDice * conMod)}`;
  const profBonus = proficiencyFromLevel(levelSafe);
  const spells = await buildSpellsForClass(chosenClass, levelSafe);
  const armorItems = await buildArmorItems(armor, shield);
  const weaponItem = await buildWeaponItem(weapon, abilities);
  const gearItems = await buildGearItems(2);
  const essentialItems = await buildEssentialClassItems(chosenClass, abilities, levelSafe);
  const casterMagicItems = await buildCasterMagicItems(chosenClass, levelSafe);

  // Determine weapon setup based on class type
  // Pure arcane casters (Wizard, Sorcerer) get magical focus + dagger backup
  // Other casters keep their regular weapons alongside magical items
  const pureArcaneCasters = ["Wizard", "Sorcerer"];
  const isPureArcaneCaster = pureArcaneCasters.includes(chosenClass);

  let finalWeapon = weaponItem;
  let backupWeapon = null;
  let finalArmorItems = armorItems;

  if (casterMagicItems.length === 0) {
    // Non-casters or low-level casters get regular magic upgrades
    const upgrades = applyMagicUpgrades(levelSafe, weaponItem, armorItems);
    finalWeapon = upgrades.weapon;
    finalArmorItems = upgrades.armorItems;
  } else if (isPureArcaneCaster) {
    // Pure arcane casters: replace weapon with magical focus + dagger backup
    const upgrades = applyMagicUpgrades(levelSafe, null, armorItems);
    finalArmorItems = upgrades.armorItems;
    finalWeapon = null;
    backupWeapon = await buildBackupWeapon(abilities);
  } else {
    // Hybrid casters (Ranger, Paladin, Bard, Cleric, Druid, Warlock):
    // Keep their regular weapon AND get magical items
    const upgrades = applyMagicUpgrades(levelSafe, weaponItem, armorItems);
    finalWeapon = upgrades.weapon;
    finalArmorItems = upgrades.armorItems;
  }
  const biography = buildBackstory(chosenRace, chosenClass);
  const spellSlots = buildSpellSlots(chosenClass, levelSafe);
  // dnd5e persists overrides; slot maxima are derived during Actor preparation.
  for (const slot of Object.values(spellSlots)) {
    slot.override = slot.max;
    delete slot.max;
  }
  const spellcastingAbility = SPELLCASTING_ABILITY[chosenClass] ?? "";
  const languages = buildLanguages(chosenRace);

  // Format creature type to show race (e.g., "humanoid (elf)")
  const creatureType = {
    value: "humanoid",
    subtype: localizeText(`races.${chosenRace}`, chosenRace).toLowerCase(),
    custom: ""
  };

  const npc = {
    name,
    type: "npc",
    img: "icons/svg/mystery-man.svg",
    system: {
      details: {
        type: creatureType,
        alignment,
        race: chosenRace,
        cr: levelSafe,
        source: { custom: localizeText(`classes.${chosenClass}`, chosenClass) },
        biography: { value: biography }
      },
      abilities,
      attributes: {
        ac: { flat: ac, calc: "flat" },
        hp: { value: hp, max: hp, formula: hpFormula },
        prof: profBonus,
        spellcasting: spellcastingAbility,
        spell: { level: spellcastingAbility ? levelSafe : 0 }
      },
      traits: {
        size: "med",
        languages: languages
      },
      spells: spellSlots
    },
    prototypeToken: {
      name,
      displayBars: 20,
      bar1: { attribute: "attributes.hp" }
    },
    items: [...finalArmorItems, ...(finalWeapon ? [finalWeapon] : []), ...(backupWeapon ? [backupWeapon] : []), ...essentialItems, ...casterMagicItems, ...gearItems, ...spells].map(prepareItemSource)
  };
  if (useTokenArt) {
    const src = await getNpcTokenImage({ race: chosenRace, role: chosenClass });
    if (src) {
      npc.img = src;
      npc.prototypeToken.texture = { src };
      npc.prototypeToken.randomImg = false;
    }
  }
  return npc;
}

function buildAbilitiesForClass(cls, level = 1) {
  const priority = CLASS_PRIORITIES[cls] ?? ["str", "dex", "con", "wis", "int", "cha"];
  const scores = [...STANDARD_ARRAY].sort((a, b) => b - a);
  const abilities = { str: {}, dex: {}, con: {}, int: {}, wis: {}, cha: {} };
  const remaining = [...scores];

  // Assign base scores according to priority
  for (const ability of priority) {
    abilities[ability].value = remaining.shift() ?? randomScore();
  }
  const leftoverAbilities = Object.keys(abilities).filter((a) => abilities[a].value === undefined);
  for (const ability of leftoverAbilities) {
    abilities[ability].value = randomScore();
  }

  // Apply Ability Score Improvements (ASI) based on level
  // Standard classes get ASI at levels: 4, 8, 12, 16, 19
  // Fighters get additional ASI at: 6, 14
  // Rogues get additional ASI at: 10
  const asiLevels = [4, 8, 12, 16, 19];
  if (cls === "Fighter") {
    asiLevels.push(6, 14);
    asiLevels.sort((a, b) => a - b);
  } else if (cls === "Rogue") {
    asiLevels.push(10);
    asiLevels.sort((a, b) => a - b);
  }

  // Count how many ASIs this character has earned
  const asiCount = asiLevels.filter(lvl => level >= lvl).length;

  // Apply ASI bonuses to top priority stats (max 20 per stat)
  // Strategy: Max out primary stat first, then secondary, etc.
  let bonusPoints = asiCount * 2; // Each ASI gives +2 points
  for (const ability of priority) {
    while (bonusPoints > 0 && abilities[ability].value < 20) {
      const increase = Math.min(2, 20 - abilities[ability].value, bonusPoints);
      abilities[ability].value += increase;
      bonusPoints -= increase;
      if (increase === 0) break;
    }
    if (bonusPoints === 0) break;
  }

  return abilities;
}

async function buildArmorItems(armor, shield) {
  const items = [];
  if (armor.name !== "None") {
    const packItem = await getPackItem(getItemsPackId(), armor.name);
    items.push(
      packItem ?? {
        name: armor.name,
        type: "equipment",
        system: {
          quantity: 1,
          equipped: true,
          attunement: 0,
          armor: { value: armor.ac, type: armor.type },
          type: { value: armor.type }
        }
      }
    );
  }

  if (shield) {
    const packItem = await getPackItem(getItemsPackId(), "Shield");
    items.push(
      packItem ?? {
        name: "Shield",
        type: "equipment",
        system: {
          quantity: 1,
          equipped: true,
          attunement: 0,
          armor: { value: 2, type: "shield" },
          type: { value: "shield" }
        }
      }
    );
  }

  return items;
}

async function buildWeaponItem(weapon, abilities) {
  const packItem = await getPackItem(getItemsPackId(), weapon.name);
  if (packItem) return packItem;

  const abilityScore = abilities[weapon.ability]?.value ?? 10;
  const abilityModifier = abilityMod(abilityScore);
  return {
    name: weapon.name,
    type: "weapon",
    system: {
      quantity: 1,
      equipped: true,
      attunement: 0,
      activation: { type: "action", cost: 1 },
      ability: weapon.ability,
      actionType: weapon.range === "r" ? "rwak" : "mwak",
      proficient: true,
      attackBonus: 0,
      damage: { parts: [[`${weapon.die}${formatModifier(abilityModifier)}`, weapon.damageType]], versatile: "" },
      properties: { fin: weapon.ability === "dex", thr: weapon.range === "r" }
    }
  };
}

async function buildBackupWeapon(abilities) {
  // Try to get dagger from compendium first
  const packItem = await getPackItem(getItemsPackId(), "Dagger");
  if (packItem) return packItem;

  // Fallback: create a basic dagger
  const dexScore = abilities.dex?.value ?? 10;
  const strScore = abilities.str?.value ?? 10;
  const useAbility = dexScore >= strScore ? "dex" : "str";
  const abilityModifier = abilityMod(abilities[useAbility]?.value ?? 10);

  return {
    name: "Dagger",
    type: "weapon",
    img: "icons/weapons/daggers/dagger-straight-steel.webp",
    system: {
      quantity: 1,
      equipped: true,
      attunement: 0,
      activation: { type: "action", cost: 1 },
      ability: useAbility,
      actionType: "mwak",
      proficient: true,
      attackBonus: 0,
      damage: { parts: [[`1d4${formatModifier(abilityModifier)}`, "piercing"]], versatile: "" },
      properties: { fin: true, lgt: true, thr: true }
    }
  };
}

async function buildGearItems(count = 2) {
  const results = [];
  const picks = shuffle(GEAR_OPTIONS).slice(0, count);
  for (const itemName of picks) {
    const packItem = await getPackItem("dnd5e.items", itemName);
    results.push(
      packItem ?? {
        name: itemName,
        type: "equipment",
        system: {
          quantity: 1,
          equipped: false,
          attunement: 0,
          type: { value: "adventuringGear" }
        }
      }
    );
  }
  return results;
}

async function buildEssentialClassItems(chosenClass, abilities, level) {
  const essentialItemNames = ESSENTIAL_CLASS_ITEMS[chosenClass] ?? [];
  const results = [];

  for (const itemName of essentialItemNames) {
    // Special case: Unarmed Strike for Monks
    if (itemName === "Unarmed Strike") {
      const dexMod = abilityMod(abilities.dex?.value ?? 10);
      const strMod = abilityMod(abilities.str?.value ?? 10);
      const attackMod = Math.max(dexMod, strMod);

      results.push({
        name: "Unarmed Strike",
        type: "weapon",
        img: "icons/skills/melee/unarmed-punch-fist.webp",
        system: {
          quantity: 1,
          equipped: true,
          attunement: 0,
          activation: { type: "action", cost: 1 },
          ability: dexMod >= strMod ? "dex" : "str",
          actionType: "mwak",
          proficient: true,
          attackBonus: 0,
          damage: { parts: [["1d4" + formatModifier(attackMod), "bludgeoning"]], versatile: "" },
          properties: { fin: true }
        }
      });
    } else {
      // Try to get from compendium
      const packItem = await getPackItem(getItemsPackId(), itemName);
      if (packItem) {
        results.push(packItem);
      } else {
        // Create basic item if not found in compendium
        results.push({
          name: itemName,
          type: "equipment",
          system: {
            quantity: 1,
            equipped: true,
            attunement: 0,
            type: { value: "trinket" }
          }
        });
      }
    }
  }

  // Special case: Sneak Attack for Rogues
  if (chosenClass === "Rogue") {
    const sneakDice = Math.ceil(level / 2);
    results.push({
      name: "Sneak Attack",
      type: "feat",
      img: "icons/skills/melee/strike-sword-stabbed-brown.webp",
      system: {
        description: {
          value: localizeText("features.sneakAttack.description", `<p>Once per turn, you can deal an extra ${sneakDice}d6 damage to one creature you hit with an attack if you have advantage on the attack roll. The attack must use a finesse or a ranged weapon.</p><p>You don't need advantage on the attack roll if another enemy of the target is within 5 feet of it, that enemy isn't incapacitated, and you don't have disadvantage on the attack roll.</p>`, { dice: sneakDice })
        },
        activation: { type: "special", cost: 0 },
        damage: { parts: [[`${sneakDice}d6`, "piercing"]] },
        actionType: "other"
      }
    });
  }

  return results;
}

function calculateAc(armor, dexMod, shield) {
  const dexContribution = armor.dexCap === null ? dexMod : Math.min(dexMod, armor.dexCap);
  return armor.ac + dexContribution + (shield ? 2 : 0);
}

function abilityMod(score) {
  return Math.floor((score - 10) / 2);
}

function randomScore() {
  return 8 + Math.floor(Math.random() * 8);
}

function rollHp(hitDice, conMod) {
  const dieAvg = 4.5; // d8 average
  return Math.round(hitDice * (dieAvg + conMod));
}

function buildBackstory(race, cls) {
  const passage = category => {
    const table = BACKSTORY_TABLE[category];
    const text = pick(table);
    return localizeText(`backstory.${category}.${table.indexOf(text)}`, text);
  };
  const upbringing = passage("upbringing");
  const hook = passage("hooks");
  const quirk = passage("quirks");
  const goal = passage("goals");
  const summary = localizeText("biography.summary", `Race: ${race}, Class: ${cls}`, {
    race: localizeText(`races.${race}`, race), class: localizeText(`classes.${cls}`, cls)
  });
  return `<p>${upbringing} ${hook}</p><p>${quirk} ${goal}</p><p>${summary}</p>`;
}

function buildLanguages(race) {
  const raceLanguages = RACE_LANGUAGES[race] ?? ["common"];
  const languages = { value: [], custom: "" };

  for (const lang of raceLanguages) {
    languages.value.push(lang);
  }

  return languages;
}

async function buildSpellsForClass(cls, level) {
  const casterType = SPELLCASTING[cls] ?? "none";
  if (casterType === "none") return [];

  const spellPackId = getSpellsPackId();
  const pack = spellPackId ? game.packs.get(spellPackId) : null;
  if (!pack) {
    console.warn("5edndnpc | No spell pack found, skipping spells");
    return [];
  }

  const maxSpellLevel = getMaxSpellLevel(level, casterType);
  const documents = await pack.getDocuments();

  // Filter valid spells for this class and level
  const valid = documents.filter((spell) => {
    const spellLevel = spell.system?.level ?? 0;
    if (spellLevel > maxSpellLevel) return false;
    return spellHasClass(spell, cls);
  });

  const selectedSpells = [];
  const essentialSpellNames = ESSENTIAL_SPELLS[cls] ?? [];

  // First, add essential spells that are available and level-appropriate
  for (const spellName of essentialSpellNames) {
    const essentialSpell = valid.find(s =>
      s.name.toLowerCase() === spellName.toLowerCase()
    );
    if (essentialSpell && !selectedSpells.find(s => s._id === essentialSpell._id)) {
      selectedSpells.push(essentialSpell);
    }
  }

  // Then fill remaining slots with random spells - scale with level
  // Level 1: ~8 spells, Level 5: ~12, Level 10: ~20, Level 15: ~30, Level 20: ~40
  const count = Math.max(8, Math.ceil(level * 1.8));
  const remaining = valid.filter(s => !selectedSpells.find(sel => sel._id === s._id));
  const randomSpells = shuffle(remaining).slice(0, count - selectedSpells.length);
  selectedSpells.push(...randomSpells);

  // Prepare all spells
  return selectedSpells.map((spell) => {
    const data = spell.toObject();
    if ("method" in CONFIG.Item.dataModels.spell.schema.fields) {
      data.system.method = "spell";
      data.system.prepared = 1;
      delete data.system.preparation;
    } else {
      data.system.preparation = { mode: "prepared", prepared: true };
    }
    return data;
  });
}

function getMaxSpellLevel(level, casterType) {
  const clamped = Math.max(1, Math.min(20, level));
  if (casterType === "full") return Math.min(9, Math.ceil(clamped / 2));
  if (casterType === "half") return Math.max(1, Math.min(5, Math.ceil(clamped / 4)));
  if (casterType === "pact") return Math.max(1, Math.min(5, Math.ceil(clamped / 2)));
  return 0;
}

function spellHasClass(spell, cls) {
  const classes = spell.system?.classes;
  const key = cls.toLowerCase();
  if (classes && typeof classes === "object") {
    if (Array.isArray(classes.value)) return classes.value.map((c) => c?.toLowerCase?.() ?? c).includes(key);
    if (classes[key] !== undefined) return Boolean(classes[key]);
  }
  // 2024 data may use classIdentifier on the document or systems tags
  const identifier = spell.system?.identifier;
  if (identifier && typeof identifier === "string") {
    const idLower = identifier.toLowerCase();
    if (idLower.includes(key)) return true;
  }
  const tags = spell.system?.tags ?? [];
  if (Array.isArray(tags)) {
    const lower = tags.map((t) => (typeof t === "string" ? t.toLowerCase() : t));
    if (lower.some((t) => typeof t === "string" && t.includes(key))) return true;
  }
  // If no class info, allow it so casters always get spells
  return true;
}

async function getPackItem(packId, name) {
  const pack = game.packs.get(packId);
  if (!pack) return null;

  const index = await pack.getIndex({ fields: ["name"] });
  const entry = index.find((e) => e.name === name);
  if (!entry) return null;

  const doc = await pack.getDocument(entry._id);
  return doc?.toObject() ?? null;
}

function proficiencyFromLevel(level) {
  const clamped = Math.max(1, Math.min(20, level));
  return 2 + Math.floor((clamped - 1) / 4);
}

function pickNameForRace(race) {
  const firstName = pickFirstName(race);
  const lastName = pickLastName(race);
  return lastName ? `${firstName} ${lastName}` : firstName;
}

function pickFirstName(race) {
  const names = FIRST_NAMES_BY_RACE[race] ?? Object.values(FIRST_NAMES_BY_RACE).flat();
  if (Math.random() < 0.3) {
    return generateFirstNameFromSyllables(race);
  }
  const name = pick(names);
  return localizeText(`names.first.${race}.${names.indexOf(name)}`, name);
}

function pickLastName(race) {
  if (!RACES_WITH_SURNAMES.includes(race)) return null;
  const surnames = LAST_NAMES_BY_RACE[race] ?? [];
  if (Math.random() < 0.3) {
    return generateLastNameFromSyllables(race);
  }
  const name = pick(surnames);
  return localizeText(`names.last.${race}.${surnames.indexOf(name)}`, name);
}

function formatModifier(mod) {
  if (mod === 0) return "";
  return mod > 0 ? `+${mod}` : `${mod}`;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function chooseLoadout(cls) {
  const loadout = CLASS_LOADOUTS[cls];
  if (!loadout) {
    return { armor: pick(ARMOR_OPTIONS), weapon: pick(WEAPON_OPTIONS), shield: false };
  }

  const armor = ARMOR_OPTIONS.find((a) => a.name === loadout.armor) ?? pick(ARMOR_OPTIONS);
  const weapon = WEAPON_OPTIONS.find((w) => w.name === loadout.weapon) ?? pick(WEAPON_OPTIONS);
  return { armor, weapon, shield: Boolean(loadout.shield) };
}

const CLASS_LOADOUTS = {
  Barbarian: { armor: "Hide Armor", weapon: "Greataxe", shield: false },
  Bard: { armor: "Leather Armor", weapon: "Shortsword", shield: false },
  Cleric: { armor: "Scale Mail", weapon: "Mace", shield: true },
  Druid: { armor: "Leather Armor", weapon: "Spear", shield: true },
  Fighter: { armor: "Chain Mail", weapon: "Longsword", shield: true },
  Monk: { armor: "None", weapon: "Quarterstaff", shield: false },
  Paladin: { armor: "Chain Mail", weapon: "Longsword", shield: true },
  Ranger: { armor: "Studded Leather Armor", weapon: "Longbow", shield: false },
  Rogue: { armor: "Leather Armor", weapon: "Shortsword", shield: false },
  Sorcerer: { armor: "None", weapon: "Dagger", shield: false },
  Warlock: { armor: "Leather Armor", weapon: "Light Crossbow", shield: false },
  Wizard: { armor: "None", weapon: "Quarterstaff", shield: false }
};

const CLASS_PRIORITIES = {
  Barbarian: ["str", "con", "dex", "wis", "cha", "int"],
  Bard: ["cha", "dex", "con", "wis", "int", "str"],
  Cleric: ["wis", "con", "str", "dex", "cha", "int"],
  Druid: ["wis", "con", "dex", "int", "cha", "str"],
  Fighter: ["str", "con", "dex", "wis", "cha", "int"],
  Monk: ["dex", "wis", "con", "str", "int", "cha"],
  Paladin: ["str", "cha", "con", "wis", "dex", "int"],
  Ranger: ["dex", "wis", "con", "str", "int", "cha"],
  Rogue: ["dex", "con", "int", "wis", "cha", "str"],
  Sorcerer: ["cha", "con", "dex", "wis", "int", "str"],
  Warlock: ["cha", "con", "dex", "wis", "int", "str"],
  Wizard: ["int", "con", "dex", "wis", "cha", "str"]
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

const SPELLCASTING = {
  Barbarian: "none",
  Bard: "full",
  Cleric: "full",
  Druid: "full",
  Fighter: "none",
  Monk: "none",
  Paladin: "half",
  Ranger: "half",
  Rogue: "none",
  Sorcerer: "full",
  Warlock: "pact",
  Wizard: "full"
};

const SPELLCASTING_ABILITY = {
  Bard: "cha",
  Cleric: "wis",
  Druid: "wis",
  Paladin: "cha",
  Ranger: "wis",
  Sorcerer: "cha",
  Warlock: "cha",
  Wizard: "int"
};

// Essential spells that each class should always have (if level appropriate)
const ESSENTIAL_SPELLS = {
  Bard: ["Vicious Mockery", "Healing Word", "Cure Wounds", "Faerie Fire"],
  Cleric: ["Sacred Flame", "Cure Wounds", "Bless", "Healing Word", "Spiritual Weapon"],
  Druid: ["Produce Flame", "Shillelagh", "Goodberry", "Healing Word", "Entangle"],
  Paladin: ["Cure Wounds", "Bless", "Divine Favor", "Shield of Faith"],
  Ranger: ["Hunter's Mark", "Cure Wounds", "Goodberry", "Entangle"],
  Sorcerer: ["Fire Bolt", "Mage Armor", "Shield", "Magic Missile", "Chromatic Orb"],
  Warlock: ["Eldritch Blast", "Hex", "Armor of Agathys", "Hellish Rebuke"],
  Wizard: ["Fire Bolt", "Mage Armor", "Shield", "Magic Missile", "Detect Magic", "Identify"]
};

// Essential items/tools that each class should have
const ESSENTIAL_CLASS_ITEMS = {
  Bard: ["Lute"],  // Musical instrument as spellcasting focus
  Cleric: ["Holy Symbol"],
  Druid: ["Druidic Focus"],
  Monk: ["Unarmed Strike"],  // Special: added as weapon
  Paladin: ["Holy Symbol"],
  Rogue: ["Thieves' Tools"],
  Sorcerer: ["Arcane Focus"],
  Warlock: ["Arcane Focus"],
  Wizard: ["Arcane Focus", "Spellbook"]
};

// Magical items appropriate for casters by type
const CASTER_MAGIC_ITEMS = {
  weapons: [
    { name: "Quarterstaff", alternates: ["Staff"], displayName: "Staff", type: "weapon", img: "icons/weapons/staves/staff-ornate-blue.webp" },
    { name: "Wand", alternates: [], displayName: "Wand", type: "weapon", img: "icons/weapons/wands/wand-carved-purple.webp" },
    { name: "Rod", alternates: ["Immovable Rod"], displayName: "Rod", type: "weapon", img: "icons/weapons/wands/rod-gold-pink.webp" }
  ],
  armor: [
    { name: "Robe of Protection", alternates: ["Robe"], displayName: "Robe of Protection", type: "equipment", img: "icons/equipment/chest/robe-layered-blue.webp" },
    { name: "Cloak of Protection", alternates: ["Cloak"], displayName: "Cloak of Protection", type: "equipment", img: "icons/equipment/back/cloak-layered-purple.webp" }
  ],
  accessories: [
    { name: "Ring of Protection", alternates: ["Ring"], displayName: "Ring of Protection", type: "equipment", img: "icons/equipment/finger/ring-band-silver.webp" },
    { name: "Amulet of Protection", alternates: ["Amulet"], displayName: "Amulet of Protection", type: "equipment", img: "icons/equipment/neck/amulet-gem-pink-gold.webp" }
  ]
};

function getItemsPackId() {
  const preferred = ["dnd5e.equipment24", "dnd5e.items"];
  return preferred.find((id) => game.packs.has(id)) ?? null;
}

function buildSpellSlots(cls, level) {
  const casterType = SPELLCASTING[cls] ?? "none";
  if (casterType === "none") return defaultSpellSlots();
  if (casterType === "pact") return pactSpellSlots(level);
  return fullOrHalfCasterSlots(level, casterType === "half");
}

function defaultSpellSlots() {
  return {
    spell1: { value: 0, max: 0 },
    spell2: { value: 0, max: 0 },
    spell3: { value: 0, max: 0 },
    spell4: { value: 0, max: 0 },
    spell5: { value: 0, max: 0 },
    spell6: { value: 0, max: 0 },
    spell7: { value: 0, max: 0 },
    spell8: { value: 0, max: 0 },
    spell9: { value: 0, max: 0 },
    pact: { value: 0, max: 0 }
  };
}

function pactSpellSlots(level) {
  // Rough warlock progression
  const pactLevel = Math.min(5, Math.ceil(level / 2));
  const slots = level < 11 ? 2 : level < 17 ? 3 : 4;
  const data = defaultSpellSlots();
  data.pact = { value: slots, max: slots, level: pactLevel };
  return data;
}

function fullOrHalfCasterSlots(level, isHalf) {
  const clamped = Math.max(1, Math.min(20, level));
  const casterLevel = isHalf ? Math.max(1, Math.floor(clamped / 2)) : clamped;
  // Minimal slot table; good enough for stub NPCs
  const table = [
    [2, 0, 0, 0, 0, 0, 0, 0, 0],
    [3, 0, 0, 0, 0, 0, 0, 0, 0],
    [4, 2, 0, 0, 0, 0, 0, 0, 0],
    [4, 3, 0, 0, 0, 0, 0, 0, 0],
    [4, 3, 2, 0, 0, 0, 0, 0, 0],
    [4, 3, 3, 0, 0, 0, 0, 0, 0],
    [4, 3, 3, 1, 0, 0, 0, 0, 0],
    [4, 3, 3, 2, 0, 0, 0, 0, 0],
    [4, 3, 3, 3, 1, 0, 0, 0, 0],
    [4, 3, 3, 3, 2, 0, 0, 0, 0],
    [4, 3, 3, 3, 2, 1, 0, 0, 0],
    [4, 3, 3, 3, 2, 1, 0, 0, 0],
    [4, 3, 3, 3, 2, 1, 1, 0, 0],
    [4, 3, 3, 3, 2, 1, 1, 0, 0],
    [4, 3, 3, 3, 2, 1, 1, 1, 0],
    [4, 3, 3, 3, 2, 1, 1, 1, 0],
    [4, 3, 3, 3, 2, 1, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1, 1]
  ];
  const slots = table[Math.min(casterLevel, table.length) - 1];
  const data = defaultSpellSlots();
  slots.forEach((v, i) => {
    data[`spell${i + 1}`] = { value: v, max: v };
  });
  return data;
}

function getSpellsPackId() {
  const preferred = ["dnd5e.spells24", "dnd5e.spells"];
  return preferred.find((id) => game.packs.has(id)) ?? null;
}

function applyMagicUpgrades(level, weaponItem, armorItems) {
  const bonuses = [];
  if (level >= 8 && level <= 12) bonuses.push(1);
  if (level >= 13 && level <= 16) bonuses.push(2, 1);
  if (level >= 17) bonuses.push(3, 2, 1);

  if (!bonuses.length) return { weapon: weaponItem, armorItems };

  const armorIdx = armorItems.findIndex((i) => !isShield(i));
  const shieldIdx = armorItems.findIndex((i, idx) => idx !== armorIdx && isShield(i));

  const used = new Set();
  const upgradedArmor = [...armorItems];
  let upgradedWeapon = weaponItem;

  const slots = [
    { key: "weapon", item: () => upgradedWeapon, apply: (bonus) => (upgradedWeapon = upgradeItem(upgradedWeapon, bonus)) },
    {
      key: "armor",
      item: () => (armorIdx >= 0 ? upgradedArmor[armorIdx] : null),
      apply: (bonus) => {
        if (armorIdx >= 0) upgradedArmor[armorIdx] = upgradeItem(upgradedArmor[armorIdx], bonus);
      }
    },
    {
      key: "shield",
      item: () => (shieldIdx >= 0 ? upgradedArmor[shieldIdx] : null),
      apply: (bonus) => {
        if (shieldIdx >= 0) upgradedArmor[shieldIdx] = upgradeItem(upgradedArmor[shieldIdx], bonus);
      }
    }
  ];

  for (const bonus of bonuses.sort((a, b) => b - a)) {
    let applied = false;
    for (const slot of slots) {
      if (used.has(slot.key)) continue;
      const item = slot.item();
      if (!item) continue;
      slot.apply(bonus);
      used.add(slot.key);
      applied = true;
      break;
    }
    // Don't stack multiple bonuses on the same item
    // If no slot available, skip this bonus
  }

  return { weapon: upgradedWeapon, armorItems: upgradedArmor };
}

function isShield(item) {
  const typeVal = item?.system?.type?.value || item?.system?.armor?.type;
  if (typeVal && `${typeVal}`.toLowerCase() === "shield") return true;
  const name = item?.name?.toLowerCase?.() ?? "";
  return name.includes("shield");
}

function upgradeItem(item, bonus) {
  if (!item) return item;
  const clone = structuredClone(item);
  clone.name = `${clone.name} +${bonus}`;
  const rarity = bonus === 1 ? "uncommon" : bonus === 2 ? "rare" : "veryRare";
  if (!clone.system) clone.system = {};
  clone.system.rarity = clone.system.rarity || rarity;
  if (clone.type === "equipment") {
    clone.system.armor ??= {};
    clone.system.armor.magicalBonus = bonus;
  } else {
    clone.system.magicalBonus = bonus;
  }
  const properties = clone.system.properties;
  clone.system.properties = Array.isArray(properties) ? [...properties]
    : Object.keys(properties ?? {}).filter(key => properties[key]);
  if (!clone.system.properties.includes("mgc")) clone.system.properties.push("mgc");
  return clone;
}

/** Complete Item sources so dnd5e can run its own legacy-to-activity migration.
 * Fresh IDs also prevent repeated compendium items from colliding within an Actor.
 * Activity and effect IDs are left intact because they may reference one another.
 */
function prepareItemSource(item) {
  // Compendium translations belong to the source pack. Localize our fallbacks.
  if (!item._id) item.name = localizeItemName(item.name);
  item._id = foundry.utils.randomID();
  item.effects ??= [];
  const system = item.system;
  // Activity initialization runs before legacy object properties are cleaned.
  if (system?.properties && !Array.isArray(system.properties)) {
    system.properties = Object.keys(system.properties).filter(key => system.properties[key]);
  }
  if (typeof system?.attunement === "number") {
    if (system.attunement === 2) system.attuned = true;
    system.attunement = system.attunement ? "required" : "";
  }
  // Custom magical weapons bypass upgradeItem, but still need the magic property.
  if (item.type === "weapon" && system?.magicalBonus) {
    system.properties ??= [];
    if (!system.properties.includes("mgc")) system.properties.push("mgc");
  }
  return item;
}

async function buildCasterMagicItems(chosenClass, level) {
  const casterType = SPELLCASTING[chosenClass] ?? "none";
  if (casterType === "none") return [];

  const items = [];
  let bonus = 0;

  // Determine magic item tier based on level
  if (level >= 5 && level < 10) bonus = 1;
  else if (level >= 10 && level < 15) bonus = 2;
  else if (level >= 15) bonus = 3;

  if (bonus === 0) return [];

  const rarity = bonus === 1 ? "uncommon" : bonus === 2 ? "rare" : "veryRare";

  // Add a magical weapon (staff, wand, or rod) from compendium
  const weaponChoice = pick(CASTER_MAGIC_ITEMS.weapons);
  let weaponItem = await getPackItem(getItemsPackId(), weaponChoice.name);

  // Try alternate names if primary fails
  if (!weaponItem && weaponChoice.alternates) {
    for (const altName of weaponChoice.alternates) {
      weaponItem = await getPackItem(getItemsPackId(), altName);
      if (weaponItem) break;
    }
  }

  if (weaponItem) {
    // Clone and upgrade the compendium item
    const upgraded = upgradeItem(weaponItem, bonus);
    // Use display name for consistency
    upgraded.name = `${localizeItemName(weaponChoice.displayName)} +${bonus}`;
    items.push(upgraded);
  } else {
    // Fallback: create custom item
    items.push({
      name: `${weaponChoice.displayName} +${bonus}`,
      type: "weapon",
      img: weaponChoice.img,
      system: {
        quantity: 1,
        equipped: true,
        attunement: 1,
        rarity: rarity,
        magicalBonus: bonus,
        activation: { type: "action", cost: 1 },
        ability: "",
        actionType: "msak",
        proficient: true,
        attackBonus: bonus,
        damage: { parts: [["1d6", "bludgeoning"]], versatile: "" },
        properties: { ver: weaponChoice.displayName === "Staff" }
      }
    });
  }

  // Add a protective item (robe or cloak) for higher level casters
  if (level >= 10) {
    const armorChoice = pick(CASTER_MAGIC_ITEMS.armor);
    const armorBonus = Math.min(bonus, level >= 15 ? 2 : 1);
    let armorItem = await getPackItem(getItemsPackId(), armorChoice.name);

    // Try alternate names if primary fails
    if (!armorItem && armorChoice.alternates) {
      for (const altName of armorChoice.alternates) {
        armorItem = await getPackItem(getItemsPackId(), altName);
        if (armorItem) break;
      }
    }

    if (armorItem) {
      // Clone and upgrade the compendium item
      const upgraded = upgradeItem(armorItem, armorBonus);
      upgraded.name = `${localizeItemName(armorChoice.displayName)} +${armorBonus}`;
      items.push(upgraded);
    } else {
      // Fallback: create custom item
      items.push({
        name: `${armorChoice.displayName} +${armorBonus}`,
        type: "equipment",
        img: armorChoice.img,
        system: {
          quantity: 1,
          equipped: true,
          attunement: 1,
          rarity: rarity,
          armor: {
            value: armorBonus,
            type: armorChoice.displayName.includes("Robe") ? "light" : "clothing"
          },
          type: { value: armorChoice.displayName.includes("Robe") ? "light" : "clothing" }
        }
      });
    }
  }

  // Add an accessory (ring or amulet) for very high level casters
  if (level >= 15) {
    const accessoryChoice = pick(CASTER_MAGIC_ITEMS.accessories);
    let accessoryItem = await getPackItem(getItemsPackId(), accessoryChoice.name);

    // Try alternate names if primary fails
    if (!accessoryItem && accessoryChoice.alternates) {
      for (const altName of accessoryChoice.alternates) {
        accessoryItem = await getPackItem(getItemsPackId(), altName);
        if (accessoryItem) break;
      }
    }

    if (accessoryItem) {
      // Clone and upgrade the compendium item
      const upgraded = upgradeItem(accessoryItem, bonus);
      upgraded.name = `${localizeItemName(accessoryChoice.displayName)} +${bonus}`;
      items.push(upgraded);
    } else {
      // Fallback: create custom item
      items.push({
        name: `${accessoryChoice.displayName} +${bonus}`,
        type: "equipment",
        img: accessoryChoice.img,
        system: {
          quantity: 1,
          equipped: true,
          attunement: 1,
          rarity: rarity,
          armor: { value: bonus, type: "trinket" },
          type: { value: "trinket" }
        }
      });
    }
  }

  return items;
}

function generateFirstNameFromSyllables(race) {
  const buckets = FIRST_NAME_SYLLABLES[race] ?? FIRST_NAME_SYLLABLES.Human;
  const pieces = buckets.map((bucket, index) => {
    const syllable = pick(bucket);
    return localizeText(`names.syllables.first.${race}.${index}.${bucket.indexOf(syllable)}`, syllable);
  });
  const name = pieces.join("");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function generateLastNameFromSyllables(race) {
  if (!RACES_WITH_SURNAMES.includes(race)) return null;
  const buckets = LAST_NAME_SYLLABLES[race] ?? LAST_NAME_SYLLABLES.Human;
  const pieces = buckets.map((bucket, index) => {
    const syllable = pick(bucket);
    return localizeText(`names.syllables.last.${race}.${index}.${bucket.indexOf(syllable)}`, syllable);
  });
  const name = pieces.join("");
  return name.charAt(0).toUpperCase() + name.slice(1);
}
