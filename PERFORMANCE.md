# Performance Benchmarks

[@haraka/email-address][hea] (referred to as _email-address_ throughout) is benchmarked in the 3 ways it can be used:

1. [Envelope parsing](#envelope-parsing) of SMTP envelope addresses ([RFC 5321][rfc5321]).
2. [Header parsing](#header-parsing) of Email headers ([RFC 5322][rfc5322]).
3. [Validation](#validation) of bare email addresses.

## Summary

| Package                     | Domain     | Implementation                        |   Avg speedup |
| --------------------------- | ---------- | ------------------------------------- | ------------: |
| [address-rfc2821][addr2821] | Envelope   | [nearley][nearley] grammar (PEG-like) | ~44.3× faster |
| [smtp-address-parser][sap]  | Envelope   | [nearley][nearley] grammar (PEG-like) | ~50.0× faster |
| [address-rfc2822][addr2822] | Header     | [email-addresses][eaddr] PEG parser   | ~20.5× faster |
| [nodemailer][nodemailer]    | Header     | hand-rolled tokeniser                 |  ~1.3× faster |
| [@hapi/address][hapi-a]     | Validation | hand-rolled regex + string split      |  ~5.5× faster |

_email-address_ replaces both legacy Haraka packages with a native O(1) recursive descent
parser. The nearley-compiled grammars carry a significant per-parse overhead from the Earley chart algorithm.

## Header Parsing

| Description        | Input                                                 | email-address<br>(ops/s) | address-rfc2822<br>(ops/s) | nodemailer<br>(ops/s) |
| ------------------ | ----------------------------------------------------- | -----------------------: | -------------------------: | --------------------: |
| bare address       | `alice@example.com`                                   |                2,030,553 |                    111,377 |             1,672,318 |
| display name       | `"Alice Smith" <alice@example.com>`                   |                1,409,755 |                     59,767 |             1,267,304 |
| addr + comment     | `Alice Smith <alice@example.com> (via webmail)`       |                1,046,365 |                     54,140 |               839,105 |
| multiple addresses | `alice@example.com, bob@example.com, carol@example.…` |                  632,260 |                     35,833 |               492,652 |
| group syntax       | `Friends: alice@example.com, bob@example.com;`        |                  766,134 |                     33,863 |               424,193 |
| complex header     | `"Alice Smith" <alice@example.com>, "Bob Jones" <bo…` |                  502,414 |                     23,444 |               420,862 |

## Envelope Parsing

- _address-rfc2821_ and _email-address_ also accept the `<Path>` wrapping form used in SMTP commands (`MAIL FROM:<user@example.com>`).
- _smtp-address-parser_ only parses the bare mailbox form.

| Description       | Input                       | email-address<br>(ops/s) | address-rfc2821<br>(ops/s) | smtp-address-parser<br>(ops/s) |
| ----------------- | --------------------------- | -----------------------: | -------------------------: | -----------------------------: |
| simple mailbox    | `user@example.com`          |                4,186,918 |                     63,200 |                         51,690 |
| quoted local-part | `"quoted user"@example.com` |                3,774,606 |                     47,461 |                         43,255 |
| IPv4 literal      | `u@[1.2.3.4]`               |                5,360,852 |                    177,787 |                        160,782 |
| IPv6 literal      | `u@[IPv6:2001:db8::1]`      |                1,927,578 |                     65,391 |                         63,855 |
| Unicode / EAI     | `δοκιμή@παράδειγμα.gr`      |                  754,063 |                     47,273 |                         41,800 |

## Validation

Both _email-address_ and _@hapi/address_ expose a boolean `isValid` / `isEmailValid` API. They differ in scope: _email-address_ validates the full Envelope grammar (quoted local-parts, IP literals);
_@hapi/address_ targets web-form validation and rejects those forms.

| Description       | Input                       | email-address<br>(ops/s) | @hapi/address<br>(ops/s) |
| ----------------- | --------------------------- | -----------------------: | -----------------------: |
| simple mailbox    | `user@example.com`          |                3,558,402 |                1,736,320 |
| quoted local-part | `"quoted user"@example.com` |                3,288,753 |                       ❌ |
| IPv4 literal      | `u@[1.2.3.4]`               |                4,430,104 |                       ❌ |
| Unicode / EAI     | `δοκιμή@παράδειγμα.gr`      |                  696,498 |                  257,786 |
| invalid address   | `notanemail`                |                  215,208 |               18,910,741 |

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
