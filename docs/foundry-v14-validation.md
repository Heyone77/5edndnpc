# Foundry v14 validation checklist

Target: Foundry VTT 14.369 and dnd5e 6.0.6. In-memory runtime checks: **48 PASS**, reported by the user from Chrome on 2026-10-18. Manual UI, persistence and roll checks below remain **pending**.

The corrected harness passed for all 12 classes at levels 1, 5, 11 and 20. It confirmed Actor/Item validation, embedded Item counts, legacy activity migration, prepared spells, slot values/maxima and pact levels for the generated samples. These were unsaved Documents; this does not verify database persistence, actual rolls or the generator dialog.

## Automated checks already available

```bash
node --test tests/*.test.mjs
```

The tests do not load Foundry, render a browser UI, access a real compendium or save world Documents. They cover the module's boundary payloads and deterministic gameplay regression.

## Prepare a test world

Use a disposable dnd5e world. Install this checkout as `Data/modules/5edndnpc`, enable the module and reload the world. Start with other optional modules disabled. A test copy was installed at `F:/fnd/Foundry/Data/modules/5edndnpc`; the served generator and smoke script were checked against the workspace files. No campaign Documents were changed by the in-memory suite.

## In-memory schema and migration smoke checks

After loading the world, open the browser developer console and run:

```js
await (await import("./modules/5edndnpc/tests/foundry-smoke.mjs")).runFoundrySmokeChecks();
```

This builds 48 unsaved Actors using the actual installed document classes and compendia. It checks validation, embedded Item counts, activity migration, prepared spells, slot maxima and pact levels. It does not call `Actor.create`, save documents, consume resources or change world settings. Expect 48 PASS rows. If Foundry uses a custom URL prefix, retain that prefix in the import path.

After updating the smoke script in an already loaded world, bypass its ES module cache:

```js
await (await import(`/modules/5edndnpc/tests/foundry-smoke.mjs?check=${Date.now()}`)).runFoundrySmokeChecks();
```

Repeat with a fresh world where optional equipment/spell packs are unavailable or do not contain the requested names, to exercise fallback Items. Do not delete system packs or alter a campaign world for this check.

## Manual UI and persistence checks

- [ ] One Generate 5e NPC button appears in the Actor Directory. It remains usable after searches, folder changes, Actor creation/deletion and directory rerenders.
- [ ] The separate Actor Directory window has one independent working button.
- [ ] Generate, Enter, Cancel, Escape and the close control work. Cancellation creates no Actor.
- [ ] Level ranges 1-1, 20-20 and reversed 7-2 work; selections and range persist as before. Check empty and out-of-bounds input with browser validation.
- [ ] Random race/class and explicit selections work. Repeated rapid Generate clicks do not create duplicates from a single submission.
- [ ] Users without Actor creation permission see no button. A user with permission can create an NPC. Revoking permission while a dialog is open prevents generation.
- [ ] Generate all classes at low and high levels. Inspect names, race/subtype, biography, abilities, HP, flat AC and proficiency.
- [ ] Weapons, fallback dagger, Unarmed Strike and Sneak Attack have usable activities. Check attack and damage rolls, including stored ability modifiers; do not rebalance the existing formulas during compatibility verification.
- [ ] Equipment and spells copied more than once do not disappear through duplicate Item IDs. Item activity/effect links survive copying.
- [ ] Prepared spells appear and can be cast; spell slot value and maximum match the generator. Test pact slot level, spending and recovery for Warlock separately.
- [ ] Upgraded weapons/armor carry their bonuses in the correct fields. Check equipped/attunement requirements. Flat Actor AC remains the generator's existing flat calculation; adding automatic stacking bonuses would change its rules.
- [ ] Missing compendium entries produce fallback items without validation errors. Missing spell packs preserve the existing warning-and-skip behavior.
- [ ] Drag the NPC onto a scene: token name, HP bar and HP changes work.
- [ ] Reload the world and reopen generated Actors. Items, activities, spells and slot overrides persist.
- [ ] Check light/dark themes; the module does not alter unrelated sidebar footers. Then repeat the main flow with the normal module set enabled.
- [ ] No new console errors or deprecation warnings originate from this module.

## Backwards compatibility and release gate

- [ ] Repeat with Foundry v13 and an appropriate dnd5e release. dnd5e 6.0.6 cannot run on v13.
- [ ] Record exact Foundry/system versions and any failures here.
- [ ] After the v14 runtime checks pass, update `module.json` compatibility `verified` from `13` to `14`. Keep minimum `13` only if the v13 run passes.
- [ ] Update the release version and download URL together when publishing an actual archive; do not point at a nonexistent release.

## Optional Too Many Tokens artwork

The standalone live provider check passed 12 representative class/race combinations using the real external catalogs and image HEAD responses. This is network validation, not a browser/canvas rendering check.

Run the read-only network check from a loaded world if desired:

```js
await (await import(`/modules/5edndnpc/tests/token-art-live.mjs?check=${Date.now()}`)).runTokenArtLiveChecks();
```

- [ ] The localized artwork checkbox appears, is initially enabled, and remembers an opt-out.
- [ ] Generate a Human Wizard and a nonhuman martial NPC with the checkbox enabled: portrait and prototype token show the same fitting image.
- [ ] Drag the NPC onto a scene and confirm the image loads for GM and players.
- [ ] A Half-Elf remains matched to Half-Elf art rather than generic Elf art.
- [ ] Disabling artwork performs no token-provider network requests and uses the previous default image.
- [ ] With the external host unavailable, generation still succeeds after the bounded wait, with a localized warning.
- [ ] Existing Actors and scene tokens remain unchanged; new images survive a world reload.

## API evidence and migration scope

See [the migration plan](superpowers/plans/2026-10-18-foundry-v14.md) for the local source files used to verify API signatures. No canvas APIs, game tables or NPC progression formulas were replaced.

The generator intentionally keeps legacy fallback attack definitions, with complete Item sources, so dnd5e performs its own activity conversion. The v14 source confirms this path requires `_id`, `effects`, old action data and normalized property arrays. The in-memory smoke suite verifies the installed system actually performs that conversion.
