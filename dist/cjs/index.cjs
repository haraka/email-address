'use strict'

// AUTO-GENERATED from the matching `.js` file by scripts/build-cjs.js
// — do not edit by hand. The pre-commit hook in .githooks/pre-commit
// regenerates these files whenever any `.js` source is staged;
// `npm run build:cjs` produces the same output on demand.

const { Address, Group } = require('./lib/address.cjs')
const { parseHeaderString } = require('./lib/header.cjs')
const { parseAddress, isValid } = require('./lib/validator.cjs')
const { extractName, isAllLower, isAllUpper, nameCase } = require('./lib/name-utils.cjs')
// SUNSET 2027: opt-in legacy-contract wrapper — see lib/legacy.js.
const { asLegacy, unwrapLegacy } = require('./lib/legacy.cjs')
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

module.exports = {
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
module.exports.default = module.exports
