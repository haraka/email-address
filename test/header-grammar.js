import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { Address, Group, parseHeader, parseFrom, parseSender, parseReplyTo } from '../index.js'

describe('parseHeader — basics', () => {
  it('parses a single name-addr', () => {
    const [a] = parseHeader('Alice <alice@example.com>')
    assert.equal(a.phrase, 'Alice')
    assert.equal(a.user, 'alice')
    assert.equal(a.host, 'example.com')
    assert.equal(a.address, 'alice@example.com')
    assert.equal(a.comment, '')
    assert.equal(a.format(), 'Alice <alice@example.com>')
  })

  it('parses a bare addr-spec', () => {
    const [a] = parseHeader('alice@example.com')
    assert.equal(a.phrase, '')
    assert.equal(a.address, 'alice@example.com')
    assert.equal(a.format(), 'alice@example.com')
  })

  it('parses an address list', () => {
    const r = parseHeader('"Alice" <a@x>, "Bob" <b@x>, charlie@x')
    assert.equal(r.length, 3)
    assert.equal(r[0].phrase, 'Alice')
    assert.equal(r[1].phrase, 'Bob')
    assert.equal(r[2].phrase, '')
  })

  it('throws on empty / null input', () => {
    assert.throws(() => parseHeader(''), { message: 'Nothing to parse' })
    assert.throws(() => parseHeader(null), { message: 'Nothing to parse' })
  })
})

describe('parseHeader — comments', () => {
  it('attaches a trailing comment to .comment', () => {
    const [a] = parseHeader('user@example.com (Display Name)')
    assert.equal(a.comment, 'Display Name')
    assert.equal(a.format(), 'user@example.com (Display Name)')
  })

  it('moves a comment between phrase and angle-addr to the end on format()', () => {
    const [a] = parseHeader('Alice (Boss) <alice@example.com>')
    assert.equal(a.phrase, 'Alice')
    assert.equal(a.comment, 'Boss')
    assert.equal(a.format(), 'Alice <alice@example.com> (Boss)')
  })

  it('handles nested comments', () => {
    const [a] = parseHeader('user@example.com (Outer (Inner) End)')
    assert.equal(a.comment, 'Outer (Inner) End')
  })

  it('throws on unterminated comments', () => {
    assert.throws(() => parseHeader('user@example.com (unterminated'))
  })
})

describe('parseHeader — display names', () => {
  it('strips outer quotes when storing the phrase', () => {
    const [a] = parseHeader('"Alice" <alice@example.com>')
    assert.equal(a.phrase, 'Alice')
    assert.equal(a.format(), 'Alice <alice@example.com>') // round-trips unquoted (atext-safe)
  })

  it('preserves the phrase content of a quoted-string', () => {
    const [a] = parseHeader('"Joe & J. Harvey" <ddd@org>')
    assert.equal(a.phrase, 'Joe & J. Harvey')
    assert.equal(a.format(), '"Joe & J. Harvey" <ddd@org>')
  })

  it('accepts non-ASCII display names (RFC 6532)', () => {
    const [a] = parseHeader('"Имя Фамилия" <name@gmail.com>')
    assert.equal(a.phrase, 'Имя Фамилия')
    assert.equal(a.format(), '"Имя Фамилия" <name@gmail.com>')
  })

  it('rejects display names containing "," by default', () => {
    assert.throws(() => parseHeader('Foo, Bar <foo@x>'))
  })

  it('accepts display names containing "," when allowCommaInDisplayName is true', () => {
    const [a] = parseHeader('Foo, Bar <foo@x>', { allowCommaInDisplayName: true })
    assert.equal(a.phrase, 'Foo, Bar')
    assert.equal(a.address, 'foo@x')
  })

  it('accepts display names containing "@" by default', () => {
    const [a] = parseHeader('foo@example <foo@example.com>')
    assert.equal(a.phrase, 'foo@example')
  })
})

describe('parseHeader — groups', () => {
  it('parses an empty group (RFC 6854)', () => {
    const [g] = parseHeader('Friends:;')
    assert.ok(g instanceof Group)
    assert.equal(g.phrase, 'Friends')
    assert.equal(g.addresses.length, 0)
    assert.equal(g.format(), 'Friends:')
  })

  it('parses a populated group with multiple members', () => {
    const [g] = parseHeader('Partners: alice@x, bob@y;')
    assert.ok(g instanceof Group)
    assert.equal(g.addresses.length, 2)
    assert.equal(g.addresses[0].address, 'alice@x')
    assert.equal(g.addresses[1].address, 'bob@y')
  })

  it('back-links each group member via .group', () => {
    const [g] = parseHeader('Friends: a@x, b@y;')
    for (const m of g.addresses) assert.equal(m.group, g)
  })

  it('mixes groups and bare addresses in an address-list', () => {
    const r = parseHeader('alone@x, Friends: a@y, b@z;, lonely@x')
    assert.equal(r.length, 3)
    assert.ok(r[0] instanceof Address)
    assert.ok(r[1] instanceof Group)
    assert.ok(r[2] instanceof Address)
  })
})

describe('parseHeader — IDN and is_utf8', () => {
  it('punycodes the host into .host while preserving .original_host', () => {
    const [a] = parseHeader('"User" <u@δοκιμή.gr>')
    assert.equal(a.original_host, 'δοκιμή.gr')
    assert.match(a.host, /^xn--/)
    assert.equal(a.is_utf8, true)
  })

  it('sets is_utf8 when only the local-part is non-ASCII', () => {
    const [a] = parseHeader('"User" <андрис@example.com>')
    assert.equal(a.is_utf8, true)
    assert.equal(a.host, 'example.com')
  })
})

describe('parseHeader — convenience helpers', () => {
  it('parseFrom returns a list', () => {
    const r = parseFrom('Travis CI <builds@travis-ci.org>')
    assert.equal(r.length, 1)
    assert.equal(r[0].phrase, 'Travis CI')
    assert.equal(r[0].address, 'builds@travis-ci.org')
  })

  it('parseSender returns a single Address', () => {
    const a = parseSender('"Anne Standley, PMPM" <info@x.example>', {})
    assert.equal(a.phrase, 'Anne Standley, PMPM')
    assert.equal(a.address, 'info@x.example')
  })

  it('parseReplyTo preserves encoded-word phrases verbatim', () => {
    const r = parseReplyTo('=?utf-8?Q?Anne?= <info@x.example>')
    assert.equal(r[0].phrase, '=?utf-8?Q?Anne?=')
  })
})

describe('parseHeader — startAt options', () => {
  it('accepts an angle-addr only via startAt: angle-addr', () => {
    const [a] = parseHeader('<u@example.com>', { startAt: 'angle-addr' })
    assert.equal(a.address, 'u@example.com')
  })

  it('rejects a list when startAt is "mailbox"', () => {
    assert.throws(() => parseHeader('a@x, b@y', { startAt: 'mailbox' }))
  })
})

describe('Address — name()', () => {
  it('extracts a human name from the phrase', () => {
    const [a] = parseHeader('"Alice Smith" <alice@example.com>')
    assert.equal(a.name(), 'Alice Smith')
  })

  it('falls back to the comment when phrase is empty', () => {
    const [a] = parseHeader('alice@example.com (Alice Smith)')
    assert.equal(a.name(), 'Alice Smith')
  })

  it('derives a name from first.last@ when phrase + comment are empty', () => {
    const [a] = parseHeader('graham.barr@example.com')
    assert.equal(a.name(), 'Graham Barr')
  })
})
