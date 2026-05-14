// Personal-name helpers used by `parseHeader` callers that want a
// best-effort human-readable name out of a `From:` / `To:` address.
// These are heuristics, not RFC machinery — they originated as a port
// of perl's Mail::Address from the upstream address-rfc2822 package
// and are preserved here for source compatibility.

function isAllLower(s) {
  return s === s.toLowerCase()
}

function isAllUpper(s) {
  return s === s.toUpperCase()
}

// Title-case a string, with special-cases for "Mc…", "O'…" prefixes
// and a Roman-numeral pass so "level iii support" → "Level III Support".
function nameCase(s) {
  return s
    .toLowerCase()
    .replace(/\b(\w+)/g, (_, d1) => d1.charAt(0).toUpperCase() + d1.slice(1))
    .replace(/\bMc(\w)/gi, (_, d1) => `Mc${d1.toUpperCase()}`)
    .replace(/\bo'(\w)/gi, (_, d1) => `O'${d1.toUpperCase()}`)
    .replace(/\b(x*(ix)?v*(iv)?i*)\b/gi, (_, d1) => d1.toUpperCase())
}

// Strip every `<open>…<close>` pair from `s` — used for both the
// `(comment)` and `[bracketed]` strips.
function stripBracketed(s, open, close) {
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s[i] === open) {
      const end = s.indexOf(close, i + 1)
      if (end === -1) break // no closer — drop the rest, matching the regex
      i = end + 1
    } else {
      out += s[i]
      i += 1
    }
  }
  return out
}

// Detect an encoded-word phrase (`=?charset?encoding?text?=`). We only
// need to know whether the marker sequence `=?` is followed somewhere
// by a closing `?=` — semantics match the original `/=\?.*?\?=/`
// test
function containsEncodedWord(s) {
  const start = s.indexOf('=?')
  if (start === -1) return false
  return s.indexOf('?=', start + 2) !== -1
}

// Test whether `localPart` matches `^chunk(sep chunk)+$`, where chunk
// is 1+ chars from `[^%.@_]` and sep is one of `.` or `_`. An
// imperative scan keeps the test linear regardless of input shape
function hasMultiPartLocal(localPart) {
  if (!localPart) return false
  const isSep = (ch) => ch === '.' || ch === '_'
  const isChunkChar = (ch) => ch !== '%' && ch !== '.' && ch !== '@' && ch !== '_'

  let i = 0
  while (i < localPart.length && isChunkChar(localPart[i])) i += 1
  if (i === 0) return false // no leading chunk
  let separators = 0
  while (i < localPart.length) {
    if (!isSep(localPart[i])) return false
    i += 1
    const chunkStart = i
    while (i < localPart.length && isChunkChar(localPart[i])) i += 1
    if (i === chunkStart) return false // separator with nothing after it
    separators += 1
  }
  return separators > 0
}

// Pull a human name out of an address's `phrase` / `comment` (and, as a
// last resort, the local-part of the address itself). Returns '' when
// the heuristic finds nothing usable.
function extractName(phrase, address = '') {
  let name = phrase || ''

  // Encoded-word phrases (`=?UTF-8?Q?…?=`) are too brittle to decode
  // here — give up rather than emit garbage.
  if (containsEncodedWord(name)) return ''

  // trim & condense whitespace
  name = name.trim().replace(/\s+/g, ' ')

  // Disregard purely numeric names (e.g. CompuServe 12345.6789 ids)
  if (/^[\d ]+$/.test(name)) return ''

  // strip outermost parens / quotes
  if (name.startsWith('(') && name.endsWith(')')) name = name.slice(1, -1)
  if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1)

  // remove embedded comments, then unescape
  name = stripBracketed(name, '(', ')').replace(/\\/g, '')

  if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1)

  name = name
    .replace(/^([^\s]+) ?, ?(.*)$/, '$2 $1') // "Last, First" → "First Last"
    .replace(/,.*/, '')

  if (isAllUpper(name) || isAllLower(name)) name = nameCase(name)

  name = stripBracketed(name, '[', ']')
    .replace(/(^[\s'"]+|[\s'"]+$)/g, '') // trim quotes/spaces again
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (name) return name

  // Fall back: extract a name from a `first.last@…` style segment.
  // The address may have several `@` / `%` separators (e.g. the
  // X.400-style `jrh%cup.portal.com@host`); we try each segment
  // bounded by them — left to right, matching the original leftmost-
  // first regex semantics — and return on the first segment that has
  // the chunk(sep chunk)+ shape.
  const segments = []
  let segStart = 0
  for (let i = 0; i < address.length; i += 1) {
    const ch = address[i]
    if (ch === '@' || ch === '%') {
      segments.push(address.slice(segStart, i))
      segStart = i + 1
    }
  }
  for (const segment of segments) {
    if (!hasMultiPartLocal(segment)) continue
    let candidate = segment.replace(/[._]+/g, ' ').trim()
    if (isAllUpper(candidate) || isAllLower(candidate)) candidate = nameCase(candidate)
    return candidate
  }

  // X.400 style /G=Given/S=Surname/…
  if (/\/g=/i.test(address)) {
    const g = /\/g=([^/]*)/i.exec(address)?.[1] || ''
    const s = /\/s=([^/]*)/i.exec(address)?.[1] || ''
    const joined = `${g} ${s}`.trim()
    if (joined) return isAllUpper(joined) || isAllLower(joined) ? nameCase(joined) : joined
  }

  return ''
}

export { isAllLower, isAllUpper, nameCase, extractName }
