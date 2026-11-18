export default function Tag({ children }: { children: string }) {
  return (
    <span className="inline-block rounded-full bg-sand px-2.5 py-1 text-xs font-medium text-ember-900">
      {children}
    </span>
  )
}
