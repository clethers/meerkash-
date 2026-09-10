import type { CurrencyCode, ExpenseCategory, PaymentMethod, Recurrence, SplitModeDb } from '@/types/db';

export const CATEGORIES: Array<{ value: ExpenseCategory; label: string; emoji: string }> = [
  { value: 'food_dining', label: 'Food & Dining', emoji: '🍽️' },
  { value: 'groceries', label: 'Groceries', emoji: '🛒' },
  { value: 'transportation', label: 'Transportation', emoji: '🚗' },
  { value: 'rent_utilities', label: 'Rent & Utilities', emoji: '🏠' },
  { value: 'travel', label: 'Travel', emoji: '✈️' },
  { value: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'work', label: 'Work', emoji: '💼' },
  { value: 'other', label: 'Other', emoji: '📌' },
];

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<ExpenseCategory, string>;

export const CATEGORY_EMOJI: Record<ExpenseCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.emoji]),
) as Record<ExpenseCategory, string>;

export const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'unspecified', label: 'Not specified' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya', label: 'Maya' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
) as Record<PaymentMethod, string>;

/**
 * Neither GCash nor Maya publishes a "pay this specific person this amount"
 * deep link for third-party apps without a merchant partnership — that's a
 * business relationship, not something buildable here. This is the honest
 * scope instead: open the app itself (falling back to its store listing if
 * not installed), so the person finishes the actual payment inside GCash/
 * Maya and comes back to Meerkash's existing settle-up flow to record it.
 */
export const PAYMENT_APP_LINKS: Partial<Record<PaymentMethod, { scheme: string; storeUrl: string }>> = {
  gcash: {
    scheme: 'gcash://',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.globe.gcash.android',
  },
  maya: {
    scheme: 'maya://',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.paymaya',
  },
};

export const CURRENCIES: Array<{ value: CurrencyCode; label: string }> = [
  { value: 'PHP', label: 'Philippine Peso' },
  { value: 'USD', label: 'US Dollar' },
  { value: 'EUR', label: 'Euro' },
  { value: 'GBP', label: 'British Pound' },
  { value: 'AUD', label: 'Australian Dollar' },
  { value: 'CAD', label: 'Canadian Dollar' },
  { value: 'SGD', label: 'Singapore Dollar' },
  { value: 'HKD', label: 'Hong Kong Dollar' },
  { value: 'NZD', label: 'New Zealand Dollar' },
  { value: 'CHF', label: 'Swiss Franc' },
  { value: 'JPY', label: 'Japanese Yen' },
  { value: 'CNY', label: 'Chinese Yuan' },
  { value: 'INR', label: 'Indian Rupee' },
  { value: 'IDR', label: 'Indonesian Rupiah' },
  { value: 'MYR', label: 'Malaysian Ringgit' },
  { value: 'THB', label: 'Thai Baht' },
  { value: 'VND', label: 'Vietnamese Dong' },
  { value: 'KRW', label: 'South Korean Won' },
  { value: 'TWD', label: 'New Taiwan Dollar' },
  { value: 'BRL', label: 'Brazilian Real' },
  { value: 'MXN', label: 'Mexican Peso' },
  { value: 'ZAR', label: 'South African Rand' },
  { value: 'AED', label: 'UAE Dirham' },
  { value: 'SAR', label: 'Saudi Riyal' },
  { value: 'TRY', label: 'Turkish Lira' },
  { value: 'PLN', label: 'Polish Zloty' },
  { value: 'SEK', label: 'Swedish Krona' },
  { value: 'NOK', label: 'Norwegian Krone' },
  { value: 'DKK', label: 'Danish Krone' },
  { value: 'CZK', label: 'Czech Koruna' },
  { value: 'HUF', label: 'Hungarian Forint' },
  { value: 'ILS', label: 'Israeli New Shekel' },
  { value: 'RUB', label: 'Russian Ruble' },
  { value: 'NGN', label: 'Nigerian Naira' },
  { value: 'KES', label: 'Kenyan Shilling' },
  { value: 'EGP', label: 'Egyptian Pound' },
  { value: 'PKR', label: 'Pakistani Rupee' },
  { value: 'BDT', label: 'Bangladeshi Taka' },
  { value: 'LKR', label: 'Sri Lankan Rupee' },
  { value: 'NPR', label: 'Nepalese Rupee' },
  { value: 'MMK', label: 'Myanmar Kyat' },
  { value: 'KHR', label: 'Cambodian Riel' },
  { value: 'LAK', label: 'Lao Kip' },
  { value: 'BND', label: 'Brunei Dollar' },
  { value: 'MOP', label: 'Macanese Pataca' },
  { value: 'MNT', label: 'Mongolian Tugrik' },
  { value: 'KZT', label: 'Kazakhstani Tenge' },
  { value: 'UZS', label: 'Uzbekistani Som' },
  { value: 'AZN', label: 'Azerbaijani Manat' },
  { value: 'GEL', label: 'Georgian Lari' },
  { value: 'AMD', label: 'Armenian Dram' },
  { value: 'QAR', label: 'Qatari Riyal' },
  { value: 'KWD', label: 'Kuwaiti Dinar' },
  { value: 'BHD', label: 'Bahraini Dinar' },
  { value: 'OMR', label: 'Omani Rial' },
  { value: 'JOD', label: 'Jordanian Dinar' },
  { value: 'LBP', label: 'Lebanese Pound' },
  { value: 'IQD', label: 'Iraqi Dinar' },
  { value: 'IRR', label: 'Iranian Rial' },
  { value: 'AFN', label: 'Afghan Afghani' },
  { value: 'YER', label: 'Yemeni Rial' },
  { value: 'UAH', label: 'Ukrainian Hryvnia' },
  { value: 'BYN', label: 'Belarusian Ruble' },
  { value: 'RON', label: 'Romanian Leu' },
  { value: 'BGN', label: 'Bulgarian Lev' },
  { value: 'RSD', label: 'Serbian Dinar' },
  { value: 'ISK', label: 'Icelandic Krona' },
  { value: 'ARS', label: 'Argentine Peso' },
  { value: 'CLP', label: 'Chilean Peso' },
  { value: 'COP', label: 'Colombian Peso' },
  { value: 'PEN', label: 'Peruvian Sol' },
  { value: 'UYU', label: 'Uruguayan Peso' },
  { value: 'BOB', label: 'Bolivian Boliviano' },
  { value: 'PYG', label: 'Paraguayan Guarani' },
  { value: 'GTQ', label: 'Guatemalan Quetzal' },
  { value: 'CRC', label: 'Costa Rican Colon' },
  { value: 'DOP', label: 'Dominican Peso' },
  { value: 'JMD', label: 'Jamaican Dollar' },
  { value: 'TTD', label: 'Trinidad & Tobago Dollar' },
  { value: 'BBD', label: 'Barbadian Dollar' },
  { value: 'BSD', label: 'Bahamian Dollar' },
  { value: 'XCD', label: 'East Caribbean Dollar' },
  { value: 'HNL', label: 'Honduran Lempira' },
  { value: 'NIO', label: 'Nicaraguan Cordoba' },
  { value: 'PAB', label: 'Panamanian Balboa' },
  { value: 'GHS', label: 'Ghanaian Cedi' },
  { value: 'TZS', label: 'Tanzanian Shilling' },
  { value: 'UGX', label: 'Ugandan Shilling' },
  { value: 'ZMW', label: 'Zambian Kwacha' },
  { value: 'MZN', label: 'Mozambican Metical' },
  { value: 'MAD', label: 'Moroccan Dirham' },
  { value: 'DZD', label: 'Algerian Dinar' },
  { value: 'TND', label: 'Tunisian Dinar' },
  { value: 'XOF', label: 'West African CFA Franc' },
  { value: 'XAF', label: 'Central African CFA Franc' },
  { value: 'ETB', label: 'Ethiopian Birr' },
  { value: 'RWF', label: 'Rwandan Franc' },
  { value: 'BWP', label: 'Botswana Pula' },
  { value: 'NAD', label: 'Namibian Dollar' },
  { value: 'MUR', label: 'Mauritian Rupee' },
  { value: 'SCR', label: 'Seychellois Rupee' },
  { value: 'XPF', label: 'CFP Franc' },
  { value: 'FJD', label: 'Fijian Dollar' },
  { value: 'PGK', label: 'Papua New Guinean Kina' },
  { value: 'WST', label: 'Samoan Tala' },
  { value: 'TOP', label: 'Tongan Paʻanga' },
  { value: 'VUV', label: 'Vanuatu Vatu' },
  { value: 'ALL', label: 'Albanian Lek' },
  { value: 'MKD', label: 'Macedonian Denar' },
  { value: 'BAM', label: 'Bosnia-Herzegovina Convertible Mark' },
  { value: 'MDL', label: 'Moldovan Leu' },
  { value: 'KGS', label: 'Kyrgyzstani Som' },
  { value: 'TJS', label: 'Tajikistani Somoni' },
  { value: 'TMT', label: 'Turkmenistani Manat' },
];

export const CURRENCY_CODES: CurrencyCode[] = CURRENCIES.map((c) => c.value);

export const CURRENCY_LABEL: Record<CurrencyCode, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.value, c.label]),
) as Record<CurrencyCode, string>;

export const RECURRENCES: Array<{ value: Recurrence; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export const SPLIT_MODES: Array<{ value: SplitModeDb; label: string }> = [
  { value: 'equal', label: 'Equally' },
  { value: 'exact', label: 'Exact amounts' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'shares', label: 'Shares' },
];

export const SPLIT_MODE_LABEL: Record<SplitModeDb, string> = Object.fromEntries(
  SPLIT_MODES.map((m) => [m.value, m.label]),
) as Record<SplitModeDb, string>;

export const RECEIPTS_BUCKET = 'receipts';
export const PROOFS_BUCKET = 'settlement-proofs';
