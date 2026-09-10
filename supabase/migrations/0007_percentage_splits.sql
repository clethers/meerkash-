-- ============================================================================
-- AbonoShare — percentage splitting
--
-- A third split mode alongside 'equal' and 'exact'. Percentages are stored as
-- integer basis points (0-10000 = 0.00%-100.00%) so there is never float
-- rounding, matching the centavos-only philosophy used everywhere else.
-- Nullable: 'equal'/'exact' rows are untouched and stay null. share_centavos
-- remains the one column balance/RLS/display logic reads — this column is
-- display/edit metadata only.
--
-- `alter type ... add value` must be its own statement/migration: Postgres
-- forbids using a new enum value in the same transaction that adds it.
-- ============================================================================
alter type split_mode add value 'percentage';

alter table expense_participants
  add column percentage_basis_points integer
    check (percentage_basis_points is null or percentage_basis_points between 0 and 10000);
