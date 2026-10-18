// Link formats verified against Too Many Tokens Online's dnd/links directory.
// This reads data only; it does not import or execute the upstream module.
const INDEX_ROOT = "https://raw.githubusercontent.com/IsThisMyRealName/too-many-tokens-online/main/dnd/links/";
const IMAGE_ROOT = "https://raw.githubusercontent.com/IsThisMyRealName/too-many-tokens-dnd/main/";
const CLASS_CATEGORIES = {
  Barbarian: ["Berserker", "Tribal Warrior"],
  Bard: ["Commoner"],
  Cleric: ["Priest", "Acolyte"],
  Druid: ["Druid"],
  Fighter: ["Veteran", "Guard", "Gladiator"],
  Monk: ["Commoner"],
  Paladin: ["Knight", "Veteran"],
  Ranger: ["Scout"],
  Rogue: ["Bandit", "Scout"],
  Sorcerer: ["Mage"],
  Warlock: ["Mage"],
  Wizard: ["Mage"]
};
const RACE_TAGS = {
  Human: "human", Elf: "elf", Dwarf: "dwarf", Halfling: "halfling", Gnome: "gnome",
  "Half-Orc": "halforc", "Half-Elf": "halfelf", Tiefling: "tiefling", Dragonborn: "dragonborn"
};

export function createTokenArtProvider({
  fetch: fetchData = (...args) => globalThis.fetch(...args),
  random = () => Math.random(),
  timeoutMs = 6000
} = {}) {
  const categoryCache = new Map();
  const verifiedImages = new Set();

  function loadCategory(category, signal) {
    if (categoryCache.has(category)) return categoryCache.get(category);
    const request = (async () => {
      const response = await fetchData(`${INDEX_ROOT}${encodeURIComponent(category)}.txt`, { signal });
      if (response.status === 404) return [];
      if (!response.ok) throw new Error(`Token catalog HTTP ${response.status}`);
      const text = await response.text();
      return [...new Set(text.split(/\r?\n/).map(line => line.trim()).filter(line =>
        /^[^/\\]+\.(?:webp|png|jpe?g|avif)$/i.test(line) && !line.includes("..")
      ))];
    })();
    categoryCache.set(category, request);
    request.catch(() => {
      if (categoryCache.get(category) === request) categoryCache.delete(category);
    });
    return request;
  }

  return async ({ race, role }) => {
    const raceTag = RACE_TAGS[race];
    const preferred = CLASS_CATEGORIES[role];
    if (!raceTag || !preferred) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      for (const category of new Set([...preferred, "Commoner"])) {
        const files = (await loadCategory(category, controller.signal)).filter(file => {
          const tags = file.toLowerCase().replace(/[^a-z]/g, "");
          return tags.includes(raceTag) && !(race === "Elf" && tags.includes("halfelf"));
        });
        if (!files.length) continue;
        const start = Math.floor(random() * files.length);
        // Stale individual links should not discard an otherwise usable catalog.
        for (let offset = 0; offset < Math.min(files.length, 3); offset++) {
          const file = files[(start + offset) % files.length];
          const src = `${IMAGE_ROOT}${encodeURIComponent(category)}/${encodeURIComponent(file)}`;
          if (verifiedImages.has(src)) return src;
          const response = await fetchData(src, { method: "HEAD", signal: controller.signal });
          if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) continue;
          verifiedImages.add(src);
          return src;
        }
      }
    } catch (error) {
      // Art is optional. Network errors must not abort Actor creation.
      console.debug("5edndnpc | Optional token lookup failed", error);
    } finally {
      clearTimeout(timer);
    }
    return null;
  };
}

export const getNpcTokenImage = createTokenArtProvider();
