import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseAddress, isValid, Address } from '../index.js'

describe('parseAddress — accepts plain user@domain forms', () => {
  const accepted = [
    'user@example.com',
    'first.last@example.com',
    'user+tag@example.com',
    'a_b-c@sub.example.com',
    '"quoted user"@example.com',
    'δοκιμή@παράδειγμα.gr', // RFC 6531 EAI
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
