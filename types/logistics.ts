export type BadgeType = 'hot_deal' | 'featured' | 'trending' | 'limited';
export type DisplayMode = 'banner' | 'modal' | 'both';
export type DisplayFrequency = 'once' | 'daily' | 'always';

export type LogisticsAdvert = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  badge_text: string;
  badge_type: BadgeType;
  action_text: string | null;
  action_url: string | null;
  display_mode: DisplayMode;
  display_frequency: DisplayFrequency;
  priority: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};
