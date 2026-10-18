# Development Guide

## Prerequisites (Fedora)

- Node.js 18+ (for sanity checks): `sudo dnf install nodejs`
- Git
- Foundry VTT installed locally with the dnd5e system

## Link the module into Foundry

```bash
MODULE_PATH="$HOME/.local/share/FoundryVTT/Data/modules/5edndnpc"
mkdir -p "$(dirname "$MODULE_PATH")"
ln -sfn "$(pwd)" "$MODULE_PATH"
```

If you prefer copying instead of linking:

```bash
MODULE_PATH="$HOME/.local/share/FoundryVTT/Data/modules/5edndnpc"
mkdir -p "$(dirname "$MODULE_PATH")"
rsync -av --delete ./ "$MODULE_PATH"/
```

## Running checks

Run the dependency-free regression tests with a current Node.js version (tested with 24.13.0):

```bash
node --test tests/*.test.mjs
```

The fixtures in `tests/fixtures/generator-v1.json` record SHA-256 fingerprints of the original generator for all 12 classes at levels 1, 5, 11 and 20, using Human and a fixed random seed. They guard names, biographies, characteristics, HP/AC, slot counts, equipment choices and legacy damage formulas. Schema adaptations and document IDs are tested separately.

`tests/main.test.mjs` uses browser/Foundry boundary stand-ins. It does not exercise real rendering or database persistence. For runtime checks, follow [Foundry v14 validation](docs/foundry-v14-validation.md), including the optional in-memory smoke suite.

There is no build step. For quick syntax sanity:

```bash
node --check scripts/main.js
node --check scripts/npc-generator.js
node --check scripts/data/first-names.js
node --check scripts/data/last-names.js
node --check scripts/data/name-syllables.js
node --check scripts/data/backstories.js
```

Launch Foundry, enable the module in **Add-on Modules**, open a dnd5e world, and test via the Actor Directory "Generate 5e NPC" button.

## Project Structure

```
5edndnpc/
├── scripts/
│   ├── main.js                 # Entry point, hooks, dialog
│   ├── npc-generator.js        # Core generation logic
│   └── data/                   # Separated data modules
│       ├── first-names.js      # 60 first names per race (540 total)
│       ├── last-names.js       # Surnames for 4 races (240 total)
│       ├── name-syllables.js   # Syllable pools for procedural names
│       └── backstories.js      # 120 backstory options (4 categories)
├── styles/
│   └── 5edndnpc.css           # UI styling
└── module.json                 # Module manifest
```
