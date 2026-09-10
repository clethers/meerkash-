import { describe, expect, it } from 'vitest';
import { createTestUser, getAdminClient, inviteAndJoin, seedGroupWithOwner, signInAs, unique } from './helpers';

describe('only the owner updates the group (requirement 5)', () => {
  it('a non-owner member cannot rename the group', async () => {
    const owner = await createTestUser('owner');
    const member = await createTestUser('member');
    const memberClient = await signInAs(member);
    const originalName = unique('Original');
    const { groupId } = await seedGroupWithOwner(owner, originalName);
    await inviteAndJoin(groupId, memberClient, owner.id);

    const { data, error } = await memberClient.from('groups').update({ name: 'Hacked' }).eq('id', groupId).select();
    // RLS's USING clause matches nothing for this user, so PostgREST reports
    // the update as affecting zero rows rather than erroring.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    // An empty return array alone doesn't fully rule out a partial write —
    // re-read with a privileged client to confirm the name truly didn't move.
    const { data: current } = await getAdminClient().from('groups').select('name').eq('id', groupId).single();
    expect(current?.name).toBe(originalName);
  });

  it('the owner can rename the group', async () => {
    const owner = await createTestUser('owner');
    const ownerClient = await signInAs(owner);
    const { groupId } = await seedGroupWithOwner(owner, unique('Original'));

    const newName = unique('Renamed');
    const { data, error } = await ownerClient.from('groups').update({ name: newName }).eq('id', groupId).select();
    expect(error).toBeNull();
    expect(data?.[0]?.name).toBe(newName);
  });
});
