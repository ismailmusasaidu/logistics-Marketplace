import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Theme = 'light' | 'dark';

export const Colors = {
  light: {
    primary: '#ff8c00',
    primaryLight: '#ff9a1f',
    primaryDark: '#e67a00',
    background: '#f8f5f0',
    backgroundSecondary: '#faf8f5',
    surface: '#ffffff',
    surfaceSecondary: '#f5f1ec',
    border: '#e8e0d8',
    borderLight: '#f0ebe4',
    text: '#1a1a1a',
    textSecondary: '#78716c',
    textMuted: '#a8a29e',
    textInverse: '#ffffff',
    success: '#059669',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    error: '#ef4444',
    errorLight: '#fee2e2',
    info: '#3b82f6',
    infoLight: '#dbeafe',
    cardBackground: '#ffffff',
    headerBackground: '#ffffff',
    tabBar: '#ffffff',
    tabBarBorder: '#e8e0d8',
    inputBackground: '#ffffff',
    inputBorder: '#e8e0d8',
    shadow: 'rgba(0,0,0,0.08)',
    overlay: 'rgba(0,0,0,0.5)',
    gradientStart: '#ff9a1f',
    gradientMid: '#ff8c00',
    gradientEnd: '#e67a00',
    statusPending: '#f59e0b',
    statusConfirmed: '#3b82f6',
    statusPreparing: '#ff8c00',
    statusDelivery: '#f97316',
    statusDelivered: '#059669',
    statusCancelled: '#ef4444',
    walletGradientStart: '#2d1f12',
    walletGradientEnd: '#3d2915',
  },
  dark: {
    primary: '#ff9a1f',
    primaryLight: '#ffad40',
    primaryDark: '#ff8c00',
    background: '#0f0f0f',
    backgroundSecondary: '#1a1a1a',
    surface: '#1e1e1e',
    surfaceSecondary: '#252525',
    border: '#2e2e2e',
    borderLight: '#262626',
    text: '#f5f5f5',
    textSecondary: '#a8a29e',
    textMuted: '#6b7280',
    textInverse: '#0f0f0f',
    success: '#10b981',
    successLight: '#064e3b',
    warning: '#f59e0b',
    warningLight: '#451a03',
    error: '#f87171',
    errorLight: '#450a0a',
    info: '#60a5fa',
    infoLight: '#1e3a5f',
    cardBackground: '#1e1e1e',
    headerBackground: '#1a1a1a',
    tabBar: '#1a1a1a',
    tabBarBorder: '#2e2e2e',
    inputBackground: '#252525',
    inputBorder: '#3a3a3a',
    shadow: 'rgba(0,0,0,0.4)',
    overlay: 'rgba(0,0,0,0.7)',
    gradientStart: '#ff9a1f',
    gradientMid: '#ff8c00',
    gradientEnd: '#e67a00',
    statusPending: '#f59e0b',
    statusConfirmed: '#60a5fa',
    statusPreparing: '#ff9a1f',
    statusDelivery: '#fb923c',
    statusDelivered: '#10b981',
    statusCancelled: '#f87171',
    walletGradientStart: '#1a1009',
    walletGradientEnd: '#2d1f12',
  },
};

export type ThemeColors = typeof Colors.light;

type ThemeContextType = {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: () => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme_preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light') {
        setTheme(saved);
      }
    });
  }, []);

  const toggleTheme = async () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: Colors[theme], toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
