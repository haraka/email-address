'use strict'

// AUTO-GENERATED from the matching `.js` file by scripts/build-cjs.js
// — do not edit by hand. The pre-commit hook in .githooks/pre-commit
// regenerates these files whenever any `.js` source is staged;
// `npm run build:cjs` produces the same output on demand.

const { Address } = require('./address.cjs')
/**
 * Parse a bare `local@domain` form and return the corresponding
 * Address instance. Throws on any input that isn't a single, plain
 * email address.
 *
 * @param {string} input
 * @param {object} [opts]
 * @param {boolean} [opts.requireTLD=false]  require the domain to have at least one dot.
 * @param {boolean} [opts.postel=false]      relax the envelope size limits.
 * @returns {Address}
 */
function parseAddress(input, opts) {
  if (typeof input !== 'string') {
    throw new TypeError('email must be a string')
  }
  const s = input.trim()
  if (!s) throw new Error('empty email address')

  // Envelope-only syntax is not a "plain" email.
  if (s.startsWith('<') || s.endsWith('>')) {
    throw new Error('plain email address must not be wrapped in angle brackets')
  }
  // The bare `postmaster` shortcut (RFC 5321 §4.1.1.3) is envelope-only.
  const lower = s.toLowerCase()
  if (lower === 'postmaster') {
    throw new Error('plain email address requires a domain')
  }
  // Comments / display names / lists / groups belong to header parsing.
  // The envelope grammar would reject these too, but we surface a
  // clearer error here.
  if (s.includes('(') || s.includes(')')) {
    throw new Error('plain email address must not contain comments')
  }
  if (s.includes(',') || s.includes(';')) {
    throw new Error('plain email address must be a single address')
  }

  // Delegate the actual grammar work — `new Address(s)` parses a bare
  // local@domain via parseEnvelopeAddress.
  const a = new Address(s, opts)
  if (!a.user || !a.host) {
    throw new Error('plain email address requires a local-part and a domain')
  }
  if (opts?.requireTLD && !a.original_host.includes('.')) {
    throw new Error('domain must include a TLD (e.g. user@example.com)')
  }
  return a
}

/**
 * Boolean wrapper around `parseAddress` — never throws.
 *
 * @param {string} input
 * @param {object} [opts]   same options as `parseAddress`
 * @returns {boolean}
 */
function isValid(input, opts) {
  try {
    parseAddress(input, opts)
    return true
  } catch {
    return false
  }
}

module.exports = { parseAddress, isValid }
module.exports.default = module.exports
