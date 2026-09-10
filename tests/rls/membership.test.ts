import { describe, expect, it } from 'vitest';
import { createTestUser, inviteAndJoin, seedExpense, seedGroupWithOwner, signInAs, unique } from './helpers';

describe('a removed member loses group access (requirement 32)', () => {
  it('after remove_member(), the same still-signed-in session can no longer read the group or its expenses', async () => {
    const owner = await createTestUser('owner');
    const member = await createTestUser('member');
    const ownerClient = await signInAs(owner);
    const memberClient = await signInAs(member);
    const { groupId } = await seedGroupWithOwner(owner, unique('Membership'));
    await inviteAndJoin(groupId, memberClient, owner.id);

    // The member pays for themself only, so their net position is zero —
    // remove_member() refuses to remove anyone with an outstanding balance,
    // and a nonzero fixture balance here would be testing that guard, not RLS.
    const { expenseId } = await seedExpense(groupId, member.id, [member.id]);

    // Sanity pre-check: prove the member's session really can read this data
    // before removal, so the post-removal empty result means something.
    const before = await memberClient.from('groups').select('id').eq('id', groupId);
    expect(before.data).toHaveLength(1);

    const { error: removeError } = await ownerClient.rpc('remove_member', { gid: groupId, target: member.id });
    expect(removeError).toBeNull();

    // Same session, no re-sign-in: proves the policy function re-evaluates
    // per query against a still-valid JWT, not just that a fresh login fails.
    const { data: groups, error: groupsError } = await memberClient.from('groups').select('id').eq('id', groupId);
    expect(groupsError).toBeNull();
    expect(groups).toEqual([]);

    const { data: expenses } = await memberClient.from('expenses').select('id').eq('id', expenseId);
    expect(expenses).toEqual([]);

    // The roster policy deliberately still lets a removed member see their
    // OWN row (`user_id = auth.uid()`) so they can tell they were removed —
    // it just stops them seeing anyone else's.
    const { data: roster } = await memberClient.from('group_members').select('user_id').eq('group_id', groupId);
    expect(roster).toEqual([{ user_id: member.id }]);
  });
});
