'use strict'

// AUTO-GENERATED from the matching `.js` file by scripts/build-cjs.js
// — do not edit by hand. The pre-commit hook in .githooks/pre-commit
// regenerates these files whenever any `.js` source is staged;
// `npm run build:cjs` produces the same output on demand.

const { domainToASCII } = require('node:url')
const {
  Cursor,
  parseError,
  IPV4_RE,
  IPV6_HEX_RE,
  STANDARDIZED_TAG_RE,
  DCONTENT_RE,
  NON_ASCII_RE,
} = require('./cursor.cjs')
function parseAddressLiteral(cursor) {
  const start = cursor.pos
  cursor.expect('[')
  const bodyStart = cursor.pos
  while (!cursor.done() && cursor.peek() !== ']') {
    const c = cursor.peek()
    // dcontent excludes `[`, `\`, `]`; ASCII printable + 0x21-0x7e
    const code = c.charCodeAt(0)
    if (c === '[' || c === '\\' || code < 0x21 || code > 0x7e) {
      throw parseError('invalid character in address literal', cursor)
    }
    cursor.consume(1)
  }
  if (cursor.peek() !== ']') {
    throw parseError('unterminated address literal', cursor)
  }
  const body = cursor.input.slice(bodyStart, cursor.pos)
  cursor.consume(1)
  if (!validateLiteralBody(body, cursor.opts)) {
    // Rewind position so the error points at the literal start
    const errCursor = new Cursor(cursor.input)
    errCursor.pos = start
    throw parseError('invalid address literal', errCursor)
  }
  return cursor.input.slice(start, cursor.pos)
}

function validateLiteralBody(body, opts) {
  if (IPV4_RE.test(body)) return true
  const colonIdx = body.indexOf(':')
  if (colonIdx < 1) return false
  const tag = body.slice(0, colonIdx)
  const content = body.slice(colonIdx + 1)
  if (!STANDARDIZED_TAG_RE.test(tag)) return false
  if (!content || !DCONTENT_RE.test(content)) return false
  // The "IPv6" tag is reserved by RFC-5321 for IPv6-addr — reject
  // malformed addresses unless the caller has opted into postel mode.
  if (!opts?.postel && tag.toLowerCase() === 'ipv6') {
    return validateIPv6(content)
  }
  return true
}

// RFC-5321 §4.1.3 IPv6-addr grammar:
//   IPv6-full   = 8 hex groups
//   IPv6-comp   = ≤6 hex groups with one "::"
//   IPv6v4-full = 6 hex groups + IPv4-address-literal
//   IPv6v4-comp = "::"-compressed hex groups + IPv4-address-literal
// The IPv4 tail is folded into 2 implicit hex groups, after which a
// single shared shape (`hex (":" hex){7}` with optional one "::")
// covers all alternatives.
function validateIPv6(s) {
  if (!s) return false

  // At most one "::" is permitted.
  const firstDC = s.indexOf('::')
  if (firstDC !== -1 && s.indexOf('::', firstDC + 2) !== -1) return false

  // Fold a trailing dotted-quad into "0:0" so the remainder is pure hex.
  let body = s
  const dotIdx = s.indexOf('.')
  if (dotIdx !== -1) {
    const sepIdx = s.lastIndexOf(':', dotIdx)
    if (sepIdx === -1) return false
    if (!IPV4_RE.test(s.slice(sepIdx + 1))) return false
    body = `${s.slice(0, sepIdx + 1)}0:0`
  }

  const dc = body.indexOf('::')
  if (dc !== -1) {
    const left = body.slice(0, dc)
    const right = body.slice(dc + 2)
    const leftGroups = left === '' ? [] : left.split(':')
    const rightGroups = right === '' ? [] : right.split(':')
    for (const g of leftGroups) if (!IPV6_HEX_RE.test(g)) return false
    for (const g of rightGroups) if (!IPV6_HEX_RE.test(g)) return false
    // "::" represents at least 2 zero groups; total explicit groups ≤ 6.
    return leftGroups.length + rightGroups.length <= 6
  }

  const groups = body.split(':')
  if (groups.length !== 8) return false
  for (const g of groups) if (!IPV6_HEX_RE.test(g)) return false
  return true
}

// Convert a U-label domain to its A-label (punycode) form via the
// platform's UTS-46 implementation. Returns the original string when
// there is no non-ASCII content, throws on invalid IDN input.
function toASCIIDomain(domain) {
  if (!NON_ASCII_RE.test(domain)) return domain
  const ascii = domainToASCII(domain)
  if (!ascii) throw new Error('invalid IDN domain')
  return ascii
}

module.exports = { parseAddressLiteral, validateLiteralBody, validateIPv6, toASCIIDomain }
module.exports.default = module.exports
