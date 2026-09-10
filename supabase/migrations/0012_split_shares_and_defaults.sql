-- ============================================================================
-- AbonoShare — shares splitting + default split mode per group
--
-- A fourth split mode alongside 'equal'/'exact'/'percentage'. Each
-- participant gets an integer share count (e.g. 2 vs 1 -> 2/3 vs 1/3);
-- normalised to basis points and distributed with the exact same
-- deterministic remainder logic as 'percentage' (see splitByShares in
-- src/lib/balance/split.ts). `shares` is nullable and display/edit metadata
-- only, matching the percentage_basis_points precedent in
-- 0007_percentage_splits.sql — share_centavos remains the one column
-- balance/RLS/display logic reads.
--
-- `alter type ... add value` must be its own statement/migration: Postgres
-- forbids using a new enum value in the same transaction that adds it.
-- ============================================================================
alter type split_mode add value 'shares';

alter table expense_participants
  add column shares integer
    check (shares is null or shares >= 1);

-- ------------------------------------------------------- group preference --
alter table groups
  add column default_split_mode split_mode not null default 'equal';
