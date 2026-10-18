# 5e D&D NPC Generator (Foundry VTT v13/v14, dnd5e)

Generates quick, system-valid dnd5e NPCs from the Actor Directory with class/race-aware stats, SRD gear/spells, and mix-and-match backstories.

Maintained fork of [neepster/5edndnpc](https://github.com/neepster/5edndnpc), originally created by Chris Jones. This fork adds Foundry v14 adaptations, English/Russian localization and optional Too Many Tokens artwork.

Install this fork using its [Foundry manifest](https://raw.githubusercontent.com/Heyone77/5edndnpc/main/module.json). The download points to this fork's main-branch archive; no separate GitHub release is required.

## Installation (Linux, manual)

1. Download or clone this repo.
2. Copy the folder into `~/.local/share/FoundryVTT/Data/modules/5edndnpc` (create the `modules` dir if needed).
3. Launch Foundry, go to **Setup > Add-on Modules**, and enable **5e D&D NPC Generator** for your world.

## Usage

- Open the **Actor Directory**; a **"Generate 5e NPC"** button appears in the footer.
- Choose level range (min/max), race, and class (or leave random) in the dialog and click **Generate**.
- The module will create an NPC Actor with:
  - **Level-appropriate ability scores** with Ability Score Improvements (ASI) based on D&D 5e rules
  - **Varied names** from expanded pools (60+ per race) with surnames for Dwarf, Elf, Human, Half-Elf
  - **Rich backstories** assembled from 120+ options across upbringing, hooks, quirks, and goals
  - **Class-specific features** like Hunter's Mark (Rangers), Sneak Attack (Rogues), Unarmed Strike (Monks)
  - **Level-scaled equipment** including magical items for casters (+1/+2/+3 staffs, robes, rings based on level tier)
  - **Appropriate spell loadouts** with essential spells and increased variety for high-level casters
  - **Smart weapon choices** - pure arcane casters get magical focus + dagger, hybrid casters keep martial weapons
  - Level-based HP/AC and gear linked to dnd5e compendia

## Requirements

- Foundry VTT v13 or v14; migration targets v14.369 with dnd5e 6.0.6
- dnd5e system (2024 data supported; falls back to 2014 compendia)
- No build step; plain ES modules loaded via `module.json`

## Compatibility status

The v14 changes were checked against locally installed Foundry 14.369 and dnd5e 6.0.6 sources. Automated tests cover UI integration boundaries, generated data and 48 deterministic comparisons with the original generator. The user also reported 48 PASS results from the in-memory suite in a running Foundry world. Actual UI rendering, persistence and rolls remain to be verified.

`module.json` deliberately retains `verified: "13"` until the [runtime checklist](docs/foundry-v14-validation.md) has passed. Foundry may therefore display an unverified-v14 warning. Set `verified` to `14` only after that check. Fork version 1.1.0 uses the main-branch archive for downloads; a tagged release can replace that URL when published.

Foundry v13 support is retained in code, including older spell preparation schemas, but has not been rerun locally. dnd5e 6.0.6 itself requires Foundry 14.367+; use a v13-compatible dnd5e release for v13 testing.

The migration preserves the existing NPC rules and approximations, including flat AC, spell progression tables and fallback attack damage. It does not rebalance NPCs or add new class mechanics.

## Languages

English and Russian are registered in `module.json` and use Foundry's normal language selection. Russian covers the generator dialog, notifications, all 120 backstory passages, pooled/procedural names, alignment labels and module-created item/feature text. Name and syllable translations live in the language dictionaries; there is no automatic runtime transliteration.

Compendium item/spell names and descriptions retain their source pack translations. Install appropriate dnd5e translation packs for those. Existing Actors are not renamed or rewritten when the language changes; localization applies to newly generated content.

After installing this update, restart Foundry so it reloads the manifest's language registration, then refresh the browser. Select Russian in Foundry's normal language settings if it is not already selected.

## Automatic token artwork

The generator dialog has an initially enabled **Find a token from Too Many Tokens** checkbox. It remembers the choice per client. The selected image becomes both the Actor portrait and prototype token image; existing Actors and placed tokens are not changed.

The provider reads the public D&D link catalogs from [Too Many Tokens Online](https://github.com/IsThisMyRealName/too-many-tokens-online) and uses the images hosted in [Too Many Tokens DND](https://github.com/IsThisMyRealName/too-many-tokens-dnd). No additional Foundry module is required and no external JavaScript is loaded. Attribution: Too Many Tokens / Jonathan Held (Jojop).

Artwork matching keeps the selected race and prefers a related NPC category: Mage for arcane casters, Priest for Cleric, Scout for Ranger, and martial categories for fighters. Where a category lacks the requested race, it tries broader categories of the same race. Bard and Monk use Commoner art because the catalog has no dedicated categories for them. This is an appearance approximation; it does not change NPC rules. Gender is not inferred from names.

Catalogs and successful image availability checks are cached for the browser session. Lookups have a six-second overall timeout and skip a limited number of broken image links. If no image is available, the NPC is still created with its default image and a localized warning. Images remain online URLs, so the GM and players need access to the image host to display them. Disable the checkbox to avoid these network requests.

Programmatic generation remains offline by default; use `generateRandomNpc({ level, race, role, useTokenArt: true })` to request artwork.
