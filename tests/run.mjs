// Runs every tests/*.test.mts file and prints a summary. Needs Node 22.6 or newer
// (it runs TypeScript directly). Usage: npm run test:logic
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 6)) {
  console.error(`These tests need Node 22.6 or newer (you have ${process.versions.node}).`)
  process.exit(1)
}

const dir = dirname(fileURLToPath(import.meta.url))
const suites = readdirSync(dir).filter((name) => name.endsWith('.test.mts')).sort()
let failedSuites = 0
let total = 0

for (const suite of suites) {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', '--import', join(dir, 'register.mjs'), join(dir, suite)],
    { encoding: 'utf8' },
  )
  const output = `${result.stdout}${result.stderr}`
  const failures = output.split('\n').filter((line) => line.startsWith('FAIL'))
  const summary = output.split('\n').find((line) => /\d+ passed, \d+ failed/.test(line)) ?? 'did not finish'
  total += Number(summary.match(/(\d+) passed/)?.[1] ?? 0)

  console.log(`${result.status === 0 ? 'ok  ' : 'FAIL'}  ${suite.padEnd(24)} ${summary}`)
  failures.forEach((line) => console.log(`      ${line}`))
  if (result.status !== 0) {
    failedSuites++
    if (failures.length === 0) console.log(output.trim().split('\n').slice(-8).map((l) => `      ${l}`).join('\n'))
  }
}

console.log(`\n${total} checks passed across ${suites.length} files${failedSuites ? `; ${failedSuites} file(s) FAILED` : ''}`)
process.exit(failedSuites ? 1 : 0)
