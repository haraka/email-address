// Regenerates the CJS mirror for every ESM source file. Invoked by
// the pre-commit hook (when any `*.js` is staged) and by the `prepack`
// lifecycle so the published `.cjs` files always match the ESM
// sources.
//
//   node scripts/build-cjs.js          # rewrite every <src>.cjs
//   node scripts/build-cjs.js --check  # exit 1 if any <src>.cjs is stale
//
// The transform is intentionally syntactic and narrow:
//
//   - Strip a leading `^// ` file-level comment block from the ESM
//     source (it only makes sense in the ESM context — the CJS file
//     gets its own auto-generated header instead).
//   - Rewrite every top-level `import { … } from '…'` line into a
//     `const { … } = require('…')`. Relative paths ending in `.js`
//     are rewritten to `.cjs` so the CJS mirror loads its own
//     siblings rather than crossing back into ESM via Node's
//     sync-require-of-ESM interop.
//   - Replace the trailing `export { … }` (+ optional
//     `export default { … }`) block with
//     `module.exports = { … }` followed by
//     `module.exports.default = module.exports`.
//
// Everything between those endpoints is copied verbatim, so the two
// formats share a single implementation of record.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(here)

// All ESM sources that need a CJS mirror. Keep this list in lock-step
// with `package.json` `files` and with new files under `lib/`. Output
// paths mirror the source tree under `dist/cjs/` so a future CJS
// retirement is a single `rm -rf dist/`.
const SOURCES = [
  { esm: 'index.js', cjs: 'dist/cjs/index.cjs' },
  { esm: 'lib/cursor.js', cjs: 'dist/cjs/lib/cursor.cjs' },
  { esm: 'lib/literals.js', cjs: 'dist/cjs/lib/literals.cjs' },
  { esm: 'lib/envelope.js', cjs: 'dist/cjs/lib/envelope.cjs' },
  { esm: 'lib/header.js', cjs: 'dist/cjs/lib/header.cjs' },
  { esm: 'lib/address.js', cjs: 'dist/cjs/lib/address.cjs' },
  { esm: 'lib/validator.js', cjs: 'dist/cjs/lib/validator.cjs' },
  { esm: 'lib/name-utils.js', cjs: 'dist/cjs/lib/name-utils.cjs' },
  { esm: 'lib/legacy.js', cjs: 'dist/cjs/lib/legacy.cjs' },
]

const CJS_HEADER = `'use strict'

// AUTO-GENERATED from the matching \`.js\` file by scripts/build-cjs.js
// — do not edit by hand. The pre-commit hook in .githooks/pre-commit
// regenerates these files whenever any \`.js\` source is staged;
// \`npm run build:cjs\` produces the same output on demand.

`

// File-level comment block at the top of an ESM source. Spans the
// initial run of `^// `-prefixed lines, up to the first blank line.
const LEADING_COMMENT_BLOCK_RE = /^(?:\/\/[^\n]*\n)+\n/

// `import { foo, bar } from '…'` — single-line, brace form. Multi-line
// import lists aren't used in this codebase.
const IMPORT_LINE_RE = /^import\s+(\{[^}]+\})\s+from\s+'([^']+)'\s*$/gm

// Trailing export block — `export { … }` followed optionally by
// `export default { … }`. We collapse it to one `module.exports`.
const EXPORT_BLOCK_RE = /^export\s+(\{[\s\S]+?\})\s*(?:^export\s+default\s+\{[\s\S]+?\}\s*)?$/m

function rewriteRequirePath(spec) {
  // Only rewrite relative paths; bare specifiers (`node:url`,
  // `node-fetch`) pass through unchanged.
  if (!spec.startsWith('./') && !spec.startsWith('../')) return spec
  if (spec.endsWith('.js')) return spec.replace(/\.js$/, '.cjs')
  return spec
}

function generate(esmPath) {
  const src = readFileSync(esmPath, 'utf8')

  let out = src.replace(LEADING_COMMENT_BLOCK_RE, '')

  if (!IMPORT_LINE_RE.test(out)) {
    // No imports — that's fine for leaf files, but ensure we still get
    // a sensible body. Reset the regex's stickyness for later use.
    IMPORT_LINE_RE.lastIndex = 0
  } else {
    IMPORT_LINE_RE.lastIndex = 0
  }

  out = out.replace(IMPORT_LINE_RE, (_, list, spec) => {
    return `const ${list} = require('${rewriteRequirePath(spec)}')`
  })

  if (!EXPORT_BLOCK_RE.test(out)) {
    throw new Error(
      `${esmPath} has no trailing \`export { … }\` block — every ESM source must end with one so the CJS generator can collect its public surface.`,
    )
  }
  out = out.replace(EXPORT_BLOCK_RE, (_, list) => {
    return `module.exports = ${list}\nmodule.exports.default = module.exports\n`
  })

  return CJS_HEADER + out
}

const checkMode = process.argv.includes('--check')
let stale = 0

for (const { esm, cjs } of SOURCES) {
  const esmPath = join(ROOT, esm)
  const cjsPath = join(ROOT, cjs)
  const want = generate(esmPath)

  if (checkMode) {
    let have = ''
    try {
      have = readFileSync(cjsPath, 'utf8')
    } catch {
      /* file may not exist yet */
    }
    if (have !== want) {
      process.stderr.write(`${cjs}: out of date\n`)
      stale += 1
    }
  } else {
    mkdirSync(dirname(cjsPath), { recursive: true })
    writeFileSync(cjsPath, want)
    process.stdout.write(`wrote ${cjs}\n`)
  }
}

if (checkMode) {
  if (stale > 0) {
    process.stderr.write(
      `\n${stale} CJS mirror(s) are stale. Run \`npm run build:cjs\` and commit the result.\n`,
    )
    process.exit(1)
  }
}
