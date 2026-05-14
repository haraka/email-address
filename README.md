[![Build Status][ci-img]][ci-url]
[![Coverage Status][cov-img]][cov-url]

# @haraka/email-address

Parser for RFC-821 / RFC-2821 / RFC-5321 envelope-format email addresses
(Mailbox and Path).

Dual-published as ESM (`import`) and CJS (`require`); pick whichever
matches your codebase.

This module handles the addresses that appear immediately after the SMTP
verbs `MAIL FROM:` and `RCPT TO:`. For example:

```
<>                                  // null reverse-path
<Postmaster>
<from@example.com>
<to@example.com>
<dot.atom.string@example.com>
<"quoted string"@example.com>
<user@[1.2.3.4]>
<user@[IPv6:2001:db8::1]>
angle-brackets-optional@example.com
```

To parse the addresses contained in message headers (`To:`, `From:`, `Cc:`,
…), use an RFC 2822 / 5322 parser such as
[address-rfc2822](https://www.npmjs.com/package/address-rfc2822) or
[email-addresses](https://www.npmjs.com/package/email-addresses).

## Installation

```sh
npm install @haraka/email-address
```

## Usage

The package ships ESM and CJS entry points side-by-side. Both expose an
identical `Address` class.

### ESM

```js
import { Address } from '@haraka/email-address'

const addr = new Address('<user@example.com>')
addr.user // 'user'
addr.host // 'example.com'
addr.format() // '<user@example.com>'
```

A default export is also available — useful for `import addr from
'@haraka/email-address'` style imports in tooling that prefers it:

```js
import emailAddress from '@haraka/email-address'
const addr = new emailAddress.Address('<user@example.com>')
```

### CJS

```js
const { Address } = require('@haraka/email-address')

const addr = new Address('<user@example.com>')
addr.format() // '<user@example.com>'
```

Both forms run end-to-end in [`examples/esm.mjs`](examples/esm.mjs) and
[`examples/cjs.cjs`](examples/cjs.cjs); each one prints parsed fields
for the same set of inputs and is invoked with plain `node`.

For internationalized addresses, the parser preserves the original
U-label form and lazily exposes the A-label (punycode) form:

```js
const addr = new Address('<δοκιμή@παράδειγμα.gr>')
addr.user // 'δοκιμή'
addr.original_host // 'παράδειγμα.gr'
addr.host // 'xn--hxajbheg2az3al.gr'
addr.is_utf8 // true
addr.format(true) // '<δοκιμή@xn--hxajbheg2az3al.gr>'
```

### Module layout

The package's `exports` map resolves to the right file automatically:

| Consumer style                                    | Resolves to  | Notes                                |
| ------------------------------------------------- | ------------ | ------------------------------------ |
| `import { Address } from '@haraka/email-address'` | `index.js`   | Native ESM; the canonical source.    |
| `require('@haraka/email-address')`                | `index.cjs`  | CJS mirror                           |
| TypeScript                                        | `index.d.ts` | Same types regardless of entry point |

## Standards conformance

This parser targets strict conformance to the SMTP envelope grammar by
default. The table below tracks each relevant RFC and what the module does
about it.

| RFC                                                                       | Subject                                | Status                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [RFC 821][rfc821] / [2821][rfc2821] / [5321][rfc5321]                     | SMTP envelope addresses                | **Conformant.** Recursive-descent parser implementing §4.1.2 (Mailbox, Path, source-route, ADL), §4.1.3 (address literals), and §4.5.3.1 length limits.                                          |
| [RFC 5321 §4.1.2][rfc5321]                                                | Local-part (dot-string, quoted)        | **Conformant.** Both forms parsed; case preserved; quoted-pair (`\x`) accepted.                                                                                                                  |
| [RFC 5321 §4.1.3][rfc5321]                                                | IPv4 address literal                   | **Conformant.** Strict octet validation (0-255, no leading zeros).                                                                                                                               |
| [RFC 5321 §4.1.3][rfc5321]                                                | IPv6 address literal                   | **Conformant (strict).** The `IPv6:` tag is validated against the IPv6-full / IPv6-comp / IPv6v4-full / IPv6v4-comp productions. The `postel: true` option opts back into the lax fallback.      |
| [RFC 5321 §4.1.2][rfc5321]                                                | Source routes / ADL                    | **Variance (discarded).** Source routes parse correctly but are silently dropped; only the final mailbox is retained. RFC 5321 deprecates source routes; preserve externally if you need them.   |
| [RFC 5321 §4.5.3.1.1][rfc5321]                                            | 64-octet local-part                    | **Conformant.** Bytes counted as UTF-8 octets.                                                                                                                                                   |
| [RFC 5321 §4.5.3.1.2][rfc5321]                                            | 255-octet domain                       | **Conformant.** Checked before any IDN encoding.                                                                                                                                                 |
| [RFC 5321 §4.5.3.1.3][rfc5321]                                            | 256-octet Path                         | **Conformant.** Enforced on the input string. `postel: true` raises the cap to 998 octets (the §4.5.3.1.6 SMTP text-line maximum).                                                               |
| [RFC 1035 §2.3.4][rfc1035] / [RFC 5321 §4.5.3.1.1][rfc5321]               | 63-octet label                         | **Conformant.** Each sub-domain label is rejected if its UTF-8 length exceeds 63 octets.                                                                                                         |
| [RFC 1123 §2.1][rfc1123]                                                  | Labels may start with a digit          | **Conformant.**                                                                                                                                                                                  |
| [RFC 3629][rfc3629]                                                       | UTF-8 octet counting                   | **Conformant.** Uses `Buffer.byteLength(..., 'utf8')` everywhere a length is checked.                                                                                                            |
| [RFC 5322][rfc5322]                                                       | Message-format syntax                  | **Intentional non-support.** Comments (`(…)`), folding white space, group syntax, and display names are not part of the SMTP envelope and are rejected. Use an RFC-5322 parser for headers.      |
| [RFC 6531][rfc6531]                                                       | SMTPUTF8 — internationalized addresses | **Conformant (basic).** Non-ASCII codepoints accepted in both local-part and domain. `is_utf8` is set when **either** side contains non-ASCII. Unicode normalization (NFC) is **not** performed. |
| [RFC 5890][rfc5890] / [5891][rfc5891] / [5892][rfc5892] / [UTS-46][uts46] | IDNA2008 / UTS-46                      | **Conformant (via platform).** IDN conversion uses Node's built-in `url.domainToASCII`, which implements UTS-46 (IDNA2008 with transitional rules). Invalid IDN labels throw.                    |
| [RFC 5893][rfc5893]                                                       | Bidi (right-to-left) rules             | **Inherited from `domainToASCII`.** Not separately enforced by this module.                                                                                                                      |
| [RFC 5198][rfc5198]                                                       | Net-Unicode (NFC)                      | **Variance (not normalized).** The parser preserves the caller-supplied form. Normalize externally if you need bit-identical comparison across encodings.                                        |

## API

### `new Address(email, options?)`

Parse an SMTP envelope address. Throws if the input is not a valid
RFC-5321 reverse-path / forward-path / Mailbox.

### `new Address(user, host, options?)`

Construct an address from its parts. `host` may contain U-labels; it will
be converted to A-labels for `address.host`.

### `new Address(rehydrated)`

Construct from a plain object that has an `original` key — used to
round-trip an address through `JSON.stringify` / `JSON.parse`.

### Options

| Option   | Type      | Default | Effect                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postel` | `boolean` | `false` | Be liberal in what you accept. When `true`: (1) malformed `[IPv6:…]` bodies that fail the strict §4.1.3 grammar fall back to the General-address-literal path and are accepted as-is; (2) the 256-octet RFC 5321 §4.5.3.1.3 path limit is raised to the 998-octet SMTP text-line maximum (§4.5.3.1.6), so longer real-world reverse/forward paths still parse. This switch may govern other lenient behaviours in the future. |

### Properties

| Property        | Description                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `user`          | Local-part as written (case preserved, quotes preserved).                                           |
| `host`          | Domain in canonical form: lowercased, U-labels converted to A-labels (punycode).                    |
| `original_host` | Domain as written: case preserved, U-labels preserved.                                              |
| `original`      | The full input string.                                                                              |
| `is_utf8`       | `true` when **either** the local-part or the domain contains non-ASCII (RFC 6531). Unset otherwise. |

### Methods

| Method                                      | Returns                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `isNull()`                                  | `true` for the null reverse-path (`<>` / empty input).                                                             |
| `format(use_punycode = false)`              | Canonical `<user@host>` form. With `use_punycode = true`, the punycode `host` is used in place of `original_host`. |
| `address(set = null, use_punycode = false)` | `user@host` form (no angle brackets). Passing a string to `set` re-parses the instance in place.                   |
| `toString()`                                | Same as `format()`.                                                                                                |

## License

MIT.

[rfc821]: https://www.rfc-editor.org/rfc/rfc821
[rfc1035]: https://www.rfc-editor.org/rfc/rfc1035
[rfc1123]: https://www.rfc-editor.org/rfc/rfc1123
[rfc2821]: https://www.rfc-editor.org/rfc/rfc2821
[rfc3629]: https://www.rfc-editor.org/rfc/rfc3629
[rfc5198]: https://www.rfc-editor.org/rfc/rfc5198
[rfc5321]: https://www.rfc-editor.org/rfc/rfc5321
[rfc5322]: https://www.rfc-editor.org/rfc/rfc5322
[rfc5890]: https://www.rfc-editor.org/rfc/rfc5890
[rfc5891]: https://www.rfc-editor.org/rfc/rfc5891
[rfc5892]: https://www.rfc-editor.org/rfc/rfc5892
[rfc5893]: https://www.rfc-editor.org/rfc/rfc5893
[rfc6531]: https://www.rfc-editor.org/rfc/rfc6531
[uts46]: https://www.unicode.org/reports/tr46/
[ci-img]: https://github.com/haraka/node-address-rfc2821/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/haraka/node-address-rfc2821/actions/workflows/ci.yml
[cov-img]: https://codecov.io/github/haraka/node-address-rfc2821/coverage.svg?branch=master
[cov-url]: https://codecov.io/github/haraka/node-address-rfc2821?branch=master
