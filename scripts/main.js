import { generateRandomNpc, RACES, CLASSES } from "./npc-generator.js";

const MODULE_ID = "5edndnpc";
const localize = key => game.i18n.localize(`${MODULE_ID}.${key}`);

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing 5e NPC Generator module`);

  // Register settings to remember last level range
  game.settings.register(MODULE_ID, "lastMinLevel", {
    name: "5edndnpc.settings.lastMinLevel",
    scope: "client",
    config: false,
    type: Number,
    default: 1
  });

  game.settings.register(MODULE_ID, "lastMaxLevel", {
    name: "5edndnpc.settings.lastMaxLevel",
    scope: "client",
    config: false,
    type: Number,
    default: 5
  });
  game.settings.register(MODULE_ID, "tokenArtEnabled", {
    name: "5edndnpc.settings.tokenArtEnabled",
    scope: "client",
    config: false,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") {
    console.warn(`${MODULE_ID} | This module is intended for the dnd5e system.`);
    return;
  }

  console.log(`${MODULE_ID} | Module ready and dnd5e system detected`);
});

Hooks.on("renderActorDirectory", (app, html) => {
  if (game.system.id !== "dnd5e") return;
  // ApplicationV2 supplies an HTMLElement; tolerate v13 hooks supplying jQuery.
  const root = html?.querySelector ? html : html?.[0];
  if (!root) return;
  const existing = root.querySelector(`.npc-gen-button[data-module="${MODULE_ID}"]`);
  if (!CONFIG.Actor.documentClass.canUserCreate(game.user)) {
    existing?.remove();
    return;
  }
  if (existing) return;

  let footer = root.querySelector(".directory-footer");
  if (!footer) {
    const list = root.querySelector(".directory-list");
    if (!list) return;
    footer = document.createElement("footer");
    footer.className = "directory-footer action-buttons flexcol npc-gen-footer";
    list.after(footer);
  }
  const actionBar = footer.matches(".action-buttons") ? footer : footer.querySelector(".action-buttons") ?? footer;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "npc-gen-button";
  button.dataset.module = MODULE_ID;
  button.innerHTML = `<i class="fas fa-user-plus" inert></i> ${localize("button")}`;
  button.addEventListener("click", openNpcDialog);
  actionBar.append(button);
  console.debug(`${MODULE_ID} | Added 5e NPC button to Actor Directory footer`);
});

function openNpcDialog() {
  if (!CONFIG.Actor.documentClass.canUserCreate(game.user)) return;
  const raceOptions = [`<option value="random">${localize("dialog.randomRace")}</option>`, ...RACES.map((race) => `<option value="${race}">${localize(`races.${race}`)}</option>`)].join("");
  const classOptions = [`<option value="random">${localize("dialog.randomClass")}</option>`, ...CLASSES.map((cls) => `<option value="${cls}">${localize(`classes.${cls}`)}</option>`)].join("");

  // Load last used level range from settings
  const lastMinLevel = game.settings.get(MODULE_ID, "lastMinLevel") || 1;
  const lastMaxLevel = game.settings.get(MODULE_ID, "lastMaxLevel") || 5;
  const tokenArtEnabled = game.settings.get(MODULE_ID, "tokenArtEnabled");

  const content = `
    <div class="npc-generator-form">
      <div class="form-group level-range">
        <label>${localize("dialog.levelRange")}</label>
        <div class="level-inputs">
          <input type="number" name="minLevel" value="${lastMinLevel}" min="1" max="20" placeholder="${localize("dialog.min")}">
          <span class="level-separator">${localize("dialog.to")}</span>
          <input type="number" name="maxLevel" value="${lastMaxLevel}" min="1" max="20" placeholder="${localize("dialog.max")}">
        </div>
        <p class="hint">${localize("dialog.levelHint")}</p>
      </div>
      <div class="form-group">
        <label>${localize("dialog.race")}</label>
        <select name="race">${raceOptions}</select>
      </div>
      <div class="form-group">
        <label>${localize("dialog.class")}</label>
        <select name="role">${classOptions}</select>
      </div>
      <div class="form-group token-art">
        <label class="checkbox">
          <input type="checkbox" name="tokenArt" ${tokenArtEnabled ? "checked" : ""}>
          ${localize("dialog.tokenArt")}
        </label>
        <p class="hint">${localize("dialog.tokenArtHint")}</p>
      </div>
    </div>
  `;

  new foundry.applications.api.DialogV2({
    window: { title: localize("dialog.title") },
    content,
    buttons: [
      {
        action: "generate",
        label: localize("dialog.generate"),
        default: true,
        callback: (_event, button) => handleGenerateNpc(button.form)
      },
      {
        action: "cancel",
        label: localize("dialog.cancel"),
        type: "button"
      }
    ]
  }).render({ force: true });
}

async function handleGenerateNpc(form) {
  if (game.system.id !== "dnd5e") {
    ui.notifications?.warn(localize("notifications.wrongSystem"));
    return;
  }
  const ActorClass = CONFIG.Actor.documentClass;
  if (!ActorClass.canUserCreate(game.user)) {
    ui.notifications?.warn(localize("notifications.noPermission"));
    return;
  }

  try {
    const fields = form.elements;

    // Get level range and randomize
    const minLevel = Math.max(1, Math.min(20, Number(fields.namedItem("minLevel").value) || 1));
    const maxLevel = Math.max(1, Math.min(20, Number(fields.namedItem("maxLevel").value) || 5));
    const levelRange = [Math.min(minLevel, maxLevel), Math.max(minLevel, maxLevel)];
    const level = levelRange[0] + Math.floor(Math.random() * (levelRange[1] - levelRange[0] + 1));

    // Save level range settings for next time
    await game.settings.set(MODULE_ID, "lastMinLevel", minLevel);
    await game.settings.set(MODULE_ID, "lastMaxLevel", maxLevel);

    const raceValue = fields.namedItem("race").value;
    const roleValue = fields.namedItem("role").value;
    const useTokenArt = fields.namedItem("tokenArt").checked;
    await game.settings.set(MODULE_ID, "tokenArtEnabled", useTokenArt);

    const npcData = await generateRandomNpc({
      level,
      race: raceValue === "random" ? undefined : raceValue,
      role: roleValue === "random" ? undefined : roleValue,
      useTokenArt
    });
    if (useTokenArt && !npcData.prototypeToken.texture?.src) {
      ui.notifications?.warn(localize("notifications.tokenArtUnavailable"));
    }
    const actor = await ActorClass.create(npcData);
    if (!actor) return;
    ui.notifications?.info(game.i18n.format("5edndnpc.notifications.created", { level, name: actor.name }));
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to create NPC`, error);
    ui.notifications?.error(localize("notifications.failed"));
  }
}
