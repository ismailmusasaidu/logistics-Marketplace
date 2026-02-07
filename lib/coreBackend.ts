import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const coreUrl =
  Constants.expoConfig?.extra?.coreSupabaseUrl ||
  process.env.EXPO_PUBLIC_CORE_BACKEND_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const coreAnonKey =
  Constants.expoConfig?.extra?.coreSupabaseAnonKey ||
  process.env.EXPO_PUBLIC_CORE_BACKEND_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!coreUrl || !coreAnonKey) {
  throw new Error('Missing CORE_BACKEND Supabase environment variables');
}

export const coreBackend: SupabaseClient = createClient(coreUrl, coreAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const CORE_URL = coreUrl;

export type CoreProfile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CoreWallet = {
  id: string;
  user_id: string;
  balance: number;
  locked_balance: number;
  created_at: string;
  updated_at: string;
};

export type CoreWalletTransaction = {
  id: string;
  user_id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference: string | null;
  reference_type: string | null;
  source_app: 'logistics' | 'marketplace';
  balance_after: number;
  created_at: string;
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await coreBackend.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function callEdgeFunction<T>(
  functionName: string,
  options: { method?: string; body?: any; params?: Record<string, string> } = {}
): Promise<T> {
  const { method = 'POST', body, params } = options;
  const headers = await getAuthHeaders();

  let url = `${CORE_URL}/functions/v1/${functionName}`;
  if (params) {
    const search = new URLSearchParams(params);
    url += `?${search.toString()}`;
  }

  const fetchOptions: RequestInit = { method, headers };
  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json();

  if (!response.ok && !data.success) {
    throw new Error(data.error || `Edge function ${functionName} failed`);
  }

  return data as T;
}

export const coreWalletService = {
  async getBalance(): Promise<CoreWallet> {
    const data = await callEdgeFunction<{ success: boolean; wallet: CoreWallet }>(
      'get-wallet-balance'
    );
    return data.wallet;
  },

  async credit(
    amount: number,
    sourceApp: 'logistics' | 'marketplace',
    description = '',
    reference: string | null = null,
    referenceType: string | null = null
  ): Promise<{ transaction_id: string; new_balance: number }> {
    const data = await callEdgeFunction<{
      success: boolean;
      transaction_id: string;
      new_balance: number;
    }>('credit-wallet', {
      body: { amount, description, reference, reference_type: referenceType, source_app: sourceApp },
    });
    return { transaction_id: data.transaction_id, new_balance: data.new_balance };
  },

  async debit(
    amount: number,
    sourceApp: 'logistics' | 'marketplace',
    description = '',
    reference: string | null = null,
    referenceType: string | null = null
  ): Promise<{ transaction_id: string; new_balance: number }> {
    const data = await callEdgeFunction<{
      success: boolean;
      transaction_id: string;
      new_balance: number;
    }>('debit-wallet', {
      body: { amount, description, reference, reference_type: referenceType, source_app: sourceApp },
    });
    return { transaction_id: data.transaction_id, new_balance: data.new_balance };
  },

  async getHistory(
    limit = 50,
    offset = 0,
    sourceApp?: 'logistics' | 'marketplace'
  ): Promise<{
    balance: number;
    locked_balance: number;
    transactions: CoreWalletTransaction[];
    total: number;
  }> {
    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(offset),
    };
    if (sourceApp) {
      params.source_app = sourceApp;
    }

    return callEdgeFunction<{
      success: boolean;
      balance: number;
      locked_balance: number;
      transactions: CoreWalletTransaction[];
      total: number;
    }>('wallet-history', { method: 'GET', params });
  },

  formatCurrency(amount: number): string {
    return `\u20A6${amount.toFixed(2)}`;
  },
};
