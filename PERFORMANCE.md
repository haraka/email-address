# Performance Benchmarks

[@haraka/email-address][hea] (referred to as _email-address_ throughout) is benchmarked across the workloads it supports:

1. [Envelope parsing](#envelope-parsing) of SMTP envelope addresses ([RFC 5321][rfc5321]).
2. [Header parsing](#header-parsing) of Email headers ([RFC 5322][rfc5322]).
3. [Validation](#validation) of plain email addresses.

## Summary

| Package                      | Alias        | Domain     | Implementation                        |   Avg speedup |
| ---------------------------- | ------------ | ---------- | ------------------------------------- | ------------: |
| [@haraka/email-address][hea] | `@h/ea`      | All        | recursive descent parser              |      baseline |
| [address-rfc2822][addr2822]  | `rfc2822`    | Header     | [email-addresses][eaddr] PEG parser   | ~19.0× faster |
| [nodemailer][nodemailer]     | `nodemailer` | Header     | hand-rolled tokeniser                 |  ~1.2× faster |
| [address-rfc2821][addr2821]  | `rfc2821`    | Envelope   | [nearley][nearley] grammar (PEG-like) | ~42.6× faster |
| [smtp-address-parser][sap]   | `sap`        | Envelope   | [nearley][nearley] grammar (PEG-like) | ~48.0× faster |
| [email-address-parser][eap]  | `eap`        | Envelope   | hand-rolled split + regex             |  ~0.6× faster |
| [@hapi/address][hapi-a]      | `hapi`       | Validation | hand-rolled regex + string split      |  ~6.5× faster |

- _@h/ea_ replaces both legacy Haraka packages (rfc2821, rfc2822)
- The nearley-compiled grammars carry a significant per-parse overhead from the Earley chart algorithm.
- _eap_ is fast, narrowly scoped and very incomplete

## Header Parsing

| Description        | Input                                                 | @h/ea<br>(ops/s) | rfc2822<br>(ops/s) | nodemailer<br>(ops/s) |
| ------------------ | ----------------------------------------------------- | ---------------: | -----------------: | --------------------: |
| bare address       | `alice@example.com`                                   |        1,815,736 |            109,528 |             1,639,512 |
| display name       | `"Alice Smith" <alice@example.com>`                   |        1,309,169 |             59,465 |             1,347,178 |
| addr + comment     | `Alice Smith <alice@example.com> (via webmail)`       |          960,858 |             53,430 |               894,091 |
| multiple addresses | `alice@example.com, bob@example.com, carol@example.…` |          582,491 |             35,332 |               490,000 |
| group syntax       | `Friends: alice@example.com, bob@example.com;`        |          718,017 |             34,423 |               424,077 |
| complex header     | `"Alice Smith" <alice@example.com>, "Bob Jones" <bo…` |          472,597 |             23,231 |               425,686 |

- _address-rfc2822_ is a thin wrapper around [_email-addresses_][eaddr], they are equivalent for benchmarking purposes.

## Envelope Parsing

- _address-rfc2821_ and _email-address_ also accept the `<Path>` wrapping form used in SMTP commands (`MAIL FROM:<user@example.com>`).
- _smtp-address-parser_ only parses the bare mailbox form.

| Description       | Input                       | @h/ea<br>(ops/s) | rfc2821<br>(ops/s) | sap<br>(ops/s) | eap<br>(ops/s) |
| ----------------- | --------------------------- | ---------------: | -----------------: | -------------: | -------------: |
| simple mailbox    | `user@example.com`          |        3,967,244 |             62,734 |         51,881 |      5,077,516 |
| quoted local-part | `"quoted user"@example.com` |        3,634,799 |             47,548 |         43,509 |      3,670,320 |
| IPv4 literal      | `u@[1.2.3.4]`               |        5,096,104 |            180,044 |        159,295 |      9,344,411 |
| IPv6 literal      | `u@[IPv6:2001:db8::1]`      |        1,957,496 |             66,284 |         64,898 |      5,161,202 |
| Unicode / EAI     | `δοκιμή@παράδειγμα.gr`      |          725,750 |             47,353 |         41,227 |      4,270,600 |

## Validation

Both _email-address_ and _@hapi/address_ expose a boolean `isValid` / `isEmailValid` API. They differ in scope: _email-address_ validates the full Envelope grammar (quoted local-parts, IP literals);
_@hapi/address_ targets web-form validation and rejects those forms.

| Description       | Input                       | @h/ea<br>(ops/s) | hapi<br>(ops/s) |
| ----------------- | --------------------------- | ---------------: | --------------: |
| simple mailbox    | `user@example.com`          |        3,395,509 |       1,649,881 |
| quoted local-part | `"quoted user"@example.com` |        3,195,331 |              ❌ |
| IPv4 literal      | `u@[1.2.3.4]`               |        4,172,331 |              ❌ |
| Unicode / EAI     | `δοκιμή@παράδειγμα.gr`      |          676,437 |         257,923 |
| invalid address   | `notanemail`                |          209,291 |      18,631,515 |

## Environment

| Key      | Value        |
| -------- | ------------ |
| Node.js  | v24.15.0     |
| Platform | darwin arm64 |
| Date     | 2026-06-02   |

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
[eap]: https://github.com/gene-hightower/email-address-parser
