// ESM entry point — canonical source for this module. The CJS mirror at
// `./index.cjs` is auto-generated from this file (and every file under
// `lib/`) by scripts/build-cjs.js and refreshed by the pre-commit hook
// in .githooks/pre-commit, so do not edit index.cjs by hand.
//
// This file is intentionally thin: it re-exports the building blocks
// from `./lib/` and wraps the parser entry points with their
// public-API defaults. All actual parsing logic lives in:
//
//   ./lib/cursor.js     shared regex constants + Cursor + parseError
//   ./lib/literals.js   address-literal parsing (IPv4 / IPv6 / IDN)
//   ./lib/envelope.js   RFC-5321 envelope grammar
//   ./lib/header.js     RFC-5322 header grammar
//   ./lib/address.js    Address + Group classes (+ format helpers)
//   ./lib/validator.js  plain-address validator for web forms
//   ./lib/name-utils.js personal-name helpers (nameCase, extractName, …)

import { Address, Group } from './lib/address.js'
import { parseHeaderString } from './lib/header.js'
import { parseAddress, isValid } from './lib/validator.js'
import { extractName, isAllLower, isAllUpper, nameCase } from './lib/name-utils.js'
// SUNSET 2027: opt-in legacy-contract wrapper — see lib/legacy.js.
import { asLegacy, unwrapLegacy } from './lib/legacy.js'

// RFC-5321 single envelope address.
function parseEnvelope(input, opts) {
  return new Address(input, opts)
}

// RFC-5322 header-value: a single Address, a list, or a group (mixed
// `Address` and `Group` instances in document order).
function parseHeader(input, opts) {
  const defaults = { allowAtInDisplayName: true, allowCommaInDisplayName: false }
  const resolved = typeof opts === 'string' ? { startAt: opts } : opts || {}
  return parseHeaderString(input, { ...defaults, ...resolved })
}

function parseFrom(input) {
  return parseHeader(input, { startAt: 'from' })
}

function parseSender(input) {
  return parseHeader(input, { startAt: 'sender' })[0]
}

function parseReplyTo(input) {
  return parseHeader(input, { startAt: 'reply-to' })
}

// SUNSET 2027: `parse` is the address-rfc2822 spelling of `parseHeader`.
// Kept so not-yet-migrated callers (`addrparser.parse(headerValue)`)
// keep working. Remove in 2027 once consumers use `parseHeader`.
const parse = parseHeader

export {
  Address,
  Group,
  parseEnvelope,
  parseHeader,
  parse,
  parseFrom,
  parseSender,
  parseReplyTo,
  parseAddress,
  isValid,
  extractName,
  isAllLower,
  isAllUpper,
  nameCase,
  asLegacy,
  unwrapLegacy,
}
export default {
  Address,
  Group,
  parseEnvelope,
  parseHeader,
  parse,
  parseFrom,
  parseSender,
  parseReplyTo,
  parseAddress,
  isValid,
  extractName,
  isAllLower,
  isAllUpper,
  nameCase,
  asLegacy,
  unwrapLegacy,
}
