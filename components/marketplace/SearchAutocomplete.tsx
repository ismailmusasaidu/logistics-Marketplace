import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  Platform,
} from 'react-native';
import { Search, Clock, X, TrendingUp, ArrowUpLeft } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/marketplace/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { Fonts } from '@/constants/fonts';

const HISTORY_KEY = 'search_history_marketplace';
const MAX_HISTORY = 10;

interface SearchAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (query: string) => void;
  placeholder?: string;
}

interface Suggestion {
  type: 'history' | 'product' | 'trending';
  text: string;
  id?: string;
}

export default function SearchAutocomplete({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Search products...',
}: SearchAutocompleteProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadHistory();
    loadTrending();
  }, []);

  useEffect(() => {
    if (focused) {
      Animated.timing(dropdownAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      Animated.timing(dropdownAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [focused]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      buildDefaultSuggestions();
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchProductSuggestions(value.trim());
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, history, trending]);

  const loadHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  };

  const saveHistory = async (query: string, current: string[]) => {
    const updated = [query, ...current.filter(h => h !== query)].slice(0, MAX_HISTORY);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const removeHistoryItem = async (item: string) => {
    const updated = history.filter(h => h !== item);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const clearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  };

  const loadTrending = async () => {
    try {
      const { data } = await supabase
        .from('search_logs')
        .select('query')
        .order('count', { ascending: false })
        .limit(5);
      if (data) setTrending(data.map((r: any) => r.query));
    } catch {}
  };

  const buildDefaultSuggestions = useCallback(() => {
    const items: Suggestion[] = [];
    history.slice(0, 5).forEach(h => items.push({ type: 'history', text: h }));
    trending.slice(0, 3).forEach(t => {
      if (!history.includes(t)) items.push({ type: 'trending', text: t });
    });
    setSuggestions(items);
  }, [history, trending]);

  const fetchProductSuggestions = async (query: string) => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .eq('is_available', true)
        .limit(6);

      const productSuggestions: Suggestion[] = (data || []).map((p: any) => ({
        type: 'product' as const,
        text: p.name,
        id: p.id,
      }));

      const historySuggestions = history
        .filter(h => h.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 3)
        .map(h => ({ type: 'history' as const, text: h }));

      setSuggestions([...historySuggestions, ...productSuggestions]);
    } catch {
      buildDefaultSuggestions();
    }
  };

  const handleSelect = (text: string) => {
    onChangeText(text);
    saveHistory(text, history);
    logSearch(text);
    onSubmit(text);
    inputRef.current?.blur();
    setFocused(false);
  };

  const handleSubmit = () => {
    if (!value.trim()) return;
    saveHistory(value.trim(), history);
    logSearch(value.trim());
    onSubmit(value.trim());
    inputRef.current?.blur();
    setFocused(false);
  };

  const logSearch = async (query: string) => {
    try {
      await supabase.rpc('log_search_query', { search_query: query }).throwOnError();
    } catch {}
  };

  const showDropdown = focused && suggestions.length > 0;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputRow, { backgroundColor: colors.inputBackground, borderColor: focused ? colors.primary : colors.inputBorder }]}>
        <Search size={18} color={focused ? colors.primary : colors.textMuted} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text, fontFamily: Fonts.spaceRegular }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => { setFocused(true); buildDefaultSuggestions(); }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => { onChangeText(''); buildDefaultSuggestions(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && (
        <Animated.View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: dropdownAnim,
              transform: [{ translateY: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
            },
          ]}
        >
          {history.length > 0 && !value.trim() && (
            <View style={styles.dropdownHeader}>
              <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Recent</Text>
              <TouchableOpacity onPress={clearHistory}>
                <Text style={[styles.clearAll, { color: colors.primary }]}>Clear all</Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={suggestions}
            keyExtractor={(item, i) => `${item.type}-${item.text}-${i}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionRow, { borderBottomColor: colors.borderLight }]}
                onPress={() => handleSelect(item.text)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                  {item.type === 'history' && <Clock size={14} color={colors.textMuted} />}
                  {item.type === 'trending' && <TrendingUp size={14} color={colors.primary} />}
                  {item.type === 'product' && <Search size={14} color={colors.textSecondary} />}
                </View>
                <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={1}>
                  {item.text}
                </Text>
                {item.type === 'history' && (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); removeHistoryItem(item.text); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.removeBtn}
                  >
                    <X size={12} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
                {item.type !== 'history' && (
                  <ArrowUpLeft size={14} color={colors.textMuted} style={styles.fillIcon} />
                )}
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="always"
            style={{ maxHeight: 280 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 100,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    gap: 8,
  },
  searchIcon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 6 },
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' },
    }),
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dropdownLabel: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearAll: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk-Medium',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk-Regular',
  },
  removeBtn: {
    padding: 4,
  },
  fillIcon: {
    flexShrink: 0,
  },
});
