const SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  JPY: '¥',
  CAD: '$',
  AUD: '$'
};

export function isValidCurrency(code) {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Z]{3}$/.test(code.trim().toUpperCase());
}

export function getCurrencySymbol(code) {
  if (!code || typeof code !== 'string') return '';
  const c = code.trim().toUpperCase();
  return SYMBOLS[c] || c; // fallback to code
}

export default { isValidCurrency, getCurrencySymbol };
