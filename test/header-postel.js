// `postel: true` parity with how `address-rfc2822` invoked
// `email-addresses` with `strict: false`. Covers the two RFC 5322 §4.4
// obs-* productions we admit under the flag, the strict-mode
// rejections that go away, and the carve-outs that stay rejected even
// with postel.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { Group, parseHeader } from '../index.js'

describe('postel: true — obs-local-part (RFC 5322 §4.4)', () => {
  it('strict mode rejects multi-word quoted local-parts', () => {
    assert.throws(() => parseHeader('"foo"."bar"@x.com'))
  })

  it('postel mode accepts quoted.quoted', () => {
    const [a] = parseHeader('"foo"."bar"@x.com', { postel: true })
    assert.equal(a.user, '"foo"."bar"')
    assert.equal(a.host, 'x.com')
  })

  it('postel mode accepts atom.quoted', () => {
    const [a] = parseHeader('bar."foo"@x.com', { postel: true })
    assert.equal(a.user, 'bar."foo"')
  })

  it('postel mode accepts quoted.atom', () => {
    const [a] = parseHeader('"foo".bar@x.com', { postel: true })
    assert.equal(a.user, '"foo".bar')
  })

  it('postel mode preserves quoted content with internal whitespace', () => {
    const [a] = parseHeader('"first last"."company name"@example.com', { postel: true })
    assert.equal(a.user, '"first last"."company name"')
  })

  it('plain dot-atom local-parts still parse unchanged under postel', () => {
    const [a] = parseHeader('first.last@example.com', { postel: true })
    assert.equal(a.user, 'first.last')
  })
})

describe('postel: true — obs-mbox-list null entries (RFC 5322 §4.4)', () => {
  it('strict mode rejects an interstitial null entry', () => {
    assert.throws(() => parseHeader('a@x, , b@y'))
  })

  it('postel mode accepts an interstitial null entry', () => {
    const r = parseHeader('a@x, , b@y', { postel: true })
    assert.equal(r.length, 2)
    assert.equal(r[0].address, 'a@x')
    assert.equal(r[1].address, 'b@y')
  })

  it('postel mode tolerates leading commas', () => {
    const r = parseHeader(', , a@x', { postel: true })
    assert.equal(r.length, 1)
    assert.equal(r[0].address, 'a@x')
  })

  it('postel mode tolerates multiple trailing commas', () => {
    const r = parseHeader('a@x, , , ', { postel: true })
    assert.equal(r.length, 1)
    assert.equal(r[0].address, 'a@x')
  })

  it('postel mode handles all of leading, interstitial, and trailing nulls together', () => {
    const r = parseHeader(', , a@x, , , b@y, ,', { postel: true })
    assert.equal(r.length, 2)
    assert.deepEqual(
      r.map((a) => a.address),
      ['a@x', 'b@y'],
    )
  })

  it('postel mode tolerates null entries inside a group', () => {
    const [g] = parseHeader('Friends: a@x, , b@y;', { postel: true })
    assert.ok(g instanceof Group)
    assert.equal(g.addresses.length, 2)
  })

  it('postel mode tolerates leading nulls inside a group', () => {
    const [g] = parseHeader('Friends: , a@x;', { postel: true })
    assert.equal(g.addresses.length, 1)
    assert.equal(g.addresses[0].address, 'a@x')
  })
})

describe('postel: true — carve-outs (still rejected)', () => {
  // obs-NO-WS-CTL / obs-qp with control characters: header-injection
  // surface, deliberately not relaxed.
  it('rejects NUL inside qtext under postel', () => {
    assert.throws(() => parseHeader('"\u0000"@x.com', { postel: true }))
  })

  it('rejects a quoted-string with embedded control chars under postel', () => {
    assert.throws(() => parseHeader('"foo\u0001bar"@x.com', { postel: true }))
  })

  // Plainly malformed inputs that aren't obsolete syntax — bugs, not
  // grammar history.
  it('rejects a leading-dot domain under postel', () => {
    assert.throws(() => parseHeader('u@.example.com', { postel: true }))
  })

  it('rejects a consecutive-dot domain under postel', () => {
    assert.throws(() => parseHeader('u@example..com', { postel: true }))
  })

  it('rejects an empty local-part under postel', () => {
    assert.throws(() => parseHeader('@example.com', { postel: true }))
  })
})

describe('postel: true — does not break strict-mode tests', () => {
  // Inputs that worked in strict mode must continue to work under
  // postel — postel only adds acceptances, never removes them.
  it('plain mailbox', () => {
    const [a] = parseHeader('Alice <alice@example.com>', { postel: true })
    assert.equal(a.phrase, 'Alice')
    assert.equal(a.address, 'alice@example.com')
  })

  it('quoted display name with comment', () => {
    const [a] = parseHeader('"Alice" <a@x> (Boss)', { postel: true })
    assert.equal(a.phrase, 'Alice')
    assert.equal(a.comment, 'Boss')
  })

  it('groups parse identically under postel', () => {
    const [g] = parseHeader('Friends: a@x, b@y;', { postel: true })
    assert.equal(g.phrase, 'Friends')
    assert.equal(g.addresses.length, 2)
  })

  it('IDN punycodes the host', () => {
    const [a] = parseHeader('<u@δοκιμή.gr>', { postel: true })
    assert.match(a.host, /^xn--/)
    assert.equal(a.is_utf8, true)
  })
})
