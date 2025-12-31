import fetch from 'node-fetch';

/**
 * Get conversion rate from `from` -> `to` using multiple free APIs with fallbacks
 * Priority: Frankfurter (no key) > ExchangeRate-API (no key) > Fawaz API (no key) > exchangerate.host (requires key)
 */
export async function getConversionRate(from, to) {
  if (!from || !to) throw new Error('from and to currencies required');
  const f = from.trim().toUpperCase();
  const t = to.trim().toUpperCase();
  if (f === t) return 1;

  const errors = [];

  // Try Frankfurter API (free, no key, reliable)
  try {
    console.log(`Trying Frankfurter API: ${f} -> ${t}`);
    return await getFrankfurterRate(f, t);
  } catch (error) {
    console.warn('Frankfurter API failed:', error.message);
    errors.push({ api: 'Frankfurter', error: error.message });
  }

  // Try ExchangeRate-API (free, no key, good uptime)
  try {
    console.log(`Trying ExchangeRate-API: ${f} -> ${t}`);
    return await getExchangeRateAPIRate(f, t);
  } catch (error) {
    console.warn('ExchangeRate-API failed:', error.message);
    errors.push({ api: 'ExchangeRate-API', error: error.message });
  }

  // Try Fawaz Currency API (free, no key, CDN-backed)
  try {
    console.log(`Trying Fawaz Currency API: ${f} -> ${t}`);
    return await getFawazRate(f, t);
  } catch (error) {
    console.warn('Fawaz API failed:', error.message);
    errors.push({ api: 'Fawaz', error: error.message });
  }

  // Try exchangerate.host if API key is available
  if (process.env.EXCHANGERATE_API_KEY) {
    try {
      console.log(`Trying exchangerate.host: ${f} -> ${t}`);
      return await getExchangeRateHostRate(f, t, process.env.EXCHANGERATE_API_KEY);
    } catch (error) {
      console.warn('exchangerate.host failed:', error.message);
      errors.push({ api: 'exchangerate.host', error: error.message });
    }
  }

  // All APIs failed
  console.error('All exchange rate APIs failed:', errors);
  throw new Error(`Failed to fetch exchange rate after trying ${errors.length} APIs. Last error: ${errors[errors.length - 1]?.error}`);
}

/**
 * Frankfurter API - Free, no key required, reliable
 * Docs: https://www.frankfurter.app/docs/
 */
async function getFrankfurterRate(from, to) {
  const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
  
  const resp = await fetch(url, { 
    timeout: 8000,
    headers: { 'Accept': 'application/json' }
  });
  
  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${errorText}`);
  }
  
  const data = await resp.json();
  
  const rate = data?.rates?.[to];
  if (!rate || isNaN(rate) || rate <= 0) {
    throw new Error('Invalid rate in response');
  }
  
  console.log(`✓ Frankfurter: ${from} -> ${to} = ${rate}`);
  return Number(rate);
}

/**
 * ExchangeRate-API - Free tier, no key for basic use
 * Docs: https://www.exchangerate-api.com/docs/free
 */
async function getExchangeRateAPIRate(from, to) {
  const url = `https://open.er-api.com/v6/latest/${from}`;
  
  const resp = await fetch(url, { 
    timeout: 8000,
    headers: { 'Accept': 'application/json' }
  });
  
  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${errorText}`);
  }
  
  const data = await resp.json();
  
  if (data.result === 'error') {
    throw new Error(data['error-type'] || 'API error');
  }
  
  const rate = data?.rates?.[to];
  if (!rate || isNaN(rate) || rate <= 0) {
    throw new Error('Invalid rate in response');
  }
  
  console.log(`✓ ExchangeRate-API: ${from} -> ${to} = ${rate}`);
  return Number(rate);
}

/**
 * Fawaz Currency API - Free, CDN-backed, no key
 * Docs: https://github.com/fawazahmed0/currency-api
 */
async function getFawazRate(from, to) {
  const fromLower = from.toLowerCase();
  const toLower = to.toLowerCase();
  
  // Try primary CDN
  try {
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${fromLower}.json`;
    
    const resp = await fetch(url, { 
      timeout: 8000,
      headers: { 'Accept': 'application/json' }
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    
    const data = await resp.json();
    const rate = data?.[fromLower]?.[toLower];
    
    if (!rate || isNaN(rate) || rate <= 0) {
      throw new Error('Invalid rate in response');
    }
    
    console.log(`✓ Fawaz API: ${from} -> ${to} = ${rate}`);
    return Number(rate);
  } catch (cdnError) {
    // Try fallback domain
    const fallbackUrl = `https://latest.currency-api.pages.dev/v1/currencies/${fromLower}.json`;
    
    const resp = await fetch(fallbackUrl, { 
      timeout: 8000,
      headers: { 'Accept': 'application/json' }
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    
    const data = await resp.json();
    const rate = data?.[fromLower]?.[toLower];
    
    if (!rate || isNaN(rate) || rate <= 0) {
      throw new Error('Invalid rate in response');
    }
    
    console.log(`✓ Fawaz API (fallback): ${from} -> ${to} = ${rate}`);
    return Number(rate);
  }
}

/**
 * exchangerate.host - Requires API key (add to .env if you have one)
 * Get key at: https://exchangerate.host/
 */
async function getExchangeRateHostRate(from, to, apiKey) {
  const url = `https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=1&access_key=${apiKey}`;
  
  const resp = await fetch(url, { 
    timeout: 8000,
    headers: { 'Accept': 'application/json' }
  });
  
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  
  const data = await resp.json();
  
  if (data.success === false) {
    throw new Error(data.error?.info || 'API error');
  }
  
  const rate = data?.info?.rate ?? data?.info?.quote ?? data?.result;
  if (!rate || isNaN(rate) || rate <= 0) {
    throw new Error('Invalid rate in response');
  }
  
  console.log(`✓ exchangerate.host: ${from} -> ${to} = ${rate}`);
  return Number(rate);
}

export default { getConversionRate };