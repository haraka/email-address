# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/).

### Unreleased

### [3.0.1] - 2026-05-13

- convert to ESM

### [3.0.0] - 2026-06-01

- feat: rewrite of [address-rfc2821][addr2821] as a dependency-free O(1) recursive descent parser.
  - inherited test suite, now with 100% code coverage.
  - much faster, especially on long addresses
  - zero dependencies
  - better RFC adherence, across the board
- feat: dual-package layout, ESM (`index.js`) is canonical, CJS (`index.cjs`) is auto-generated
- feat: a `postel: true` option to permit lax acceptance.
  - raises the 256-octet path limit to the 998-octet SMTP text-line maximum
  - relaxes IPv6 address parsing
- feat: set `is_utf8` when the local-part or the domain contains non-ASCII
- feat: improved IDN encoding using `node:url`'s `domainToASCII` (UTS-46)
- fix: detect non-ASCII at codepoint granularity (regex `u` flag), so
  supplementary-plane characters are no longer matched as two surrogates.

[addr2821]: https://github.com/haraka/node-address-rfc2821

[3.0.0]: https://github.com/haraka/email-address/releases/tag/v3.0.0
[3.0.1]: https://github.com/haraka/email-address/releases/tag/v3.0.1

