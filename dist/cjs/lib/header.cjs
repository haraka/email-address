'use strict'

// AUTO-GENERATED from the matching `.js` file by scripts/build-cjs.js
// — do not edit by hand. The pre-commit hook in .githooks/pre-commit
// regenerates these files whenever any `.js` source is staged;
// `npm run build:cjs` produces the same output on demand.

const {
  Cursor,
  parseError,
  ATEXT_RE,
  QTEXT_RE,
  HEADER_SUB_DOMAIN_RE,
  NON_ASCII_RE,
  FWS_RE,
} = require('./cursor.cjs')
const { parseAddressLiteral, toASCIIDomain } = require('./literals.cjs')
const { Address, Group } = require('./address.cjs')
// Skip *(CFWS): folding white space and comments. If a `sink` array is
// provided, captured comment bodies (without outer parens) are pushed
// into it so callers can later attach them to a mailbox-level Address.
function skipCFWS(cursor, sink) {
  while (!cursor.done()) {
    if (cursor.match(FWS_RE)) continue
    if (cursor.peek() === '(') {
      const c = parseHeaderComment(cursor)
      if (sink && c) sink.push(c)
      continue
    }
    break
  }
}

function joinComments(arr) {
  return arr.filter(Boolean).join(' ').trim()
}

// Parse a single comment, including nested comments. Returns the comment
// body (everything between the outermost `(` and `)`), with nested
// parens preserved.
function parseHeaderComment(cursor) {
  cursor.expect('(')
  const start = cursor.pos
  let depth = 1
  while (!cursor.done()) {
    const c = cursor.peek()
    if (c === '\\') {
      cursor.consume(2)
      continue
    }
    if (c === '(') {
      depth += 1
      cursor.consume(1)
      continue
    }
    if (c === ')') {
      depth -= 1
      if (depth === 0) {
        const body = cursor.input.slice(start, cursor.pos)
        cursor.consume(1)
        return body.trim()
      }
      cursor.consume(1)
      continue
    }
    cursor.consume(1)
  }
  throw parseError('unterminated comment', cursor)
}

// Word := atom / quoted-string.  Returns { text, raw } where `text` is
// the unquoted content (for storage) and `raw` is the original token
// (used in some obs- contexts).
function parseHeaderWord(cursor, opts, sink) {
  skipCFWS(cursor, sink)
  if (cursor.peek() === '"') return parseHeaderQuotedString(cursor)
  return parseHeaderAtom(cursor, opts)
}

function parseHeaderAtom(cursor, opts) {
  // Per §3.2.3 the atom character class is ATEXT_RE; with caller opts we
  // additionally admit '@' or ',' inside display-name atoms for the
  // obs-phrase production used by real-world mailers.
  const start = cursor.pos
  let advanced = false
  while (!cursor.done()) {
    if (cursor.match(ATEXT_RE)) {
      advanced = true
      continue
    }
    const ch = cursor.peek()
    if (opts?.allowAtInDisplayName && ch === '@') {
      cursor.consume(1)
      advanced = true
      continue
    }
    if (opts?.allowCommaInDisplayName && ch === ',') {
      cursor.consume(1)
      advanced = true
      continue
    }
    break
  }
  if (!advanced) throw parseError('expected atom', cursor)
  return { text: cursor.input.slice(start, cursor.pos), raw: cursor.input.slice(start, cursor.pos) }
}

function parseHeaderQuotedString(cursor) {
  const rawStart = cursor.pos
  cursor.expect('"')
  let text = ''
  while (true) {
    if (cursor.done()) throw parseError('unterminated quoted-string', cursor)
    const ch = cursor.peek()
    if (ch === '"') {
      cursor.consume(1)
      return { text, raw: cursor.input.slice(rawStart, cursor.pos) }
    }
    if (ch === '\\') {
      cursor.consume(1)
      if (cursor.done()) throw parseError('quoted-pair at end of input', cursor)
      text += cursor.peek()
      cursor.consume(1)
      continue
    }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      // FWS inside quoted-string folds to a single space.
      if (cursor.match(FWS_RE)) {
        if (text.length && !text.endsWith(' ')) text += ' '
        continue
      }
    }
    const matched = cursor.match(QTEXT_RE)
    if (!matched) throw parseError('invalid character in quoted-string', cursor)
    text += matched
  }
}

// Phrase := 1*(word / "." / CFWS) — the obs-phrase production accepts
// stray dots and CFWS between words. We collapse internal whitespace to
// single spaces, drop the dots from storage (matching rfc2822 / Perl
// Mail::Address semantics).
function parseHeaderPhrase(cursor, opts, sink) {
  skipCFWS(cursor, sink)
  const wordsAndDots = []
  let lastWasWord = false
  while (!cursor.done()) {
    skipCFWS(cursor, sink)
    const ch = cursor.peek()
    if (ch === '"' || isAtextStart(ch, opts)) {
      const w = parseHeaderWord(cursor, opts, sink)
      wordsAndDots.push(w.text)
      lastWasWord = true
      continue
    }
    if (ch === '.' && lastWasWord) {
      cursor.consume(1)
      wordsAndDots.push('.')
      lastWasWord = false
      continue
    }
    break
  }
  if (wordsAndDots.length === 0) throw parseError('expected phrase', cursor)
  // Join with single space, but allow "." to abut the surrounding word.
  let out = ''
  for (let i = 0; i < wordsAndDots.length; i += 1) {
    const t = wordsAndDots[i]
    if (t === '.') {
      out = out.replace(/ $/, '') + '.'
    } else if (out.length && !out.endsWith('.')) {
      out += ' ' + t
    } else {
      out += t
    }
  }
  return out
}

function isAtextStart(ch, opts) {
  if (!ch) return false
  if (/[0-9A-Za-z!#$%&'*+\-/=?^_`{|}~]/.test(ch)) return true
  if (NON_ASCII_RE.test(ch)) return true
  if (opts?.allowAtInDisplayName && ch === '@') return true
  if (opts?.allowCommaInDisplayName && ch === ',') return true
  return false
}

// local-part := dot-atom / quoted-string (with obs- support for CFWS
// between atoms and inside).
function parseHeaderLocalPart(cursor, sink) {
  skipCFWS(cursor, sink)
  if (cursor.peek() === '"') {
    const q = parseHeaderQuotedString(cursor)
    return { value: q.raw, isQuoted: true }
  }
  let local = ''
  while (true) {
    const atom = cursor.match(ATEXT_RE)
    if (!atom) {
      if (local.length === 0) throw parseError('expected local-part atom', cursor)
      break
    }
    local += atom
    const beforeCFWS = cursor.pos
    // Speculative — we don't know whether the next non-space is a dot
    // (committing to the local-part) or something else (committing this
    // CFWS to the caller). Use a scratch sink so the outer call sees
    // the comment exactly once.
    const scratch = []
    skipCFWS(cursor, scratch)
    if (cursor.peek() === '.') {
      // Commit the captured comments — they belong to the local-part.
      if (sink) for (const c of scratch) sink.push(c)
      cursor.consume(1)
      local += '.'
      skipCFWS(cursor, sink)
      continue
    }
    cursor.pos = beforeCFWS
    break
  }
  return { value: local, isQuoted: false }
}

// domain := dot-atom / domain-literal (with obs- support for CFWS
// between sub-domains).
function parseHeaderDomain(cursor, sink) {
  skipCFWS(cursor, sink)
  if (cursor.peek() === '[') {
    return parseAddressLiteral(cursor)
  }
  let domain = ''
  while (true) {
    const labelStart = cursor.pos
    if (!cursor.match(HEADER_SUB_DOMAIN_RE)) {
      if (domain.length === 0) throw parseError('expected domain label', cursor)
      break
    }
    if (Buffer.byteLength(cursor.input.slice(labelStart, cursor.pos), 'utf8') > 63) {
      throw parseError('sub-domain label exceeds 63 octets', cursor)
    }
    domain += cursor.input.slice(labelStart, cursor.pos)
    const beforeCFWS = cursor.pos
    // Speculative scratch sink, same reasoning as parseHeaderLocalPart.
    const scratch = []
    skipCFWS(cursor, scratch)
    if (cursor.peek() === '.') {
      if (sink) for (const c of scratch) sink.push(c)
      cursor.consume(1)
      domain += '.'
      skipCFWS(cursor, sink)
      continue
    }
    cursor.pos = beforeCFWS
    break
  }
  return domain
}

function parseHeaderAddrSpec(cursor, sink) {
  const local = parseHeaderLocalPart(cursor, sink)
  skipCFWS(cursor, sink)
  cursor.expect('@')
  skipCFWS(cursor, sink)
  const domain = parseHeaderDomain(cursor, sink)
  return { user: local.value, original_host: domain }
}

function parseHeaderAngleAddr(cursor, sink) {
  skipCFWS(cursor, sink)
  cursor.expect('<')
  // Source-route style "@a,@b:user@host" — accept and discard the route.
  skipCFWS(cursor, sink)
  if (cursor.peek() === '@') {
    while (cursor.peek() === '@') {
      cursor.consume(1)
      parseHeaderDomain(cursor, sink)
      skipCFWS(cursor, sink)
      if (cursor.peek() === ',') {
        cursor.consume(1)
        skipCFWS(cursor, sink)
      } else break
    }
    skipCFWS(cursor, sink)
    cursor.expect(':')
    skipCFWS(cursor, sink)
  }
  const spec = parseHeaderAddrSpec(cursor, sink)
  skipCFWS(cursor, sink)
  cursor.expect('>')
  return spec
}

// Mailbox := name-addr / addr-spec. We disambiguate by scanning the
// rest of the input for an unguarded `<` before a top-level `,` `;` or
// end — that pattern is the name-addr signature. CFWS comments seen
// anywhere along the way are collected into a single `.comment` string.
function parseHeaderMailbox(cursor, opts) {
  const sink = []
  skipCFWS(cursor, sink)
  if (hasAngleBracketComing(cursor, opts)) {
    const start = cursor.pos
    let phrase = ''
    if (cursor.peek() !== '<') {
      phrase = parseHeaderPhrase(cursor, opts, sink)
    }
    skipCFWS(cursor, sink)
    if (cursor.peek() !== '<') {
      // false alarm — rewind and treat as addr-spec
      cursor.pos = start
      sink.length = 0
      const spec = parseHeaderAddrSpec(cursor, sink)
      skipCFWS(cursor, sink)
      return finishMailbox(cursor, spec, '', joinComments(sink))
    }
    const angle = parseHeaderAngleAddr(cursor, sink)
    skipCFWS(cursor, sink)
    return finishMailbox(cursor, angle, phrase, joinComments(sink))
  }
  const spec = parseHeaderAddrSpec(cursor, sink)
  skipCFWS(cursor, sink)
  return finishMailbox(cursor, spec, '', joinComments(sink))
}

// Look ahead for an angle-addr without consuming. Skips over quoted
// strings and comments so a "<" inside them doesn't fool us. When
// `allowCommaInDisplayName` is set, top-level `,` does not terminate
// the scan (it could be part of the display name).
function hasAngleBracketComing(cursor, opts) {
  let i = cursor.pos
  const s = cursor.input
  let depth = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '(') {
      depth += 1
      i += 1
      continue
    }
    if (ch === ')') {
      depth -= 1
      i += 1
      continue
    }
    if (depth > 0) {
      if (ch === '\\') {
        i += 2
        continue
      }
      i += 1
      continue
    }
    if (ch === '"') {
      i += 1
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\') i += 1
        i += 1
      }
      i += 1
      continue
    }
    if (ch === '<') return true
    if (ch === ';' || ch === ':') return false
    if (ch === ',' && !opts?.allowCommaInDisplayName) return false
    i += 1
  }
  return false
}

function finishMailbox(_cursor, spec, phrase, comment) {
  // spec.original_host is the domain as written
  const original_host = spec.original_host
  let host = original_host
  let is_utf8 = false
  if (NON_ASCII_RE.test(spec.user) || NON_ASCII_RE.test(original_host)) {
    is_utf8 = true
  }
  if (NON_ASCII_RE.test(original_host)) {
    host = toASCIIDomain(original_host)
  }
  host = host.toLowerCase()
  return _newHeaderAddress({
    user: spec.user,
    host,
    original_host,
    phrase: phrase || '',
    comment: comment || '',
    is_utf8,
  })
}

function _newHeaderAddress({ user, host, original_host, phrase, comment, is_utf8 }) {
  const a = Object.create(Address.prototype)
  a.user = user
  a.host = host
  a.original_host = original_host
  a.original = `${user}@${original_host}`
  a.phrase = phrase
  a.comment = comment
  a.group = null
  if (is_utf8) a.is_utf8 = true
  Object.defineProperty(a, '_kind', { value: 'header', enumerable: false, writable: false })
  return a
}

// Address := mailbox / group. group := display-name ":" [mailbox-list / CFWS] ";" [CFWS]
// NB: leading CFWS is intentionally NOT eaten here. parseHeaderMailbox /
// parseHeaderGroup own their leading CFWS so they can attach any
// comments to the resulting Address rather than silently discard them.
function parseHeaderAddress(cursor, opts) {
  if (hasGroupColonComing(cursor)) {
    return parseHeaderGroup(cursor, opts)
  }
  return parseHeaderMailbox(cursor, opts)
}

// Detect "phrase ':'" at the top level (no `<` in the way). Used to
// decide between mailbox and group productions.
function hasGroupColonComing(cursor) {
  let i = cursor.pos
  const s = cursor.input
  let depth = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '(') {
      depth += 1
      i += 1
      continue
    }
    if (ch === ')') {
      depth -= 1
      i += 1
      continue
    }
    if (depth > 0) {
      if (ch === '\\') {
        i += 2
        continue
      }
      i += 1
      continue
    }
    if (ch === '"') {
      i += 1
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\') i += 1
        i += 1
      }
      i += 1
      continue
    }
    if (ch === ':') return true
    if (ch === '<' || ch === '@' || ch === ',' || ch === ';') return false
    i += 1
  }
  return false
}

function parseHeaderGroup(cursor, opts) {
  const phrase = parseHeaderPhrase(cursor, opts, null)
  skipCFWS(cursor, null)
  cursor.expect(':')
  skipCFWS(cursor, null)
  const members = []
  if (cursor.peek() !== ';') {
    members.push(parseHeaderMailbox(cursor, opts))
    while (true) {
      skipCFWS(cursor, null)
      if (cursor.peek() === ',') {
        cursor.consume(1)
        skipCFWS(cursor, null)
        if (cursor.peek() === ';' || cursor.done()) break // obs-mbox-list allows null entries
        members.push(parseHeaderMailbox(cursor, opts))
        continue
      }
      break
    }
  }
  skipCFWS(cursor, null)
  cursor.expect(';')
  skipCFWS(cursor, null)
  const group = new Group(phrase, members)
  for (const m of members) m.group = group
  return group
}

function parseHeaderAddressList(cursor, opts) {
  const items = []
  if (cursor.done()) return items
  items.push(parseHeaderAddress(cursor, opts))
  while (true) {
    // Between-address whitespace + comments are discarded — comments
    // here aren't attached to either neighbour.
    skipCFWS(cursor, null)
    if (cursor.peek() === ',') {
      cursor.consume(1)
      // Leading CFWS for the next address is owned by that address's
      // parseHeaderMailbox/Group, so don't eat it here.
      if (cursor.done()) break
      items.push(parseHeaderAddress(cursor, opts))
      continue
    }
    break
  }
  return items
}

// Entry point used by `parseHeader`.
function parseHeaderString(input, opts) {
  if (input == null) throw new Error('Nothing to parse')
  const trimmed = String(input).trim()
  if (!trimmed) throw new Error('Nothing to parse')
  const cursor = new Cursor(trimmed, opts)
  const startAt = opts?.startAt || 'address-list'
  let result
  switch (startAt) {
    case 'address':
      result = [parseHeaderAddress(cursor, opts)]
      break
    case 'mailbox':
    case 'sender':
      result = [parseHeaderMailbox(cursor, opts)]
      break
    case 'mailbox-list':
    case 'from':
    case 'reply-to':
    case 'address-list':
      result = parseHeaderAddressList(cursor, opts)
      break
    case 'group':
      result = [parseHeaderGroup(cursor, opts)]
      break
    case 'angle-addr':
      result = [finishMailbox(cursor, parseHeaderAngleAddr(cursor, null), '', '')]
      break
    default:
      throw new Error(`Unknown startAt: ${startAt}`)
  }
  skipCFWS(cursor, null)
  if (!cursor.done()) {
    throw parseError(`trailing input after ${startAt}`, cursor)
  }
  if (!result.length) throw new Error('No results')
  return result
}

module.exports = { parseHeaderString }
module.exports.default = module.exports
