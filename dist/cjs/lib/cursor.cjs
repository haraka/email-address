'use strict'

// AUTO-GENERATED from the matching `.js` file by scripts/build-cjs.js
// — do not edit by hand. The pre-commit hook in .githooks/pre-commit
// regenerates these files whenever any `.js` source is staged;
// `npm run build:cjs` produces the same output on demand.

// Atom characters: `atext` per RFC-5321 + any non-ASCII codepoint
// (RFC-6531 EAI extends atext to include U-labels / UTF-8 local-parts).
const ATEXT_RE = /[0-9A-Za-z!#$%&'*+\-/=?^_`{|}~\u{80}-\u{10FFFF}]+/uy

// sub-domain = Let-dig [Ldh-str]; Ldh-str must end in Let-dig (no
// trailing dash). Non-ASCII codepoints are admitted for U-label
// support.
const SUB_DOMAIN_RE =
  /[0-9A-Za-z\u{80}-\u{10FFFF}](?:[-0-9A-Za-z\u{80}-\u{10FFFF}]*[0-9A-Za-z\u{80}-\u{10FFFF}])?/uy

// Header-mode sub-domain: same shape as the envelope production but
// also admits `_` inside labels — legacy / obsolete domain names (e.g.
// the NetNews-era `node_cb83`) that real-world mailers still emit.
const HEADER_SUB_DOMAIN_RE =
  /[0-9A-Za-z\u{80}-\u{10FFFF}](?:[-_0-9A-Za-z\u{80}-\u{10FFFF}]*[0-9A-Za-z_\u{80}-\u{10FFFF}])?/uy

// qtextSMTP = printable ASCII excluding `"` (0x22) and `\` (0x5c).
// Non-ASCII is admitted under RFC-6531.
const QTEXT_RE = /[\x20-\x21\x23-\x5b\x5d-\x7e\u{80}-\u{10FFFF}]+/uy

// quoted-pairSMTP = `\` followed by any printable ASCII (incl. SP).
const QUOTED_PAIR_RE = /\\[\x20-\x7e]/y

// Snum = 0-255 with no leading zeros.
const SNUM = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const IPV4_RE = new RegExp(`^${SNUM}\\.${SNUM}\\.${SNUM}\\.${SNUM}$`)

// Standardized-tag = Ldh-str.
const STANDARDIZED_TAG_RE = /^[A-Za-z0-9](?:[-A-Za-z0-9]*[A-Za-z0-9])?$/

// dcontent = printable ASCII excluding `[` (0x5b), `\` (0x5c),
// `]` (0x5d).
const DCONTENT_RE = /^[\x21-\x5a\x5e-\x7e]+$/

// IPv6 hex group = 1-4 hex digits.
const IPV6_HEX_RE = /^[0-9A-Fa-f]{1,4}$/

// Any codepoint outside the ASCII range; `u` flag ensures
// supplementary planes are matched at codepoint granularity.
const NON_ASCII_RE = /[\u{80}-\u{10FFFF}]/u

// Folding white space (RFC 5322 §3.2.2).
const FWS_RE = /[ \t\r\n]+/y

// Characters considered display-safe when formatting a phrase without
// adding quotes. Matches the rfc2822 module's historical formatter so
// the header corpus rounds-trips byte-for-byte. Includes ASCII atext
// plus SP, backtick, and the underscore-included `\w` shorthand.
const FORMAT_PHRASE_SAFE_RE = /^[-\w !#$%&'*+/=?^`{|}~]+$/

class Cursor {
  constructor(input, opts) {
    this.input = input
    this.pos = 0
    this.opts = opts
  }
  peek() {
    return this.input[this.pos]
  }
  done() {
    return this.pos >= this.input.length
  }
  consume(n = 1) {
    const c = this.input.slice(this.pos, this.pos + n)
    this.pos += n
    return c
  }
  expect(ch) {
    if (this.peek() !== ch) {
      throw parseError(`expected ${JSON.stringify(ch)}`, this)
    }
    this.pos += 1
  }
  match(re) {
    re.lastIndex = this.pos
    const m = re.exec(this.input)
    if (!m) return null
    this.pos = re.lastIndex
    return m[0]
  }
}

function parseError(msg, cursor) {
  return new Error(`Invalid RFC-5321 address at position ${cursor.pos}: ${msg}`)
}

module.exports = {
  ATEXT_RE,
  SUB_DOMAIN_RE,
  HEADER_SUB_DOMAIN_RE,
  QTEXT_RE,
  QUOTED_PAIR_RE,
  IPV4_RE,
  STANDARDIZED_TAG_RE,
  DCONTENT_RE,
  IPV6_HEX_RE,
  NON_ASCII_RE,
  FWS_RE,
  FORMAT_PHRASE_SAFE_RE,
  Cursor,
  parseError,
}
module.exports.default = module.exports
