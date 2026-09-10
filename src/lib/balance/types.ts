import type { Centavos } from '@/lib/money';

export type UserId = string;

export type SplitMode = 'equal' | 'exact' | 'percentage' | 'shares';

export interface ExpenseInput {
  id: string;
  /** Who fronted the cash. Need not be a participant. */
  payerId: UserId;
  /** Total of the expense, in centavos. Must be > 0. */
  amount: Centavos;
  /** Everyone who consumed it. Excluded members simply are not in this list. */
  participants: UserId[];
  splitMode: SplitMode;
  /** Required when splitMode === 'exact'. Must sum to `amount`. */
  exactShares?: Record<UserId, Centavos>;
  /** Required when splitMode === 'percentage'. Basis points (0-10000), must sum to 10000. */
  percentages?: Record<UserId, number>;
  /** Required when splitMode === 'shares'. Positive integer share counts. */
  shares?: Record<UserId, number>;
  /** Soft-deleted expenses never affect balances. */
  deletedAt?: string | null;
}

export type SettlementStatus = 'pending' | 'confirmed' | 'rejected';

export interface SettlementInput {
  id: string;
  /** The person handing over money. */
  fromId: UserId;
  /** The person receiving it. */
  toId: UserId;
  amount: Centavos;
  status: SettlementStatus;
  deletedAt?: string | null;
}

/** amountPaid - fairShare, per member. Positive = is owed. Sums to zero. */
export type NetPositions = Record<UserId, Centavos>;

export interface Transfer {
  from: UserId;
  to: UserId;
  amount: Centavos;
}

export interface LedgerInput {
  members: UserId[];
  expenses: ExpenseInput[];
  settlements: SettlementInput[];
}

export interface Ledger {
  net: NetPositions;
  transfers: Transfer[];
  totalSpent: Centavos;
}

export class BalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BalanceError';
  }
}
