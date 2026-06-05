[![Build Status][ci-img]][ci-url]
[![Coverage Status][cov-img]][cov-url]

# @haraka/email-address

A high-performance zero-dependency email address parser and validator for email addresses in **plain**, SMTP **Envelope** (RFC 5321) and Email **Header** (RFC 5322/6532) formats. Dual-published as ESM and CJS – use it with `import` or `require`.

Defaults to strict RFC adherence but includes a lenient [postel](https://en.wikipedia.org/wiki/Robustness_principle) option for real-world inputs. Best-in-class [O(n)](https://stackoverflow.com/questions/487258/what-is-a-plain-english-explanation-of-big-o-notation) performance ([benchmarks](PERFORMANCE.md)).

```js
parseEnvelope('<from@example.com>') // → Address
parseHeader('"Alice" <a@x>, "Bob" <b@x>') // → Address[]
parseHeader('Friends: a@x, b@x;') // → [Group]
```

The envelope side handles `<>`, `<Postmaster>`, dot-atom and quoted local-parts,
IPv4/IPv6 address literals, and IDN (U-labels → punycode). The header side adds display names, comments (including nested), folding whitespace, group syntax, and the obsolete
productions real-world mail still emits.

## Installation

```sh
npm install @haraka/email-address
```

## Usage

The ESM and CJS entry points both expose an identical `Address` class.

### Envelope

```js
import { Address, parseEnvelope } from '@haraka/email-address'

const addr = parseEnvelope('<user@example.com>')
addr.user // 'user'
addr.host // 'example.com'
addr.address // 'user@example.com'
addr.format() // '<user@example.com>'
addr.isNull() // false

// The class form is preserved for back-compat with v3:
new Address('<user@example.com>').format() // '<user@example.com>'
```

### Header

`parseHeader` accepts the full set of header productions — name-addr,
addr-spec, address-list, and groups. The return is always an array,
mixing `Address` and `Group` instances in document order.

```js
import { parseHeader, parseFrom, Group } from '@haraka/email-address'

const list = parseHeader(
  '"Alice Smith" <alice@example.com>, bob@example.com (Bob), ' +
    'Friends: c@example.com, d@example.com;',
)

for (const entry of list) {
  if (entry instanceof Group) {
    console.log('group:', entry.phrase, entry.addresses.length, 'members')
  } else {
    console.log(entry.phrase, entry.address, entry.name())
  }
}

// Header-shaped shortcuts:
parseFrom('Travis CI <builds@travis-ci.org>') // → Address[]
parseSender('"Anne, PMPM" <info@x.example>') // → Address
parseReplyTo('=?utf-8?Q?Anne?= <info@x.example>') // → Address[]
```

### Plain-address validation (web forms, general-purpose)

When you just need "is this a valid email address" — sign-up forms, contact pages, CSV imports — use `parseAddress` (throws on bad input) or `isValid` (returns a boolean). These reject anything that isn't a bare `local@domain`: angle brackets, comments, display names, address lists, and groups all fail.

```js
import { parseAddress, isValid } from '@haraka/email-address'

isValid('user@example.com') // true
isValid('<user@example.com>') // false  (angle brackets are envelope-only)
isValid('Alice <a@example.com>') // false  (display names are header-only)
isValid('not-an-email') // false

// Strict, RFC-conformant — "user@example" (no TLD) is valid by default:
isValid('user@localhost') // true

// Web-form preset: require a TLD:
isValid('user@localhost', { requireTLD: true }) // false
isValid('user@example.com', { requireTLD: true }) // true

// Throwing variant — returns an Address when valid:
const a = parseAddress('first.last@example.com')
a.user // 'first.last'
a.host // 'example.com'
```

### CJS

```js
const { Address, parseEnvelope, parseHeader, Group } = require('@haraka/email-address')

parseEnvelope('<u@example.com>').format()
parseHeader('"Alice" <a@x>')[0].phrase // 'Alice'
```

Both styles run end-to-end in [`examples/esm.mjs`](examples/esm.mjs) and [`examples/cjs.cjs`](examples/cjs.cjs); each prints parsed fields for the same set of inputs.

For internationalized addresses, the parser preserves the original U-label form and lazily exposes the A-label (punycode) form:

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

| Consumer style                                    | Resolves to          | Notes                                 |
| ------------------------------------------------- | -------------------- | ------------------------------------- |
| `import { Address } from '@haraka/email-address'` | `index.js`           | Native ESM; the canonical source.     |
| `require('@haraka/email-address')`                | `dist/cjs/index.cjs` | Auto-generated CJS mirror tree.       |
| TypeScript                                        | `index.d.ts`         | Same types regardless of entry point. |

## API

### Parsers

| Function                         | Returns                | Description                                                                              |
| -------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| `parseEnvelope(input, opts?)`    | `Address`              | RFC-5321 single envelope address (`MAIL FROM:` / `RCPT TO:`).                            |
| `parseHeader(input, opts?)`      | `(Address \| Group)[]` | RFC-5322 header value. Default `startAt = 'address-list'`.                               |
| `parseFrom(input)`               | `(Address \| Group)[]` | `parseHeader(input, { startAt: 'from' })`.                                               |
| `parseSender(input)`             | `Address`              | `parseHeader(input, { startAt: 'sender' })[0]` — `Sender:` is single-address by grammar. |
| `parseReplyTo(input)`            | `(Address \| Group)[]` | `parseHeader(input, { startAt: 'reply-to' })`.                                           |
| `new Address(envelope, opts?)`   | `Address`              | Back-compat constructor — equivalent to `parseEnvelope`.                                 |
| `new Address(user, host, opts?)` | `Address`              | Build an address from its parts without parsing.                                         |

### Envelope options

| Option   | Type      | Default | Effect                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postel` | `boolean` | `false` | Be liberal in what you accept. When `true`: (1) malformed `[IPv6:…]` bodies that fail the strict §4.1.3 grammar fall back to the General-address-literal path and are accepted as-is; (2) the 256-octet RFC 5321 §4.5.3.1.3 path limit and the 64-octet §4.5.3.1.1 local-part limits are raised to the 998-octet SMTP text-line maximum (§4.5.3.1.6) |

### Header options

| Option                    | Type                                                                                                                        | Default          | Effect                                                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startAt`                 | `'address-list' \| 'from' \| 'sender' \| 'reply-to' \| 'mailbox' \| 'mailbox-list' \| 'group' \| 'angle-addr' \| 'address'` | `'address-list'` | Which RFC-5322 production to start at. Mainly used by the `parseFrom` / `parseSender` / `parseReplyTo` wrappers.                                                                                                                                  |
| `allowAtInDisplayName`    | `boolean`                                                                                                                   | `true`           | Accept `@` inside display names — common in real-world `From:` values like `foo@example <foo@example.com>`.                                                                                                                                       |
| `allowCommaInDisplayName` | `boolean`                                                                                                                   | `false`          | Accept `,` inside display names. Off by default because it breaks the `,`-separated address-list grammar.                                                                                                                                         |
| `postel`                  | `boolean`                                                                                                                   | `false`          | Be liberal in what you accept. Enables two RFC-5322 §4.4 obs-\* productions: **obs-local-part** (multi-word local-parts such as `"foo"."bar"@x.com`) and **obs-mbox-list** null entries (`a@x, , b@y`, leading or interstitial commas in groups). |

### `Address` properties

| Property        | Description                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `user`          | Local-part as written (case preserved, quotes preserved).                                           |
| `host`          | Domain in canonical form: lowercased, U-labels converted to A-labels (punycode).                    |
| `original_host` | Domain as written: case preserved, U-labels preserved.                                              |
| `original`      | The full input string.                                                                              |
| `is_utf8`       | `true` when **either** the local-part or the domain contains non-ASCII (RFC 6531). Unset otherwise. |
| `address`       | `user@host` using `original_host` so case is preserved. Read-only getter.                           |
| `phrase`        | Display name from a header parse. Empty string for envelope-parsed addresses.                       |
| `comment`       | Trailing `(…)` comment from a header parse. Empty string for envelope-parsed addresses.             |
| `group`         | Enclosing `Group` when parsed inside one, else `null`.                                              |

### `Address` methods

| Method                         | Returns                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `isNull()`                     | `true` for the null reverse-path (`<>` / empty input).                                                                                    |
| `format(use_punycode = false)` | Canonical form. Envelope: `<user@host>`. Header: `Phrase <user@host> (Comment)`. With `use_punycode = true`, the punycode `host` is used. |
| `name()`                       | Heuristic personal-name extraction from `phrase` / `comment` / `address`. Returns `''` when nothing usable is found.                      |
| `toString()`                   | Same as `format()`.                                                                                                                       |

### `Group`

`Group` instances appear in `parseHeader` results when the input
contains a group like `Friends: a@x, b@x;`. Each member `Address` has
its `.group` field pointing back at the enclosing `Group`.

| Field / Method | Description                                          |
| -------------- | ---------------------------------------------------- |
| `phrase`       | Group display name.                                  |
| `addresses`    | `Address[]` — group members in document order.       |
| `format()`     | `phrase:addr1,addr2,…;` rendering per RFC 5322 §3.4. |
| `name()`       | Heuristic personal-name extraction from `phrase`.    |

### Name-handling utilities

Ported from `address-rfc2822` for source compatibility:

| Function                          | Description                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `nameCase(s)`                     | Title-case with Mc/O' and Roman-numeral special cases (`level iii support → Level III Support`). |
| `isAllLower(s)` / `isAllUpper(s)` | Case-detection helpers used by `nameCase`.                                                       |
| `extractName(phrase, address?)`   | The heuristic behind `Address.prototype.name()` — exposed for direct use.                        |

## Standards conformance

This parser targets strict conformance to the SMTP envelope grammar by default. The table below tracks each relevant RFC and what the module does about it.

| RFC                                                                       | Subject                                | Status                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [RFC 821][rfc821] / [2821][rfc2821] / [5321][rfc5321]                     | SMTP envelope addresses                | **Conformant.** Recursive-descent parser implementing §4.1.2 (Mailbox, Path, source-route, ADL), §4.1.3 (address literals), and §4.5.3.1 length limits.                                                                                                                                                                         |
| [RFC 5321 §4.1.2][rfc5321]                                                | Local-part (dot-string, quoted)        | **Conformant.** Both forms parsed; case preserved; quoted-pair (`\x`) accepted.                                                                                                                                                                                                                                                 |
| [RFC 5321 §4.1.3][rfc5321]                                                | IPv4 address literal                   | **Conformant.** Strict octet validation (0-255, no leading zeros).                                                                                                                                                                                                                                                              |
| [RFC 5321 §4.1.3][rfc5321]                                                | IPv6 address literal                   | **Conformant (strict).** The `IPv6:` tag is validated against the IPv6-full / IPv6-comp / IPv6v4-full / IPv6v4-comp productions. The `postel: true` option opts back into the lax fallback.                                                                                                                                     |
| [RFC 5321 §4.1.2][rfc5321]                                                | Source routes / ADL                    | **Variance (discarded).** Source routes parse correctly but are silently dropped; only the final mailbox is retained. RFC 5321 deprecates source routes; preserve externally if you need them.                                                                                                                                  |
| [RFC 5321 §4.5.3.1.1][rfc5321]                                            | 64-octet local-part                    | **Conformant.** Bytes counted as UTF-8 octets. `postel: true` raises the cap to 998 octets (the §4.5.3.1.6 SMTP text-line maximum).                                                                                                                                                                                             |
| [RFC 5321 §4.5.3.1.2][rfc5321]                                            | 255-octet domain                       | **Conformant.** Checked before any IDN encoding.                                                                                                                                                                                                                                                                                |
| [RFC 5321 §4.5.3.1.3][rfc5321]                                            | 256-octet Path                         | **Conformant.** Enforced on the input string. `postel: true` raises the cap to 998 octets (the §4.5.3.1.6 SMTP text-line maximum).                                                                                                                                                                                              |
| [RFC 1035 §2.3.4][rfc1035] / [RFC 5321 §4.5.3.1.1][rfc5321]               | 63-octet label                         | **Conformant.** Each sub-domain label is rejected if its UTF-8 length exceeds 63 octets.                                                                                                                                                                                                                                        |
| [RFC 1123 §2.1][rfc1123]                                                  | Labels may start with a digit          | **Conformant.**                                                                                                                                                                                                                                                                                                                 |
| [RFC 3629][rfc3629]                                                       | UTF-8 octet counting                   | **Conformant.** Uses `Buffer.byteLength(..., 'utf8')` everywhere a length is checked.                                                                                                                                                                                                                                           |
| [RFC 5322][rfc5322]                                                       | Message-header address syntax          | **Conformant via `parseHeader`.** Recursive-descent parser for §3.4 (name-addr, addr-spec, group, address-list) with the §4.4 obsolete productions enabled by default (FWS around `@`, dotted display names, `_` in legacy labels, nested comments). Envelope parsing still rejects these — they only apply to the header path. |
| [RFC 6531][rfc6531]                                                       | SMTPUTF8 — internationalized addresses | **Conformant (basic).** Non-ASCII codepoints accepted in both local-part and domain. `is_utf8` is set when **either** side contains non-ASCII. Unicode normalization (NFC) is **not** performed.                                                                                                                                |
| [RFC 5890][rfc5890] / [5891][rfc5891] / [5892][rfc5892] / [UTS-46][uts46] | IDNA2008 / UTS-46                      | **Conformant (via platform).** IDN conversion uses Node's built-in `url.domainToASCII`, which implements UTS-46 (IDNA2008 with transitional rules). Invalid IDN labels throw.                                                                                                                                                   |
| [RFC 5893][rfc5893]                                                       | Bidi (right-to-left) rules             | **Inherited from `domainToASCII`.** Not separately enforced by this module.                                                                                                                                                                                                                                                     |
| [RFC 5198][rfc5198]                                                       | Net-Unicode (NFC)                      | **Variance (not normalized).** The parser preserves the caller-supplied form. Normalize externally if you need bit-identical comparison across encodings.                                                                                                                                                                       |

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
[ci-img]: https://github.com/haraka/email-address/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/haraka/email-address/actions/workflows/ci.yml
[cov-img]: https://codecov.io/github/haraka/email-address/branch/main/graph/badge.svg?token=fbar73t4OV
[cov-url]: https://codecov.io/github/haraka/email-address
