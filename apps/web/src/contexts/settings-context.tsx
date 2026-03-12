"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ── Types ──

export interface DecimalSettings {
  /** Decimal places for currency/metal prices (default 3) */
  price: number;
  /** Decimal places for weight quantities in oz/grams (default 2) */
  weight: number;
  /** Decimal places for balances, debits, credits (default 2) */
  balance: number;
}

export interface AppSettings {
  decimals: DecimalSettings;
  /** Column accessorKeys to hide in PMX Ledger (default: ["balanceUsd", "balanceZar"]) */
  hiddenColumns: string[];
}

interface SettingsContextValue {
  settings: AppSettings;
  updateDecimals: (partial: Partial<DecimalSettings>) => void;
  toggleColumn: (columnKey: string) => void;
  resetDefaults: () => void;
}

// ── Defaults ──

const STORAGE_KEY = "foundation-settings";

const DEFAULT_SETTINGS: AppSettings = {
  decimals: {
    price: 3,
    weight: 2,
    balance: 2,
  },
  hiddenColumns: ["balanceUsd", "balanceZar"],
};

// ── Context ──

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      decimals: {
        price: parsed.decimals?.price ?? DEFAULT_SETTINGS.decimals.price,
        weight: parsed.decimals?.weight ?? DEFAULT_SETTINGS.decimals.weight,
        balance: parsed.decimals?.balance ?? DEFAULT_SETTINGS.decimals.balance,
      },
      hiddenColumns: parsed.hiddenColumns ?? DEFAULT_SETTINGS.hiddenColumns,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

// ── Provider ──

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Initialize with defaults to avoid SSR mismatch
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  // Persist on every change (after hydration)
  useEffect(() => {
    if (hydrated) {
      saveSettings(settings);
    }
  }, [settings, hydrated]);

  const updateDecimals = useCallback((partial: Partial<DecimalSettings>) => {
    setSettings((prev) => ({
      ...prev,
      decimals: { ...prev.decimals, ...partial },
    }));
  }, []);

  const toggleColumn = useCallback((columnKey: string) => {
    setSettings((prev) => {
      const hidden = prev.hiddenColumns.includes(columnKey)
        ? prev.hiddenColumns.filter((k) => k !== columnKey)
        : [...prev.hiddenColumns, columnKey];
      return { ...prev, hiddenColumns: hidden };
    });
  }, []);

  const resetDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, updateDecimals, toggleColumn, resetDefaults }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// ── Hook ──

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
