import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { Address, parseHeader } from '../index.js'

const elapsedMs = (fn) => {
  const started = process.hrtime.bigint()
  try {
    fn()
  } catch {
    /* rejection is fine; we are checking responsiveness */
  }
  return Number(process.hrtime.bigint() - started) / 1e6
}

// generous bounds for slow CI; the quadratic paths took 10-40s
describe('parseHeader — linear time on hostile input', () => {
  it('a 512KB dotted display name', () => {
    const ms = elapsedMs(() => parseHeader(`${'a.'.repeat(256 * 1024)}<x@example.com>`))
    assert.ok(ms < 1500, `took ${ms.toFixed(0)}ms`)
  })

  it('a 512KB multi-word display name', () => {
    const ms = elapsedMs(() => parseHeader(`${'a '.repeat(256 * 1024)}<x@example.com>`))
    assert.ok(ms < 1500, `took ${ms.toFixed(0)}ms`)
  })

  it('a 512KB quoted-string with folded whitespace', () => {
    const ms = elapsedMs(() => parseHeader(`"x\\${'\rword x@'.repeat(64 * 1024)}`))
    assert.ok(ms < 1500, `took ${ms.toFixed(0)}ms`)
  })

  it('still folds quoted-string FWS to one space', () => {
    const [a] = parseHeader('"a \r\n b\\  \t c" <x@example.com>')
    assert.equal(a.phrase, 'a b c')
  })

  it('a long list under allowCommaInDisplayName', () => {
    const input = `${'a@example.com, '.repeat(20_000)}x`
    const ms = elapsedMs(() => parseHeader(input, { allowCommaInDisplayName: true }))
    assert.ok(ms < 1500, `took ${ms.toFixed(0)}ms`)
  })
})

describe('parseHeader — phrase joining', () => {
  for (const [input, phrase] of [
    ['"" a <x@example.com>', 'a'],
    ['"" "" a <x@example.com>', 'a'],
    ['"" g: a@example.com;', 'g'],
    ['a "" . b <x@example.com>', 'a.b'],
    ['"a " . b <x@example.com>', 'a.b'],
    ['a . "" b <x@example.com>', 'a.b'],
    ['"a  " . b <x@example.com>', 'a .b'],
    ['"" . a <x@example.com>', '.a'],
    ['a . b . c <x@example.com>', 'a.b.c'],
  ]) {
    it(`${JSON.stringify(input)} → ${JSON.stringify(phrase)}`, () => {
      assert.equal(parseHeader(input)[0].phrase, phrase)
    })
  }
})

describe('parseHeader — allowCommaInDisplayName lookahead memo', () => {
  it('still finds a trailing angle-addr after a long comma run', () => {
    const [a] = parseHeader(`Doe, ${'x, '.repeat(500)}John <j@example.com>`, {
      allowCommaInDisplayName: true,
    })
    assert.equal(a.address, 'j@example.com')
  })

  it('treats each list entry independently', () => {
    const r = parseHeader('a@example.com, Doe, John <j@example.com>', {
      allowCommaInDisplayName: true,
    })
    assert.equal(r.length, 1)
    assert.equal(r[0].phrase, 'a@example.com, Doe, John')
  })

  it('a "<" inside a comment does not count', () => {
    const r = parseHeader('a@example.com (x <y), b@example.com', {
      allowCommaInDisplayName: true,
    })
    assert.deepEqual(
      r.map((a) => a.address),
      ['a@example.com', 'b@example.com'],
    )
  })

  it('reuses no stale answer once the angle-addr is consumed', () => {
    const r = parseHeader('Doe, John (j <k) <j@example.com>, a@example.com', {
      allowCommaInDisplayName: true,
    })
    assert.deepEqual(
      r.map((a) => [a.phrase, a.address]),
      [
        ['Doe, John', 'j@example.com'],
        ['', 'a@example.com'],
      ],
    )
  })
})

describe('Group — display-name safety', () => {
  it('rejects CR/LF smuggled into a group phrase via quoted-pair', () => {
    assert.throws(() => parseHeader('"evil\\\r\\\nBcc: x@y" : a@example.com;'), /control character/)
  })

  it('rejects NUL smuggled into a group phrase via quoted-pair', () => {
    assert.throws(() => parseHeader('"a\\\0b" : a@example.com;'), /control character/)
  })

  it('quotes a phrase containing specials so format() re-parses', () => {
    const [g] = parseHeader('"a:b" : x@example.com;')
    assert.equal(g.format(), '"a:b":x@example.com;')
    const [again] = parseHeader(g.format())
    assert.equal(again.phrase, 'a:b')
    assert.equal(again.addresses[0].address, 'x@example.com')
  })

  it('leaves a plain phrase unquoted', () => {
    const [g] = parseHeader('Undisclosed recipients:;')
    assert.equal(g.format(), 'Undisclosed recipients:;')
  })
})

describe('Address#toJSON — group members', () => {
  it('serializes a group member without a circular reference', () => {
    const [g] = parseHeader('Friends: a@example.com, b@example.com;')
    const json = JSON.parse(JSON.stringify(g.addresses[0]))
    assert.deepEqual(json.group, { phrase: 'Friends' })

    const back = new Address(json)
    assert.equal(back.group.phrase, 'Friends')
    assert.equal(back.format(), 'a@example.com')
  })

  it('serializes a whole Group', () => {
    const [g] = parseHeader('Friends: a@example.com;')
    const json = JSON.parse(JSON.stringify(g))
    assert.equal(json.phrase, 'Friends')
    assert.equal(json.addresses[0].user, 'a')
  })
})

describe('parseHeader — domain shape', () => {
  for (const input of ['x@example.com.', 'x@example.com (c) .', 'x@example . ']) {
    it(`rejects trailing "." in ${JSON.stringify(input)}`, () => {
      assert.throws(() => parseHeader(input), /expected domain label after "\."/)
    })
  }

  it('still accepts CFWS between labels (obs-domain)', () => {
    assert.equal(parseHeader('x@example . com')[0].host, 'example.com')
  })

  it('rejects a domain over 255 octets', () => {
    assert.throws(() => parseHeader(`x@${'b.'.repeat(130)}com`), /domain exceeds 255 octets/)
  })

  it('accepts a 255-octet domain', () => {
    const domain = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}`
    assert.equal(domain.length, 255)
    assert.equal(parseHeader(`x@${domain}`)[0].host, domain)
  })
})

describe('IDN — limits apply to the A-label', () => {
  // 63 UTF-8 octets, 70+ in punycode
  const wideULabel = String.fromCodePoint(
    ...Array.from({ length: 21 }, (_, i) => 0x4e00 + ((i * 7919) % 0x5000)),
  )

  it('fixture fits 63 UTF-8 octets', () => {
    assert.equal(Buffer.byteLength(wideULabel, 'utf8'), 63)
  })

  it('envelope rejects a U-label whose A-label exceeds 63 octets', () => {
    assert.throws(() => new Address(`<a@${wideULabel}.example>`), /IDN label exceeds 63 octets/)
  })

  it('header rejects a U-label whose A-label exceeds 63 octets', () => {
    assert.throws(() => parseHeader(`a@${wideULabel}.example`), /IDN label exceeds 63 octets/)
  })

  it('still accepts an ordinary U-label', () => {
    assert.equal(new Address('<a@δοκιμή.gr>').host, 'xn--jxalpdlp.gr')
  })
})
