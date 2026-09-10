-- ============================================================================
-- AbonoShare — multi-currency per group
--
-- Relaxes the PHP-only restriction while keeping the other half of
-- requirement 11 intact: one currency per group, no mixing, no conversion.
-- Currency is set once at group creation and is immutable — expenses and
-- settlements store raw integer amounts with no per-row currency tag, so
-- changing a group's currency after expenses exist would silently corrupt
-- every historical amount's meaning.
--
-- All ten currencies use 2 decimal places (100 minor units per major unit),
-- so the existing PESO = 100 integer-centavos convention in src/lib/money.ts
-- applies unchanged to every one of them. Currencies with a different
-- minor-unit count (JPY, KRW, etc.) are deliberately excluded.
-- ============================================================================
alter table groups drop constraint groups_currency_check;
alter table groups add constraint groups_currency_check
  check (currency in ('PHP','USD','EUR','GBP','AUD','CAD','SGD','HKD','NZD','CHF'));
