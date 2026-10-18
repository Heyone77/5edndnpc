import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const english = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

// Stand-ins cover only browser/Foundry boundaries. The module hook, dialog
// callback, generator and Actor creation payload run unchanged.
const hooks = new Map();
globalThis.Hooks = {
  once: (name, callback) => hooks.set(name, callback),
  on: (name, callback) => hooks.set(name, callback)
};
await import("../scripts/main.js");

function setup(locale = "en") {
  const translations = JSON.parse(readFileSync(new URL(`../lang/${locale}.json`, import.meta.url), "utf8"));
  const state = { allowed: true, created: [], messages: [], dialog: null };
  const settings = new Map();
  globalThis.game = {
    system: { id: "dnd5e" }, user: {}, packs: new Map(),
    i18n: {
      localize: key => translations[key] ?? english[key] ?? key,
      format: (key, data) => (translations[key] ?? english[key] ?? key)
        .replace(/\{(\w+)\}/g, (_match, name) => String(data[name]))
    },
    settings: {
      register: (_module, key, options) => settings.set(key, options.default),
      get: (_module, key) => settings.get(key),
      set: async (_module, key, value) => settings.set(key, value)
    }
  };
  globalThis.CONFIG = { Actor: { documentClass: {
    canUserCreate: () => state.allowed,
    create: async data => { state.created.push(data); return { name: data.name }; }
  } } };
  let id = 0;
  globalThis.foundry = {
    utils: { randomID: () => String(++id).padStart(16, "0") },
    applications: { api: { DialogV2: class {
      constructor(config) { state.dialog = config; }
      render(options) { state.renderOptions = options; }
    } } }
  };
  globalThis.ui = { notifications: Object.fromEntries(["info", "warn", "error"].map(kind =>
    [kind, message => state.messages.push({ kind, message })])) };
  const footer = {
    children: [], matches: selector => selector === ".action-buttons",
    append(button) { this.children.push(button); }
  };
  const root = { querySelector: selector => selector === ".directory-footer" ? footer : footer.children[0] };
  globalThis.document = { createElement: () => ({
    dataset: {}, addEventListener(_event, callback) { this.click = callback; },
    remove() { footer.children.splice(footer.children.indexOf(this), 1); }
  }) };
  hooks.get("init")();
  return { state, settings, footer, root };
}

function form(values) {
  return { elements: { namedItem: name => name === "tokenArt" ? { checked: values.tokenArt ?? false } : { value: values[name] } } };
}

test("directory rerenders keep one button and DialogV2 uses a single outer form", () => {
  const { root, footer, state } = setup();
  hooks.get("renderActorDirectory")({}, root);
  hooks.get("renderActorDirectory")({}, root);
  assert.equal(footer.children.length, 1);
  footer.children[0].click();
  assert.equal(state.dialog.window.title, "Generate 5e NPC");
  assert.ok(!state.dialog.content.includes("<form"));
  assert.equal(state.dialog.buttons.find(b => b.action === "generate").default, true);
  assert.equal(state.dialog.buttons.find(b => b.action === "cancel").type, "button");
  assert.deepEqual(state.renderOptions, { force: true });
});

test("DialogV2 generates within a reversed range and persists the submitted settings", async () => {
  const { root, footer, state, settings } = setup();
  hooks.get("renderActorDirectory")({}, root);
  footer.children[0].click();
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    await state.dialog.buttons[0].callback({}, { form: form({ minLevel: "7", maxLevel: "2", race: "Human", role: "Fighter" }) });
  } finally { Math.random = random; }
  assert.equal(state.created.length, 1);
  assert.equal(state.created[0].system.details.cr, 5);
  assert.equal(settings.get("lastMinLevel"), 7);
  assert.equal(settings.get("lastMaxLevel"), 2);
  assert.equal(state.messages[0].kind, "info");
});

test("permission revoked after opening the dialog prevents Actor creation", async () => {
  const { root, footer, state } = setup();
  hooks.get("renderActorDirectory")({}, root);
  footer.children[0].click();
  state.allowed = false;
  await state.dialog.buttons[0].callback({}, { form: form({}) });
  assert.equal(state.created.length, 0);
  assert.equal(state.messages[0].kind, "warn");
  hooks.get("renderActorDirectory")({}, root);
  assert.equal(footer.children.length, 0);
});

test("Russian dialog translates labels while keeping generator identifiers unchanged", () => {
  const { root, footer, state } = setup("ru");
  hooks.get("renderActorDirectory")({}, root);
  assert.match(footer.children[0].innerHTML, /Создать НИП/);
  footer.children[0].click();
  assert.equal(state.dialog.window.title, "Создать НИП D&D 5e");
  assert.match(state.dialog.content, /Диапазон уровней/);
  assert.match(state.dialog.content, /value="Human">Человек<\/option>/);
  assert.match(state.dialog.content, /value="Warlock">Колдун<\/option>/);
  assert.equal(state.dialog.buttons[0].label, "Создать");
  assert.equal(state.dialog.buttons[1].label, "Отмена");
});

test("Russian generation and permission notifications use translated templates", async () => {
  const { root, footer, state } = setup("ru");
  hooks.get("renderActorDirectory")({}, root);
  footer.children[0].click();
  await state.dialog.buttons[0].callback({}, { form: form({ minLevel: "1", maxLevel: "1", race: "Human", role: "Fighter" }) });
  assert.equal(state.messages[0].message, `5edndnpc: создан НИП «${state.created[0].name}», уровень 1.`);
  state.allowed = false;
  await state.dialog.buttons[0].callback({}, { form: form({}) });
  assert.equal(state.messages[1].message, "5edndnpc: у вас нет прав на создание актёров.");
});

test("token-art checkbox is enabled initially and the submitted opt-out is remembered", async () => {
  const { root, footer, state, settings } = setup("ru");
  hooks.get("renderActorDirectory")({}, root);
  footer.children[0].click();
  assert.match(state.dialog.content, /name="tokenArt"[^>]*checked/);
  assert.match(state.dialog.content, /Подбирать токен/);
  await state.dialog.buttons[0].callback({}, { form: form({ minLevel: "1", maxLevel: "1", race: "Human", role: "Fighter", tokenArt: false }) });
  assert.equal(settings.get("tokenArtEnabled"), false);
  footer.children[0].click();
  assert.doesNotMatch(state.dialog.content, /name="tokenArt"[^>]*checked/);
  assert.equal(state.created[0].img, "icons/svg/mystery-man.svg");
});
