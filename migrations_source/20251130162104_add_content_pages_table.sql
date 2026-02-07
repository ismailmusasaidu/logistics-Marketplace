/*
  # Create Content Pages Table

  1. New Tables
    - `content_pages`
      - `id` (uuid, primary key)
      - `page_type` (text) - 'help_center', 'terms_of_service', 'privacy_policy'
      - `title` (text) - Page title
      - `content` (jsonb) - Structured content for the page
      - `last_updated_by` (uuid) - Admin who last updated
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `content_pages` table
    - Add policy for anyone to read content pages
    - Add policy for admins to create/update content pages
  
  3. Initial Data
    - Create default entries for help_center, terms_of_service, and privacy_policy
*/

CREATE TABLE IF NOT EXISTS content_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type text UNIQUE NOT NULL CHECK (page_type IN ('help_center', 'terms_of_service', 'privacy_policy')),
  title text NOT NULL,
  content jsonb NOT NULL,
  last_updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE content_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read content pages"
  ON content_pages
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert content pages"
  ON content_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update content pages"
  ON content_pages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

INSERT INTO content_pages (page_type, title, content) VALUES
(
  'help_center',
  'Help Center',
  '{
    "sections": [
      {
        "title": "Frequently Asked Questions",
        "items": [
          {
            "question": "How do I place an order?",
            "answer": "Browse products on the home screen, tap on a product to view details, select quantity, and add to cart. Then go to the cart tab and proceed to checkout."
          },
          {
            "question": "How do I track my order?",
            "answer": "Go to the Orders tab to view all your orders. Tap on any order to see detailed tracking information and current status."
          },
          {
            "question": "What payment methods are accepted?",
            "answer": "We accept all major credit cards, debit cards, and digital payment methods. Payment is processed securely through our payment gateway."
          },
          {
            "question": "How do I become a vendor?",
            "answer": "Register as a vendor during sign up or contact admin support. Once approved, you can set up your store and start listing products."
          }
        ]
      },
      {
        "title": "Contact Support",
        "items": [
          {
            "type": "email",
            "label": "Email Support",
            "value": "support@marketplace.com"
          },
          {
            "type": "phone",
            "label": "Phone Support",
            "value": "+1 (555) 123-4567"
          },
          {
            "type": "chat",
            "label": "Live Chat",
            "value": "Available 9 AM - 6 PM EST"
          }
        ]
      }
    ]
  }'::jsonb
),
(
  'terms_of_service',
  'Terms of Service',
  '{
    "lastUpdated": "November 30, 2025",
    "sections": [
      {
        "heading": "1. Acceptance of Terms",
        "content": "By accessing and using this marketplace platform, you accept and agree to be bound by the terms and provision of this agreement."
      },
      {
        "heading": "2. Use License",
        "content": "Permission is granted to temporarily access the materials on the marketplace platform for personal, non-commercial transitory viewing only."
      },
      {
        "heading": "3. User Accounts",
        "content": "When you create an account with us, you must provide accurate, complete, and current information."
      }
    ]
  }'::jsonb
),
(
  'privacy_policy',
  'Privacy Policy',
  '{
    "lastUpdated": "November 30, 2025",
    "sections": [
      {
        "heading": "1. Introduction",
        "content": "This Privacy Policy describes how we collect, use, and handle your personal information when you use our marketplace platform."
      },
      {
        "heading": "2. Information We Collect",
        "content": "When you create an account, we collect personal information including full name, email address, phone number, delivery address, and payment information."
      },
      {
        "heading": "3. How We Use Your Information",
        "content": "We use the collected information to provide and maintain our service, process transactions, and improve user experience."
      }
    ]
  }'::jsonb
)
ON CONFLICT (page_type) DO NOTHING;

CREATE OR REPLACE FUNCTION update_content_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_content_pages_updated_at
  BEFORE UPDATE ON content_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_content_pages_updated_at();
