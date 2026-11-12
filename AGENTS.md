# Project context

This directory is the working project for 再靠近一点 (Closer Together).

- Canonical implementation: root `index.html`; assets in `assets/` and `icons/`.
- Start with `开始这里.md` for current structure and product decisions.
- Production: https://lidioliang.github.io/closer-together/
- Existing repository: https://github.com/LidioLiang/closer-together, branch `main`.
- `archive/` contains historical prototypes. Do not use its old templates or build scripts to overwrite the current app.
- Preserve separate couple/friend progress, existing storage keys and question IDs.
- Keep visible UI free of topic counts and progress counters. Retain icon-only sound toggle and a single draw button.
- When changing question content or application logic, run `node test.cjs`. For layout changes, check mobile and desktop using supported browser tools.
- Before a remote edit, inspect the current remote version to avoid overwriting newer work. This local delivery includes a verified snapshot, not a Git clone with history.
