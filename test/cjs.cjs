'use strict'

// Smoke test for the CJS entry point. The full functional suite is
// exercised through the ESM source; this file just guarantees the
// `require('@haraka/email-address')` path resolves and behaves
// identically for Haraka modules that haven't migrated off CJS.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const cjsModule = require('..')

describe('CJS entry point', () => {
  it('exposes Address as a named export', () => {
    assert.equal(typeof cjsModule.Address, 'function')
    assert.equal(cjsModule.Address.name, 'Address')
  })

  it('exposes the same Address on the default export', () => {
    assert.equal(cjsModule.default.Address, cjsModule.Address)
  })

  it('parses a canonical envelope address', () => {
    const a = new cjsModule.Address('<u@example.com>')
    assert.equal(a.user, 'u')
    assert.equal(a.host, 'example.com')
    assert.equal(a.format(), '<u@example.com>')
  })

  it('honours the postel option through CJS', () => {
    const a = new cjsModule.Address('<u@[IPv6:1::2::3]>', { postel: true })
    assert.equal(a.host, '[ipv6:1::2::3]')
    assert.throws(
      () => new cjsModule.Address('<u@[IPv6:1::2::3]>'),
      (err) => err.name !== 'TypeError',
    )
  })

  it('round-trips an IDN through punycode encoding', () => {
    const a = new cjsModule.Address('<u@δοκιμή.gr>')
    assert.equal(a.is_utf8, true)
    assert.match(a.host, /^u?xn--/)
  })

  it('exposes parseHeader, parseFrom, parseSender, parseReplyTo, Group, validator, name-utils', () => {
    for (const k of [
      'parseEnvelope',
      'parseHeader',
      'parseFrom',
      'parseSender',
      'parseReplyTo',
      'parseAddress',
      'isValid',
      'Group',
      'nameCase',
      'isAllLower',
      'isAllUpper',
      'extractName',
    ]) {
      assert.equal(typeof cjsModule[k], 'function', `expected ${k} to be a function`)
    }
  })

  it('every dist/cjs/lib/*.cjs file is requirable on its own', () => {
    // Catches generator regressions that emit syntactically-broken CJS.
    for (const m of [
      'cursor',
      'literals',
      'envelope',
      'header',
      'address',
      'validator',
      'name-utils',
    ]) {
      const mod = require(`../dist/cjs/lib/${m}.cjs`)
      assert.equal(typeof mod, 'object', `dist/cjs/lib/${m}.cjs should export an object`)
      assert.notEqual(Object.keys(mod).length, 0, `dist/cjs/lib/${m}.cjs should have exports`)
    }
  })

  it('plain-address validator works through CJS', () => {
    assert.equal(cjsModule.isValid('user@example.com'), true)
    assert.equal(cjsModule.isValid('not-an-email'), false)
    const a = cjsModule.parseAddress('first.last@example.com')
    assert.equal(a.user, 'first.last')
    assert.equal(a.host, 'example.com')
  })

  it('parseHeader works through CJS', () => {
    const r = cjsModule.parseHeader('"Alice" <a@example.com>, Friends: x@y, z@y;')
    assert.equal(r.length, 2)
    assert.equal(r[0].phrase, 'Alice')
    assert.ok(r[1] instanceof cjsModule.Group)
    assert.equal(r[1].addresses.length, 2)
  })

  it('returns the same Address constructor as the ESM entry point', async () => {
    // Sanity: `require('./index.cjs').Address` and the ESM `import` should
    // refer to constructors that produce indistinguishable instances. We
    // can't compare identity across module systems (Node loads them
    // separately), but both should accept the same inputs and yield the
    // same observable fields.
    const esm = await import('../index.js')
    const fromCjs = new cjsModule.Address('<u@example.com>')
    const fromEsm = new esm.Address('<u@example.com>')
    for (const key of ['user', 'host', 'original']) {
      assert.equal(fromCjs[key], fromEsm[key], `field ${key}`)
    }
  })
})
