import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GroupHeader } from '@/components/groups/GroupHeader';
import {
  NewTemplateForm,
  OccurrenceActions,
  RemoveTemplateButton,
} from '@/components/groups/RecurringForms';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getGroupBundle } from '@/lib/data/groups';
import { listDueOccurrences, listTemplates } from '@/lib/actions/recurring';
import { isDue } from '@/lib/recurring';
import { CATEGORY_EMOJI } from '@/lib/constants';
import { formatMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const bundle = await getGroupBundle(groupId);
  if (!bundle) notFound();

  const [templates, occurrences] = await Promise.all([
    listTemplates(groupId),
    listDueOccurrences(groupId),
  ]);

  const templateById = new Map(templates.map((t) => [t.id, t]));
  const due = occurrences.filter((o) => isDue(o.due_on));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <GroupHeader
        group={bundle.group}
        memberCount={bundle.activeMembers.length}
        current="/recurring"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel>Recurring reminders</SectionLabel>
          <p className="mt-1 max-w-lg text-sm text-slate-600">
            A separate module from your day-to-day expenses. These are reminders, not charges —
            record the real amount when it actually happens.
          </p>
        </div>
        <NewTemplateForm
          groupId={groupId}
          today={today}
          currency={bundle.group.currency}
          members={bundle.activeMembers.map((m) => ({
            id: m.user_id,
            name: m.profile?.display_name ?? 'Member',
          }))}
        />
      </div>

      {due.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel as="h3">Due now</SectionLabel>
          <ul className="space-y-2">
            {due.map((occurrence) => {
              const template = templateById.get(occurrence.template_id);
              if (!template) return null;
              return (
                <li key={occurrence.id} className="card space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl" aria-hidden>{CATEGORY_EMOJI[template.category]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{template.name}</p>
                      <p className="text-sm text-slate-500">
                        Due {occurrence.due_on}
                        {template.amount_centavos
                          ? ` · usually ${formatMoney(template.amount_centavos, bundle.group.currency)}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ButtonLink
                      href={`/groups/${groupId}/expenses/new?template=${template.id}`}
                      size="sm"
                    >
                      Record it as an expense
                    </ButtonLink>
                    <OccurrenceActions groupId={groupId} occurrenceId={occurrence.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionLabel as="h3">All reminders</SectionLabel>
        {templates.length === 0 ? (
          <EmptyState
            title="No recurring reminders"
            description="Set one up for something that happens on a schedule, like a daily lunch or a monthly bill."
          />
        ) : (
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg" aria-hidden>{CATEGORY_EMOJI[template.category]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{template.name}</p>
                  <p className="text-xs text-slate-500">
                    {template.frequency} · next {template.next_due_on}
                    {template.amount_centavos ? ` · ${formatMoney(template.amount_centavos, bundle.group.currency)}` : ''}
                  </p>
                </div>
                <RemoveTemplateButton groupId={groupId} templateId={template.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Alert tone="info">
        Each occurrence you record becomes a normal expense, splittable and editable like any other.{' '}
        <Link href={`/groups/${groupId}`} className="font-medium underline">
          Back to the group
        </Link>
      </Alert>
    </div>
  );
}
