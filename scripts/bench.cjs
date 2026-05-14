#!/usr/bin/env node
'use strict'

/**
 * scripts/bench.cjs — Performance comparison:
 *   address-rfc2821      vs  email-address  (envelope / RFC-5321)
 *   smtp-address-parser  vs  email-address  (envelope / RFC-5321)
 *   address-rfc2822      vs  email-address  (header   / RFC-5322)
 *   nodemailer           vs  email-address  (header   / RFC-5322)
 *   @hapi/address        vs  email-address  (validation / isValid)
 *
 * Run standalone:   'npm run bench'   (from the email-address package root)
 * Import:           const { runBenchmarks } = require('./scripts/bench.cjs')
 *
 * Note: @hapi/address requires a CJS build. If ../../../address/dist/index.js is missing, run:
 *   cd ../../../address && npx tsc --outDir dist --module commonjs --moduleResolution node
 */

const { performance } = require('node:perf_hooks')
const os = require('node:os')
const fs = require('node:fs')
const path = require('node:path')

const rfc2821 = require('../../address-rfc2821/index.js')
const rfc2822 = require('../../address-rfc2822/index.js')
const sap = require('../../../smtp-address-parser/dist/lib/index.js')
const nodemailer = require('../../../nodemailer/lib/addressparser/index.js')
const ea = require('../dist/cjs/index.cjs')

let hapi
try {
  hapi = require('../../../address/dist/index.js')
} catch {
  console.warn(
    'Warning: @hapi/address CJS build not found. Skipping validation section.\n' +
      '  To include it: cd ../../../address && npx tsc --outDir dist --module commonjs --moduleResolution node\n',
  )
}

// ---------------------------------------------------------------------------
// Micro-benchmark harness
// ---------------------------------------------------------------------------

const WARMUP = 10_000
const ITERATIONS = 50_000
const ROUNDS = 5

/**
 * Measure the throughput of `fn` in operations per second.
 * Runs `WARMUP` iterations first (JIT warm-up), then `ROUNDS` timed trials
 * of `ITERATIONS` each and returns the best (fastest) run.
 *
 * @param {Function} fn - Zero-argument function to benchmark.
 * @returns {number} ops/s (best-of-N rounds)
 */
function measure(fn) {
  for (let i = 0; i < WARMUP; i++) fn()

  let bestMs = Infinity
  for (let r = 0; r < ROUNDS; r++) {
    const t0 = performance.now()
    for (let i = 0; i < ITERATIONS; i++) fn()
    const elapsed = performance.now() - t0
    if (elapsed < bestMs) bestMs = elapsed
  }

  return Math.round((ITERATIONS / bestMs) * 1_000)
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// All inputs are bare mailbox form (no angle brackets) so that all three
// envelope parsers can handle them. address-rfc2821 and email-address
// additionally support the <Path> wrapping form used in SMTP commands.
const ENVELOPE_CASES = [
  { label: 'simple mailbox', input: 'user@example.com' },
  { label: 'quoted local-part', input: '"quoted user"@example.com' },
  { label: 'IPv4 literal', input: 'u@[1.2.3.4]' },
  { label: 'IPv6 literal', input: 'u@[IPv6:2001:db8::1]' },
  { label: 'Unicode / EAI', input: 'δοκιμή@παράδειγμα.gr' },
]

const HEADER_CASES = [
  { label: 'bare address', input: 'alice@example.com' },
  { label: 'display name', input: '"Alice Smith" <alice@example.com>' },
  { label: 'addr + comment', input: 'Alice Smith <alice@example.com> (via webmail)' },
  { label: 'multiple addresses', input: 'alice@example.com, bob@example.com, carol@example.com' },
  { label: 'group syntax', input: 'Friends: alice@example.com, bob@example.com;' },
  {
    label: 'complex header',
    input: '"Alice Smith" <alice@example.com>, "Bob Jones" <bob@example.com>, carol@example.com',
  },
]

// Validation cases: a mix of inputs both validators agree on plus inputs where
// they diverge (email-address follows full RFC 5321 grammar; @hapi/address
// targets web-form validation and rejects quoted local-parts and IP literals).
const VALIDATION_CASES = [
  { label: 'simple mailbox', input: 'user@example.com' },
  { label: 'quoted local-part', input: '"quoted user"@example.com' },
  { label: 'IPv4 literal', input: 'u@[1.2.3.4]' },
  { label: 'Unicode / EAI', input: 'δοκιμή@παράδειγμα.gr' },
  { label: 'invalid address', input: 'notanemail' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** How many times faster `next` is vs `prev` (e.g. "20.4×"). */
function multiplier(next, prev) {
  return (next / prev).toFixed(1)
}

function fmtOps(n) {
  if (n === 0) return 'N/A'
  return n.toLocaleString('en-US')
}

function safeMeasure(fn) {
  try {
    return measure(fn)
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Main benchmark runner
// ---------------------------------------------------------------------------

/**
 * Run all benchmarks and return structured results.
 *
 * @returns {{
 *   env: { node: string, platform: string, date: string },
 *   envelope:   Array<{label: string, input: string, rfc2821: number, sapOps: number, emailAddress: number}>,
 *   header:     Array<{label: string, input: string, rfc2822: number, nodemailer: number, emailAddress: number}>,
 *   validation: Array<{label: string, input: string, emailAddress: number, hapi: number, eaResult: boolean, hapiResult: boolean}>,
 * }}
 */
function runBenchmarks() {
  const env = {
    node: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    date: new Date().toISOString().slice(0, 10),
  }

  console.log()
  console.log(`Node ${env.node}  |  ${env.platform}  |  ${env.date}`)
  console.log()

  // ── Envelope (RFC-5321) ──────────────────────────────────────────────────
  console.log('Envelope address parsing  (RFC 5321)')
  console.log('─'.repeat(90))
  console.log(
    `${'Case'.padEnd(22)} ${'address-rfc2821'.padStart(16)} ${'smtp-address-parser'.padStart(21)} ${'email-address'.padStart(22)} ${'Δ'.padStart(6)}`,
  )
  console.log('─'.repeat(90))

  const envelopeResults = []
  for (const { label, input } of ENVELOPE_CASES) {
    process.stdout.write(`  ${label.padEnd(20)}`)

    const r2821 = safeMeasure(() => new rfc2821.Address(input))
    const sapOps = safeMeasure(() => sap.parse(input))
    const eaOps = safeMeasure(() => new ea.Address(input))
    const mult = r2821 > 0 ? `${multiplier(eaOps, r2821)}×` : 'n/a'

    envelopeResults.push({ label, input, rfc2821: r2821, sapOps, emailAddress: eaOps })
    console.log(
      `${fmtOps(r2821).padStart(16)} ${fmtOps(sapOps).padStart(21)} ${fmtOps(eaOps).padStart(22)} ${mult.padStart(6)}`,
    )
  }

  // ── Header (RFC-5322) ────────────────────────────────────────────────────
  console.log()
  console.log('Header address parsing  (RFC 5322)')
  console.log('─'.repeat(95))
  console.log(
    `${'Case'.padEnd(22)} ${'address-rfc2822'.padStart(16)} ${'nodemailer'.padStart(14)} ${'email-address'.padStart(22)} ${'Δ (vs rfc2822)'.padStart(14)}`,
  )
  console.log('─'.repeat(95))

  const headerResults = []
  for (const { label, input } of HEADER_CASES) {
    process.stdout.write(`  ${label.padEnd(20)}`)

    const r2822 = safeMeasure(() => rfc2822.parse(input))
    const nmOps = safeMeasure(() => nodemailer(input))
    const eaOps = safeMeasure(() => ea.parseHeader(input))
    const mult = r2822 > 0 ? `${multiplier(eaOps, r2822)}×` : 'n/a'

    headerResults.push({ label, input, rfc2822: r2822, nodemailer: nmOps, emailAddress: eaOps })
    console.log(
      `${fmtOps(r2822).padStart(16)} ${fmtOps(nmOps).padStart(14)} ${fmtOps(eaOps).padStart(22)} ${mult.padStart(14)}`,
    )
  }

  console.log()

  // ── Validation ──────────────────────────────────────────────────────────
  const validationResults = []
  if (hapi) {
    console.log('Email address validation  (isValid)')
    console.log('─'.repeat(80))
    console.log(
      `${'Case'.padEnd(22)} ${'email-address'.padStart(16)} ${'@hapi/address'.padStart(16)} ${'Δ'.padStart(6)}`,
    )
    console.log('─'.repeat(80))

    for (const { label, input } of VALIDATION_CASES) {
      process.stdout.write(`  ${label.padEnd(20)}`)

      const eaOps = safeMeasure(() => ea.isValid(input))
      const hapiOps = safeMeasure(() => hapi.isEmailValid(input))
      const mult = hapiOps > 0 ? `${multiplier(eaOps, hapiOps)}×` : 'n/a'
      const eaResult = ea.isValid(input)
      const hapiResult = hapi.isEmailValid(input)

      validationResults.push({
        label,
        input,
        emailAddress: eaOps,
        hapi: hapiOps,
        eaResult,
        hapiResult,
      })
      console.log(
        `${fmtOps(eaOps).padStart(16)} ${fmtOps(hapiOps).padStart(16)} ${mult.padStart(6)}`,
      )
    }
    console.log()
  }

  return { env, envelope: envelopeResults, header: headerResults, validation: validationResults }
}

// ---------------------------------------------------------------------------
// Markdown generator
// ---------------------------------------------------------------------------

/**
 * Render benchmark results as a Markdown document.
 *
 * @param {ReturnType<runBenchmarks>} results
 * @returns {string}
 */
function generateMarkdown(results) {
  const { env, envelope, header, validation } = results

  const envelopeAvgMult = (
    envelope.filter((r) => r.rfc2821 > 0).reduce((s, r) => s + r.emailAddress / r.rfc2821, 0) /
    envelope.filter((r) => r.rfc2821 > 0).length
  ).toFixed(1)

  const headerAvgMult = (
    header.filter((r) => r.rfc2822 > 0).reduce((s, r) => s + r.emailAddress / r.rfc2822, 0) /
    header.filter((r) => r.rfc2822 > 0).length
  ).toFixed(1)

  const nmAvgMult = (
    header.filter((r) => r.nodemailer > 0).reduce((s, r) => s + r.emailAddress / r.nodemailer, 0) /
    header.filter((r) => r.nodemailer > 0).length
  ).toFixed(1)

  const sapAvgMult = (
    envelope.filter((r) => r.sapOps > 0).reduce((s, r) => s + r.emailAddress / r.sapOps, 0) /
    envelope.filter((r) => r.sapOps > 0).length
  ).toFixed(1)

  const hapiAvgMult =
    validation && validation.length > 0
      ? (
          validation.filter((r) => r.hapi > 0).reduce((s, r) => s + r.emailAddress / r.hapi, 0) /
          validation.filter((r) => r.hapi > 0).length
        ).toFixed(1)
      : null

  function envelopeRows() {
    return envelope
      .map(({ label, input, rfc2821: r, sapOps: s, emailAddress: e }) => {
        return `| ${label} | \`${input}\` | ${fmtOps(e)} | ${fmtOps(r)} | ${fmtOps(s)} |`
      })
      .join('\n')
  }

  function headerRows() {
    return header
      .map(({ label, input, rfc2822: o, nodemailer: nm, emailAddress: n }) => {
        const dispInput = input.length > 52 ? input.slice(0, 50) + '…' : input
        return `| ${label} | \`${dispInput}\` | ${fmtOps(n)} | ${fmtOps(o)} | ${fmtOps(nm)} |`
      })
      .join('\n')
  }

  function validationRows() {
    if (!validation || validation.length === 0) return ''
    return validation
      .map(({ label, input, emailAddress: e, hapi: h, eaResult, hapiResult }) => {
        // Show ❌ in the @hapi/address column when it rejects an address email-address accepts —
        // those timing numbers are meaningless (the inputs are outside its intended scope).
        const hapiCell = eaResult && !hapiResult ? '❌' : fmtOps(h)
        return `| ${label} | \`${input}\` | ${fmtOps(e)} | ${hapiCell} |`
      })
      .join('\n')
  }

  const validationSection =
    validation && validation.length > 0
      ? `
## Validation

Both *email-address* and *@hapi/address* expose a boolean \`isValid\` / \`isEmailValid\` API. They differ in scope: *email-address* validates the full Envelope grammar (quoted local-parts, IP literals);
*@hapi/address* targets web-form validation and rejects those forms.

| Description | Input | email-address<br>(ops/s) | @hapi/address<br>(ops/s) |
|-------------|-------|-------------------------:|-------------------------:|
${validationRows()}
`
      : ''

  const summaryHapiRow =
    hapiAvgMult !== null
      ? `| [@hapi/address][hapi-a] | Validation | hand-rolled regex + string split | ~${hapiAvgMult}× faster |\n`
      : ''

  return `# Performance Benchmarks

[@haraka/email-address][hea] (referred to as *email-address* throughout) is benchmarked in the 3 ways it can be used:

1. [Envelope parsing](#envelope-parsing) of SMTP envelope addresses ([RFC 5321][rfc5321]).
2. [Header parsing](#header-parsing) of Email headers ([RFC 5322][rfc5322]).
3. [Validation](#validation) of bare email addresses.

## Summary

| Package | Domain | Implementation | Avg speedup |
|--------|--------|---------------|------------:|
| [address-rfc2821][addr2821] | Envelope | [nearley][nearley] grammar (PEG-like) | ~${envelopeAvgMult}× faster |
| [smtp-address-parser][sap] | Envelope | [nearley][nearley] grammar (PEG-like) | ~${sapAvgMult}× faster |
| [address-rfc2822][addr2822] | Header | [email-addresses][eaddr] PEG parser | ~${headerAvgMult}× faster |
| [nodemailer][nodemailer] | Header | hand-rolled tokeniser | ~${nmAvgMult}× faster |
${summaryHapiRow}
*email-address* replaces both legacy Haraka packages with a native O(1) recursive descent
parser. The nearley-compiled grammars carry a significant per-parse overhead from the Earley chart algorithm.

## Header Parsing

| Description | Input | email-address<br>(ops/s) | address-rfc2822<br>(ops/s) | nodemailer<br>(ops/s) |
|-------------|-------|-------------------------:|---------------------------:|----------------------:|
${headerRows()}

## Envelope Parsing

- *address-rfc2821* and *email-address* also accept the \`<Path>\` wrapping form used in SMTP commands (\`MAIL FROM:<user@example.com>\`).
- *smtp-address-parser* only parses the bare mailbox form.

| Description | Input | email-address<br>(ops/s) | address-rfc2821<br>(ops/s) | smtp-address-parser<br>(ops/s) |
|-------------|-------|-------------------------:|---------------------------:|-------------------------------:|
${envelopeRows()}

${validationSection}

## Environment

| Key | Value |
|-----|-------|
| Node.js | ${env.node} |
| Platform | ${env.platform} |
| Date | ${env.date} |

## Methodology

Each case is measured with a **${WARMUP.toLocaleString('en-US')}-iteration warm-up** (JIT stabilisation) followed by
**${ROUNDS} timed trials** of **${ITERATIONS.toLocaleString('en-US')} iterations** each.
The reported figure is the **best (lowest-elapsed) trial**, expressed as ops/s.

Refresh this page with: \`npm run bench\`

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
`
}

// ---------------------------------------------------------------------------
// Standalone entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const results = runBenchmarks()
  const md = generateMarkdown(results)

  const docsDir = path.join(__dirname, '..')
  const outPath = path.join(docsDir, 'PERFORMANCE.md')
  fs.writeFileSync(outPath, md, 'utf8')
  console.log(`✓ Results written to ${outPath}`)
}

module.exports = {
  runBenchmarks,
  generateMarkdown,
  ENVELOPE_CASES,
  HEADER_CASES,
  VALIDATION_CASES,
  measure,
}
