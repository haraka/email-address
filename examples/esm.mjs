// ESM consumption — modern Node.js, bundlers, or any `"type": "module"` package.
//
//   node examples/esm.mjs
//
// You can pick named or default imports; both resolve to the same class.

import { Address } from '@haraka/email-address'
// Equivalent: `import addressModule from '@haraka/email-address'`
//             then `new addressModule.Address(...)`.

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
