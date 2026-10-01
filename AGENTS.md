# Agent guidelines

This project is a dual-game Path of Exile exchange tool. The UI has two top-level game tabs:

- **Path of Exile 2** (`gameId: "poe2"`)
- **Path of Exile** (`gameId: "poe"`)

Game configs live in `GAME_CONFIGS` in `app.js`, with per-game data under `data/poe2_data/` and `data/poe_data/`.

## Dual-game changes (default)

When working on a change, apply it for **both** Path of Exile and Path of Exile 2 by default.

- Prefer shared logic over game-specific forks.
- If behavior depends on game, handle both `poe` and `poe2` (via `GAME_CONFIGS`, `state.gameId`, or shared helpers)—do not implement for only one tab.
- If UI, filters, storage, styling, or data loading changes, verify both game tabs still work.
- Only make a change single-game when the feature is inherently game-specific (for example Campaign is PoE2-only via `data-poe2-only`), or the user explicitly asks for one game.

## No Contributors

Do **not** add any Contributors, credits, acknowledgements, or similar attribution for Cursor, agents, or tools.

- No `CONTRIBUTORS` / `AUTHORS` / credits files or README contributor sections.
- No `Co-authored-by: Cursor` (or any AI/agent) trailer in commit messages.
- Do not invent or append contributor entries; leave human owner attribution alone.

A local Git hook lives at `.githooks/prepare-commit-msg` (also installed under `.git/hooks/`) to strip Cursor co-author trailers if the editor injects them.

## Project notes

- Static frontend: `index.html`, `app.js`, `campaign.js`, CSS, and `data/`.
- Do not add unnecessary docs or refactors outside the requested change.
