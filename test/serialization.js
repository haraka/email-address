import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { Address, parseFrom } from '../index.js'

describe('Address#toJSON', () => {
  it('emits only the addr-rfc2821 wire shape for an envelope address', () => {
    const json = JSON.parse(JSON.stringify(new Address('<matt@tnpi.net>')))
    assert.deepEqual(Object.keys(json), ['original', 'original_host', 'host', 'user'])
  })

  it('omits empty header metadata and transient opts', () => {
    const json = JSON.parse(JSON.stringify(new Address('matt', 'tnpi.net')))
    assert.equal('phrase' in json, false)
    assert.equal('comment' in json, false)
    assert.equal('group' in json, false)
    assert.equal('opts' in json, false)
  })

  it('carries is_utf8 when set', () => {
    const json = JSON.parse(JSON.stringify(new Address('user', 'δοκιμή.gr')))
    assert.equal(json.is_utf8, true)
  })

  it('preserves a header display name and re-renders it', () => {
    const addr = parseFrom('John Doe <john@example.com>')[0]
    const json = JSON.parse(JSON.stringify(addr))
    assert.equal(json.phrase, 'John Doe')

    const reparsed = new Address(json)
    assert.equal(reparsed.phrase, 'John Doe')
    assert.equal(reparsed.toString(), 'John Doe <john@example.com>')
  })

  it('preserves a header comment', () => {
    const addr = parseFrom('john@example.com (Johnny)')[0]
    const reparsed = new Address(JSON.parse(JSON.stringify(addr)))
    assert.equal(reparsed.comment, 'Johnny')
    assert.equal(reparsed.toString(), addr.toString())
  })

  it('round-trips a null reverse-path', () => {
    const reparsed = new Address(JSON.parse(JSON.stringify(new Address('<>'))))
    assert.equal(reparsed.isNull(), true)
    assert.equal(reparsed.format(), '<>')
  })
})
