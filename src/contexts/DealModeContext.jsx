import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEAL_MODE_RENT,
  DEAL_MODE_SALE,
  loadDealMode,
  normalizeDealMode,
  saveDealMode,
  themeForDealMode,
} from '../theme/dealModeTheme.js';
import { defaultTradeForDealMode, tradesForDealMode } from '../utils/dealModeMatch.js';

const DealModeContext = createContext(null);

export function DealModeProvider({ children }) {
  const [mode, setModeState] = useState(() => loadDealMode());

  const setDealMode = useCallback((next) => {
    const normalized = normalizeDealMode(next);
    setModeState(normalized);
    saveDealMode(normalized);
  }, []);

  const value = useMemo(() => {
    const isRent = mode === DEAL_MODE_RENT;
    return {
      mode,
      isRent,
      isSale: !isRent,
      setDealMode,
      theme: themeForDealMode(mode),
      trades: tradesForDealMode(mode),
      defaultTrade: defaultTradeForDealMode(mode),
    };
  }, [mode, setDealMode]);

  return (
    <DealModeContext.Provider value={value}>
      {children}
    </DealModeContext.Provider>
  );
}

export function useDealMode() {
  const ctx = useContext(DealModeContext);
  if (!ctx) {
    return {
      mode: DEAL_MODE_SALE,
      isRent: false,
      isSale: true,
      setDealMode: () => {},
      theme: themeForDealMode(DEAL_MODE_SALE),
      trades: tradesForDealMode(DEAL_MODE_SALE),
      defaultTrade: defaultTradeForDealMode(DEAL_MODE_SALE),
    };
  }
  return ctx;
}
