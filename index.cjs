'use strict'

// AUTO-GENERATED from `./index.js` by scripts/build-cjs.js — do not edit
// this file by hand. The pre-commit hook in .githooks/pre-commit
// regenerates it whenever index.js is staged; `npm run build:cjs`
// produces the same output on demand.

const { domainToASCII } = require('node:url')

// ---------------------------------------------------------------------------
// Recursive-descent parser for RFC-5321 envelope addresses.
//
// All regexes use the sticky (`y`) flag so the cursor can advance in O(1)
// without slicing the input string. They are anchored to the cursor position
// via `lastIndex`. None use backreferences or nested quantifiers — bounded
// matching only — so they are not vulnerable to ReDoS.
//
// Character classes use the `u` flag so non-ASCII matches at codepoint
// granularity (a single supplementary-plane character advances `lastIndex`
// by two UTF-16 code units in one step) and `\u{80}-\u{10FFFF}` reliably
// picks up any non-ASCII codepoint across every plane.
// ---------------------------------------------------------------------------

// Atom characters: `atext` per RFC-5321 + any non-ASCII codepoint
// (RFC-6531 EAI extends atext to include U-labels / UTF-8 local-parts).
const ATEXT_RE = /[0-9A-Za-z!#$%&'*+\-/=?^_`{|}~\u{80}-\u{10FFFF}]+/uy

// sub-domain = Let-dig [Ldh-str]; Ldh-str must end in Let-dig (no trailing
// dash). Non-ASCII codepoints are admitted for U-label support.
const SUB_DOMAIN_RE =
  /[0-9A-Za-z\u{80}-\u{10FFFF}](?:[-0-9A-Za-z\u{80}-\u{10FFFF}]*[0-9A-Za-z\u{80}-\u{10FFFF}])?/uy

// qtextSMTP = printable ASCII excluding `"` (0x22) and `\` (0x5c). Non-ASCII
// is admitted under RFC-6531.
const QTEXT_RE = /[\x20-\x21\x23-\x5b\x5d-\x7e\u{80}-\u{10FFFF}]+/uy

// quoted-pairSMTP = `\` followed by any printable ASCII (incl. SP).
const QUOTED_PAIR_RE = /\\[\x20-\x7e]/y

// Snum = 0-255 with no leading zeros.
const SNUM = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const IPV4_RE = new RegExp(`^${SNUM}\\.${SNUM}\\.${SNUM}\\.${SNUM}$`)

// Standardized-tag = Ldh-str.
const STANDARDIZED_TAG_RE = /^[A-Za-z0-9](?:[-A-Za-z0-9]*[A-Za-z0-9])?$/

// dcontent = printable ASCII excluding `[` (0x5b), `\` (0x5c), `]` (0x5d).
const DCONTENT_RE = /^[\x21-\x5a\x5e-\x7e]+$/

// IPv6 hex group = 1-4 hex digits.
const IPV6_HEX_RE = /^[0-9A-Fa-f]{1,4}$/

// Any codepoint outside the ASCII range; `u` flag ensures supplementary
// planes are matched at codepoint granularity.
const NON_ASCII_RE = /[\u{80}-\u{10FFFF}]/u

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

function parseAddress(addr, opts) {
  const cursor = new Cursor(addr, opts)
  const result = cursor.peek() === '<' ? parsePath(cursor) : parseMailbox(cursor)
  if (!cursor.done()) {
    throw parseError('trailing input after address', cursor)
  }
  return result
}

function parsePath(cursor) {
  cursor.expect('<')
  if (cursor.peek() === '@') {
    parseADL(cursor)
    if (cursor.peek() !== ':') {
      throw parseError('expected ":" after source route', cursor)
    }
    cursor.consume(1)
  }
  const mailbox = parseMailbox(cursor)
  cursor.expect('>')
  return mailbox
}

function parseADL(cursor) {
  parseAtDomain(cursor)
  while (cursor.peek() === ',') {
    cursor.consume(1)
    parseAtDomain(cursor)
  }
}

function parseAtDomain(cursor) {
  cursor.expect('@')
  parseDomain(cursor)
}

function parseMailbox(cursor) {
  const local_part = parseLocalPart(cursor)
  cursor.expect('@')
  const domain = parseNonLocalPart(cursor)
  return { local_part, domain }
}

function parseLocalPart(cursor) {
  return cursor.peek() === '"' ? parseQuotedString(cursor) : parseDotString(cursor)
}

function parseDotString(cursor) {
  const start = cursor.pos
  if (!cursor.match(ATEXT_RE)) {
    throw parseError('expected atom in local-part', cursor)
  }
  while (cursor.peek() === '.') {
    cursor.consume(1)
    if (!cursor.match(ATEXT_RE)) {
      throw parseError('expected atom after "."', cursor)
    }
  }
  return cursor.input.slice(start, cursor.pos)
}

function parseQuotedString(cursor) {
  const start = cursor.pos
  cursor.expect('"')
  while (true) {
    if (cursor.done()) {
      throw parseError('unterminated quoted-string', cursor)
    }
    const c = cursor.peek()
    if (c === '"') {
      cursor.consume(1)
      return cursor.input.slice(start, cursor.pos)
    }
    if (c === '\\') {
      if (!cursor.match(QUOTED_PAIR_RE)) {
        throw parseError('invalid quoted-pair', cursor)
      }
      continue
    }
    if (!cursor.match(QTEXT_RE)) {
      throw parseError('invalid character in quoted-string', cursor)
    }
  }
}

function parseNonLocalPart(cursor) {
  return cursor.peek() === '[' ? parseAddressLiteral(cursor) : parseDomain(cursor)
}

function parseDomain(cursor) {
  const start = cursor.pos
  parseLabel(cursor)
  while (cursor.peek() === '.') {
    cursor.consume(1)
    parseLabel(cursor)
  }
  return cursor.input.slice(start, cursor.pos)
}

function parseLabel(cursor) {
  const labelStart = cursor.pos
  if (!cursor.match(SUB_DOMAIN_RE)) {
    throw parseError('expected sub-domain', cursor)
  }
  // RFC-1035 §2.3.4 / RFC-5321 §4.5.3.1.1: labels are at most 63 octets.
  if (Buffer.byteLength(cursor.input.slice(labelStart, cursor.pos), 'utf8') > 63) {
    throw parseError('sub-domain label exceeds 63 octets', cursor)
  }
}

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

// Validate the body inside `[...]`. Three RFC-5321 §4.1.3 alternatives:
//   IPv4-address-literal     — bare 1.2.3.4 form, octets validated
//   IPv6-address-literal     — "IPv6:" prefix + IPv6-addr; in strict mode
//                              (default) the IPv6 portion is validated
//                              against the IPv6-full / IPv6-comp /
//                              IPv6v4-full / IPv6v4-comp productions.
//                              With `postel: true`, the General-fallback
//                              path is taken (any dcontent accepted).
//   General-address-literal  — Standardized-tag ":" dcontent+
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
// The IPv4 tail is folded into 2 implicit hex groups, after which a single
// shared shape (`hex (":" hex){7}` with optional one "::") covers all
// alternatives.
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
// platform's UTS-46 implementation. Returns the original string when there
// is no non-ASCII content, throws on invalid IDN input.
function toASCIIDomain(domain) {
  if (!NON_ASCII_RE.test(domain)) return domain
  const ascii = domainToASCII(domain)
  if (!ascii) throw new Error('invalid IDN domain')
  return ascii
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

class Address {
  constructor(user, hostOrOptions, options) {
    if (typeof user === 'object' && user !== null && user.original) {
      // Construct from a JSON-rehydrated object
      for (const k in user) {
        this[k] = user[k]
      }
      return this
    }

    let host
    let opts
    if (typeof hostOrOptions === 'string') {
      host = hostOrOptions
      opts = options || {}
    } else {
      opts = hostOrOptions || {}
    }
    this.opts = opts

    if (!host) {
      this.original = user
      this.parse(user)
    } else {
      this.original = `${user}@${host}`
      this.user = user
      this.original_host = host

      if (NON_ASCII_RE.test(host) || NON_ASCII_RE.test(user)) {
        this.is_utf8 = true
      }
      this.host = toASCIIDomain(host).toLowerCase()
    }
  }

  parse(addr) {
    // empty addr is the null reverse-path
    if (addr === '' || addr === '<>') {
      this.user = ''
      this.host = ''
      return
    }

    // RFC-5321 §4.5.3.1.3: a reverse-path or forward-path is at most
    // 256 octets including punctuation. Enforced before any further
    // work so an oversized input is rejected before allocation-heavy
    // operations like toLowerCase(). Under `postel: true`, the cap is
    // relaxed to the SMTP text-line maximum (§4.5.3.1.6) so paths that
    // exceed the strict 256-octet limit but still fit on the wire are
    // accepted.
    const maxPath = this.opts?.postel ? 998 : 256
    const addrBytes = Buffer.byteLength(addr, 'utf8')
    if (addrBytes > maxPath) {
      throw new Error(`RFC-5321 path exceeds ${maxPath} octets (${addrBytes} given)`)
    }

    // bare postmaster is permissible: RFC-5321 (4.1.1.3)
    switch (addr.toLowerCase()) {
      case 'postmaster':
      case '<postmaster>':
        this.user = 'postmaster'
        this.host = ''
        return
    }

    const result = parseAddress(addr, this.opts)

    let domainpart = result.domain
    this.original_host = domainpart

    // RFC-5321 §4.5.3.1.1: 64 octet local-part
    if (Buffer.byteLength(result.local_part, 'utf8') > 64) {
      throw new Error('RFC-5321 local-part exceeds 64 octets')
    }
    // RFC-5321 §4.5.3.1.2: 255 octet domain (defense-in-depth; the
    // 256-octet path cap above makes this branch unreachable today).
    if (Buffer.byteLength(domainpart, 'utf8') > 255) {
      throw new Error('RFC-5321 domain exceeds 255 octets')
    }

    if (NON_ASCII_RE.test(result.local_part) || NON_ASCII_RE.test(domainpart)) {
      this.is_utf8 = true
    }
    if (NON_ASCII_RE.test(domainpart)) {
      domainpart = toASCIIDomain(domainpart)
    }

    this.host = domainpart.toLowerCase()
    this.user = result.local_part
  }

  isNull() {
    return !this.user
  }

  format(use_punycode) {
    if (this.isNull()) return '<>'

    return `<${this.address(null, use_punycode)}>`
  }

  address(set, use_punycode) {
    if (set) {
      this.original = set
      this.parse(set)
    }
    return (
      (this.user || '') +
      (this.original_host ? `@${use_punycode ? this.host : this.original_host}` : '')
    )
  }

  toString() {
    return this.format()
  }
}

module.exports = { Address }
module.exports.default = module.exports
