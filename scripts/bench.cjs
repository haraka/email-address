#!/usr/bin/env node
'use strict'

/**
 * scripts/bench.cjs — Performance comparison:
 *   address-rfc2821      vs  email-address  (envelope / RFC-5321)
 *   smtp-address-parser  vs  email-address  (envelope / RFC-5321)
 *   email-address-parser vs  email-address  (envelope / RFC-5321)
 *   address-rfc2822      vs  email-address  (header   / RFC-5322)
 *   nodemailer           vs  email-address  (header   / RFC-5322)
 *   @hapi/address        vs  email-address  (validation / isValid)
 *
 * Any competitor whose package isn't installed locally is skipped. Sections
 * with no remaining competitors are skipped entirely.
 *
 * Run standalone:   'npm run bench'   (from the email-address package root)
 *
 * @hapi/address requires a CJS build. To include it:
 *   cd ../../address && npx tsc --outDir dist --module commonjs --moduleResolution node
 */

const { performance } = require('node:perf_hooks')
const os = require('node:os')
const fs = require('node:fs')
const path = require('node:path')

const ea = require('../dist/cjs/index.cjs')

// Each competitor declares where its checkout lives (relative to the
// package root, which is `npm run bench`'s cwd) plus the upstream repo
// to clone it from. `postInstall` runs after the clone for packages
// that need a build step before they can be required.
const COMPETITOR_INSTALL = {
  rfc2821: {
    modulePath: '../../../address-rfc2821/index.js',
    targetDir: '../../../address-rfc2821',
    repo: 'https://github.com/haraka/node-address-rfc2821.git',
  },
  rfc2822: {
    modulePath: '../../../address-rfc2822/index.js',
    targetDir: '../../../address-rfc2822',
    repo: 'https://github.com/haraka/node-address-rfc2822.git',
  },
  sap: {
    modulePath: '../../../smtp-address-parser/dist/lib/index.js',
    targetDir: '../../smtp-address-parser',
    repo: 'https://github.com/gene-hightower/smtp-address-parser.git',
    postInstall: 'npm install && npm run build',
  },
  eap: {
    modulePath: '../../../email-address-parser/dist/src/index.js',
    targetDir: '../../../email-address-parser',
    repo: 'https://github.com/gene-hightower/email-address-parser.git',
    postInstall: 'npm install && npm run build',
  },
  nodemailer: {
    modulePath: '../../../nodemailer/lib/addressparser/index.js',
    targetDir: '../../nodemailer',
    repo: 'https://github.com/nodemailer/nodemailer.git',
  },
  hapi: {
    modulePath: '../../../address/dist/index.js',
    targetDir: '../../address',
    repo: 'https://github.com/hapijs/address.git',
    postInstall: 'npm install && npx tsc --outDir dist --module commonjs --moduleResolution node',
  },
}

function tryRequireCompetitor(install) {
  try {
    return require(install.modulePath)
  } catch {
    const lines = [`  git clone ${install.repo} ${install.targetDir}`]
    if (install.postInstall) {
      lines.push(`  (cd ${install.targetDir} && ${install.postInstall})`)
    }
    console.warn(
      `bench: skipping ${install.targetDir} (not installed). To enable:\n${lines.join('\n')}\n`,
    )
    return null
  }
}

const mods = {}
for (const [key, install] of Object.entries(COMPETITOR_INSTALL)) {
  mods[key] = tryRequireCompetitor(install)
}

// ---------------------------------------------------------------------------
// Micro-benchmark harness
// ---------------------------------------------------------------------------

const WARMUP = 10_000
const ITERATIONS = 50_000
const ROUNDS = 5

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

function safeMeasure(fn) {
  try {
    return measure(fn)
  } catch {
    return 0
  }
}

function multiplier(next, prev) {
  return (next / prev).toFixed(1)
}

function fmtOps(n) {
  if (n === 0) return 'N/A'
  return n.toLocaleString('en-US')
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

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

const VALIDATION_CASES = [
  { label: 'simple mailbox', input: 'user@example.com' },
  { label: 'quoted local-part', input: '"quoted user"@example.com' },
  { label: 'IPv4 literal', input: 'u@[1.2.3.4]' },
  { label: 'Unicode / EAI', input: 'δοκιμή@παράδειγμα.gr' },
  { label: 'invalid address', input: 'notanemail' },
]

// ---------------------------------------------------------------------------
// Competitor + section model
// ---------------------------------------------------------------------------

// Per-competitor metadata used by both the console table and the markdown
// summary. `available` is what gates inclusion in any output.
const COMPETITOR_META = {
  rfc2821: {
    label: 'address-rfc2821',
    available: () => mods.rfc2821 !== null,
    run: (input) => new mods.rfc2821.Address(input),
    summary: {
      name: '[address-rfc2821][addr2821]',
      impl: '[nearley][nearley] grammar (PEG-like)',
    },
  },
  sap: {
    label: 'smtp-address-parser',
    available: () => mods.sap !== null,
    run: (input) => mods.sap.parse(input),
    summary: {
      name: '[smtp-address-parser][sap]',
      impl: '[nearley][nearley] grammar (PEG-like)',
    },
  },
  eap: {
    label: 'email-address-parser',
    available: () => mods.eap !== null,
    run: (input) => mods.eap.parse(input),
    summary: {
      name: '[email-address-parser][eap]',
      impl: 'hand-rolled split + regex',
    },
  },
  rfc2822: {
    label: 'address-rfc2822',
    available: () => mods.rfc2822 !== null,
    run: (input) => mods.rfc2822.parse(input),
    summary: {
      name: '[address-rfc2822][addr2822]',
      impl: '[email-addresses][eaddr] PEG parser',
    },
  },
  nodemailer: {
    label: 'nodemailer',
    available: () => mods.nodemailer !== null,
    run: (input) => mods.nodemailer(input),
    summary: {
      name: '[nodemailer][nodemailer]',
      impl: 'hand-rolled tokeniser',
    },
  },
  hapi: {
    label: '@hapi/address',
    available: () => mods.hapi !== null,
    run: (input) => mods.hapi.isEmailValid(input),
    summary: {
      name: '[@hapi/address][hapi-a]',
      impl: 'hand-rolled regex + string split',
    },
  },
}

const LOCAL_LABEL = 'email-address'
const LOCAL_ALIAS = '@h/ea'
const LOCAL_SUMMARY = {
  name: '[@haraka/email-address][hea]',
  impl: 'recursive descent parser',
}
const CASE_COL = 22

// Section descriptors. `competitorKeys` lists candidate competitors in display
// order; missing ones are filtered out at run time. `deltaKey` selects which
// competitor anchors the trailing Δ column.
const SECTIONS = [
  {
    key: 'envelope',
    title: 'Envelope address parsing (RFC 5321)',
    domain: 'Envelope',
    cases: ENVELOPE_CASES,
    competitorKeys: ['rfc2821', 'sap', 'eap'],
    deltaKey: 'rfc2821',
    local: (input) => new ea.Address(input),
    mdTitle: 'Envelope Parsing',
    mdPreamble:
      '- _address-rfc2821_ and _email-address_ also accept the `<Path>` wrapping form used in SMTP commands (`MAIL FROM:<user@example.com>`).\n' +
      '- _smtp-address-parser_ only parses the bare mailbox form.',
  },
  {
    key: 'header',
    title: 'Header address parsing (RFC 5322)',
    domain: 'Header',
    cases: HEADER_CASES,
    competitorKeys: ['rfc2822', 'nodemailer'],
    deltaKey: 'rfc2822',
    local: (input) => ea.parseHeader(input),
    mdTitle: 'Header Parsing',
    mdFooter:
      '- _address-rfc2822_ is a thin wrapper around [_email-addresses_][eaddr], they are equivalent for benchmarking purposes.',
    truncInput: true,
  },
  {
    key: 'validation',
    title: 'Email address validation  (isValid)',
    domain: 'Validation',
    cases: VALIDATION_CASES,
    competitorKeys: ['hapi'],
    deltaKey: 'hapi',
    local: (input) => ea.isValid(input),
    captureResults: true,
    mdTitle: 'Validation',
    mdPreamble:
      'Both _email-address_ and _@hapi/address_ expose a boolean `isValid` / `isEmailValid` API. They differ in scope: _email-address_ validates the full Envelope grammar (quoted local-parts, IP literals);\n' +
      '_@hapi/address_ targets web-form validation and rejects those forms.',
  },
]

// Markdown section ordering differs from console ordering in the legacy
// layout; preserve that here so PERFORMANCE.md keeps its shape.
const MD_SECTION_ORDER = ['header', 'envelope', 'validation']

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function runSection(section) {
  const competitors = section.competitorKeys
    .map((k) => ({ key: k, ...COMPETITOR_META[k] }))
    .filter((c) => c.available())

  if (competitors.length === 0) return null

  const colWidths = competitors.map((c) => Math.max(c.label.length, 14))
  const localWidth = Math.max(LOCAL_LABEL.length, 14)
  const deltaWidth = 6
  const totalWidth =
    CASE_COL + colWidths.reduce((s, w) => s + w + 1, 0) + (localWidth + 1) + (deltaWidth + 1)

  console.log(section.title)
  console.log('─'.repeat(totalWidth))
  const headerCells = ['Case'.padEnd(CASE_COL)]
  competitors.forEach((c, i) => headerCells.push(c.label.padStart(colWidths[i])))
  headerCells.push(LOCAL_LABEL.padStart(localWidth))
  headerCells.push('Δ'.padStart(deltaWidth))
  console.log(headerCells.join(' '))
  console.log('─'.repeat(totalWidth))

  const rows = []
  for (const { label, input } of section.cases) {
    process.stdout.write(`  ${label.padEnd(CASE_COL - 2)}`)

    const competitorOps = {}
    for (const c of competitors) competitorOps[c.key] = safeMeasure(() => c.run(input))
    const localOps = safeMeasure(() => section.local(input))

    const anchorKey =
      competitorOps[section.deltaKey] != null ? section.deltaKey : competitors[0].key
    const anchorOps = competitorOps[anchorKey] || 0
    const delta = anchorOps > 0 ? `${multiplier(localOps, anchorOps)}×` : 'n/a'

    const row = { label, input, local: localOps, competitors: competitorOps }
    if (section.captureResults) {
      try {
        row.localResult = section.local(input)
      } catch {
        row.localResult = null
      }
      row.competitorResults = {}
      for (const c of competitors) {
        try {
          row.competitorResults[c.key] = c.run(input)
        } catch {
          row.competitorResults[c.key] = null
        }
      }
    }
    rows.push(row)

    const cells = []
    competitors.forEach((c, i) => cells.push(fmtOps(competitorOps[c.key]).padStart(colWidths[i])))
    cells.push(fmtOps(localOps).padStart(localWidth))
    cells.push(delta.padStart(deltaWidth))
    console.log(` ${cells.join(' ')}`)
  }
  console.log()

  return {
    key: section.key,
    domain: section.domain,
    competitors: competitors.map((c) => ({ key: c.key, label: c.label, summary: c.summary })),
    rows,
    mdTitle: section.mdTitle,
    mdPreamble: section.mdPreamble,
    mdFooter: section.mdFooter,
    truncInput: !!section.truncInput,
    captureResults: !!section.captureResults,
  }
}

function runBenchmarks() {
  const env = {
    node: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    date: new Date().toISOString().slice(0, 10),
  }

  console.log()
  console.log(`Node ${env.node}  |  ${env.platform}  |  ${env.date}`)
  console.log()

  const sections = SECTIONS.map(runSection).filter(Boolean)
  return { env, sections }
}

// ---------------------------------------------------------------------------
// Markdown generator
// ---------------------------------------------------------------------------

function avgSpeedup(section, competitorKey) {
  const wins = section.rows.filter((r) => r.competitors[competitorKey] > 0)
  if (wins.length === 0) return null
  const sum = wins.reduce((s, r) => s + r.local / r.competitors[competitorKey], 0)
  return (sum / wins.length).toFixed(1)
}

function summaryRows(sections) {
  const rows = [
    `| ${LOCAL_SUMMARY.name} | \`${LOCAL_ALIAS}\` | All | ${LOCAL_SUMMARY.impl} | baseline |`,
  ]
  for (const sectionKey of MD_SECTION_ORDER) {
    const section = sections.find((s) => s.key === sectionKey)
    if (!section) continue
    for (const c of section.competitors) {
      const speedup = avgSpeedup(section, c.key)
      if (speedup === null) continue
      rows.push(
        `| ${c.summary.name} | \`${c.key}\` | ${section.domain} | ${c.summary.impl} | ~${speedup}× faster |`,
      )
    }
  }
  return rows.join('\n')
}

function sectionTable(section) {
  const headerCells = [
    'Description',
    'Input',
    `${LOCAL_ALIAS}<br>(ops/s)`,
    ...section.competitors.map((c) => `${c.key}<br>(ops/s)`),
  ]
  const aligns = ['---', '---', '---:', ...section.competitors.map(() => '---:')]

  const lines = [`| ${headerCells.join(' | ')} |`, `|${aligns.map((a) => `${a}`).join('|')}|`]

  for (const row of section.rows) {
    const dispInput =
      section.truncInput && row.input.length > 52 ? `${row.input.slice(0, 50)}…` : row.input
    const cells = [row.label, `\`${dispInput}\``, fmtOps(row.local)]
    for (const c of section.competitors) {
      if (section.captureResults) {
        // ❌ when this competitor rejects an input email-address accepts —
        // the timing is meaningless because the input is outside its scope.
        const cell =
          row.localResult && !row.competitorResults[c.key] ? '❌' : fmtOps(row.competitors[c.key])
        cells.push(cell)
      } else {
        cells.push(fmtOps(row.competitors[c.key]))
      }
    }
    lines.push(`| ${cells.join(' | ')} |`)
  }
  return lines.join('\n')
}

function renderSection(section) {
  const parts = [`## ${section.mdTitle}`, '']
  if (section.mdPreamble) parts.push(section.mdPreamble, '')
  parts.push(sectionTable(section))
  if (section.mdFooter) parts.push('', section.mdFooter)
  return parts.join('\n')
}

function generateMarkdown(results) {
  const { env, sections } = results

  const orderedSections = MD_SECTION_ORDER.map((k) => sections.find((s) => s.key === k)).filter(
    Boolean,
  )

  const sectionMd = orderedSections.map(renderSection).join('\n\n')

  return `# Performance Benchmarks

[@haraka/email-address][hea] (referred to as _email-address_ throughout) is benchmarked across the workloads it supports:

1. [Envelope parsing](#envelope-parsing) of SMTP envelope addresses ([RFC 5321][rfc5321]).
2. [Header parsing](#header-parsing) of Email headers ([RFC 5322][rfc5322]).
3. [Validation](#validation) of plain email addresses.

## Summary

| Package | Alias | Domain | Implementation | Avg speedup |
|--------|-------|--------|---------------|------------:|
${summaryRows(sections)}

- _@h/ea_ replaces both legacy Haraka packages (rfc2821, rfc2822)
- The nearley-compiled grammars carry a significant per-parse overhead from the Earley chart algorithm.
- _eap_ is fast, narrowly scoped and very incomplete

${sectionMd}

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
[eap]: https://github.com/gene-hightower/email-address-parser
`
}

// ---------------------------------------------------------------------------
// Standalone entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const results = runBenchmarks()
  const md = generateMarkdown(results)

  const outPath = path.join(__dirname, '..', 'PERFORMANCE.md')
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
