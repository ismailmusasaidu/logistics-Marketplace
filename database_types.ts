export type UserRole = 'customer' | 'vendor' | 'admin';

export type VendorStatus = 'pending' | 'approved' | 'rejected';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  vendor_status: VendorStatus;
  business_name?: string;
  business_description?: string;
  business_address?: string;
  business_phone?: string;
  business_license?: string;
  rejection_reason?: string;
  is_suspended: boolean;
  suspended_at?: string;
  suspended_by?: string;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  reference_type?: 'order' | 'topup' | 'refund' | 'admin_adjustment' | 'withdrawal';
  reference_id?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Vendor {
  id: string;
  user_id: string;
  business_name: string;
  description?: string;
  logo_url?: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  is_verified: boolean;
  is_active: boolean;
  rating: number;
  total_sales: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  vendor_id: string;
  category_id: string;
  name: string;
  description?: string;
  image_url?: string;
  price: number;
  unit: string;
  stock_quantity: number;
  is_available: boolean;
  is_featured: boolean;
  rating: number;
  total_reviews: number;
  discount_percentage: number;
  discount_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface Cart {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'transfer' | 'online' | 'wallet' | 'cash_on_delivery';
export type PaymentStatus = 'pending' | 'completed' | 'failed';

export interface Order {
  id: string;
  customer_id: string;
  vendor_id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  delivery_address: string;
  delivery_type: 'pickup' | 'delivery';
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  order_id?: string;
  rating: number;
  comment?: string;
  verified_purchase: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorResponse {
  id: string;
  review_id: string;
  vendor_id: string;
  response_text: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewHelpfulness {
  id: string;
  review_id: string;
  user_id: string;
  is_helpful: boolean;
  created_at: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  base_price: number;
  price_per_km: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPricing {
  id: string;
  default_base_price: number;
  default_price_per_km: number;
  min_delivery_charge: number;
  max_delivery_distance_km: number;
  free_delivery_threshold: number;
  updated_at: string;
  updated_by?: string;
}

export interface DeliveryAddress {
  id: string;
  user_id: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  latitude?: number;
  longitude?: number;
  is_default: boolean;
  zone_id?: string;
  distance_from_store_km?: number;
  estimated_delivery_price?: number;
  created_at: string;
  updated_at: string;
}

export type PromotionDiscountType = 'percentage' | 'fixed_amount' | 'free_delivery';

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description?: string;
  discount_type: PromotionDiscountType;
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number;
  valid_from: string;
  valid_until: string;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

export interface DeliveryAdjustment {
  id: string;
  order_id: string;
  original_price: number;
  adjusted_price: number;
  adjustment_amount: number;
  reason: string;
  adjusted_by: string;
  created_at: string;
}

export interface DeliveryLog {
  id: string;
  user_id?: string;
  order_id?: string;
  address_id?: string;
  action: string;
  details?: any;
  zone_id?: string;
  distance_km?: number;
  base_price?: number;
  distance_price?: number;
  promotion_discount?: number;
  adjustment_amount?: number;
  final_price?: number;
  created_at: string;
}

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  description: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type AdvertDisplayFrequency = 'once' | 'daily' | 'always';

export interface Advert {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  action_text?: string;
  action_url?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  display_frequency: AdvertDisplayFrequency;
  priority: number;
  hot_deal_text?: string;
  featured_text?: string;
  trending_text?: string;
  limited_offer_text?: string;
  created_at: string;
  updated_at: string;
}

export interface Wishlist {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}
