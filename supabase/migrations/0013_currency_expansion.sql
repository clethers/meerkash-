-- ============================================================================
-- AbonoShare — expand supported currencies + display-only FX conversion
--
-- Widens groups_currency_check from the original 10-currency set (0008) to a
-- much larger real ISO 4217 list. 0008 deliberately excluded currencies with
-- a non-2-decimal minor unit (JPY, KRW, VND, ...) to stay "faithful" to each
-- currency's real-world subdivision. That constraint isn't actually load-
-- bearing: src/lib/money.ts's "centavos" are an internal bookkeeping unit
-- (always 1/100 of the displayed major unit), not a claim about a currency's
-- real minor unit — Intl.NumberFormat still renders each currency with its
-- correct number of decimal places at display time regardless of how many
-- implied decimals the stored integer carries. So 0-decimal and 3-decimal
-- currencies are safe to allow.
--
-- Also adds profiles.preferred_currency: a nullable, purely-cosmetic setting
-- used to show a supplementary "≈ total in <preferred currency>" alongside
-- (never replacing) each group's native-currency balance. It does not change
-- how any amount is stored — every expense/settlement still lives in cents
-- of its own group's fixed currency.
-- ============================================================================
alter table groups drop constraint groups_currency_check;
alter table groups add constraint groups_currency_check
  check (currency in (
    'PHP','USD','EUR','GBP','AUD','CAD','SGD','HKD','NZD','CHF',
    'JPY','CNY','INR','IDR','MYR','THB','VND','KRW','TWD',
    'BRL','MXN','ZAR','AED','SAR','TRY','PLN','SEK','NOK','DKK',
    'CZK','HUF','ILS','RUB','NGN','KES','EGP','PKR','BDT',
    'LKR','NPR','MMK','KHR','LAK','BND','MOP','MNT','KZT',
    'UZS','AZN','GEL','AMD','QAR','KWD','BHD','OMR','JOD',
    'LBP','IQD','IRR','AFN','YER','UAH','BYN','RON','BGN',
    'RSD','ISK','ARS','CLP','COP','PEN','UYU','BOB','PYG',
    'GTQ','CRC','DOP','JMD','TTD','BBD','BSD','XCD','HNL',
    'NIO','PAB','GHS','TZS','UGX','ZMW','MZN','MAD','DZD',
    'TND','XOF','XAF','ETB','RWF','BWP','NAD','MUR','SCR',
    'XPF','FJD','PGK','WST','TOP','VUV','ALL','MKD','BAM',
    'MDL','KGS','TJS','TMT'
  ));

alter table profiles add column preferred_currency text;
alter table profiles add constraint profiles_preferred_currency_check
  check (preferred_currency is null or preferred_currency in (
    'PHP','USD','EUR','GBP','AUD','CAD','SGD','HKD','NZD','CHF',
    'JPY','CNY','INR','IDR','MYR','THB','VND','KRW','TWD',
    'BRL','MXN','ZAR','AED','SAR','TRY','PLN','SEK','NOK','DKK',
    'CZK','HUF','ILS','RUB','NGN','KES','EGP','PKR','BDT',
    'LKR','NPR','MMK','KHR','LAK','BND','MOP','MNT','KZT',
    'UZS','AZN','GEL','AMD','QAR','KWD','BHD','OMR','JOD',
    'LBP','IQD','IRR','AFN','YER','UAH','BYN','RON','BGN',
    'RSD','ISK','ARS','CLP','COP','PEN','UYU','BOB','PYG',
    'GTQ','CRC','DOP','JMD','TTD','BBD','BSD','XCD','HNL',
    'NIO','PAB','GHS','TZS','UGX','ZMW','MZN','MAD','DZD',
    'TND','XOF','XAF','ETB','RWF','BWP','NAD','MUR','SCR',
    'XPF','FJD','PGK','WST','TOP','VUV','ALL','MKD','BAM',
    'MDL','KGS','TJS','TMT'
  ));
