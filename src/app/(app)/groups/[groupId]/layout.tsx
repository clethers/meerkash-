import { notFound } from 'next/navigation';
import { getGroupCore } from '@/lib/data/groups';

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const core = await getGroupCore(groupId);
  if (!core) notFound();

  return <>{children}</>;
}
