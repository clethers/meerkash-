import { describe, expect, it } from 'vitest';
import {
  createTestUser,
  inviteAndJoin,
  seedGroupWithOwner,
  seedSettlement,
  seedSettlementProof,
  signInAs,
  unique,
} from './helpers';

describe('only the two parties read a settlement proof (requirement 23)', () => {
  async function setup() {
    const payer = await createTestUser('payer');
    const receiver = await createTestUser('receiver');
    const thirdParty = await createTestUser('third');
    const payerClient = await signInAs(payer);
    const receiverClient = await signInAs(receiver);
    const thirdPartyClient = await signInAs(thirdParty);

    const { groupId } = await seedGroupWithOwner(payer, unique('Settle'));
    await inviteAndJoin(groupId, receiverClient, payer.id);
    await inviteAndJoin(groupId, thirdPartyClient, payer.id);

    const { settlementId } = await seedSettlement(groupId, payer.id, receiver.id);
    const { path } = await seedSettlementProof(settlementId);

    return { payerClient, receiverClient, thirdPartyClient, path };
  }

  it('a third-party group member cannot download the proof object', async () => {
    const { thirdPartyClient, path } = await setup();
    const { data, error } = await thirdPartyClient.storage.from('settlement-proofs').download(path);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('the payer can download the proof', async () => {
    const { payerClient, path } = await setup();
    const { data, error } = await payerClient.storage.from('settlement-proofs').download(path);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it('the receiver can download the proof', async () => {
    const { receiverClient, path } = await setup();
    const { data, error } = await receiverClient.storage.from('settlement-proofs').download(path);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });
});
