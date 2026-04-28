const MODULE_ID = "pf2e-loot-generator";
const PACK_CACHE = new Map();
const ITEM_TYPES = ["weapon", "shield", "armor", "equipment", "consumable", "treasure", "backpack", "kit", "scroll", "wand"];
const PHYSICAL_ITEM_TYPES = ["weapon", "shield", "armor", "equipment", "consumable", "treasure", "backpack", "kit"];
const RARITIES = ["common", "uncommon", "rare", "unique"];
const LOOT_MODES = ["manual", "encounter"];
const ENCOUNTER_THREATS = ["low", "moderate", "severe", "extreme"];
const DEFAULT_IMAGE = "icons/svg/chest.svg";
const ENCOUNTER_TREASURE_GP = {
  1: { low: 13, moderate: 18, severe: 26, extreme: 35 },
  2: { low: 23, moderate: 30, severe: 45, extreme: 60 },
  3: { low: 38, moderate: 50, severe: 75, extreme: 100 },
  4: { low: 65, moderate: 85, severe: 130, extreme: 170 },
  5: { low: 100, moderate: 135, severe: 200, extreme: 270 },
  6: { low: 150, moderate: 200, severe: 300, extreme: 400 },
  7: { low: 220, moderate: 290, severe: 440, extreme: 580 },
  8: { low: 300, moderate: 400, severe: 600, extreme: 800 },
  9: { low: 430, moderate: 570, severe: 860, extreme: 1140 },
  10: { low: 600, moderate: 800, severe: 1200, extreme: 1600 },
  11: { low: 865, moderate: 1150, severe: 1725, extreme: 2300 },
  12: { low: 1250, moderate: 1650, severe: 2475, extreme: 3300 },
  13: { low: 1875, moderate: 2500, severe: 3750, extreme: 5000 },
  14: { low: 2750, moderate: 3650, severe: 5500, extreme: 7300 },
  15: { low: 4100, moderate: 5450, severe: 8200, extreme: 10900 },
  16: { low: 6200, moderate: 8250, severe: 12400, extreme: 16500 },
  17: { low: 9600, moderate: 12800, severe: 19200, extreme: 25600 },
  18: { low: 15600, moderate: 20800, severe: 31200, extreme: 41600 },
  19: { low: 26600, moderate: 35500, severe: 53250, extreme: 71000 },
  20: { low: 36800, moderate: 49000, severe: 73500, extreme: 98000 },
};
const SCROLL_COMPENDIUM_IDS = {
  1: "RjuupS9xyXDLgyIr",
  2: "Y7UD64foDbDMV9sx",
  3: "ZmefGBXGJF3CFDbn",
  4: "QSQZJ5BC3DeHv153",
  5: "tjLvRWklAylFhBHQ",
  6: "4sGIy77COooxhQuC",
  7: "fomEZZ4MxVVK3uVu",
  8: "iPki3yuoucnj7bIt",
  9: "cFHomF3tty8Wi1e5",
  10: "o1XIHJ4MJyroAHfF",
};
const WAND_COMPENDIUM_IDS = {
  1: "UJWiN0K3jqVjxvKk",
  2: "vJZ49cgi8szuQXAD",
  3: "wrDmWkGxmwzYtfiA",
  4: "Sn7v9SsbEDMUIwrO",
  5: "5BF7zMnrPYzyigCs",
  6: "kiXh4SUWKr166ZeM",
  7: "nmXPj9zuMRQBNT60",
  8: "Qs8RgNH6thRPv2jt",
  9: "Fgv722039TVM5JTc",
};
const DEFAULT_CONFIG = {
  generationMode: "create",
  lootMode: "manual",
  lootName: "",
  lootImage: DEFAULT_IMAGE,
  targetActorId: "",
  encounterLevel: 1,
  encounterCount: 1,
  encounterThreat: "moderate",
  fillWithCoins: true,
  commonCount: "1-8",
  uncommonCount: "0-4",
  rareCount: "0-2",
  uniqueCount: "0",
  minLevel: 0,
  maxLevel: 10,
  categories: [...ITEM_TYPES],
  rarities: [...RARITIES],
  tags: "",
  labels: "",
  openSheet: true,
  replaceExisting: false,
};

class LootGeneratorForm extends FormApplication {
  constructor(actor = null, options = {}) {
    super({}, options);
    this.actor = actor;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "pf2e-loot-generator-form",
      title: game.i18n.localize("PF2ELootGenerator.Form.Title"),
      template: `modules/${MODULE_ID}/templates/loot-generator-form.hbs`,
      classes: ["pf2e", "pf2e-loot-generator"],
      width: 720,
      height: "auto",
      closeOnSubmit: false,
      submitOnChange: false,
      resizable: true,
    });
  }

  getData() {
    const defaults = this.#getDefaults();

    return {
      actorName: this.actor?.name ?? "",
      actorOptions: getActorOptions(defaults.targetActorId),
      categories: ITEM_TYPES.map((type) => ({
        value: type,
        label: getCategoryLabel(type),
        checked: defaults.categories.includes(type),
      })),
      rarities: RARITIES.map((rarity) => ({
        value: rarity,
        label: game.i18n.localize(CONFIG.PF2E.rarityTraits?.[rarity] ?? rarity),
        checked: defaults.rarities.includes(rarity),
      })),
      encounterThreats: ENCOUNTER_THREATS.map((threat) => ({
        value: threat,
        label: game.i18n.localize(`PF2ELootGenerator.Threat.${capitalize(threat)}`),
        selected: defaults.encounterThreat === threat,
      })),
      selectedTags: getSelectedTraitOptions(defaults.tags),
      traitOptions: getTraitOptions(),
      defaults,
      createMode: defaults.generationMode === "create",
      existingMode: defaults.generationMode === "existing",
      manualLootMode: defaults.lootMode === "manual",
      encounterLootMode: defaults.lootMode === "encounter",
      encounterBudgetLabel: formatCopper(getEncounterBudget(defaults.encounterLevel, defaults.encounterThreat, defaults.encounterCount)),
      hasContextActor: Boolean(this.actor),
    };
  }

  async _updateObject(_event, formData) {
    if (game.system.id !== "pf2e") {
      ui.notifications.error(game.i18n.localize("PF2ELootGenerator.Notify.NoPf2e"));
      return;
    }

    const config = this.#normalizeFormData(formData);
    if (!this.actor && config.generationMode === "create" && !config.lootName) {
      ui.notifications.error(game.i18n.localize("PF2ELootGenerator.Notify.NoLootName"));
      return;
    }
    if (!this.actor && config.generationMode === "existing" && !config.targetActorId) {
      ui.notifications.error(game.i18n.localize("PF2ELootGenerator.Notify.NoTargetActor"));
      return;
    }

    ui.notifications.info(game.i18n.localize("PF2ELootGenerator.Notify.Generating"));

    const actor = await createOrPopulateLoot({
      actor: this.actor,
      config,
    });
    if (!actor) return;

    await this.close({ force: true });

    if (config.openSheet) {
      actor.sheet?.render(true);
    }
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("[data-action='cancel']").on("click", (event) => {
      event.preventDefault();
      this.close();
    });

    html.find("button.file-picker").on("click", (event) => {
      event.preventDefault();
      const picker = FilePicker.fromButton(event.currentTarget);
      picker.render(true);
    });

    html.find("[data-action='add-trait']").on("click", (event) => {
      event.preventDefault();
      addTraitFromPicker(html[0]);
    });

    html.find("[data-trait-search]").on("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addTraitFromPicker(html[0]);
    });

    html.find("[data-trait-chips]").on("click", ".trait-chip", (event) => {
      event.preventDefault();
      removeTraitFromPicker(html[0], event.currentTarget.dataset.trait);
    });

    html.find("[name='encounterLevel'], [name='encounterThreat'], [name='encounterCount']").on("change input", () => {
      updateEncounterItemLevelRange(html[0]);
      updateEncounterBudgetLabel(html[0]);
    });

    html.find("[name='lootMode']").on("change", () => {
      updateLootModeSections(html[0]);
      updateEncounterItemLevelRange(html[0]);
    });

    updateEncounterItemLevelRange(html[0]);
    updateLootModeSections(html[0]);
  }

  #getDefaults() {
    if (!this.actor) return { ...DEFAULT_CONFIG };

    const stored = this.actor.getFlag(MODULE_ID, "generatorConfig") ?? {};
    return {
      ...DEFAULT_CONFIG,
      ...stored,
      generationMode: "existing",
      lootName: stored.lootName || this.actor.name,
      lootImage: this.actor.img || stored.lootImage || DEFAULT_IMAGE,
      targetActorId: this.actor.id,
      categories: normalizeSelection(stored.categories, ITEM_TYPES),
      rarities: normalizeSelection(stored.rarities, RARITIES),
    };
  }

  #normalizeFormData(formData) {
    const expanded = foundry.utils.expandObject(formData);
    const categories = ensureArray(expanded.categories).filter(Boolean);
    const rarities = ensureArray(expanded.rarities).filter(Boolean);
    const generationMode = this.actor ? "existing" : String(expanded.generationMode ?? DEFAULT_CONFIG.generationMode);
    const lootMode = normalizeChoice(expanded.lootMode, LOOT_MODES, DEFAULT_CONFIG.lootMode);
    const encounterLevel = clampWholeNumber(expanded.encounterLevel, 1, 20, DEFAULT_CONFIG.encounterLevel);
    const encounterCount = clampWholeNumber(expanded.encounterCount, 1, 99, DEFAULT_CONFIG.encounterCount);
    const encounterThreat = normalizeChoice(expanded.encounterThreat, ENCOUNTER_THREATS, DEFAULT_CONFIG.encounterThreat);
    const defaultItemLevelRange = getDefaultItemLevelRange(encounterLevel);
    const minLevel =
      lootMode === "encounter" ? defaultItemLevelRange.min : Math.max(0, Number(expanded.minLevel ?? 0) || 0);
    const maxLevel =
      lootMode === "encounter" ? defaultItemLevelRange.max : Math.max(0, Number(expanded.maxLevel ?? 0) || 0);

    return {
      generationMode: generationMode === "existing" ? "existing" : "create",
      lootMode,
      lootName: this.actor ? this.actor.name : String(expanded.lootName ?? "").trim(),
      lootImage: String(expanded.lootImage ?? "").trim() || DEFAULT_IMAGE,
      targetActorId: this.actor?.id ?? String(expanded.targetActorId ?? "").trim(),
      encounterLevel,
      encounterCount,
      encounterThreat,
      fillWithCoins: Boolean(expanded.fillWithCoins),
      encounterBudget: getEncounterBudget(encounterLevel, encounterThreat, encounterCount),
      commonCount: String(expanded.commonCount ?? DEFAULT_CONFIG.commonCount).trim(),
      uncommonCount: String(expanded.uncommonCount ?? DEFAULT_CONFIG.uncommonCount).trim(),
      rareCount: String(expanded.rareCount ?? DEFAULT_CONFIG.rareCount).trim(),
      uniqueCount: String(expanded.uniqueCount ?? DEFAULT_CONFIG.uniqueCount).trim(),
      countRanges: {
        common: parseRangeInput(expanded.commonCount, DEFAULT_CONFIG.commonCount),
        uncommon: parseRangeInput(expanded.uncommonCount, DEFAULT_CONFIG.uncommonCount),
        rare: parseRangeInput(expanded.rareCount, DEFAULT_CONFIG.rareCount),
        unique: parseRangeInput(expanded.uniqueCount, DEFAULT_CONFIG.uniqueCount),
      },
      minLevel: Math.min(minLevel, maxLevel),
      maxLevel: Math.max(minLevel, maxLevel),
      categories: categories.length ? categories : [...ITEM_TYPES],
      rarities: rarities.length ? rarities : [...RARITIES],
      tags: normalizeCsv(expanded.tags),
      labels: normalizeCsv(expanded.labels),
      openSheet: Boolean(expanded.openSheet),
      replaceExisting: !this.actor && Boolean(expanded.replaceExisting),
    };
  }
}

async function createOrPopulateLoot({ actor = null, config }) {
  const matches = await getFilteredItems(config);
  if (!matches.length) {
    ui.notifications.warn(game.i18n.localize("PF2ELootGenerator.Notify.NoMatches"));
    return null;
  }

  const generated = generateLoot(matches, config);
  if (!generated.items.length && generated.coinValue <= 0) {
    ui.notifications.warn(game.i18n.localize("PF2ELootGenerator.Notify.NoSelection"));
    return null;
  }

  const target = actor ?? (config.generationMode === "existing" ? game.actors.get(config.targetActorId) : await createLootActor(config));
  if (!target) {
    ui.notifications.error(game.i18n.localize("PF2ELootGenerator.Notify.NoTargetActor"));
    return null;
  }

  await addItemsToActor(target, generated.items);
  if (generated.coinValue > 0) {
    await addCoinsToActor(target, generated.coinValue);
  }
  await target.setFlag(MODULE_ID, "generatorConfig", serializeGeneratorConfig(config, target));

  const notificationKey =
    config.lootMode === "encounter"
      ? config.generationMode === "create"
        ? "PF2ELootGenerator.Notify.CreatedBudget"
        : "PF2ELootGenerator.Notify.AddedBudget"
      : config.generationMode === "create"
        ? "PF2ELootGenerator.Notify.Created"
        : "PF2ELootGenerator.Notify.Added";

  ui.notifications.info(
    game.i18n.format(notificationKey, {
      name: target.name,
      count: generated.items.length + (generated.coinValue > 0 ? 1 : 0),
      encounters: config.encounterCount,
      budget: formatCopper(generated.budget),
      spent: formatCopper(generated.spentValue),
      coins: formatCopper(generated.coinValue),
    }),
  );

  return target;
}

async function createLootActor(config) {
  const existing = game.actors.getName(config.lootName);
  if (existing && !config.replaceExisting) {
    ui.notifications.error(game.i18n.localize("PF2ELootGenerator.Notify.ExistingActor"));
    return null;
  }

  if (existing && config.replaceExisting) {
    await existing.delete();
  }

  return Actor.create({
    name: config.lootName,
    type: "loot",
    img: config.lootImage || DEFAULT_IMAGE,
    system: {
      lootSheetType: "Loot",
      hiddenWhenEmpty: false,
      details: {
        description: "",
        level: {
          value: config.maxLevel,
        },
      },
    },
    flags: {
      [MODULE_ID]: {
        generatorConfig: serializeGeneratorConfig(config),
      },
    },
  });
}

async function addItemsToActor(actor, selectedItems) {
  const itemDocuments = await Promise.all(
    selectedItems.map(async (entry) => {
      const item = await fromUuid(entry.uuid);
      if (!item) return null;

      const source = entry.kind === "spell-consumable" ? await createSpellConsumableSource(entry, item) : item.toObject();
      if (!source) return null;

      source.system ??= {};
      source.system.quantity ??= 1;
      return source;
    }),
  );

  const createData = itemDocuments.filter(Boolean);
  if (createData.length) {
    await actor.createEmbeddedDocuments("Item", createData);
  }
}

async function addCoinsToActor(actor, copperValue) {
  const coins = copperToCoins(copperValue);
  if (actor.inventory?.addCoins) {
    await actor.inventory.addCoins(coins);
    return;
  }

  await actor.createEmbeddedDocuments("Item", [createCoinTreasureSource(copperValue)]);
}

async function getFilteredItems(filters) {
  ui.notifications.info(game.i18n.localize("PF2ELootGenerator.Notify.Loading"));
  const allItems = await loadPackItems();
  const allSpells = await loadSpellConsumableItems(filters);

  return [...allItems, ...allSpells].filter((item) => {
    if (!filters.categories.includes(item.type)) return false;
    if (!filters.rarities.includes(item.rarity)) return false;
    if (item.level < filters.minLevel || item.level > filters.maxLevel) return false;
    if (item.priceValue <= 0) return false;
    if (filters.tags.length && !filters.tags.every((tag) => item.traits.includes(tag))) return false;
    if (filters.labels.length && !filters.labels.some((label) => item.searchBlob.includes(label))) return false;
    return true;
  });
}

function pickRandomItems(items, countRanges) {
  const selected = [];

  for (const rarity of RARITIES) {
    const pool = shuffle(items.filter((item) => item.rarity === rarity));
    const range = countRanges[rarity] ?? { min: 0, max: 0 };
    const count = Math.min(randomBetween(range.min, range.max), pool.length);
    selected.push(...pool.slice(0, count));
  }

  return selected;
}

function generateLoot(items, config) {
  if (config.lootMode !== "encounter") {
    const selected = pickRandomItems(items, config.countRanges);
    const spentValue = sumPriceValue(selected);
    return {
      items: selected,
      budget: spentValue,
      spentValue,
      itemValue: spentValue,
      coinValue: 0,
    };
  }

  return pickBudgetedItems(items, config);
}

function pickBudgetedItems(items, config) {
  const budget = config.encounterBudget;
  let remaining = budget;
  const selected = [];
  const available = shuffle(items).filter((item) => item.priceValue <= budget);

  while (remaining > 0) {
    const affordable = available.filter((item) => !selected.includes(item) && item.priceValue <= remaining);
    if (!affordable.length) break;

    const item = chooseBudgetCandidate(affordable, remaining);
    selected.push(item);
    remaining -= item.priceValue;
  }

  const itemValue = sumPriceValue(selected);
  const coinValue = config.fillWithCoins ? Math.max(0, budget - itemValue) : 0;

  return {
    items: selected,
    budget,
    spentValue: itemValue + coinValue,
    itemValue,
    coinValue,
  };
}

function chooseBudgetCandidate(items, remaining) {
  const sorted = shuffle(items).sort((a, b) => b.priceValue - a.priceValue);
  const minimumUsefulPrice = Math.max(1, Math.floor(remaining * 0.2));
  return sorted.find((item) => item.priceValue >= minimumUsefulPrice) ?? sorted[0];
}

async function loadPackItems() {
  if (PACK_CACHE.has("items")) {
    return PACK_CACHE.get("items");
  }

  const packs = game.packs.filter((pack) => {
    const packageName = pack.metadata.packageName ?? pack.metadata.package;
    return pack.documentName === "Item" && packageName === "pf2e";
  });
  const fields = [
    "system.level.value",
    "system.traits.value",
    "system.traits.rarity",
    "system.stackGroup",
    "system.slug",
    "system.category",
    "system.group",
    "system.price.value",
  ];

  const entries = [];
  for (const pack of packs) {
    const index = await pack.getIndex({ fields });
    for (const item of index) {
      if (!PHYSICAL_ITEM_TYPES.includes(item.type)) continue;
      if (item.type === "treasure" && item.system?.stackGroup === "coins") continue;

      const traits = ensureArray(item.system?.traits?.value).map((value) => String(value).toLowerCase());
      const rarity = String(item.system?.traits?.rarity ?? "common").toLowerCase();
      const category = String(item.system?.category ?? "").toLowerCase();
      const group = String(item.system?.group ?? "").toLowerCase();
      const slug = String(item.system?.slug ?? item.name ?? "").toLowerCase();
      const searchBlob = [item.name, slug, category, group].join(" ").toLowerCase();
      const priceValue = getPriceInCopper(item.system?.price?.value);
      if (priceValue <= 0) continue;

      entries.push({
        uuid: item.uuid,
        type: item.type,
        level: Number(item.system?.level?.value ?? 0) || 0,
        traits,
        rarity,
        searchBlob,
        priceValue,
      });
    }
  }

  const uniqueEntries = Array.from(new Map(entries.map((entry) => [entry.uuid, entry])).values());
  PACK_CACHE.set("items", uniqueEntries);
  return uniqueEntries;
}

async function loadSpellConsumableItems(filters) {
  const requestedTypes = filters.categories.filter((type) => type === "scroll" || type === "wand");
  if (!requestedTypes.length) return [];

  const cacheKey = "spell-consumables";
  if (PACK_CACHE.has(cacheKey)) {
    return PACK_CACHE.get(cacheKey);
  }

  const packs = game.packs.filter((pack) => {
    const packageName = pack.metadata.packageName ?? pack.metadata.package;
    return pack.documentName === "Item" && packageName === "pf2e" && pack.collection.includes("spells");
  });
  const fields = [
    "system.level.value",
    "system.traits.value",
    "system.traits.rarity",
    "system.traits.traditions",
    "system.ritual",
  ];

  const entries = [];
  for (const pack of packs) {
    const index = await pack.getIndex({ fields });
    for (const spell of index) {
      if (spell.type !== "spell") continue;

      const traits = ensureArray(spell.system?.traits?.value).map((value) => String(value).toLowerCase());
      const traditions = ensureArray(spell.system?.traits?.traditions).map((value) => String(value).toLowerCase());
      const rank = Number(spell.system?.level?.value ?? 0) || 0;
      const isCantrip = traits.includes("cantrip");
      const isFocus = traits.includes("focus") || (isCantrip && traditions.length === 0);
      const isRitual = Boolean(spell.system?.ritual);
      if (rank < 1 || isCantrip || isFocus || isRitual) continue;

      const rarity = String(spell.system?.traits?.rarity ?? "common").toLowerCase();
      const searchBlob = [spell.name].join(" ").toLowerCase();
      const itemLevelEquivalent = (rank * 2) - 1;

      for (const type of ["scroll", "wand"]) {
        if (type === "wand" && rank > 9) continue;

        const baseItemId = getSpellConsumableBaseId(type, rank);
        const basePrice = await getSpellConsumableBasePrice(type, rank);
        if (!baseItemId || basePrice <= 0) continue;

        entries.push({
          kind: "spell-consumable",
          uuid: spell.uuid,
          type,
          rank,
          baseItemId,
          level: itemLevelEquivalent,
          traits: [...new Set([...traits, ...traditions, type])],
          rarity,
          searchBlob,
          priceValue: basePrice,
        });
      }
    }
  }

  PACK_CACHE.set(cacheKey, entries);
  return entries;
}

function getActorOptions(selectedActorId) {
  return game.actors
    .filter((actor) => actor.isOwner)
    .map((actor) => ({
      id: actor.id,
      name: actor.name,
      type: game.i18n.localize(CONFIG.Actor.typeLabels?.[actor.type] ?? `TYPES.Actor.${actor.type}`),
      selected: actor.id === selectedActorId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}

function getEncounterBudget(level, threat, count = 1) {
  const tableLevel = clampWholeNumber(level, 1, 20, DEFAULT_CONFIG.encounterLevel);
  const tableThreat = normalizeChoice(threat, ENCOUNTER_THREATS, DEFAULT_CONFIG.encounterThreat);
  const encounterCount = clampWholeNumber(count, 1, 99, DEFAULT_CONFIG.encounterCount);
  return (ENCOUNTER_TREASURE_GP[tableLevel]?.[tableThreat] ?? ENCOUNTER_TREASURE_GP[1].moderate) * 100 * encounterCount;
}

function getDefaultItemLevelRange(level) {
  const encounterLevel = clampWholeNumber(level, 1, 20, DEFAULT_CONFIG.encounterLevel);
  return {
    min: Math.max(0, encounterLevel - 3),
    max: Math.min(20, encounterLevel + 1),
  };
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function normalizeCsv(value) {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeSelection(value, fallback) {
  const selected = ensureArray(value).filter(Boolean);
  return selected.length ? selected : [...fallback];
}

function normalizeChoice(value, choices, fallback) {
  const choice = String(value ?? fallback).trim().toLowerCase();
  return choices.includes(choice) ? choice : fallback;
}

function clampWholeNumber(value, min, max, fallback) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function sumPriceValue(items) {
  return items.reduce((sum, item) => sum + item.priceValue, 0);
}

function copperToCoins(copperValue) {
  let remaining = Math.max(0, Math.trunc(copperValue));
  const gp = Math.floor(remaining / 100);
  remaining %= 100;
  const sp = Math.floor(remaining / 10);
  const cp = remaining % 10;
  return { gp, sp, cp };
}

function formatCopper(copperValue) {
  const coins = new game.pf2e.Coins({ cp: Math.max(0, Math.trunc(copperValue)) });
  return coins.toString({ decimal: true });
}

function createCoinTreasureSource(copperValue) {
  return {
    name: game.i18n.localize("PF2ELootGenerator.CoinItemName"),
    type: "treasure",
    img: "icons/commodities/currency/coins-assorted-mix-gold-silver-copper.webp",
    system: {
      description: {
        value: "",
      },
      quantity: 1,
      stackGroup: "coins",
      price: {
        value: copperToCoins(copperValue),
      },
      level: {
        value: 0,
      },
      traits: {
        rarity: "common",
        value: [],
      },
    },
  };
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function getCategoryLabel(type) {
  if (type === "scroll") return game.i18n.localize("PF2ELootGenerator.Category.Scroll");
  if (type === "wand") return game.i18n.localize("PF2ELootGenerator.Category.Wand");
  return game.i18n.localize(`TYPES.Item.${type}`);
}

function getSelectedTraitOptions(tags) {
  const options = getTraitOptions();
  const optionMap = new Map(options.map((option) => [option.value, option]));
  return normalizeCsv(tags).map((tag) => optionMap.get(tag) ?? { value: tag, label: tag });
}

function getTraitOptions() {
  const traitConfig = {
    ...CONFIG.PF2E.armorTraits,
    ...CONFIG.PF2E.consumableTraits,
    ...CONFIG.PF2E.equipmentTraits,
    ...CONFIG.PF2E.shieldTraits,
    ...CONFIG.PF2E.spellTraits,
    ...CONFIG.PF2E.magicTraditions,
    ...CONFIG.PF2E.weaponTraits,
  };

  return Object.entries(traitConfig)
    .map(([value, label]) => ({
      value,
      label: game.i18n.localize(label),
      search: `${value} ${game.i18n.localize(label)}`.toLowerCase(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
}

function addTraitFromPicker(root) {
  const search = root.querySelector("[data-trait-search]");
  const typed = search?.value?.trim();
  if (!typed) return;

  const options = getTraitOptions();
  const query = typed.toLowerCase();
  const option =
    options.find((entry) => entry.value === query) ??
    options.find((entry) => entry.label.toLowerCase() === query) ??
    options.find((entry) => entry.search.includes(query));

  if (!option) return;

  const tagsInput = root.querySelector("[data-tags-value]");
  const tags = new Set(normalizeCsv(tagsInput.value));
  tags.add(option.value);
  tagsInput.value = Array.from(tags).join(", ");
  search.value = "";
  renderTraitChips(root);
}

function removeTraitFromPicker(root, trait) {
  const tagsInput = root.querySelector("[data-tags-value]");
  const tags = normalizeCsv(tagsInput.value).filter((tag) => tag !== trait);
  tagsInput.value = tags.join(", ");
  renderTraitChips(root);
}

function updateEncounterBudgetLabel(root) {
  const level = root.querySelector("[name='encounterLevel']")?.value;
  const threat = root.querySelector("[name='encounterThreat']")?.value;
  const count = root.querySelector("[name='encounterCount']")?.value;
  const label = root.querySelector("[data-encounter-budget]");
  if (!label) return;

  label.textContent = game.i18n.format("PF2ELootGenerator.Form.EncounterBudget", {
    budget: formatCopper(getEncounterBudget(level, threat, count)),
  });
}

function updateLootModeSections(root) {
  const selectedMode = root.querySelector("[name='lootMode']:checked")?.value ?? DEFAULT_CONFIG.lootMode;
  for (const section of root.querySelectorAll("[data-loot-mode-section]")) {
    section.hidden = section.dataset.lootModeSection !== selectedMode;
  }
}

function updateEncounterItemLevelRange(root) {
  const selectedMode = root.querySelector("[name='lootMode']:checked")?.value ?? DEFAULT_CONFIG.lootMode;
  if (selectedMode !== "encounter") return;

  const range = getDefaultItemLevelRange(root.querySelector("[name='encounterLevel']")?.value);
  const minLevel = root.querySelector("[name='minLevel']");
  const maxLevel = root.querySelector("[name='maxLevel']");
  if (minLevel) minLevel.value = range.min;
  if (maxLevel) maxLevel.value = range.max;
}

function renderTraitChips(root) {
  const chips = root.querySelector("[data-trait-chips]");
  const tagsInput = root.querySelector("[data-tags-value]");
  if (!chips || !tagsInput) return;

  chips.replaceChildren(
    ...getSelectedTraitOptions(tagsInput.value).map((trait) => {
      const button = document.createElement("button");
      const label = document.createElement("span");
      const icon = document.createElement("i");
      button.type = "button";
      button.className = "trait-chip";
      button.dataset.trait = trait.value;
      label.textContent = trait.label;
      icon.className = "fas fa-times";
      button.append(label, icon);
      return button;
    }),
  );
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseRangeInput(value, fallback) {
  const text = String(value ?? "").trim() || fallback;
  const match = text.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!match) return parseRangeInput(fallback, fallback);

  const first = Math.max(0, Number(match[1]) || 0);
  const second = Math.max(0, Number(match[2] ?? match[1]) || first);
  return {
    min: Math.min(first, second),
    max: Math.max(first, second),
  };
}

function shuffle(items) {
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool;
}

function getPriceInCopper(priceValue) {
  if (!priceValue) return 0;
  if (typeof priceValue === "string") {
    return game.pf2e.Coins.fromString(priceValue).copperValue;
  }
  return new game.pf2e.Coins(priceValue).copperValue;
}

async function createSpellConsumableSource(entry, spell) {
  const pack = game.packs.find((candidate) => candidate.collection === "pf2e.equipment-srd");
  const base = await pack?.getDocument(entry.baseItemId);
  if (!base) return null;

  const source = base.toObject();
  source._id = null;

  const spellSource = spell.toObject();
  const spellTraits = ensureArray(spellSource.system?.traits?.value);
  const baseTraits = source.system.traits;
  baseTraits.value = [...new Set([...baseTraits.value, ...spellTraits])].sort();
  baseTraits.rarity = spellSource.system?.traits?.rarity ?? baseTraits.rarity;

  source.name = getSpellConsumableName(entry.type, spell.name, entry.rank);
  source.system.description.value = createSpellConsumableDescription(source.system.description.value, spell);
  source.system.spell = foundry.utils.mergeObject(
    spellSource,
    {
      _id: randomID(),
      system: {
        location: {
          value: null,
          heightenedLevel: entry.rank,
        },
      },
    },
    { inplace: false },
  );

  return source;
}

function createSpellConsumableDescription(baseDescription, spell) {
  const paragraph = document.createElement("p");
  paragraph.append(spell.uuid ? `@UUID[${spell.uuid}]{${spell.name}}` : spell.name);

  const container = document.createElement("div");
  const hr = document.createElement("hr");
  container.append(paragraph, hr);
  hr.insertAdjacentHTML("afterend", baseDescription);
  return container.innerHTML;
}

function getSpellConsumableName(type, spellName, rank) {
  const template = type === "scroll" ? "PF2E.Item.Physical.FromSpell.Scroll" : "PF2E.Item.Physical.FromSpell.Wand";
  return game.i18n.format(template, { name: spellName, level: rank });
}

function getSpellConsumableBaseId(type, rank) {
  return type === "scroll" ? SCROLL_COMPENDIUM_IDS[rank] : WAND_COMPENDIUM_IDS[rank];
}

async function getSpellConsumableBasePrice(type, rank) {
  const cacheKey = `${type}-base-price-${rank}`;
  if (PACK_CACHE.has(cacheKey)) return PACK_CACHE.get(cacheKey);

  const pack = game.packs.find((candidate) => candidate.collection === "pf2e.equipment-srd");
  const base = await pack?.getDocument(getSpellConsumableBaseId(type, rank) ?? "");
  const price = getPriceInCopper(base?.system?.price?.value);
  PACK_CACHE.set(cacheKey, price);
  return price;
}

function serializeGeneratorConfig(config, actor = null) {
  return {
    generationMode: actor ? "existing" : config.generationMode,
    lootMode: config.lootMode,
    lootName: actor?.name ?? config.lootName,
    lootImage: actor?.img ?? config.lootImage,
    targetActorId: actor?.id ?? config.targetActorId,
    encounterLevel: config.encounterLevel,
    encounterCount: config.encounterCount,
    encounterThreat: config.encounterThreat,
    fillWithCoins: config.fillWithCoins,
    commonCount: config.commonCount,
    uncommonCount: config.uncommonCount,
    rareCount: config.rareCount,
    uniqueCount: config.uniqueCount,
    minLevel: config.minLevel,
    maxLevel: config.maxLevel,
    categories: [...config.categories],
    rarities: [...config.rarities],
    tags: config.tags.join(", "),
    labels: config.labels.join(", "),
    openSheet: config.openSheet,
    replaceExisting: false,
  };
}

export { MODULE_ID, LootGeneratorForm, createOrPopulateLoot };
