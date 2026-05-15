# Performance Benchmarks

[@haraka/email-address][hea] (referred to as _email-address_ throughout) is benchmarked in the 3 ways it can be used:

1. [Envelope parsing](#envelope-parsing) of SMTP envelope addresses ([RFC 5321][rfc5321]).
2. [Header parsing](#header-parsing) of Email headers ([RFC 5322][rfc5322]).
3. [Validation](#validation) of plain email addresses.

## Summary

| Package                     | Domain     | Implementation                        |   Avg speedup |
| --------------------------- | ---------- | ------------------------------------- | ------------: |
| [address-rfc2821][addr2821] | Envelope   | [nearley][nearley] grammar (PEG-like) | ~43.4× faster |
| [smtp-address-parser][sap]  | Envelope   | [nearley][nearley] grammar (PEG-like) | ~49.3× faster |
| [address-rfc2822][addr2822] | Header     | [email-addresses][eaddr] PEG parser   | ~19.0× faster |
| [nodemailer][nodemailer]    | Header     | hand-rolled tokeniser                 |  ~1.2× faster |
| [@hapi/address][hapi-a]     | Validation | hand-rolled regex + string split      |  ~5.4× faster |

- _email-address_ replaces both legacy Haraka packages with a native O(1) recursive descent parser.
- The nearley-compiled grammars carry a significant per-parse overhead from the Earley chart algorithm.

## Header Parsing

| Description        | Input                                                 | email-address<br>(ops/s) | address-rfc2822<br>(ops/s) | nodemailer<br>(ops/s) |
| ------------------ | ----------------------------------------------------- | -----------------------: | -------------------------: | --------------------: |
| bare address       | `alice@example.com`                                   |                1,868,687 |                    110,140 |             1,677,904 |
| display name       | `"Alice Smith" <alice@example.com>`                   |                1,298,514 |                     59,064 |             1,255,770 |
| addr + comment     | `Alice Smith <alice@example.com> (via webmail)`       |                  961,972 |                     53,827 |               843,135 |
| multiple addresses | `alice@example.com, bob@example.com, carol@example.…` |                  583,700 |                     35,654 |               493,335 |
| group syntax       | `Friends: alice@example.com, bob@example.com;`        |                  712,951 |                     34,285 |               425,097 |
| complex header     | `"Alice Smith" <alice@example.com>, "Bob Jones" <bo…` |                  469,075 |                     23,254 |               422,346 |

- _address-rfc2822_ is a thin wrapper around [_email-addresses_][eaddr], they are equivalent for benchmarking purposes.

## Envelope Parsing

- _address-rfc2821_ and _email-address_ also accept the `<Path>` wrapping form used in SMTP commands (`MAIL FROM:<user@example.com>`).
- _smtp-address-parser_ only parses the bare mailbox form.

| Description       | Input                       | email-address<br>(ops/s) | address-rfc2821<br>(ops/s) | smtp-address-parser<br>(ops/s) |
| ----------------- | --------------------------- | -----------------------: | -------------------------: | -----------------------------: |
| simple mailbox    | `user@example.com`          |                4,036,218 |                     62,922 |                         51,567 |
| quoted local-part | `"quoted user"@example.com` |                3,737,363 |                     47,740 |                         43,402 |
| IPv4 literal      | `u@[1.2.3.4]`               |                5,210,595 |                    181,849 |                        158,594 |
| IPv6 literal      | `u@[IPv6:2001:db8::1]`      |                1,970,906 |                     66,080 |                         63,785 |
| Unicode / EAI     | `δοκιμή@παράδειγμα.gr`      |                  752,995 |                     46,906 |                         41,391 |

## Validation

Both _email-address_ and _@hapi/address_ expose a boolean `isValid` / `isEmailValid` API. They differ in scope: _email-address_ validates the full Envelope grammar (quoted local-parts, IP literals);
_@hapi/address_ targets web-form validation and rejects those forms.

| Description       | Input                       | email-address<br>(ops/s) | @hapi/address<br>(ops/s) |
| ----------------- | --------------------------- | -----------------------: | -----------------------: |
| simple mailbox    | `user@example.com`          |                3,476,407 |                1,680,684 |
| quoted local-part | `"quoted user"@example.com` |                3,239,452 |                       ❌ |
| IPv4 literal      | `u@[1.2.3.4]`               |                4,160,137 |                       ❌ |
| Unicode / EAI     | `δοκιμή@παράδειγμα.gr`      |                  683,385 |                  258,247 |
| invalid address   | `notanemail`                |                  228,414 |               18,798,462 |

## Environment

| Key      | Value        |
| -------- | ------------ |
| Node.js  | v24.15.0     |
| Platform | darwin arm64 |
| Date     | 2026-05-15   |

## Methodology

Each case is measured with a **10,000-iteration warm-up** (JIT stabilisation) followed by
**5 timed trials** of **50,000 iterations** each.
The reported figure is the **best (lowest-elapsed) trial**, expressed as ops/s.

Refresh this page with: `npm run bench`

[hea]: https://github.com/haraka/email-address
[hapi-a]: https://github.com/hapijs/address
[eaddr]: https://github.com/jackbearheart/email-addresses
[addr2821]: https://github.com/haraka/node-address-rfc2821
[addr2822]: https://github.com/haraka/node-address-rfc2822
[nearley]: https://nearley.js.org/
[nodemailer]: https://github.com/nodemailer/nodemailer
[rfc5321]: https://www.rfc-editor.org/rfc/rfc5321
[rfc5322]: https://www.rfc-editor.org/rfc/rfc5322
[sap]: https://github.com/gene-hightower/smtp-address-parser
