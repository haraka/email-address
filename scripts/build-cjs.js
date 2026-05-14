// Regenerates `index.cjs` from `index.js`. Invoked by the pre-commit
// hook (when `index.js` is staged) and by the `prepack` lifecycle so
// the published `index.cjs` always matches the ESM source.
//
//   node scripts/build-cjs.js          # rewrite index.cjs
//   node scripts/build-cjs.js --check  # exit 1 if index.cjs is stale
//
// The transform is intentionally syntactic and narrow: it swaps the ESM
// header for a CJS header and the named/default exports for
// `module.exports`. Anything between those endpoints is copied
// verbatim, so the two files share a single implementation of record.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(here)
const ESM_PATH = join(ROOT, 'index.js')
const CJS_PATH = join(ROOT, 'index.cjs')

const ESM_HEADER = `// ESM entry point — canonical source for this module. The CJS mirror at
// \`./index.cjs\` is auto-generated from this file by scripts/build-cjs.js
// and refreshed by the pre-commit hook in .githooks/pre-commit, so do
// not edit index.cjs by hand.

import { domainToASCII } from 'node:url'`

const CJS_HEADER = `'use strict'

// AUTO-GENERATED from \`./index.js\` by scripts/build-cjs.js — do not edit
// this file by hand. The pre-commit hook in .githooks/pre-commit
// regenerates it whenever index.js is staged; \`npm run build:cjs\`
// produces the same output on demand.

const { domainToASCII } = require('node:url')`

const ESM_FOOTER = `export { Address }
export default { Address }`

const CJS_FOOTER = `module.exports = { Address }
module.exports.default = module.exports`

function generate() {
  const esm = readFileSync(ESM_PATH, 'utf8')
  if (!esm.includes(ESM_HEADER)) {
    throw new Error(
      `index.js is missing the expected ESM header block. ` +
        `Update scripts/build-cjs.js if the header was intentionally rewritten.`,
    )
  }
  if (!esm.includes(ESM_FOOTER)) {
    throw new Error(
      `index.js is missing the expected ESM export footer. ` +
        `Update scripts/build-cjs.js if the footer was intentionally rewritten.`,
    )
  }
  return esm.replace(ESM_HEADER, CJS_HEADER).replace(ESM_FOOTER, CJS_FOOTER)
}

const want = generate()
const checkMode = process.argv.includes('--check')

if (checkMode) {
  let have
  try {
    have = readFileSync(CJS_PATH, 'utf8')
  } catch {
    have = ''
  }
  if (have === want) {
    process.exit(0)
  }
  process.stderr.write(
    `index.cjs is out of date. Run \`npm run build:cjs\` and commit the result.\n`,
  )
  process.exit(1)
}

writeFileSync(CJS_PATH, want)
process.stdout.write(`wrote ${CJS_PATH}\n`)
