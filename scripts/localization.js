/** Localize module-owned generated text, retaining English when no key exists.
 * Pure generator checks can also run without a Foundry localization service.
 */
export function localizeText(key, fallback, data) {
  const i18n = globalThis.game?.i18n;
  if (!i18n) return fallback;
  const id = `5edndnpc.${key}`;
  const translated = i18n.localize(id);
  if (translated === id) return fallback;
  return data ? i18n.format(id, data) : translated;
}

export function localizeItemName(name) {
  const [, base, bonus = ""] = name.match(/^(.*?)( \+\d+)?$/);
  return localizeText(`items.${base}`, base) + bonus;
}
