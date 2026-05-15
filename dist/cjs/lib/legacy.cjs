'use strict'

// AUTO-GENERATED from the matching `.js` file by scripts/build-cjs.js
// — do not edit by hand. The pre-commit hook in .githooks/pre-commit
// regenerates these files whenever any `.js` source is staged;
// `npm run build:cjs` produces the same output on demand.

const LEGACY_FIELDS = new Set(['address', 'host'])

// A value that is simultaneously the string `s` (in every string
// context) and a zero-arg function returning `s`.
function legacyAccessor(s) {
  const str = String(s ?? '')
  const target = () => str
  return new Proxy(target, {
    apply: () => str,
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => str
      if (prop === 'toString' || prop === 'valueOf' || prop === 'toJSON') {
        return () => str
      }
      const v = str[prop]
      return typeof v === 'function' ? v.bind(str) : v
    },
    has: (_t, prop) => Reflect.has(Object(str), prop),
  })
}

// Reachable without importing this module (Haraka core uses
// `Symbol.for(...)` to unwrap before re-hydrating an Address).
const RAW = Symbol.for('haraka.email-address.legacy.raw')

function asLegacy(addr) {
  if (addr == null || typeof addr !== 'object') return addr
  // Idempotent: never double-wrap.
  if (addr[RAW]) return addr
  return new Proxy(addr, {
    get(t, prop) {
      if (prop === RAW) return t
      if (LEGACY_FIELDS.has(prop)) return legacyAccessor(t[prop])
      const v = Reflect.get(t, prop)
      // bind methods back to the real instance so `this` is the
      // Address, not the Proxy (avoids re-entrant trap surprises).
      return typeof v === 'function' ? v.bind(t) : v
    },
  })
}

// Return the underlying Address if `addr` is an asLegacy wrapper, else
// `addr` unchanged. Lets callers re-hydrate from raw string fields
// instead of the callable accessors.
function unwrapLegacy(addr) {
  return addr && typeof addr === 'object' && addr[RAW] ? addr[RAW] : addr
}

module.exports = { asLegacy, legacyAccessor, unwrapLegacy, RAW }
module.exports.default = module.exports
