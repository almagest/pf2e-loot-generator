# PF2E Loot Generator

A Foundry VTT v13 module for Pathfinder 2E that creates loot actors and adds randomized PF2E compendium items to new or existing actors.

## Features

- Adds a **Generate Loot** button to the Actors directory for GMs.
- Adds an **Add Loot** header button to actor sheets.
- Creates PF2E `loot` actors with randomized inventory.
- Adds randomized physical items, scrolls, and wands to existing actors.
- Filters by item type, rarity, level range, traits, and label/name text.
- Can generate by manual rarity counts or by the GM Core Treasure by Encounter budget table.
- Can fill unspent encounter budget with PF2E coinage.
- Stores the last generator settings on the target actor.

## Installation

Copy or symlink this folder into your Foundry user data modules directory as `pf2e-loot-generator`, then enable **PF2E Loot Generator** in the world module settings.

Example:

```bash
ln -s /home/almagest/foundry/pf2e-loot-generator ~/.local/share/FoundryVTT/Data/modules/pf2e-loot-generator
```

Adjust the destination if your Foundry user data path is different.

## Compatibility

- Foundry VTT `13.348` or newer, verified against `13.351`.
- PF2E system `7.8.0` or newer.
