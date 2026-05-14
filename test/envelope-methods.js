import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { Address } from '../index.js'

describe('Address constructors', () => {
  it('two-arg constructor sets user, host, original, and original_host', () => {
    const address = new Address('user', 'example.com')
    assert.equal(address.user, 'user')
    assert.equal(address.host, 'example.com')
    assert.equal(address.original, 'user@example.com')
    assert.equal(address.original_host, 'example.com')
  })

  it('two-arg constructor lowercases the host', () => {
    const address = new Address('user', 'ExAmPlE.CoM')
    assert.equal(address.host, 'example.com')
    assert.equal(address.original_host, 'ExAmPlE.CoM')
  })

  it('two-arg constructor normalizes UTF-8 hosts to punycode', () => {
    const address = new Address('user', 'δοκιμή.gr')
    assert.equal(address.is_utf8, true)
    assert.notEqual(address.host, 'δοκιμή.gr')
    assert.match(address.host, /^xn--/)
  })

  it('rehydrates from a plain object with an original key', () => {
    const json = {
      original: '<u@example.com>',
      user: 'u',
      host: 'example.com',
      original_host: 'example.com',
    }

    const address = new Address(json)
    assert.equal(address.user, 'u')
    assert.equal(address.host, 'example.com')
    assert.equal(address.original, '<u@example.com>')
    assert.equal(address.original_host, 'example.com')
  })

  it('round-trips through JSON.stringify/parse', () => {
    const address = new Address('<u@example.com>')
    const reparsed = new Address(JSON.parse(JSON.stringify(address)))

    assert.equal(reparsed.user, address.user)
    assert.equal(reparsed.host, address.host)
    assert.equal(reparsed.format(), address.format())
  })
})

describe('Address formatting methods', () => {
  it('format() returns <> when the address is null', () => {
    assert.equal(new Address('<>').format(), '<>')
  })

  it('format() returns the canonical form for parsed input', () => {
    assert.equal(new Address('<u@example.com>').format(), '<u@example.com>')
  })

  it('format() preserves non-Latin input by default', () => {
    const address = new Address('<přílišžluťoučkýkůň@přílišžluťoučkýkůň.cz>')
    assert.equal(address.format(), '<přílišžluťoučkýkůň@přílišžluťoučkýkůň.cz>')
  })

  it('format() preserves spaces inside quoted strings', () => {
    const address = new Address('<"pří lišžlu ťoučkýkůň"@přílišžluťoučkýkůň.cz>')
    assert.equal(address.format(), '<"pří lišžlu ťoučkýkůň"@přílišžluťoučkýkůň.cz>')
  })

  it('format(true) renders the punycoded host', () => {
    const address = new Address('<u@δοκιμή.gr>')
    assert.match(address.format(true), /xn--/)
  })

  it('format(false) keeps the original host', () => {
    const address = new Address('<u@δοκιμή.gr>')
    assert.equal(address.format(false), '<u@δοκιμή.gr>')
    assert.equal(address.format(), '<u@δοκιμή.gr>')
  })

  it('.address returns user@host without brackets', () => {
    const address = new Address('<u@example.com>')
    assert.equal(address.address, 'u@example.com')
  })

  it('.address returns just the user when there is no host', () => {
    const address = new Address('postmaster')
    assert.equal(address.address, 'postmaster')
  })

  it('.address returns an empty string for the null path', () => {
    assert.equal(new Address('<>').address, '')
  })

  it('.address preserves the original-cased host for IDN', () => {
    const address = new Address('<u@δοκιμή.gr>')
    assert.equal(address.address, 'u@δοκιμή.gr')
    // The punycoded host is exposed separately on `.host`.
    assert.match(address.host, /^xn--/)
  })

  it('toString() matches format()', () => {
    const address = new Address('<u@example.com>')
    assert.equal(address.toString(), address.format())
  })

  it('toString() returns <> for the null path', () => {
    assert.equal(new Address('<>').toString(), '<>')
  })
})

describe('Address security — rehydration allowlist', () => {
  it('does not copy inherited enumerable properties', () => {
    const proto = { injected: 'evil' }
    const obj = Object.create(proto)
    obj.original = '<u@example.com>'
    obj.user = 'u'
    obj.host = 'example.com'

    const address = new Address(obj)
    assert.equal(address.user, 'u')
    assert.equal(Object.hasOwn(address, 'injected'), false)
  })

  it('does not copy __proto__ from rehydrated object', () => {
    const obj = Object.create(null)
    obj.original = '<u@example.com>'
    obj.user = 'u'
    obj.host = 'example.com'
    // Simulate a parsed JSON.parse result that tries to mutate __proto__
    Object.defineProperty(obj, '__proto__', {
      value: { pwned: true },
      enumerable: true,
    })

    const address = new Address(obj)
    assert.equal(address.pwned, undefined)
  })

  it('rejects control characters in user during rehydration', () => {
    assert.throws(
      () =>
        new Address({
          original: '<u@example.com>',
          user: 'u\r\nBcc: evil@x.com',
          host: 'example.com',
        }),
      /control characters/,
    )
  })

  it('rejects control characters in host during rehydration', () => {
    assert.throws(
      () =>
        new Address({
          original: '<u@example.com>',
          user: 'u',
          host: 'example.com\r\nX-Injected: 1',
        }),
      /control characters/,
    )
  })
})

describe('Address security — build-from-parts', () => {
  it('rejects CR/LF in user', () => {
    assert.throws(
      () => new Address('user\r\nBcc: attacker@evil.com', 'example.com'),
      /control characters/,
    )
  })

  it('rejects CR/LF in host', () => {
    assert.throws(() => new Address('user', 'example.com\r\nX-Injected: 1'), /control characters/)
  })

  it('rejects bare LF in user', () => {
    assert.throws(() => new Address('user\nfoo', 'example.com'), /control characters/)
  })

  it('rejects NUL byte in host', () => {
    assert.throws(() => new Address('user', 'exa\x00mple.com'), /control characters/)
  })
})

describe('Address null checks', () => {
  it('isNull() is true for <>', () => {
    assert.equal(new Address('<>').isNull(), true)
  })

  it('isNull() is true for the empty string', () => {
    assert.equal(new Address('').isNull(), true)
  })

  it('isNull() is false for a mailbox', () => {
    assert.equal(new Address('<u@example.com>').isNull(), false)
  })

  it('isNull() is false for bare postmaster', () => {
    assert.equal(new Address('postmaster').isNull(), false)
  })
})
