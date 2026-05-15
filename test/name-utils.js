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
  // This guards against catastrophic-backtracking regressions, which
  // are an *orders-of-magnitude* effect, not a constant-factor one. At
  // REPS below, the deterministic helpers run in tens of ms; a return
  // to the old O(n²) shapes is ≈10^10 operations — seconds to a hung
  // worker. A single generous wall-clock ceiling cleanly separates the
  // two with ~1000× margin, and (unlike a tight budget or a ratio of
  // two sub-millisecond samples) cannot flake on a slow/loaded CI
  // runner. Earlier revisions tried 100ms then a scaling ratio; both
  // were flaky precisely because linear timings here are tiny and
  // noisy. Don't reintroduce a tight bound.
  const BUDGET_MS = 1500
  const REPS = 100_000

  // Best of a few runs — discards GC/scheduler transients. The bound is
  // so loose this barely matters, but it keeps the signal clean.
  const minMs = (fn, k = 3) => {
    let best = Infinity
    for (let i = 0; i < k; i++) {
      const start = process.hrtime.bigint()
      fn()
      const ms = Number(process.hrtime.bigint() - start) / 1e6
      if (ms < best) best = ms
    }
    return best
  }

  const cases = {
    'encoded-word check on "=?a=?a=?…"': ['=?' + 'a=?'.repeat(REPS), ''],
    'comment strip on "(((…"': ['('.repeat(REPS), ''],
    'bracket strip on "[[[…"': ['['.repeat(REPS), ''],
    'local-part fallback on "$$$…@"': ['', '$'.repeat(REPS) + '@example.com'],
    'local-part fallback on "$.$.…@"': ['', '$.'.repeat(REPS) + '@example.com'],
    'Last-First reorder on "!,!,…"': ['!,'.repeat(REPS) + '!', ''],
    'edge-trim on whitespace-only': ['\t'.repeat(REPS), ''],
  }

  for (const [name, args] of Object.entries(cases)) {
    it(`stays linear: ${name}`, () => {
      extractName(...args) // warm the JIT
      const ms = minMs(() => extractName(...args))
      assert.ok(
        ms < BUDGET_MS,
        `${name}: ${ms.toFixed(1)}ms (≥ ${BUDGET_MS}ms ⇒ catastrophic backtracking)`,
      )
    })
  }
})
