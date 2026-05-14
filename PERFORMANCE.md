# Performance Benchmarks

[@haraka/email-address][hea] (referred to as _email-address_ throughout) is benchmarked in the 3 ways it can be used:

1. [Envelope parsing](#envelope-parsing) of SMTP envelope addresses ([RFC 5321][rfc5321]).
2. [Header parsing](#header-parsing) of Email headers ([RFC 5322][rfc5322]).
3. [Validation](#validation) of bare email addresses.

## Summary

| Package                     | Domain     | Implementation                        |   Avg speedup |
| --------------------------- | ---------- | ------------------------------------- | ------------: |
| [address-rfc2821][addr2821] | Envelope   | [nearley][nearley] grammar (PEG-like) | ~44.2× faster |
| [smtp-address-parser][sap]  | Envelope   | [nearley][nearley] grammar (PEG-like) | ~50.1× faster |
| [address-rfc2822][addr2822] | Header     | [email-addresses][eaddr] PEG parser   | ~21.0× faster |
| [nodemailer][nodemailer]    | Header     | hand-rolled tokeniser                 |  ~1.3× faster |
| [@hapi/address][hapi-a]     | Validation | hand-rolled regex + string split      |  ~5.5× faster |

_email-address_ replaces both legacy Haraka packages with a native O(1) recursive descent
parser. The nearley-compiled grammars carry a significant per-parse overhead from the Earley chart algorithm.

## Header Parsing

| Description        | Input                                                 | email-address<br>(ops/s) | address-rfc2822<br>(ops/s) | nodemailer<br>(ops/s) |
| ------------------ | ----------------------------------------------------- | -----------------------: | -------------------------: | --------------------: |
| bare address       | `alice@example.com`                                   |                2,073,459 |                    110,856 |             1,663,499 |
| display name       | `"Alice Smith" <alice@example.com>`                   |                1,438,875 |                     59,792 |             1,253,858 |
| addr + comment     | `Alice Smith <alice@example.com> (via webmail)`       |                1,053,807 |                     53,853 |               841,002 |
| multiple addresses | `alice@example.com, bob@example.com, carol@example.…` |                  653,383 |                     35,519 |               489,308 |
| group syntax       | `Friends: alice@example.com, bob@example.com;`        |                  785,147 |                     34,205 |               420,533 |
| complex header     | `"Alice Smith" <alice@example.com>, "Bob Jones" <bo…` |                  518,599 |                     23,419 |               421,223 |

## Envelope Parsing

- _address-rfc2821_ and _email-address_ also accept the `<Path>` wrapping form used in SMTP commands (`MAIL FROM:<user@example.com>`).
- _smtp-address-parser_ only parses the bare mailbox form.

| Description       | Input                       | email-address<br>(ops/s) | address-rfc2821<br>(ops/s) | smtp-address-parser<br>(ops/s) |
| ----------------- | --------------------------- | -----------------------: | -------------------------: | -----------------------------: |
| simple mailbox    | `user@example.com`          |                4,193,663 |                     63,655 |                         51,379 |
| quoted local-part | `"quoted user"@example.com` |                3,754,200 |                     47,319 |                         43,419 |
| IPv4 literal      | `u@[1.2.3.4]`               |                5,290,725 |                    178,384 |                        158,444 |
| IPv6 literal      | `u@[IPv6:2001:db8::1]`      |                2,048,358 |                     67,006 |                         65,254 |
| Unicode / EAI     | `δοκιμή@παράδειγμα.gr`      |                  729,937 |                     47,678 |                         41,565 |

## Validation

Both _email-address_ and _@hapi/address_ expose a boolean `isValid` / `isEmailValid` API. They differ in scope: _email-address_ validates the full Envelope grammar (quoted local-parts, IP literals);
_@hapi/address_ targets web-form validation and rejects those forms.

| Description       | Input                       | email-address<br>(ops/s) | @hapi/address<br>(ops/s) |
| ----------------- | --------------------------- | -----------------------: | -----------------------: |
| simple mailbox    | `user@example.com`          |                3,498,114 |                1,688,966 |
| quoted local-part | `"quoted user"@example.com` |                3,292,579 |                       ❌ |
| IPv4 literal      | `u@[1.2.3.4]`               |                4,383,898 |                       ❌ |
| Unicode / EAI     | `δοκιμή@παράδειγμα.gr`      |                  679,284 |                  261,651 |
| invalid address   | `notanemail`                |                  211,330 |               19,141,504 |

## Environment

| Key      | Value        |
| -------- | ------------ |
| Node.js  | v24.15.0     |
| Platform | darwin arm64 |
| Date     | 2026-05-14   |

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
