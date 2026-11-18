export function createSuite(title: string) {
  let passed = 0
  let failed = 0
  console.log(`\n# ${title}`)
  console.error = () => {}
  console.warn = () => {}

  return {
    ok(name: string, condition: boolean, detail = '') {
      if (condition) passed++
      else failed++
      console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `  -> ${detail}`}`)
    },
    /** Resolves to the error a promise rejects with, or null when it succeeds */
    async rejects(promise: Promise<unknown>): Promise<any> {
      try {
        await promise
        return null
      } catch (error) {
        return error
      }
    },
    finish() {
      console.log(`${passed} passed, ${failed} failed`)
      process.exit(failed > 0 ? 1 : 0)
    },
  }
}
