interface AddressOptions {
  /**
   * Opt into a more permissive parse: the General-address-literal
   * fallback admits malformed `[IPv6:...]` bodies that the strict
   * RFC-5321 §4.1.3 grammar would reject. Default `false`.
   */
  postel?: boolean
}

declare class Address {
  user: string
  host: string
  original: string
  original_host?: string
  is_utf8?: boolean

  constructor(user: string, host: string, options?: AddressOptions)
  constructor(email: string, options?: AddressOptions)

  parse(addr: string): void

  isNull(): boolean

  format(use_punycode?: boolean): string

  address(set?: string | null, use_punycode?: boolean): string

  toString(): string
}

export { Address, AddressOptions }
