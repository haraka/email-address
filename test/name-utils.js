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
