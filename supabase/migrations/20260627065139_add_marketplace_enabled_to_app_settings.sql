ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS marketplace_enabled boolean NOT NULL DEFAULT true;

UPDATE public.app_settings SET marketplace_enabled = true WHERE id = 1;
