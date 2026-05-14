// Behavioural corpus inherited from address-rfc2822 / Mail::Address.
// Each block in `header-corpus.txt` is three lines:
//
//   1. input header value
//   2. expected `.format()`
//   3. expected `.name()`  (optional — empty/missing means we skip)
//
// Lines starting with `#` are skipped (commented-out cases — preserved
// here for fidelity with the upstream corpus).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseHeader, Group } from '../index.js'

const here = dirname(fileURLToPath(import.meta.url))
const raw = readFileSync(join(here, 'header-corpus.txt'), 'utf8')

const blocks = raw
  .split(/\n\n+/)
  .map((block) => block.split('\n').filter((l) => l.length && !l.startsWith('#')))
  .filter((b) => b.length > 0)

describe('header corpus — parseHeader → format() / name()', () => {
  for (const [input, wantFormat, wantName] of blocks) {
    it(input, () => {
      const result = parseHeader(input)
      const first = result[0]
      const got = first instanceof Group ? first : first
      if (wantFormat) assert.equal(got.format(), wantFormat, 'format()')
      if (wantName) assert.equal(got.name(), wantName, 'name()')
    })
  }
})
