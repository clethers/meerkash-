import { describe, expect, it } from 'vitest';
import { createTestUser, seedExpense, seedGroupWithOwner, signInAs, unique } from './helpers';

describe('members read group expenses, non-members read none (requirement 32)', () => {
  it('a group member reads the expenses and participants for their own group', async () => {
    const owner = await createTestUser('owner');
    const ownerClient = await signInAs(owner);
    const { groupId } = await seedGroupWithOwner(owner, unique('Expenses'));
    await seedExpense(groupId, owner.id, [owner.id]);

    const { data: expenses, error: expensesError } = await ownerClient
      .from('expenses')
      .select('*')
      .eq('group_id', groupId);
    expect(expensesError).toBeNull();
    expect(expenses).toHaveLength(1);

    const { data: participants, error: participantsError } = await ownerClient
      .from('expense_participants')
      .select('*')
      .eq('expense_id', expenses![0].id);
    expect(participantsError).toBeNull();
    expect(participants).toHaveLength(1);
  });

  it('a non-member reads zero rows for a group they are not in', async () => {
    const owner = await createTestUser('owner');
    const outsider = await createTestUser('outsider');
    const outsiderClient = await signInAs(outsider);
    const { groupId } = await seedGroupWithOwner(owner, unique('Expenses'));
    await seedExpense(groupId, owner.id, [owner.id]);

    const { data, error } = await outsiderClient.from('expenses').select('*').eq('group_id', groupId);
    // PostgREST returns 200 + an empty array when RLS blocks a SELECT — it
    // never surfaces as a 403/error, so the assertion has to be on the data.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { count } = await outsiderClient
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);
    expect(count).toBe(0);
  });
});
