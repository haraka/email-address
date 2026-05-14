# Performance Benchmarks

[@haraka/email-address][hea] (referred to as _email-address_ throughout) is benchmarked in the 3 ways it can be used:

1. [Envelope parsing](#envelope-parsing) of SMTP envelope addresses ([RFC 5321][rfc5321]).
2. [Header parsing](#header-parsing) of Email headers ([RFC 5322][rfc5322]).
3. [Validation](#validation) of bare email addresses.

## Summary

| Package                     | Domain     | Implementation                        |   Avg speedup |
| --------------------------- | ---------- | ------------------------------------- | ------------: |
| [address-rfc2821][addr2821] | Envelope   | [nearley][nearley] grammar (PEG-like) | ~44.2× faster |
| [smtp-address-parser][sap]  | Envelope   | [nearley][nearley] grammar (PEG-like) | ~50.0× faster |
| [address-rfc2822][addr2822] | Header     | [email-addresses][eaddr] PEG parser   | ~20.7× faster |
| [nodemailer][nodemailer]    | Header     | hand-rolled tokeniser                 |  ~1.3× faster |
| [@hapi/address][hapi-a]     | Validation | hand-rolled regex + string split      |  ~5.5× faster |

_email-address_ replaces both legacy Haraka packages with a native O(1) recursive descent
parser. The nearley-compiled grammars carry a significant per-parse overhead from the Earley chart algorithm.

## Header Parsing

| Description        | Input                                                 | email-address<br>(ops/s) | address-rfc2822<br>(ops/s) | nodemailer<br>(ops/s) |
| ------------------ | ----------------------------------------------------- | -----------------------: | -------------------------: | --------------------: |
| bare address       | `alice@example.com`                                   |                2,083,663 |                    110,064 |             1,670,244 |
| display name       | `"Alice Smith" <alice@example.com>`                   |                1,364,553 |                     59,261 |             1,238,458 |
| addr + comment     | `Alice Smith <alice@example.com> (via webmail)`       |                1,033,115 |                     53,586 |               835,684 |
| multiple addresses | `alice@example.com, bob@example.com, carol@example.…` |                  640,657 |                     35,594 |               488,982 |
| group syntax       | `Friends: alice@example.com, bob@example.com;`        |                  777,213 |                     34,252 |               424,400 |
| complex header     | `"Alice Smith" <alice@example.com>, "Bob Jones" <bo…` |                  511,202 |                     23,189 |               426,371 |

## Envelope Parsing

- _address-rfc2821_ and _email-address_ also accept the `<Path>` wrapping form used in SMTP commands (`MAIL FROM:<user@example.com>`).
- _smtp-address-parser_ only parses the bare mailbox form.

| Description       | Input                       | email-address<br>(ops/s) | address-rfc2821<br>(ops/s) | smtp-address-parser<br>(ops/s) |
| ----------------- | --------------------------- | -----------------------: | -------------------------: | -----------------------------: |
| simple mailbox    | `user@example.com`          |                4,196,494 |                     63,235 |                         51,890 |
| quoted local-part | `"quoted user"@example.com` |                3,661,707 |                     47,654 |                         43,119 |
| IPv4 literal      | `u@[1.2.3.4]`               |                5,370,089 |                    172,326 |                        155,601 |
| IPv6 literal      | `u@[IPv6:2001:db8::1]`      |                2,028,816 |                     64,909 |                         64,097 |
| Unicode / EAI     | `δοκιμή@παράδειγμα.gr`      |                  735,914 |                     47,191 |                         41,159 |

## Validation

Both _email-address_ and _@hapi/address_ expose a boolean `isValid` / `isEmailValid` API. They differ in scope: _email-address_ validates the full Envelope grammar (quoted local-parts, IP literals);
_@hapi/address_ targets web-form validation and rejects those forms.

| Description       | Input                       | email-address<br>(ops/s) | @hapi/address<br>(ops/s) |
| ----------------- | --------------------------- | -----------------------: | -----------------------: |
| simple mailbox    | `user@example.com`          |                3,492,433 |                1,705,415 |
| quoted local-part | `"quoted user"@example.com` |                3,287,996 |                       ❌ |
| IPv4 literal      | `u@[1.2.3.4]`               |                4,427,195 |                       ❌ |
| Unicode / EAI     | `δοκιμή@παράδειγμα.gr`      |                  691,766 |                  254,975 |
| invalid address   | `notanemail`                |                  214,099 |               18,594,273 |

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
