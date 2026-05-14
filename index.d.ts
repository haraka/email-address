export interface EnvelopeParseOptions {
  /**
   * Opt into a more permissive parse: the General-address-literal
   * fallback admits malformed `[IPv6:...]` bodies that the strict
   * RFC-5321 §4.1.3 grammar would reject, and the 256-octet path cap
   * is relaxed to the 998-octet SMTP text-line maximum. Default
   * `false`.
   */
  postel?: boolean
}

export type HeaderStartAt =
  | 'address-list'
  | 'address'
  | 'mailbox-list'
  | 'mailbox'
  | 'group'
  | 'angle-addr'
  | 'from'
  | 'sender'
  | 'reply-to'

export interface HeaderParseOptions {
  /** Which RFC-5322 production to start at. Default `'address-list'`. */
  startAt?: HeaderStartAt
  /** Default `true` — accept `@` inside display names. */
  allowAtInDisplayName?: boolean
  /** Default `false` — reject `,` inside display names. */
  allowCommaInDisplayName?: boolean
  /**
   * Be liberal in what you accept. When `true`, two RFC-5322 §4.4
   * obsolete productions are admitted in addition to the strict
   * grammar:
   *
   *  - **obs-local-part** — multi-word local-parts such as
   *    `"foo"."bar"@x.com` or `"foo".bar@x.com` (quoted-string and
   *    atom words separated by dots).
   *  - **obs-mbox-list** / **obs-addr-list** / **obs-group-list**
   *    null entries — leading commas (`, a@x`), interstitial
   *    commas (`a@x, , b@y`), and runs of commas in groups.
   *
   * Control-character relaxations (obs-NO-WS-CTL, obs-qp with control
   * chars) are **not** admitted — they would re-open header-injection
   * surface. Plainly malformed inputs (`u@.example.com`,
   * `u@x..com`) are also still rejected. Default `false`.
   */
  postel?: boolean
}

export declare class Address {
  user: string
  host: string
  original: string
  original_host?: string
  is_utf8?: boolean

  /** Display name (header parses only; empty string otherwise). */
  phrase: string
  /** Trailing `(…)` comment (header parses only; empty string otherwise). */
  comment: string
  /** Enclosing Group when parsed inside one, else `null`. */
  group: Group | null

  /** `user@host` (using `original_host` so case is preserved). */
  readonly address: string

  constructor(user: string, host: string, options?: EnvelopeParseOptions)
  constructor(email: string, options?: EnvelopeParseOptions)

  parse(addr: string): void

  isNull(): boolean

  /** Canonical form. `<user@host>` for envelopes; `Phrase <user@host> (comment)` for headers. */
  format(use_punycode?: boolean): string

  /** Heuristic personal-name extraction from phrase / comment / addr. */
  name(): string

  toString(): string
}

export declare class Group {
  phrase: string
  addresses: Address[]
  constructor(phrase: string, addresses: Address[])
  format(): string
  name(): string
}

/** Parse an RFC-5321 envelope address (`MAIL FROM:` / `RCPT TO:`). */
export declare function parseEnvelope(input: string, options?: EnvelopeParseOptions): Address

/** Parse an RFC-5322 header value (`From:`, `To:`, `Cc:`, …). */
export declare function parseHeader(
  input: string,
  options?: HeaderParseOptions | HeaderStartAt,
): Array<Address | Group>

/** `parseHeader(input, { startAt: 'from' })`. */
export declare function parseFrom(input: string): Array<Address | Group>

/** `parseHeader(input, { startAt: 'sender' })[0]`. */
export declare function parseSender(input: string): Address

/** `parseHeader(input, { startAt: 'reply-to' })`. */
export declare function parseReplyTo(input: string): Array<Address | Group>

export interface PlainAddressOptions extends EnvelopeParseOptions {
  /** Require the domain to contain at least one dot (i.e. a TLD). Default `false`. */
  requireTLD?: boolean
}

/**
 * Parse a plain `local@domain` address — what you'd validate in a web
 * form. Rejects angle brackets, comments, display names, lists, and
 * groups. Throws on any non-conforming input.
 */
export declare function parseAddress(input: string, options?: PlainAddressOptions): Address

/** Boolean wrapper around `parseAddress` — never throws. */
export declare function isValid(input: unknown, options?: PlainAddressOptions): boolean

// Personal-name helpers ported from address-rfc2822.
export declare function nameCase(s: string): string
export declare function isAllLower(s: string): boolean
export declare function isAllUpper(s: string): boolean
export declare function extractName(phrase: string, address?: string): string
