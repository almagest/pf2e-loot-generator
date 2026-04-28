import { LootGeneratorForm, MODULE_ID } from "./loot-generator-form.js";

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = {
    openGenerator: () => new LootGeneratorForm().render(true),
    addLoot: (actor) => new LootGeneratorForm(actor).render(true),
  };

  game.settings.registerMenu(MODULE_ID, "open-generator", {
    name: "PF2ELootGenerator.Settings.OpenName",
    hint: "PF2ELootGenerator.Settings.OpenHint",
    label: "PF2ELootGenerator.Button",
    icon: "fas fa-gem",
    type: LootGeneratorForm,
    restricted: true,
  });
});

Hooks.on("renderActorDirectory", (app, html) => {
  injectLaunchButton(app, html);
});

Hooks.on("renderSidebarTab", (app, html) => {
  injectLaunchButton(app, html);
});

Hooks.on("getApplicationV1HeaderButtons", (app, buttons) => {
  addActorHeaderButton(app, buttons);
});

Hooks.on("getApplicationHeaderButtons", (app, buttons) => {
  addActorHeaderButton(app, buttons);
});

Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
  addActorHeaderButton(app, buttons);
});

Hooks.on("renderActorSheet", (app, html) => {
  if (!canAddLootToSheet(app)) return;

  const root = resolveRootElement(html);
  const header = root?.closest?.(".app")?.querySelector?.(".window-header .window-title") ?? root?.parentElement?.querySelector?.(".window-header .window-title");
  const controls = header?.parentElement;
  if (!controls || controls.querySelector(".pf2e-loot-generator-add")) return;

  const button = document.createElement("a");
  button.className = "header-button pf2e-loot-generator-add";
  button.innerHTML = `<i class="fa-solid fa-gem"></i> ${game.i18n.localize("PF2ELootGenerator.AddButton")}`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    new LootGeneratorForm(app.actor).render(true);
  });
  controls.insertBefore(button, controls.firstChild);
});

function addActorHeaderButton(app, buttons) {
  if (!canAddLootToSheet(app)) return;
  if (buttons.some((button) => button.class === "pf2e-loot-generator-add")) return;

  buttons.unshift({
    label: game.i18n.localize("PF2ELootGenerator.AddButton"),
    class: "pf2e-loot-generator-add",
    icon: "fa-solid fa-gem",
    onclick: () => new LootGeneratorForm(app.actor).render(true),
  });
}

function injectLaunchButton(app, html) {
  if (!game.user.isGM || game.system.id !== "pf2e") return;
  if (!isActorSidebar(app)) return;

  const root = resolveRootElement(html);
  if (!root || root.querySelector(".pf2e-loot-generator-launch")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "pf2e-loot-generator-launch";
  button.innerHTML = `<i class="fas fa-gem"></i> ${game.i18n.localize("PF2ELootGenerator.Button")}`;
  button.addEventListener("click", () => new LootGeneratorForm().render(true));

  const footer = root.querySelector(".directory-footer");
  const actionButtons = root.querySelector(".action-buttons");
  const header = root.querySelector("header, .directory-header");

  if (footer) {
    footer.prepend(button);
    return;
  }

  if (actionButtons) {
    actionButtons.prepend(button);
    return;
  }

  if (header?.parentElement) {
    header.parentElement.insertBefore(button, header.nextSibling);
    return;
  }

  root.prepend(button);
}

function isActorSidebar(app) {
  return app?.tabName === "actors" || app?.options?.collection === game.actors || app?.collection === game.actors;
}

function resolveRootElement(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (html[0] instanceof HTMLElement) return html[0];
  if (html.element instanceof HTMLElement) return html.element;
  if (html.element?.[0] instanceof HTMLElement) return html.element[0];
  return null;
}

function canAddLootToSheet(app) {
  const actor = app?.actor;
  return Boolean(game.user.isGM && game.system.id === "pf2e" && actor && app.constructor?.name !== "LootGeneratorForm");
}
