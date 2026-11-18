// Lets the app's TypeScript run under Node without a bundler:
//  - the Supabase client and the browser-only image code are replaced by the fakes in tests/fakes
//  - extensionless relative imports (the app is written for Vite) resolve to their .ts files
const fake = (name) => new URL(`./fakes/${name}.ts`, import.meta.url).href

export async function resolve(specifier, context, nextResolve) {
  if (/\/lib\/supabase$/.test(specifier)) return { url: fake('supabase'), shortCircuit: true }
  if (/\/lib\/imageProcessing$/.test(specifier)) return { url: fake('imageProcessing'), shortCircuit: true }

  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?(\?.*)?$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context)
    } catch {
      /* fall through to the normal resolution */
    }
  }
  return nextResolve(specifier, context)
}
