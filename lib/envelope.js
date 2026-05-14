// RFC-5321 envelope-address grammar.
//
// Recursive-descent parser for the path / mailbox / addr-spec
// productions of §4.1.2 plus the address-literal alternatives of
// §4.1.3 (delegated to ./literals.js).

import { Cursor, parseError, ATEXT_RE, QTEXT_RE, QUOTED_PAIR_RE, SUB_DOMAIN_RE } from './cursor.js'
import { parseAddressLiteral } from './literals.js'

function parseEnvelopeAddress(addr, opts) {
  const cursor = new Cursor(addr, opts)
  const result = cursor.peek() === '<' ? parsePath(cursor) : parseEnvelopeMailbox(cursor)
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
  const mailbox = parseEnvelopeMailbox(cursor)
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

function parseEnvelopeMailbox(cursor) {
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

export { parseEnvelopeAddress }
