'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateGroup } from '@/lib/actions/groups';
import type { ActionResult } from '@/lib/actions/shared';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { SPLIT_MODES } from '@/lib/constants';
import type { SplitModeDb } from '@/types/db';

export function GroupSettingsForm({
  groupId,
  name,
  avatarUrl,
  defaultSplitMode,
  canEdit,
}: {
  groupId: string;
  name: string;
  avatarUrl: string | null;
  defaultSplitMode: SplitModeDb;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionResult | null, FormData>(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await updateGroup(prev, formData);
      if (result.ok) router.refresh();
      return result;
    },
    null,
  );
  const [splitMode, setSplitMode] = useState<SplitModeDb>(defaultSplitMode);

  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="group_id" value={groupId} />

      <div>
        <label className="label" htmlFor="name">Group name</label>
        <input
          id="name"
          name="name"
          defaultValue={name}
          maxLength={80}
          required
          disabled={!canEdit}
          className="input mt-1.5"
        />
      </div>

      <div>
        <label className="label" htmlFor="avatar">Group photo</label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={!canEdit}
          className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-50"
        />
        <input type="hidden" name="avatar_url" value={avatarUrl ?? ''} />
        <p className="mt-1 text-xs text-slate-500">
          PNG, JPEG, WebP or GIF up to 2 MB. Upload nothing to keep the current picture.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="default_split_mode">Default split mode</label>
        <input type="hidden" name="default_split_mode" value={splitMode} />
        <Select
          id="default_split_mode"
          value={splitMode}
          onChange={(v) => setSplitMode(v as SplitModeDb)}
          disabled={!canEdit}
          className="mt-1.5"
          options={SPLIT_MODES}
        />
        <p className="mt-1 text-xs text-slate-500">
          New expenses in this group start with this split mode selected.
        </p>
      </div>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{String(state.data?.message ?? 'Saved.')}</Alert> : null}

      {canEdit ? (
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      ) : (
        <Alert tone="info">Only the group owner can change the name and photo.</Alert>
      )}
    </form>
  );
}
