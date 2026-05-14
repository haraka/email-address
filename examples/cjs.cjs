// CJS consumption — the path Haraka core, plugins, and any existing
// `require()`-based code take today.
//
//   node examples/cjs.cjs

'use strict'

const { Address, Group, parseEnvelope, parseHeader } = require('@haraka/email-address')

const examples = [
  '<user@example.com>',
  'angle-brackets-optional@example.com',
  '<"quoted user"@example.com>',
  '<u@[1.2.3.4]>',
  '<u@[IPv6:2001:db8::1]>',
  '<δοκιμή@παράδειγμα.gr>',
]

for (const input of examples) {
  const a = new Address(input)
  console.log(input)
  console.log('  user          =', a.user)
  console.log('  host          =', a.host)
  if (a.is_utf8) console.log('  is_utf8       = true')
  if (a.original_host && a.original_host !== a.host) {
    console.log('  original_host =', a.original_host)
  }
  console.log('  format()      =', a.format())
  console.log()
}

// `postel: true` accepts malformed `[IPv6:...]` literals and longer paths.
const lax = new Address('<u@[IPv6:1::2::3]>', { postel: true })
console.log('postel mode accepts malformed IPv6:', lax.format())

// `format(true)` renders the punycode (A-label) host.
const idn = new Address('<u@δοκιμή.gr>')
console.log('punycode form:', idn.format(true))

// ---------------------------------------------------------------------
// Header parsing (RFC 5322) — `From:`, `To:`, `Cc:` style values.
// ---------------------------------------------------------------------

console.log('\n--- parseHeader ---')

const headerValue =
  '"Alice Smith" <alice@example.com>, ' +
  'bob@example.com (Bob), ' +
  'Friends: c@example.com, d@example.com;'

for (const entry of parseHeader(headerValue)) {
  if (entry instanceof Group) {
    console.log('group:', entry.phrase, '(' + entry.addresses.length + ' members)')
    for (const m of entry.addresses) console.log('  -', m.address)
  } else {
    console.log('addr :', entry.address, '/ name:', entry.name())
  }
}

console.log('parseEnvelope:', parseEnvelope('<u@example.com>').format())
