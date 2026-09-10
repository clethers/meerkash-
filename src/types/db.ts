export type CurrencyCode =
  | 'PHP' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'HKD' | 'NZD' | 'CHF'
  | 'JPY' | 'CNY' | 'INR' | 'IDR' | 'MYR' | 'THB' | 'VND' | 'KRW' | 'TWD'
  | 'BRL' | 'MXN' | 'ZAR' | 'AED' | 'SAR' | 'TRY' | 'PLN' | 'SEK' | 'NOK' | 'DKK'
  | 'CZK' | 'HUF' | 'ILS' | 'RUB' | 'NGN' | 'KES' | 'EGP' | 'PKR' | 'BDT'
  | 'LKR' | 'NPR' | 'MMK' | 'KHR' | 'LAK' | 'BND' | 'MOP' | 'MNT' | 'KZT'
  | 'UZS' | 'AZN' | 'GEL' | 'AMD' | 'QAR' | 'KWD' | 'BHD' | 'OMR' | 'JOD'
  | 'LBP' | 'IQD' | 'IRR' | 'AFN' | 'YER' | 'UAH' | 'BYN' | 'RON' | 'BGN'
  | 'RSD' | 'ISK' | 'ARS' | 'CLP' | 'COP' | 'PEN' | 'UYU' | 'BOB' | 'PYG'
  | 'GTQ' | 'CRC' | 'DOP' | 'JMD' | 'TTD' | 'BBD' | 'BSD' | 'XCD' | 'HNL'
  | 'NIO' | 'PAB' | 'GHS' | 'TZS' | 'UGX' | 'ZMW' | 'MZN' | 'MAD' | 'DZD'
  | 'TND' | 'XOF' | 'XAF' | 'ETB' | 'RWF' | 'BWP' | 'NAD' | 'MUR' | 'SCR'
  | 'XPF' | 'FJD' | 'PGK' | 'WST' | 'TOP' | 'VUV' | 'ALL' | 'MKD' | 'BAM'
  | 'MDL' | 'KGS' | 'TJS' | 'TMT';
export type MemberRole = 'owner' | 'member';
export type MemberStatus = 'active' | 'left' | 'removed';
export type SplitModeDb = 'equal' | 'exact' | 'percentage' | 'shares';
export type ExpenseCategory =
  | 'food_dining' | 'groceries' | 'transportation' | 'rent_utilities'
  | 'travel' | 'entertainment' | 'shopping' | 'work' | 'other';
export type SettlementStatusDb = 'pending' | 'confirmed' | 'rejected';
export type PaymentMethod = 'gcash' | 'maya' | 'bank_transfer' | 'cash' | 'other' | 'unspecified';
export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: FriendRequestStatus;
  created_at: string;
  responded_at: string | null;
}

export interface Friendship {
  user_a_id: string;
  user_b_id: string;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  preferred_currency: CurrencyCode | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Group {
  id: string;
  name: string;
  avatar_url: string | null;
  avatar_seed: string;
  currency: CurrencyCode;
  default_split_mode: SplitModeDb;
  owner_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  left_at: string | null;
  removed_by: string | null;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  token: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount_centavos: number;
  payer_id: string;
  category: ExpenseCategory;
  note: string | null;
  split_mode: SplitModeDb;
  receipt_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface ExpenseParticipant {
  expense_id: string;
  user_id: string;
  share_centavos: number;
  percentage_basis_points: number | null;
  shares: number | null;
}

export interface ExpenseRevision {
  id: string;
  expense_id: string;
  edited_by: string;
  edited_at: string;
  changed_fields: string[];
  before_value: Record<string, unknown>;
  after_value: Record<string, unknown>;
}

export interface ExpenseComment {
  id: string;
  expense_id: string;
  user_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount_centavos: number;
  status: SettlementStatusDb;
  method: PaymentMethod;
  note: string | null;
  proof_path: string | null;
  created_at: string;
  responded_at: string | null;
  deleted_at: string | null;
}

export interface ActivityEntry {
  id: string;
  group_id: string;
  actor_id: string | null;
  action: string;
  subject_type: string;
  subject_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  group_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface RecurringTemplate {
  id: string;
  group_id: string;
  name: string;
  amount_centavos: number | null;
  category: ExpenseCategory;
  frequency: Recurrence;
  next_due_on: string;
  default_payer_id: string | null;
  default_participants: string[];
  active: boolean;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
}

export interface RecurringOccurrence {
  id: string;
  template_id: string;
  due_on: string;
  expense_id: string | null;
  skipped_at: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface InvitePreview {
  group_id: string | null;
  group_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  member_count: number;
  already_member: boolean;
  valid: boolean;
  reason: string | null;
}
