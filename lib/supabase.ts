import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'customer' | 'rider' | 'vendor' | 'admin';
  avatar_url: string | null;
  vendor_status: 'pending' | 'approved' | 'rejected' | null;
  business_name: string | null;
  business_description: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_license: string | null;
  rejection_reason: string | null;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  customer_id: string;
  vendor_id: string | null;
  vendor_user_id: string | null;
  order_number: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'delivered' | 'cancelled';
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  delivery_address: string;
  delivery_type: 'pickup' | 'delivery';
  payment_method: 'wallet' | 'online' | 'cash_on_delivery' | 'transfer';
  payment_status: 'pending' | 'completed' | 'failed';
  discount_amount: number;
  promo_code: string | null;
  promo_id: string | null;
  notes: string | null;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_for_pickup_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};
