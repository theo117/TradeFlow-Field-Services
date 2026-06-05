# TradeFlow Field Services

A modern SaaS prototype for plumbing and electrical contractors managing field-service operations from office intake through technician completion, customer sign-off, and invoicing.

## What is included

- Responsive SaaS dashboard with KPI cards, charts, technician performance, and activity feed
- Customer creation, search, and filtering with job history counts
- Technician creation for job assignment and dispatch planning
- Job creation, status tracking, materials totals, and update timelines
- WhatsApp Business alert configuration for assignments, status changes, completions, and invoices
- GPS tracking and route-planning screens for technician dispatch
- Inventory item management with reorder status
- Multi-company records with subscription billing fields
- Mobile-first technician view with job controls, photo upload fields, materials, notes, and signature capture
- Quote and invoice creation with VAT, totals, and statuses
- Analytics and notification center
- Dark/light mode and role switching for Admin, Office Staff, and Technician
- SQL schema in `db/schema.sql` and an empty seed file in `db/seed.sql`

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `db/schema.sql`.
3. Open `supabase-config.js` and add your project URL and anon key:

```js
window.TRADEFLOW_SUPABASE = {
  url: "https://your-project.supabase.co",
  anonKey: "your-anon-key",
};
```

With those values configured, customers, technicians, jobs, quotes, invoices, companies, inventory, route stops, and WhatsApp settings save to Supabase.

For quick prototyping, the app uses public browser access through the anon key. Before production, enable authentication and Row Level Security policies in Supabase.

## Run

Open `index.html` in a browser. If Supabase is not configured, the app still runs locally, but records are only kept while the page is open.

The page uses Tailwind CSS, Lucide icons, and Supabase JS from CDNs.
