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
  // linear. Generous (100ms) thresholds keep CI quiet on slow runners
  // while still catching a real polynomial regression.
  const BUDGET_MS = 100
  const REPS = 50_000

  function timed(fn) {
    const start = process.hrtime.bigint()
    fn()
    return Number(process.hrtime.bigint() - start) / 1e6
  }

  it('encoded-word check stays linear on pathological "=?a=?a=?…" input', () => {
    const input = '=?' + 'a=?'.repeat(REPS)
    const ms = timed(() => extractName(input, ''))
    assert.ok(ms < BUDGET_MS, `encoded-word check on ${input.length} chars took ${ms.toFixed(1)}ms`)
  })

  it('comment strip stays linear on unbalanced "(((…" input', () => {
    const input = '('.repeat(REPS)
    const ms = timed(() => extractName(input, ''))
    assert.ok(ms < BUDGET_MS, `comment strip on ${input.length} chars took ${ms.toFixed(1)}ms`)
  })

  it('bracket strip stays linear on unbalanced "[[[…" input', () => {
    const input = '['.repeat(REPS)
    const ms = timed(() => extractName(input, ''))
    assert.ok(ms < BUDGET_MS, `bracket strip on ${input.length} chars took ${ms.toFixed(1)}ms`)
  })

  it('local-part fallback stays linear on "$$$$…@…" addresses', () => {
    const address = '$'.repeat(REPS) + '@example.com'
    const ms = timed(() => extractName('', address))
    assert.ok(
      ms < BUDGET_MS,
      `local-part fallback on ${address.length} chars took ${ms.toFixed(1)}ms`,
    )
  })

  it('local-part fallback stays linear on "$.$.$.…@…" addresses', () => {
    const address = '$.'.repeat(REPS) + '@example.com'
    const ms = timed(() => extractName('', address))
    assert.ok(
      ms < BUDGET_MS,
      `dotted local-part fallback on ${address.length} chars took ${ms.toFixed(1)}ms`,
    )
  })
})
