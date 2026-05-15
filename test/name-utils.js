import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { isAllLower, isAllUpper, nameCase, extractName } from '../lib/name-utils.js'

describe('isAllLower / isAllUpper', () => {
  it('all-lower ASCII is recognized', () => assert.equal(isAllLower('abcdefg'), true))
  it('mixed-case fails isAllLower', () => assert.equal(isAllLower('AbcDef'), false))
  it('all-upper ASCII is recognized', () => assert.equal(isAllUpper('ABCDEFG'), true))
  it('mixed-case fails isAllUpper', () => assert.equal(isAllUpper('AbcDef'), false))
})

describe('nameCase', () => {
  const cases = [
    ['john doe', 'John Doe'],
    ['JANE SMITH', 'Jane Smith'],
    ['marty mcleod', 'Marty McLeod'],
    ["martin o'malley", "Martin O'Malley"],
    ['level iii support', 'Level III Support'],
  ]
  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      assert.equal(nameCase(input), expected)
    })
  }
})

describe('extractName', () => {
  it('strips encoded-word phrases', () => {
    assert.equal(extractName('=?utf-8?Q?Anne=20Standley?=', ''), '')
  })

  it('reorders "Last, First" → "First Last"', () => {
    assert.equal(extractName('Burke, Stephen', ''), 'Stephen Burke')
  })

  it('strips [bracketed] annotations', () => {
    assert.equal(extractName('Suba Peddada [CONTRACTOR]', ''), 'Suba Peddada')
  })

  it('derives a name from first.last@ local-parts', () => {
    assert.equal(extractName('', 'graham.barr@tiuk.ti.com'), 'Graham Barr')
  })

  it('derives a name from X.400 /G=…/S=… addresses', () => {
    assert.equal(extractName('', '/G=Owen/S=Smith/O=SJ/C=GB/@mhs.example'), 'Owen Smith')
  })

  it('returns empty for purely numeric phrases', () => {
    assert.equal(extractName('123 456 7890', ''), '')
  })
})

describe('extractName — ReDoS resistance', () => {
  // These inputs exercise the regex shapes flagged by CodeQL: a lazy
  // `.*?` encoded-word matcher, a bracket-strip regex with no closer,
  // and the nested-quantifier first.last-local extractor. Each ran in
  // O(n²) before the rewrite; the deterministic helpers keep them
  // linear.
  //
  // Assert *scaling*, not wall-clock: an 8× larger input on a linear
  // routine costs ≈8× the time, a quadratic one ≈64×. A ratio ceiling
  // of 24 passes linear-plus-noise and still trips a real polynomial
  // regression — and, unlike an absolute ms budget, is immune to slow
  // CI runners (the flake this replaces).
  const SMALL = 50_000
  const BIG = SMALL * 8
  const MAX_RATIO = 24

  const minOf = (fn, k = 5) => {
    let best = Infinity
    for (let i = 0; i < k; i++) {
      const start = process.hrtime.bigint()
      fn()
      const ms = Number(process.hrtime.bigint() - start) / 1e6
      if (ms < best) best = ms
    }
    return best
  }

  // `make(n)` returns the [phrase, address] args for size n. Returns
  // the BIG/SMALL time ratio after warming the JIT at both sizes.
  const ratio = (make) => {
    const small = make(SMALL)
    const big = make(BIG)
    extractName(...small)
    extractName(...big)
    const tSmall = minOf(() => extractName(...small))
    const tBig = minOf(() => extractName(...big))
    // floor tiny baselines so sub-millisecond jitter can't blow up the
    // ratio for routines that short-circuit (genuinely sub-linear).
    return tBig / Math.max(tSmall, 0.05)
  }

  const cases = {
    'encoded-word check on "=?a=?a=?…"': (n) => ['=?' + 'a=?'.repeat(n), ''],
    'comment strip on "(((…"': (n) => ['('.repeat(n), ''],
    'bracket strip on "[[[…"': (n) => ['['.repeat(n), ''],
    'local-part fallback on "$$$…@"': (n) => ['', '$'.repeat(n) + '@example.com'],
    'local-part fallback on "$.$.…@"': (n) => ['', '$.'.repeat(n) + '@example.com'],
    'Last-First reorder on "!,!,…"': (n) => ['!,'.repeat(n) + '!', ''],
    'edge-trim on whitespace-only': (n) => ['\t'.repeat(n), ''],
  }

  for (const [name, make] of Object.entries(cases)) {
    it(`stays sub-quadratic: ${name}`, () => {
      const r = ratio(make)
      assert.ok(
        r < MAX_RATIO,
        `${name}: 8× input scaled time ${r.toFixed(1)}× (≥ ${MAX_RATIO}× ⇒ super-linear)`,
      )
    })
  }
})
