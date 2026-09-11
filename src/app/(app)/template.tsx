/**
 * Next.js remounts `template.tsx` on every navigation (unlike `layout.tsx`,
 * which persists) — so the `page-enter` CSS animation re-triggers on every
 * route change, giving a consistent, subtle entrance without touching every
 * individual page.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
