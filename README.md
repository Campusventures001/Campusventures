# Campus Venture

## Project structure

- `public/` — Website pages and static assets served to the browser.
- `server/config/` — MongoDB connection setup.
- `server/models/` — MongoDB data models for users, listings, and inquiries.
- `Server.js` — Express API and static-site server.
- `.env` — Local secrets and connection configuration. Never commit this file.
- `legacy/` — Previous unused Supabase code and empty starter files retained for reference.

## Run locally

1. Ensure `.env` contains `MONGODB_URI` and `JWT_SECRET`.
2. Run `npm.cmd start`.
3. Open `http://localhost:3000`.
