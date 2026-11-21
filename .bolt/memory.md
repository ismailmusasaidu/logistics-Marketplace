# Project memory

## Product intent & audience

- Multi-party logistics/delivery marketplace app: customers, vendors, riders.
- Core flows: ordering, cart, wishlist, vendor settings, rider location tracking, order complaints, wallet, payments.
- Expo framework; hosted on Bolt Cloud.
- Likely African market — Paystack payment integration.

## Brand personality & voice

- Not yet inferred from current context.

## Visual design & UX direction

- Not yet inferred from current context.

## Decisions, constraints & rationale

- Backend: user's own Supabase project (not Bolt-managed database); Bolt tools cannot read it directly.
- ~20 Supabase Edge Functions including: Paystack webhook, wallet, auto-rider-assignment, auth-email-hook.
- Performance-indexes migration exists; RPC functions used for stats queries.
- Realtime subscriptions heavily used across orders, carts, wishlists, vendor settings, rider location, complaints — likely first scalability bottleneck.
- Auth emails routed through custom `auth-email-hook` edge function (intended for external SMTP provider like Resend/Postmark).
- Paystack webhook and auto-rider-assignment are identified hot paths.

## Open questions & assumptions

- Supabase plan tier and compute add-on status unknown.
- Custom SMTP provider not yet confirmed wired to auth-email-hook.
- Realtime connection limit and current usage not verified.
- No explicit design system, brand voice, or UX guidelines established yet.