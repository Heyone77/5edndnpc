# Changelog

## 1.1.0 - Maintained fork
- Preserve attribution to the original neepster/5edndnpc project and Chris Jones.
- Point installation and update metadata to Heyone77/5edndnpc, using its main-branch archive.
- Include the v14 adaptations, Russian localization and optional online token artwork described below.

## Unreleased - Too Many Tokens artwork
- Add optional automatic token/portrait selection from the Too Many Tokens Online catalogs, without requiring its Foundry module.
- Match canonical race IDs and prefer related NPC categories, with same-race Commoner fallback where needed.
- Add a localized dialog checkbox and remember the client's choice.
- Cache catalogs, validate image links and limit network lookup time. Keep NPC generation working when artwork is unavailable.
- Add offline regression tests and a read-only live URL check covering all 12 classes and all nine races across representative cases.

## Unreleased - Russian localization
- Register Russian alongside English through Foundry's localization system.
- Localize the directory button, dialog, race/class labels, settings labels and notifications.
- Add paired English/Russian dictionaries for all 120 backstory passages, 540 first names, 240 surnames and procedural name syllables.
- Localize alignment display, module-created fallback items, generated magic-item display names and Sneak Attack text. Preserve compendium content and internal identifiers.
- Keep gameplay formulas, random selection order and existing Actors unchanged.

## Unreleased - Foundry VTT v14 compatibility
- Fix smoke-test false failures caused by in-place Actor source cleaning and absent zero pact maxima; keep positive pact checks strict.
- Use DialogV2 and native DOM APIs; avoid nested forms and duplicate directory buttons.
- Check Actor creation permission before showing the button and before generation.
- Restrict footer CSS to module-created elements and use theme-aware text colors.
- Write modern spell preparation fields when supported; retain older-schema support.
- Persist existing spell slot maxima as overrides and supply the NPC spellcaster level.
- Supply fresh embedded Item IDs and effects arrays for dnd5e's native activity migration; normalize legacy property and attunement data.
- Store equipment magic bonuses under `armor.magicalBonus` and mark upgraded items magical.
- Add regression tests and a runtime verification checklist. Manifest verification remains v13 pending a real v14 smoke test.

## 2026-01-04
- **Major expansion of name variety**: Increased first names from 20 to 60 per race (540 total), added surnames for Dwarf, Elf, Human, and Half-Elf (240 total)
- **Tripled backstory content**: Expanded from 10 to 30 options per category (120 total across upbringing, hooks, quirks, goals)
- **Level-appropriate ability scores**: Implemented Ability Score Improvements (ASI) based on character level following D&D 5e rules (levels 4/8/12/16/19, with Fighter and Rogue bonuses)
- **Essential class features**: Added signature abilities - Hunter's Mark for Rangers, Sneak Attack for Rogues (level-scaled), Unarmed Strike for Monks
- **Caster magical items**: Level-tiered magical items for spellcasters (5-10: +1, 10-15: +2, 15-20: +3) including staffs/wands/rods, protective gear, and accessories
- **Increased spell variety**: High-level casters now receive appropriate spell counts (level * 1.8 formula), with essential spells prioritized per class
- **Level range selector**: Added min/max level inputs with persistent client settings to remember last selection
- **Smart weapon loadouts**: Pure arcane casters (Wizard, Sorcerer) get magical focus + dagger; hybrid casters keep martial weapons
- **Compendium integration**: Magical items now properly link to SRD compendium items with fallback to custom items
- **Modular code structure**: Split data into separate files (first-names.js, last-names.js, name-syllables.js, backstories.js) for maintainability
- **UI improvements**: Moved generation button to Actor Directory footer, added styling via 5edndnpc.css

## 2024-12-04
- Expanded race-aware names with syllable synthesis; richer backstory generation.
- Added spell slot/casting ability setup and more robust SRD spell sourcing (2014/2024 compendia).
- Implemented level-based magic gear upgrades (+1/+2/+3) and extra adventuring gear.
- Updated docs (README, DEVELOPMENT, AI_NOTES) and ran `node --check` sanity.
