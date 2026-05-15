// SUNSET 2027: opt-in legacy-contract shim.
//
// 3.x exposes `Address#address` and `Address#host` as plain string
// values — `typeof addr.host === 'string'`, `addr.host === 'x'` works.
// That is the canonical API and is left untouched.
//
// Historically (address-rfc2821 / address-rfc2822) those were *methods*
// — `addr.address()` / `addr.host()`. Code that has not yet migrated
// (Haraka core, third-party plugins) still calls them that way.
// `asLegacy(addr)` returns a Proxy over an Address whose `address` and
// `host` reads yield a value that behaves as the string in every string
// context AND is callable, returning the same string. Every other
// property and method passes straight through to the underlying
// Address, and the proxy serializes (JSON) and `instanceof`-checks just
// like the real instance.
//
// This is opt-in: only the boundary that hands Addresses to legacy
// consumers (Haraka core's transaction setup) wraps. Library defaults
// and migrated consumers keep the clean primitive API.
//
// Known limitation on the wrapped fields only: `typeof w.host` is
// `'function'` and strict `w.host === 'x'` is false. Use `==`, template
// literals, or `String(w.host)`. Remove this whole file in 2027.

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
      if (LEGACY_FIELDS.has(prop) && prop in t) return legacyAccessor(t[prop])
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

export { asLegacy, legacyAccessor, unwrapLegacy, RAW }
