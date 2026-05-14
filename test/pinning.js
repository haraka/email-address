'use strict'

// Pinning tests written immediately before a parser refactor (nearley →
// hand-rolled recursive descent). Each test captures a behavior the existing
// suite did NOT explicitly cover. Their job is to make the refactor a
// pure-implementation change: if a test in this file changes after the
// refactor, the implementation has drifted observable behavior — investigate.
//
// NOTE: a few of these pin behavior that is permissive beyond RFC 5321/5952
// (e.g. malformed IPv6 strings accepted via the General_address_literal
// fallback in the current grammar). They are pinned as-is for refactor
// fidelity. Tightening any of these is appropriate for a follow-up PR.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { Address } = require('..')

describe('pinning — trailing input', () => {
  const trailingCases = [
    '<a@b>x', // single char after closing bracket
    '<a@b> ', // trailing space
    '<a@b>>', // doubled close bracket
  ]
  for (const input of trailingCases) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      assert.throws(
        () => new Address(input),
        (err) => err.name !== 'TypeError',
      )
    })
  }
})

describe('pinning — IPv6 RFC-strict forms (accepted by the strict grammar branch)', () => {
  const cases = [
    ['<u@[IPv6:::]>', '[ipv6:::]'],
    ['<u@[IPv6:1::]>', '[ipv6:1::]'],
    ['<u@[IPv6:::1.2.3.4]>', '[ipv6:::1.2.3.4]'],
    ['<u@[IPv6:1:2:3:4:5:6:7:8]>', '[ipv6:1:2:3:4:5:6:7:8]'],
    ['<u@[IPv6:1:2:3:4:5:6:1.2.3.4]>', '[ipv6:1:2:3:4:5:6:1.2.3.4]'],
  ]
  for (const [input, expectedHost] of cases) {
    it(`accepts ${JSON.stringify(input)}`, () => {
      const a = new Address(input)
      assert.equal(a.user, 'u')
      assert.equal(a.host, expectedHost)
    })
  }
})

describe('pinning — IPv6 hex case folding', () => {
  it('hex digits in IPv6 literal are lowercased on host', () => {
    const a = new Address('<u@[IPv6:DEAD::BEEF]>')
    assert.equal(a.host, '[ipv6:dead::beef]')
  })

  it('original_host preserves source case', () => {
    const a = new Address('<u@[IPv6:DEAD::BEEF]>')
    assert.equal(a.original_host, '[IPv6:DEAD::BEEF]')
  })
})

describe('strict IPv6 — malformed IPv6 literals are rejected by default', () => {
  // Address-literal bodies with the reserved "IPv6:" tag must match the
  // RFC-5321 §4.1.3 IPv6-addr production. Prior versions accepted
  // arbitrary dcontent via the General_address_literal fallback; the
  // strict default now rejects these, and they only parse when the
  // caller opts in with `postel: true`.
  const malformed = [
    '<u@[IPv6:1:2:3:4:5:6:7:8:9]>', // 9 groups — too many for strict IPv6
    '<u@[IPv6:1::2::3]>', // two `::` is illegal in strict IPv6
    '<u@[IPv6:gggg::]>', // `g` is not a hex digit
    '<u@[IPv6:1:2:3:4:5:6:7]>', // 7 groups without `::`
    '<u@[IPv6:1.2.3.4]>', // no v6 component at all
  ]
  for (const input of malformed) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      assert.throws(
        () => new Address(input),
        (err) => err.name !== 'TypeError',
      )
    })
    it(`accepts ${JSON.stringify(input)} with postel: true`, () => {
      assert.doesNotThrow(() => new Address(input, { postel: true }))
    })
  }
})

describe('pinning — consecutive dots in dot-string', () => {
  it('rejects <a..b@example.com>', () => {
    assert.throws(
      () => new Address('<a..b@example.com>'),
      (err) => err.name !== 'TypeError',
    )
  })
})

describe('pinning — UTF-8 in local-part vs domain', () => {
  it('is_utf8 is true when only the local-part contains non-ASCII', () => {
    // SMTPUTF8 is required whenever either side has non-ASCII; the flag
    // reflects that.
    const a = new Address('<андрис@example.com>')
    assert.equal(a.is_utf8, true)
    assert.equal(a.user, 'андрис')
    assert.equal(a.host, 'example.com')
  })

  it('is_utf8 is true when the domain contains non-ASCII', () => {
    const a = new Address('<u@δοκιμή.gr>')
    assert.equal(a.is_utf8, true)
  })

  it('is_utf8 is unset for fully ASCII addresses', () => {
    const a = new Address('<u@example.com>')
    assert.equal(a.is_utf8, undefined)
  })
})

describe('pinning — atom character `/` is accepted', () => {
  // grammar.ne `Atom` regex contains `/` twice (a duplicate); harmless
  // but worth pinning that `/` parses cleanly so a regex rewrite that
  // de-duplicates the class doesn't accidentally drop it.
  it('accepts <a/b@example.com>', () => {
    const a = new Address('<a/b@example.com>')
    assert.equal(a.user, 'a/b')
    assert.equal(a.host, 'example.com')
  })
})

describe('pinning — quoted local-part preserves surrounding quotes', () => {
  it('user field includes the double quotes', () => {
    const a = new Address('<"foo bar"@example.com>')
    assert.equal(a.user, '"foo bar"')
  })

  it('format() round-trips the quoted form', () => {
    const a = new Address('<"foo bar"@example.com>')
    assert.equal(a.format(), '<"foo bar"@example.com>')
  })
})

describe('pinning — supplementary-plane Unicode', () => {
  // Atom and sub-domain character classes use the `u` flag so a
  // supplementary-plane codepoint like U+1F4A9 (💩) matches as a single
  // codepoint, not as two surrogate code units.
  it('accepts an emoji in local-part (sets is_utf8)', () => {
    const a = new Address('<\u{1F4A9}@example.com>')
    assert.equal(a.user, '\u{1F4A9}')
    assert.equal(a.is_utf8, true)
  })

  it('accepts an emoji in domain (sets is_utf8)', () => {
    const a = new Address('<u@\u{1F4A9}.example.com>')
    assert.equal(a.is_utf8, true)
  })
})

describe('strict — sub-domain labels limited to 63 octets', () => {
  it('accepts a 63-octet label', () => {
    const label = 'a'.repeat(63)
    const a = new Address(`<u@${label}.example.com>`)
    assert.equal(a.host, `${label}.example.com`)
  })

  it('rejects a 64-octet label', () => {
    const label = 'a'.repeat(64)
    assert.throws(
      () => new Address(`<u@${label}.example.com>`),
      (err) => err.name !== 'TypeError' && /63 octets/.test(err.message),
    )
  })

  it('rejects a 64-octet trailing label', () => {
    const label = 'a'.repeat(64)
    assert.throws(
      () => new Address(`<u@example.${label}>`),
      (err) => err.name !== 'TypeError' && /63 octets/.test(err.message),
    )
  })

  it('counts UTF-8 octets, not codepoints', () => {
    // 'ñ' encodes as 2 bytes (0xC3 0xB1). 32 × 2 = 64 octets — over the limit.
    const label = 'ñ'.repeat(32)
    assert.throws(
      () => new Address(`<u@${label}.example.com>`),
      (err) => err.name !== 'TypeError' && /63 octets/.test(err.message),
    )
  })
})

describe('strict IPv6 — well-formed addresses accepted', () => {
  const wellFormed = [
    '<u@[IPv6:2001:db8:85a3::8a2e:370:7334]>',
    '<u@[IPv6:2001:db8:0:0:0:0:0:1]>',
    '<u@[IPv6:0:0:0:0:0:0:0:1]>',
    '<u@[IPv6:fe80::]>',
    '<u@[IPv6:::ffff:1.2.3.4]>', // IPv4-mapped
    '<u@[IPv6:::]>', // all zeros
  ]
  for (const input of wellFormed) {
    it(`accepts ${JSON.stringify(input)}`, () => {
      assert.doesNotThrow(() => new Address(input))
    })
  }
})

describe('strict IPv6 — additional malformed shapes rejected', () => {
  const malformed = [
    '<u@[IPv6:]>', // empty body
    '<u@[IPv6:12345::1]>', // hex group > 4 digits
    '<u@[IPv6:1::2::]>', // multiple ::
    '<u@[IPv6:1:2:3:4:5:1.2.3.4]>', // 5 hex + v4 = 7 effective groups
    '<u@[IPv6:1:2:3:4:5:6:7:1.2.3.4]>', // 7 hex + v4 = 9 effective groups
    '<u@[IPv6:1.2.3.4:5:6:7:8]>', // v4 not at end
    '<u@[IPv6:1:2:3:4:5:6:7:300.0.0.1]>', // bad v4 octet
  ]
  for (const input of malformed) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      assert.throws(
        () => new Address(input),
        (err) => err.name !== 'TypeError',
      )
    })
  }
})

describe('postel option — opts in to lax behaviour', () => {
  it('still rejects non-literal grammar violations', () => {
    // postel only loosens specific limits; structural grammar errors
    // continue to throw.
    assert.throws(
      () => new Address('<a..b@example.com>', { postel: true }),
      (err) => err.name !== 'TypeError',
    )
  })

  it('round-trips a malformed IPv6 literal under postel mode', () => {
    const a = new Address('<u@[IPv6:1::2::3]>', { postel: true })
    assert.equal(a.user, 'u')
    assert.equal(a.host, '[ipv6:1::2::3]')
    assert.equal(a.format(), '<u@[IPv6:1::2::3]>')
  })

  it('rejects a 257-octet path in strict mode', () => {
    const local = 'a'.repeat(60)
    // local (60) + '@' (1) + host (193) + '<>' (2) = 256
    // bump host to push the path to 257
    const host = `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.${'e'.repeat(2)}`
    const input = `<${local}@${host}>`
    assert.equal(Buffer.byteLength(input, 'utf8'), 257)
    assert.throws(
      () => new Address(input),
      (err) => err.name !== 'TypeError' && /256 octets/.test(err.message),
    )
  })

  it('accepts a >256-octet path under postel mode', () => {
    const local = 'a'.repeat(60)
    const host = `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.${'e'.repeat(2)}`
    const input = `<${local}@${host}>`
    assert.equal(Buffer.byteLength(input, 'utf8'), 257)
    const a = new Address(input, { postel: true })
    assert.equal(a.user, local)
  })

  it('rejects paths exceeding the SMTP text-line maximum even under postel', () => {
    // The relaxed cap is 998 octets (RFC 5321 §4.5.3.1.6); anything
    // longer than that can't fit on an SMTP line and is still rejected.
    const input = `<u@${'a'.repeat(1000)}>`
    assert.throws(
      () => new Address(input, { postel: true }),
      (err) => err.name !== 'TypeError' && /998 octets/.test(err.message),
    )
  })

  it('General-address-literal with non-IPv6 tag is always accepted', () => {
    // Strict mode only constrains the "IPv6" tag; other registered
    // standardized tags pass through both modes.
    const a = new Address('<u@[X-future:custom-content]>')
    assert.equal(a.original_host, '[X-future:custom-content]')
  })
})

describe('parse — invalid IDN domain', () => {
  it('throws for an IDN domain that cannot be encoded', () => {
    // domainToASCII returns '' on labels that fail UTS-46 validation
    // (e.g. labels starting with a combining mark).
    assert.throws(
      () => new Address('<u@́.com>'),
      (err) => err.name !== 'TypeError',
    )
  })
})

describe('pinning — parser error paths', () => {
  // These exercise specific failure branches inside the recursive-descent
  // parser that aren't otherwise reached by the canonical-input tests.
  // Each MUST throw a non-TypeError parse error.
  const cases = [
    ['quoted-pair followed by control char', '<"\\ "@example.com>'],
    ['quoted-string with bare control char', '<""@example.com>'],
    ['address literal with control byte', '<u@[]>'],
    ['address literal with backslash', '<u@[\\]>'],
    ['unterminated address literal', '<u@[1.2.3.4>'],
    ['empty address literal', '<u@[]>'],
    ['literal body that is neither IPv4 nor tag:content', '<u@[notvalid]>'],
    ['tag with empty content after colon', '<u@[Tag:]>'],
    ['tag containing control chars in content', '<u@[Tag:]>'],
  ]
  for (const [label, input] of cases) {
    it(`rejects ${label}`, () => {
      assert.throws(
        () => new Address(input),
        (err) => err.name !== 'TypeError',
      )
    })
  }
})
