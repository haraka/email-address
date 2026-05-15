// The `Address` class — the public value-object for both envelope and
// header parses — and the `Group` class for RFC-5322 group syntax.
//
// `Address.parse()` delegates to the envelope grammar; header-parsed
// instances are constructed by `./header.js` via the prototype-clone
// path. Header-only fields default to empty so envelope consumers see
// a consistent shape regardless of how the instance was built.

import { NON_ASCII_RE, FORMAT_PHRASE_SAFE_RE } from './cursor.js'

// Control characters (U+0000–U+001F and DEL U+007F) must not appear in any
// serialized address field — they are an SMTP / header-injection vector.
const hasCtrl = (s) => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c <= 0x1f || c === 0x7f) return true
  }
  return false
}

// Explicit allowlist for plain-object rehydration so that inherited
// enumerable properties (including __proto__) are never copied onto the
// instance.  Only fields this library writes are included.
const REHYDRATE_KEYS = [
  'user',
  'host',
  'original',
  'original_host',
  'is_utf8',
  'phrase',
  'comment',
  'group',
  '_kind',
]

// Subset of REHYDRATE_KEYS whose values flow into format() output and
// therefore must never contain control characters.
const CTRL_CHECK_KEYS = ['user', 'host', 'original_host', 'phrase', 'comment']
import { toASCIIDomain } from './literals.js'
import { parseEnvelopeAddress } from './envelope.js'

import { extractName } from './name-utils.js'
// SUNSET 2027: shared key for unwrapping an asLegacy proxy before
// re-hydration. Single source of truth in lib/legacy.js.
import { RAW } from './legacy.js'

class Group {
  constructor(phrase, addresses) {
    this.phrase = phrase || ''
    this.addresses = addresses || []
  }

  format() {
    const head = this.phrase
    const body = this.addresses.map((a) => a.format()).join(',')
    return `${head}:${body}`
  }

  name() {
    return extractName(this.phrase, '')
  }
}

class Address {
  constructor(user, hostOrOptions, options) {
    // header-parsed addresses have phrase/comment/group set, envelope
    // ones don't — these defaults keep both shapes safe to read.
    this.phrase = ''
    this.comment = ''
    this.group = null

    const source = (user && user[RAW]) || user
    if (typeof source === 'object' && source !== null && source.original) {
      // Construct from a JSON-rehydrated object — copy only known own fields.
      for (const k of REHYDRATE_KEYS) {
        if (Object.hasOwn(source, k)) this[k] = source[k]
      }
      for (const k of CTRL_CHECK_KEYS) {
        if (typeof this[k] === 'string' && hasCtrl(this[k])) {
          throw new Error(`Address field "${k}" must not contain control characters`)
        }
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
      if (hasCtrl(user) || hasCtrl(host)) {
        throw new Error('Address parts must not contain control characters')
      }
      this.original = `${user}@${host}`
      this.user = user
      this.original_host = host

      if (NON_ASCII_RE.test(host) || NON_ASCII_RE.test(user)) {
        this.is_utf8 = true
      }
      this.host = toASCIIDomain(host).toLowerCase()
    }
  }

  // `.address` is the bare `user@host` form preferred by RFC-5322
  // header consumers. Returns the case-preserved host so a round-trip
  // through `parseHeader` yields the same string.
  get address() {
    if (!this.user) return ''
    if (!this.original_host && !this.host) return this.user
    return `${this.user}@${this.original_host || this.host}`
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

    const result = parseEnvelopeAddress(addr, this.opts)

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

    const host = use_punycode ? this.host : this.original_host || this.host
    const email = host ? `${this.user}@${host}` : this.user || ''

    if (this._kind !== 'header') {
      // Envelope canonical form: <user@host>
      return `<${email}>`
    }

    // Header-style rendering: `phrase <email> (comment)`.
    const parts = []
    if (this.phrase) {
      parts.push(formatPhrase(this.phrase))
      if (email) parts.push(`<${email}>`)
    } else if (email) {
      parts.push(email)
    }
    if (this.comment) parts.push(formatComment(this.comment))
    return parts.join(' ')
  }

  name() {
    return extractName(this.phrase || this.comment, this.address)
  }

  toString() {
    return this.format()
  }
}

function formatPhrase(phrase) {
  const trimmed = phrase.trim()
  if (FORMAT_PHRASE_SAFE_RE.test(trimmed)) return phrase
  if (phrase.startsWith('"') && phrase.endsWith('"')) return phrase
  return `"${phrase}"`
}

function formatComment(comment) {
  if (!/\S/.test(comment)) return ''
  // The stored comment body never has outer parens (parseHeaderComment
  // consumes them), so wrap unconditionally.
  return `(${comment.trim()})`
}

export { Address, Group, hasCtrl }
