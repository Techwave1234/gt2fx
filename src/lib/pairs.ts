export type PairCategory = 'FX' | 'Metals' | 'Indices' | 'Crypto' | 'Energies'

export interface PairSpec {
  symbol: string
  /** Price increment counted as one "pip" for journal R math */
  pipSize: number
  /** Approx USD value of 1 pip per 1.0 standard lot/contract */
  pipValue: number
  category: PairCategory
}

const fx = (symbol: string, jpy = false): PairSpec => ({
  symbol,
  pipSize: jpy ? 0.01 : 0.0001,
  pipValue: symbol.endsWith('USD') ? 10 : symbol.endsWith('JPY') ? 6.7 : 10,
  category: 'FX',
})

/**
 * Complete catalog: 41 FX pairs (majors, crosses, exotics), 7 metals, 11 indices, 18 crypto, 3 energies — 80 instruments.
 */
export const PAIRS: PairSpec[] = [
  // --- FX majors ---
  fx('EURUSD'), fx('GBPUSD'), fx('AUDUSD'), fx('NZDUSD'), fx('USDJPY', true), fx('USDCHF'), fx('USDCAD'),
  // --- FX crosses ---
  fx('EURGBP'), fx('EURJPY', true), fx('EURCHF'), fx('EURAUD'), fx('EURNZD'), fx('EURCAD'),
  fx('GBPJPY', true), fx('GBPCHF'), fx('GBPAUD'), fx('GBPNZD'), fx('GBPCAD'),
  fx('AUDJPY', true), fx('AUDCHF'), fx('AUDNZD'), fx('AUDCAD'),
  fx('NZDJPY', true), fx('NZDCHF'), fx('NZDCAD'),
  fx('CADJPY', true), fx('CHFJPY', true),
  // --- FX exotics ---
  fx('USDSEK'), fx('USDNOK'), fx('USDDKK'), fx('USDPLN'), fx('USDHUF'), fx('USDCZK'),
  fx('USDTRY'), fx('USDMXN'), fx('USDZAR'), fx('USDSGD'), fx('USDCNH'), fx('USDHKD'),
  fx('USDTHB'), fx('USDILS'),
  // --- Metals ---
  { symbol: 'XAUUSD', pipSize: 0.1, pipValue: 10, category: 'Metals' },
  { symbol: 'XAGUSD', pipSize: 0.01, pipValue: 50, category: 'Metals' },
  { symbol: 'XPTUSD', pipSize: 0.1, pipValue: 5, category: 'Metals' },
  { symbol: 'XPDUSD', pipSize: 0.1, pipValue: 1, category: 'Metals' },
  { symbol: 'XAUEUR', pipSize: 0.1, pipValue: 11, category: 'Metals' },
  { symbol: 'XAUGBP', pipSize: 0.1, pipValue: 13, category: 'Metals' },
  { symbol: 'XAUJPY', pipSize: 1, pipValue: 0.067, category: 'Metals' },
  // --- Indices (1 contract ≈ 1 unit) ---
  { symbol: 'NAS100', pipSize: 1, pipValue: 1, category: 'Indices' },
  { symbol: 'US30', pipSize: 1, pipValue: 1, category: 'Indices' },
  { symbol: 'SPX500', pipSize: 0.1, pipValue: 10, category: 'Indices' },
  { symbol: 'US2000', pipSize: 0.1, pipValue: 10, category: 'Indices' },
  { symbol: 'GER40', pipSize: 1, pipValue: 1.08, category: 'Indices' },
  { symbol: 'UK100', pipSize: 1, pipValue: 1.27, category: 'Indices' },
  { symbol: 'FRA40', pipSize: 1, pipValue: 1.08, category: 'Indices' },
  { symbol: 'EU50', pipSize: 1, pipValue: 1.08, category: 'Indices' },
  { symbol: 'JPN225', pipSize: 1, pipValue: 0.0067, category: 'Indices' },
  { symbol: 'AUS200', pipSize: 1, pipValue: 0.66, category: 'Indices' },
  { symbol: 'HK50', pipSize: 1, pipValue: 0.128, category: 'Indices' },
  // --- Crypto (1 lot = 1 coin) ---
  { symbol: 'BTCUSD', pipSize: 1, pipValue: 1, category: 'Crypto' },
  { symbol: 'ETHUSD', pipSize: 0.1, pipValue: 10, category: 'Crypto' },
  { symbol: 'SOLUSD', pipSize: 0.01, pipValue: 100, category: 'Crypto' },
  { symbol: 'XRPUSD', pipSize: 0.0001, pipValue: 100000, category: 'Crypto' },
  { symbol: 'ADAUSD', pipSize: 0.0001, pipValue: 100000, category: 'Crypto' },
  { symbol: 'DOGEUSD', pipSize: 0.00001, pipValue: 1000000, category: 'Crypto' },
  { symbol: 'LTCUSD', pipSize: 0.01, pipValue: 100, category: 'Crypto' },
  { symbol: 'BCHUSD', pipSize: 0.01, pipValue: 100, category: 'Crypto' },
  { symbol: 'DOTUSD', pipSize: 0.001, pipValue: 1000, category: 'Crypto' },
  { symbol: 'LINKUSD', pipSize: 0.001, pipValue: 1000, category: 'Crypto' },
  { symbol: 'AVAXUSD', pipSize: 0.001, pipValue: 1000, category: 'Crypto' },
  { symbol: 'BNBUSD', pipSize: 0.01, pipValue: 100, category: 'Crypto' },
  { symbol: 'TRXUSD', pipSize: 0.0001, pipValue: 100000, category: 'Crypto' },
  { symbol: 'SHIBUSD', pipSize: 0.0000001, pipValue: 10000000000, category: 'Crypto' },
  { symbol: 'ATOMUSD', pipSize: 0.001, pipValue: 1000, category: 'Crypto' },
  { symbol: 'NEARUSD', pipSize: 0.001, pipValue: 1000, category: 'Crypto' },
  { symbol: 'XLMUSD', pipSize: 0.0001, pipValue: 100000, category: 'Crypto' },
  { symbol: 'UNIUSD', pipSize: 0.001, pipValue: 1000, category: 'Crypto' },
  // --- Energies ---
  { symbol: 'USOIL', pipSize: 0.01, pipValue: 10, category: 'Energies' },
  { symbol: 'UKOIL', pipSize: 0.01, pipValue: 10, category: 'Energies' },
  { symbol: 'NATGAS', pipSize: 0.001, pipValue: 10, category: 'Energies' },
]

/** Friendly names the AI parser understands → canonical symbols */
export const PAIR_ALIASES: Record<string, string> = {
  GOLD: 'XAUUSD',
  SILVER: 'XAGUSD',
  PLATINUM: 'XPTUSD',
  PALLADIUM: 'XPDUSD',
  OIL: 'USOIL',
  WTI: 'USOIL',
  CRUDE: 'USOIL',
  BRENT: 'UKOIL',
  GAS: 'NATGAS',
  NATGAS: 'NATGAS',
  NASDAQ: 'NAS100',
  NAS: 'NAS100',
  DOW: 'US30',
  DOWJONES: 'US30',
  SP500: 'SPX500',
  DAX: 'GER40',
  FTSE: 'UK100',
  CAC: 'FRA40',
  NIKKEI: 'JPN225',
  ASX: 'AUS200',
  HANGSENG: 'HK50',
  STOXX: 'EU50',
  BITCOIN: 'BTCUSD',
  ETHEREUM: 'ETHUSD',
  SOLANA: 'SOLUSD',
  RIPPLE: 'XRPUSD',
  CARDANO: 'ADAUSD',
  DOGECOIN: 'DOGEUSD',
  LITECOIN: 'LTCUSD',
}

const SPEC_MAP = new Map(PAIRS.map(p => [p.symbol, p]))

/** Canonicalize any pair input: uppercases and resolves aliases (gold → XAUUSD). */
export function resolvePair(input: string): string {
  const up = input.trim().toUpperCase().replace(/[\s_\/-]/g, '')
  return PAIR_ALIASES[up] ?? up
}

export function pairSpec(symbol: string): PairSpec | undefined {
  return SPEC_MAP.get(resolvePair(symbol))
}

/** Ordered symbol list for the datalist: majors, metals first, then the rest. */
export const PAIR_SYMBOLS: string[] = [
  ...PAIRS.filter(p => p.category === 'FX' && p.symbol.endsWith('USD')).map(p => p.symbol),
  ...PAIRS.filter(p => p.category === 'Metals').map(p => p.symbol),
  ...PAIRS.filter(p => p.category === 'Indices').map(p => p.symbol),
  ...PAIRS.filter(p => p.category === 'Energies').map(p => p.symbol),
  ...PAIRS.filter(p => p.category === 'FX' && !p.symbol.endsWith('USD')).map(p => p.symbol),
  ...PAIRS.filter(p => p.category === 'Crypto').map(p => p.symbol),
]

/** Regex body matching every known symbol + alias (for the AI text parser) */
export const PAIR_MATCH_SOURCE: string = [...SPEC_MAP.keys(), ...Object.keys(PAIR_ALIASES)].join('|')
