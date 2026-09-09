# GasFlow Distribution Manager

Vanilla HTML/CSS/JavaScript dashboard backed by Supabase/PostgreSQL. Designed from the structure of `2026 SEPTEMBER MONTHLY REPORT FRESH.xlsx`.

## Run
1. Create a Supabase project.
2. Open SQL Editor and run `supabase.sql`.
3. Edit `config.js` and enter your Supabase Project URL and publishable/anon key.
4. Create at least one user in Supabase Authentication (Authentication → Users → Add user). The SQL policies are for `authenticated` users, and the site now requires sign-in before showing the dashboard.
5. Open `index.html` with a local static server (for example VS Code Live Server) and sign in with that user's email and password.

## Login
The site opens on a sign-in screen backed by Supabase Auth (email + password). Signing out is available from the bottom of the sidebar. "Forgot password?" sends a Supabase password-reset email, which requires a redirect URL to be configured in your Supabase project's Auth settings for the reset link to work correctly.

## Features
- Dashboard KPI cards and sales chart
- Daily delivery/sales entry
- Customers
- Staff/delivery team
- Cylinder stock movements
- Vehicle/KM/diesel/service logs
- Expenses
- Reports and staff performance
- Excel export
- Workbook preview/import hook
- Dark mode
- Responsive mobile layout

## Security
Never place the Supabase `service_role` key in this frontend. Use only the publishable/anon key and protect tables with Row Level Security. For production, add role-based policies (admin, office, delivery staff) instead of the simple authenticated-user policies.


## Supabase configuration
Edit `config.js` and enter your Supabase Project URL and Publishable/Anon key. The website has no Settings page or browser/localStorage configuration for these credentials.
