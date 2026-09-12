/**
 * Mirrors src/app/(app)/template.tsx — Next.js remounts template.tsx on every
 * navigation, so the login <-> signup switch (and any reload) re-triggers the
 * same subtle entrance animation the rest of the app uses.
 */
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
