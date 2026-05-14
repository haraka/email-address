# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/).

### Unreleased

- refactor: CJS mirrors moved from `./index.cjs` + `./lib/*.cjs` to a
  single mirror tree under `./dist/cjs/`. Consumer-side resolution is
  unchanged — the `exports` map still routes `require` to the right
  file. Dropping CJS in a future release is now a one-directory
  delete.

### [3.1.0] - 2026-05-13

- feat: fold in [`address-rfc2822`][addr2822]
- feat: new top-level functions `parseEnvelope`, `parseHeader`,
  `parseFrom`, `parseSender`, `parseReplyTo`
- feat: new `Group` class for RFC-5322 group syntax (`Friends: a@x, b@x;`)
- feat: `Address` gains `phrase`, `comment`, `address`, and `group` fields. Header-parsed instances populate them
- feat: name-handling utilities ported from `address-rfc2822`
- feat: hand-rolled RFC-5322 recursive-descent parser
- Replacements: read the `.address` string property; pass `use_punycode` to `.format()`; for in-place reparse use `new Address(s)`.

### [3.0.1] - 2026-05-13

- convert to ESM

### [3.0.0] - 2026-06-01

- feat: rewrite of [address-rfc2821][addr2821] as a dependency-free O(1) recursive descent parser.
  - inherited test suite, now with 100% code coverage.
  - much faster, especially on long addresses
  - zero dependencies
  - better RFC adherence, across the board
- feat: dual-package, ESM (`index.js`) is canonical, CJS (`index.cjs`) is generated
- feat: a `postel: true` option to permit lax acceptance.
  - raises the 256-octet path limit to the 998-octet SMTP text-line maximum
  - relaxes IPv6 address parsing
- feat: set `is_utf8` when the local-part or the domain contains non-ASCII
- feat: improved IDN encoding using `node:url`'s `domainToASCII` (UTS-46)
- fix: detect non-ASCII at codepoint granularity (regex `u` flag), so
  supplementary-plane characters are no longer matched as two surrogates.

[addr2821]: https://github.com/haraka/node-address-rfc2821
[addr2822]: https://github.com/haraka/node-address-rfc2822
[3.0.0]: https://github.com/haraka/email-address/releases/tag/v3.0.0
[3.0.1]: https://github.com/haraka/email-address/releases/tag/v3.0.1
[4.0.0]: https://github.com/haraka/email-address/releases/tag/v4.0.0
