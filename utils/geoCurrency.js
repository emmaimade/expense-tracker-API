// utils/geoCurrency.js
import geoip from 'geoip-lite';

/**
 * Currency mappings for countries
 * Based on ISO 3166-1 alpha-2 country codes to ISO 4217 currency codes
 */
const COUNTRY_TO_CURRENCY = {
  // Africa
  NG: 'NGN', // Nigeria
  ZA: 'ZAR', // South Africa
  KE: 'KES', // Kenya
  GH: 'GHS', // Ghana
  EG: 'EGP', // Egypt
  
  // Americas
  US: 'USD', // United States
  CA: 'CAD', // Canada
  MX: 'MXN', // Mexico
  BR: 'BRL', // Brazil
  AR: 'ARS', // Argentina
  
  // Europe
  GB: 'GBP', // United Kingdom
  DE: 'EUR', // Germany
  FR: 'EUR', // France
  IT: 'EUR', // Italy
  ES: 'EUR', // Spain
  NL: 'EUR', // Netherlands
  BE: 'EUR', // Belgium
  AT: 'EUR', // Austria
  PT: 'EUR', // Portugal
  IE: 'EUR', // Ireland
  FI: 'EUR', // Finland
  GR: 'EUR', // Greece
  CH: 'CHF', // Switzerland
  SE: 'SEK', // Sweden
  NO: 'NOK', // Norway
  DK: 'DKK', // Denmark
  PL: 'PLN', // Poland
  CZ: 'CZK', // Czech Republic
  HU: 'HUF', // Hungary
  RO: 'RON', // Romania
  
  // Asia
  JP: 'JPY', // Japan
  CN: 'CNY', // China
  IN: 'INR', // India
  KR: 'KRW', // South Korea
  SG: 'SGD', // Singapore
  HK: 'HKD', // Hong Kong
  TW: 'TWD', // Taiwan
  TH: 'THB', // Thailand
  MY: 'MYR', // Malaysia
  ID: 'IDR', // Indonesia
  PH: 'PHP', // Philippines
  VN: 'VND', // Vietnam
  PK: 'PKR', // Pakistan
  BD: 'BDT', // Bangladesh
  AE: 'AED', // UAE
  SA: 'SAR', // Saudi Arabia
  IL: 'ILS', // Israel
  TR: 'TRY', // Turkey
  
  // Oceania
  AU: 'AUD', // Australia
  NZ: 'NZD', // New Zealand
};

/**
 * Get currency from IP address
 * @param {string} ipAddress - IP address of the user
 * @returns {string} Currency code (e.g., 'USD', 'EUR', 'NGN')
 */
export function getCurrencyFromIP(ipAddress) {
  try {
    // Handle localhost/development
    if (!ipAddress || 
        ipAddress === '::1' || 
        ipAddress === '127.0.0.1' || 
        ipAddress === 'localhost' ||
        ipAddress.startsWith('192.168.') ||
        ipAddress.startsWith('10.')) {
      console.log('Localhost detected, defaulting to USD');
      return 'USD'; // Default for development
    }

    // Look up IP geolocation
    const geo = geoip.lookup(ipAddress);
    
    if (!geo || !geo.country) {
      console.log('No geo data found for IP:', ipAddress);
      return 'USD'; // Fallback to USD
    }

    const countryCode = geo.country;
    const currency = COUNTRY_TO_CURRENCY[countryCode] || 'USD';
    
    console.log(`IP ${ipAddress} -> Country: ${countryCode} -> Currency: ${currency}`);
    return currency;
  } catch (error) {
    console.error('Error detecting currency from IP:', error);
    return 'USD'; // Fallback to USD on error
  }
}

/**
 * Get currency from HTTP headers (more reliable than IP)
 * @param {object} headers - Express request headers
 * @returns {string|null} Currency code or null if not found
 */
export function getCurrencyFromHeaders(headers) {
  try {
    // Check for CloudFlare country header
    if (headers['cf-ipcountry']) {
      const countryCode = headers['cf-ipcountry'];
      if (countryCode !== 'XX') { // XX means unknown
        return COUNTRY_TO_CURRENCY[countryCode] || null;
      }
    }

    // Check for other common country headers
    const countryHeader = headers['x-country-code'] || 
                         headers['x-vercel-ip-country'] ||
                         headers['x-appengine-country'];
    
    if (countryHeader) {
      return COUNTRY_TO_CURRENCY[countryHeader.toUpperCase()] || null;
    }

    return null;
  } catch (error) {
    console.error('Error getting currency from headers:', error);
    return null;
  }
}

/**
 * Get user's IP address from request (handles proxies)
 * @param {object} req - Express request object
 * @returns {string} IP address
 */
export function getClientIP(req) {
  // Check various headers for the real IP (in order of reliability)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  return req.headers['x-real-ip'] ||
         req.headers['cf-connecting-ip'] || // CloudFlare
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         '127.0.0.1';
}

/**
 * Detect currency with multiple fallback strategies
 * @param {object} req - Express request object
 * @returns {string} Detected currency code
 */
export function detectCurrency(req) {
  // Strategy 1: Try to get from headers (most reliable)
  const headerCurrency = getCurrencyFromHeaders(req.headers);
  if (headerCurrency) {
    console.log('Currency detected from headers:', headerCurrency);
    return headerCurrency;
  }

  // Strategy 2: Try to get from IP geolocation
  const clientIP = getClientIP(req);
  const ipCurrency = getCurrencyFromIP(clientIP);
  
  console.log('Currency detected from IP:', ipCurrency);
  return ipCurrency;
}

export default {
  getCurrencyFromIP,
  getCurrencyFromHeaders,
  getClientIP,
  detectCurrency
};