### Contributing — keeping the CJS mirror in sync

`index.cjs` is **auto-generated** from `index.js` by [`scripts/build-cjs.js`](scripts/build-cjs.js). Don't edit `index.cjs` by hand.

You don't normally need to think about this:

- A pre-commit hook in [`.githooks/pre-commit`](.githooks/pre-commit)
  regenerates `index.cjs` whenever `index.js` is part of the staged
  change set and stages the result so it lands in the same commit.
  The hook is wired up by the `prepare` lifecycle script — `npm install`
  in this repo runs `git config core.hooksPath .githooks` automatically.
- `npm run build:cjs` triggers the regen on demand.
- `npm run check:cjs` exits non-zero if the committed `index.cjs` is
  stale; useful in CI to catch a missed regen.
- The `prepack` lifecycle re-runs the build, so the published tarball is
  always coherent regardless of local state.
