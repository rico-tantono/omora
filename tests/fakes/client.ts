import { fake } from './supabase.ts'

export interface FakeOptions {
  /** Result of a table query, by table and operation (select, insert, update, delete) */
  respond?: (table: string, op: string, payload?: any) => any
  /** Result of a database function call */
  rpc?: (fn: string, args: any) => any
  /** Index of the upload that should fail (0 = the first) */
  failUploadAt?: number
  /** Files returned when listing storage, keyed by "bucket:folder" */
  list?: Record<string, { name: string; id: string | null }[]>
  auth?: Record<string, (arg?: any) => any>
}

// Installs a fake Supabase client and records everything done to it.
export function installFakeClient(options: FakeOptions = {}) {
  const calls: any[] = []
  const uploads: string[] = []
  const removed: string[] = []
  const store = { signedBatches: 0, uploadOptions: undefined as any }

  const chain = (table: string) => {
    let op = 'select'
    let payload: any
    const result = () => Promise.resolve(options.respond?.(table, op, payload) ?? { data: null, error: null })
    const c: any = {
      select: (columns?: string) => {
        if (op === 'select') calls.push(['select', table, columns])
        return c
      },
      order: () => c,
      eq: (...args: any[]) => (calls.push(['eq', ...args]), c),
      insert: (p: any) => ((op = 'insert'), (payload = p), calls.push([table, 'insert', p]), c),
      update: (p: any) => ((op = 'update'), (payload = p), calls.push([table, 'update', p]), c),
      delete: () => ((op = 'delete'), calls.push([table, 'delete']), c),
      single: () => result(),
      maybeSingle: () => result(),
      then: (resolve: any, reject: any) => result().then(resolve, reject),
    }
    return c
  }

  const auth = options.auth ?? {}
  fake.client = {
    from: chain,
    rpc: async (fn: string, args: any) => {
      calls.push(['rpc', fn, args])
      return options.rpc?.(fn, args) ?? { data: null, error: null }
    },
    auth: {
      signUp: async (a: any) => (calls.push(['signUp', a]), auth.signUp?.(a) ?? { data: {}, error: null }),
      signInWithPassword: async (a: any) => (calls.push(['signIn', a]), auth.signIn?.(a) ?? { error: null }),
      signOut: async (a?: any) => (calls.push(['signOut', a?.scope ?? 'global']), auth.signOut?.(a) ?? { error: null }),
      resend: async (a: any) => (calls.push(['resend', a]), auth.resend?.(a) ?? { error: null }),
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _blob: unknown, uploadOptions: any) => {
          if (options.failUploadAt === uploads.length) return { error: { message: 'upload failed' } }
          uploads.push(`${bucket}:${path}`)
          store.uploadOptions = uploadOptions
          return { error: null }
        },
        remove: async (paths: string[]) => (removed.push(...paths.map((p) => `${bucket}:${p}`)), { error: null }),
        list: async (folder: string) => ({ data: options.list?.[`${bucket}:${folder}`] ?? [], error: null }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        }),
        createSignedUrls: async (paths: string[]) => {
          store.signedBatches++
          return { data: paths.map((p) => ({ path: p, signedUrl: `signed://${p}`, error: null })), error: null }
        },
      }),
    },
  }
  return { calls, uploads, removed, store }
}
