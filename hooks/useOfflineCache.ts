import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function useOfflineCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = CACHE_TTL_MS
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadFromCache = useCallback(async (): Promise<CacheEntry<T> | null> => {
    try {
      const raw = await AsyncStorage.getItem(`cache_${key}`);
      if (!raw) return null;
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return null;
    }
  }, [key]);

  const saveToCache = useCallback(async (value: T) => {
    try {
      const entry: CacheEntry<T> = { data: value, timestamp: Date.now() };
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch {}
  }, [key]);

  const fetchFresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const fresh = await fetcher();
      setData(fresh);
      setIsStale(false);
      setLastUpdated(new Date());
      await saveToCache(fresh);
      return fresh;
    } catch {
      const cached = await loadFromCache();
      if (cached) {
        setData(cached.data);
        setIsStale(true);
        setLastUpdated(new Date(cached.timestamp));
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetcher, saveToCache, loadFromCache]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await loadFromCache();
      if (cached && !cancelled) {
        setData(cached.data);
        setLastUpdated(new Date(cached.timestamp));
        const age = Date.now() - cached.timestamp;
        if (age < ttlMs) {
          setLoading(false);
          setIsStale(false);
          fetchFresh(false);
          return;
        }
        setIsStale(true);
      }
      if (!cancelled) await fetchFresh(true);
    })();
    return () => { cancelled = true; };
  }, [key]);

  const refresh = useCallback(() => fetchFresh(true), [fetchFresh]);

  const invalidate = useCallback(async () => {
    await AsyncStorage.removeItem(`cache_${key}`);
    await fetchFresh(true);
  }, [key, fetchFresh]);

  return { data, loading, isStale, lastUpdated, refresh, invalidate };
}

export async function clearAllCaches() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith('cache_'));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch {}
}

export function formatCacheAge(lastUpdated: Date | null): string {
  if (!lastUpdated) return '';
  const diffMs = Date.now() - lastUpdated.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
