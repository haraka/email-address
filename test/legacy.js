import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { Address, asLegacy, unwrapLegacy, parse, parseHeader } from '../index.js'

describe('SUNSET 2027: parse alias', () => {
  it('is the same function as parseHeader', () => {
    assert.equal(parse, parseHeader)
  })

  it('parses a header value like parseHeader', () => {
    const got = parse('John Doe <john@Example.com>')
    assert.equal(got[0].address, 'john@Example.com')
  })
})

describe('SUNSET 2027: asLegacy wrapper', () => {
  it('leaves the canonical Address API untouched', () => {
    const a = new Address('<Foo@Example.com>')
    assert.equal(typeof a.host, 'string')
    assert.equal(a.host, 'example.com')
    assert.equal(a.address, 'Foo@Example.com')
  })

  it('host/address read as the string in string contexts', () => {
    const w = asLegacy(new Address('<Foo@Example.com>'))
    assert.equal(String(w.host), 'example.com')
    assert.equal(`${w.host}`, 'example.com')
    assert.equal(w.host == 'example.com', true) // loose eq via toPrimitive
    assert.equal(w.host.toUpperCase(), 'EXAMPLE.COM')
    assert.equal(w.address.split('@')[0], 'Foo')
    assert.equal(w.address.length, 'Foo@Example.com'.length)
  })

  it('host/address are also callable (legacy method form)', () => {
    const w = asLegacy(new Address('<Foo@Example.com>'))
    assert.equal(w.host(), 'example.com')
    assert.equal(w.address(), 'Foo@Example.com')
  })

  it('documented caveat: wrapped fields are not primitives', () => {
    const w = asLegacy(new Address('<a@b.com>'))
    assert.equal(typeof w.host, 'function')
    assert.equal(w.host === 'b.com', false)
  })

  it('passes every other member straight through', () => {
    const w = asLegacy(new Address('<Foo@Example.com>'))
    assert.equal(w.user, 'Foo')
    assert.equal(w.original_host, 'Example.com')
    assert.equal(w.isNull(), false)
    assert.equal(w.format(), '<Foo@Example.com>')
    assert.equal(w.toString(), '<Foo@Example.com>')
    assert.ok(w instanceof Address)
  })

  it('null reverse-path stays callable', () => {
    const w = asLegacy(new Address('<>'))
    assert.equal(w.isNull(), true)
    assert.equal(w.address(), '')
    assert.equal(String(w.address), '')
  })

  it('survives the JSON serialize / rehydrate round-trip', () => {
    const w = asLegacy(new Address('<Foo@Example.com>'))
    const round = new Address(JSON.parse(JSON.stringify(w)))
    assert.equal(round.host, 'example.com') // primitive again after rehydrate
    assert.equal(round.address, 'Foo@Example.com')
    assert.equal(typeof round.host, 'string')
  })

  it('returns non-objects unchanged', () => {
    assert.equal(asLegacy(null), null)
    assert.equal(asLegacy(undefined), undefined)
    assert.equal(asLegacy('x@y.com'), 'x@y.com')
  })

  it('is idempotent — never double-wraps', () => {
    const w = asLegacy(new Address('<a@b.com>'))
    assert.equal(asLegacy(w), w)
  })

  it('unwrapLegacy recovers the raw Address with primitive fields', () => {
    const w = asLegacy(new Address('<Foo@Example.com>'))
    const raw = unwrapLegacy(w)
    assert.equal(typeof raw.host, 'string')
    assert.equal(raw.host, 'example.com')
    // re-hydrating from the raw form keeps primitives intact
    const round = new Address(JSON.parse(JSON.stringify(raw)))
    assert.equal(round.host, 'example.com')
  })

  it('unwrapLegacy passes plain Addresses / non-objects through', () => {
    const a = new Address('<a@b.com>')
    assert.equal(unwrapLegacy(a), a)
    assert.equal(unwrapLegacy(null), null)
  })

  it('re-hydrating from a proxy yields primitive fields', () => {
    const a = new Address('<foo@example.com>')
    const w = asLegacy(a)
    assert.equal(typeof w.host, 'function')

    const a2 = new Address(w)
    assert.equal(typeof a2.host, 'string')
    assert.equal(a2.host, 'example.com')
  })

  it('legacy fields are string-like only (no leaked Function surface)', () => {
    const w = asLegacy(new Address('<foo@example.com>'))
    // contract is "a string that is also a zero-arg callable" — it must
    // not expose Function.prototype (.call/.bind) or poisoned .caller.
    assert.equal(w.host(), 'example.com')
    assert.equal(w.host.call, undefined)
    assert.equal(w.host.bind, undefined)
    assert.equal(w.host.caller, undefined)
  })

  it('asLegacy does not inject properties into non-Address objects', () => {
    const obj = { foo: 'bar' }
    const w = asLegacy(obj)
    assert.equal(w.foo, 'bar')
    assert.equal(w.address, undefined)
    assert.equal(w.host, undefined)
    assert.equal('address' in w, false)
  })

  it('asLegacy still binds methods on non-Address objects', () => {
    const obj = {
      val: 42,
      getVal() {
        return this.val
      },
    }
    const w = asLegacy(obj)
    const getVal = w.getVal
    assert.equal(getVal(), 42) // should be bound to obj
  })

  it('legacy fields still behave like strings', () => {
    const w = asLegacy(new Address('<foo@example.com>'))
    assert.equal(w.host.length, 11)
    assert.equal(w.host.toUpperCase(), 'EXAMPLE.COM')
    assert.equal(w.host + '!', 'example.com!')
    assert.equal(JSON.stringify(w.host), '"example.com"')
  })
})
