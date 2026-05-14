'use strict'

// AUTO-GENERATED from the matching `.js` file by scripts/build-cjs.js
// — do not edit by hand. The pre-commit hook in .githooks/pre-commit
// regenerates these files whenever any `.js` source is staged;
// `npm run build:cjs` produces the same output on demand.

function isAllLower(s) {
  return s === s.toLowerCase()
}

function isAllUpper(s) {
  return s === s.toUpperCase()
}

// Title-case a string, with special-cases for "Mc…", "O'…" prefixes
// and a Roman-numeral pass so "level iii support" → "Level III Support".
function nameCase(s) {
  return s
    .toLowerCase()
    .replace(/\b(\w+)/g, (_, d1) => d1.charAt(0).toUpperCase() + d1.slice(1))
    .replace(/\bMc(\w)/gi, (_, d1) => `Mc${d1.toUpperCase()}`)
    .replace(/\bo'(\w)/gi, (_, d1) => `O'${d1.toUpperCase()}`)
    .replace(/\b(x*(ix)?v*(iv)?i*)\b/gi, (_, d1) => d1.toUpperCase())
}

// Pull a human name out of an address's `phrase` / `comment` (and, as a
// last resort, the local-part of the address itself). Returns '' when
// the heuristic finds nothing usable.
function extractName(phrase, address = '') {
  let name = phrase || ''

  // Encoded-word phrases (`=?UTF-8?Q?…?=`) are too brittle to decode
  // here — give up rather than emit garbage.
  if (/=\?.*?\?=/.test(name)) return ''

  // trim & condense whitespace
  name = name.trim().replace(/\s+/g, ' ')

  // Disregard purely numeric names (e.g. CompuServe 12345.6789 ids)
  if (/^[\d ]+$/.test(name)) return ''

  // strip outermost parens / quotes
  if (name.startsWith('(') && name.endsWith(')')) name = name.slice(1, -1)
  if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1)

  name = name
    .replace(/\([^)]*\)/g, '') // remove embedded comments
    .replace(/\\/g, '') // unescape

  if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1)

  name = name
    .replace(/^([^\s]+) ?, ?(.*)$/, '$2 $1') // "Last, First" → "First Last"
    .replace(/,.*/, '')

  if (isAllUpper(name) || isAllLower(name)) name = nameCase(name)

  name = name
    .replace(/\[[^\]]*\]/g, '') // drop [bracketed] annotations
    .replace(/(^[\s'"]+|[\s'"]+$)/g, '') // trim quotes/spaces again
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (name) return name

  // Fall back: extract a name from `first.last@…` style local-parts.
  const m = /([^%.@_]+([._][^%.@_]+)+)[@%]/.exec(address)
  if (m) {
    let candidate = m[1].replace(/[._]+/g, ' ')
    candidate = candidate.trim()
    if (isAllUpper(candidate) || isAllLower(candidate)) candidate = nameCase(candidate)
    return candidate
  }

  // X.400 style /G=Given/S=Surname/…
  if (/\/g=/i.test(address)) {
    const g = /\/g=([^/]*)/i.exec(address)?.[1] || ''
    const s = /\/s=([^/]*)/i.exec(address)?.[1] || ''
    const joined = `${g} ${s}`.trim()
    if (joined) return isAllUpper(joined) || isAllLower(joined) ? nameCase(joined) : joined
  }

  return ''
}

module.exports = { isAllLower, isAllUpper, nameCase, extractName }
module.exports.default = module.exports
