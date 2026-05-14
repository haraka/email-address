import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseAddress, isValid, Address } from '../index.js'

describe('parseAddress — accepts plain user@domain forms', () => {
  const accepted = [
    'user@example.com',
    'first.last@example.com',
    'disposable.style.email.with+symbol@example.com',
    'user+tag@example.com',
    'a_b-c@sub.example.com',
    'admin@mailserver1',
    '"quoted user"@example.com',
    'δοκιμή@παράδειγμα.gr', // RFC 6531 EAI
    '我買@屋企.香港', // RFC 6531 EAI — Chinese script
    '  user@example.com  ', // trimmed
  ]
  for (const input of accepted) {
    it(JSON.stringify(input), () => {
      const a = parseAddress(input)
      assert.ok(a instanceof Address)
      assert.ok(a.user.length > 0)
      assert.ok(a.host.length > 0)
    })
  }
})

describe('parseAddress — rejects non-plain forms', () => {
  const rejected = [
    ['', /empty/],
    ['   ', /empty/],
    ['no-at-sign', /local-part|sub-domain|expected/],
    ['@example.com', /local-part|expected/],
    ['user@', /sub-domain|domain/],
    ['<user@example.com>', /angle brackets/],
    ['user@example.com>', /angle brackets/],
    ['<user@example.com', /angle brackets/],
    ['postmaster', /requires a domain/],
    ['POSTMASTER', /requires a domain/],
    ['user@example.com (Comment)', /comments/],
    ['(Comment) user@example.com', /comments/],
    ['Alice <alice@example.com>', /angle brackets/],
    ['a@x, b@y', /single address/],
    ['Friends: a@x, b@y;', /single address/],
    // unquoted local-part violations
    ['.user@example.com', /local-part/],
    ['user.@example.com', /expected atom/],
    ['john..doe@example.com', /expected atom/],
    ['foo\\ bar@example.com', /expected "@"/],
    // malformed quoted local-part
    ['"user " with"@example.com', /expected "@"/],
    // domain violations
    ['user@example.com.', /sub-domain/],
    ['user@example.com#', /trailing input/],
    ['foo.bar@bad=domain.com', /trailing input/],
    // invalid IPv4 address literals
    ['user@[300.0.0.1]', /invalid address literal/],
    ['Manuéla@[127.0.0.0.1]', /invalid address literal/],
    ['moe@[127.0.1]', /invalid address literal/],
    ['Jacqueline@[127.00.0.1]', /invalid address literal/],
    [42, TypeError],
    [null, TypeError],
    [undefined, TypeError],
  ]
  for (const [input, errMatcher] of rejected) {
    it(JSON.stringify(input), () => {
      if (errMatcher === TypeError) {
        assert.throws(() => parseAddress(input), TypeError)
      } else {
        assert.throws(() => parseAddress(input), errMatcher)
      }
    })
  }
})

describe('parseAddress — requireTLD option', () => {
  it('accepts user@example by default', () => {
    assert.doesNotThrow(() => parseAddress('user@example'))
  })

  it('rejects user@example when requireTLD: true', () => {
    assert.throws(() => parseAddress('user@example', { requireTLD: true }), /TLD/)
  })

  it('accepts user@example.com when requireTLD: true', () => {
    assert.doesNotThrow(() => parseAddress('user@example.com', { requireTLD: true }))
  })
})

describe('isValid — boolean wrapper', () => {
  const truthy = [
    'user@example.com',
    'first.last@example.com',
    '"quoted"@example.com',
    'δοκιμή@παράδειγμα.gr',
  ]
  const falsy = [
    '',
    'no-at-sign',
    '<user@example.com>',
    'postmaster',
    'user@example.com (Comment)',
    'a@x, b@y',
    42,
    null,
    undefined,
  ]
  for (const input of truthy) {
    it(`true: ${JSON.stringify(input)}`, () => assert.equal(isValid(input), true))
  }
  for (const input of falsy) {
    it(`false: ${JSON.stringify(input)}`, () => assert.equal(isValid(input), false))
  }

  it('honours requireTLD via opts', () => {
    assert.equal(isValid('user@example'), true)
    assert.equal(isValid('user@example', { requireTLD: true }), false)
    assert.equal(isValid('user@example.com', { requireTLD: true }), true)
  })
})

describe('parseAddress — RFC-5321 quoted local-parts', () => {
  it('accepts space-only quoted local-part', () => {
    const a = parseAddress('" "@example.org')
    assert.equal(a.user, '" "')
    assert.equal(a.host, 'example.org')
  })

  it('accepts escaped double-quote inside quoted local-part', () => {
    const a = parseAddress('"user \\" with"@example.com')
    assert.equal(a.user, '"user \\" with"')
    assert.equal(a.host, 'example.com')
  })

  it('accepts consecutive dots inside quoted local-part', () => {
    const a = parseAddress('"john..doe"@example.org')
    assert.equal(a.user, '"john..doe"')
    assert.equal(a.host, 'example.org')
  })

  it('accepts angle brackets inside quoted local-part', () => {
    const a = parseAddress('"<john-doe>"@example.org')
    assert.equal(a.user, '"<john-doe>"')
    assert.equal(a.host, 'example.org')
  })

  it('accepts @ inside quoted local-part', () => {
    const a = parseAddress('"john.doe@example.com"@example.org')
    assert.equal(a.user, '"john.doe@example.com"')
    assert.equal(a.host, 'example.org')
  })
})

describe('parseAddress — RFC-5321 address literals', () => {
  it('accepts IPv4 address literals', () => {
    const a = parseAddress('simple@[127.0.0.1]')
    assert.equal(a.user, 'simple')
    assert.equal(a.host, '[127.0.0.1]')
  })

  it('accepts IPv6 address literals and normalizes to lowercase', () => {
    const a = parseAddress('simple@[IPv6:::1]')
    assert.equal(a.user, 'simple')
    assert.equal(a.host, '[ipv6:::1]')
  })
})

describe('parseAddress — misc RFC-5321 local-part patterns', () => {
  it('accepts percent-routing notation', () => {
    const a = parseAddress('john.doe%example.com@example.org')
    assert.equal(a.user, 'john.doe%example.com')
    assert.equal(a.host, 'example.org')
  })

  it('accepts trailing hyphen in unquoted local-part', () => {
    const a = parseAddress('name-@example.org')
    assert.equal(a.user, 'name-')
    assert.equal(a.host, 'example.org')
  })
})
