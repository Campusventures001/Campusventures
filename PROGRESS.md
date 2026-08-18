# Campus Venture — What we did (session summary)

Last updated: 17 Aug 2026

## Live site
- URL: https://campus-ventures.onrender.com
- GitHub: https://github.com/Nithesh17122004/campus-ventures (branch `main`)
- Database: MongoDB Atlas (70+ listings) / 71 listings total

## Features built
1. **Lead capture** – first visit shows a popup asking name, phone, email id, Buy/Sell + Continue.
   - Saved to MongoDB, deduplicated (same email/phone = update, not duplicate)
   - Saved to browser storage if offline, then merged
2. **Admin Customer Leads panel** – after admin login, "Directory management" shows all captured leads with name, phone, email, interest, time, Call button.
3. **Admin Edit button** – `✎ Edit` appears on each listing card for admin only; edits save locally + to the DB (PUT /api/listings/:id).
4. **Delete/Add sync to the DB** – existing Delete + Add property buttons now also call the server.
5. **Lead emails** – coded to email campusventures001@gmail.com via nodemailer; ACTIVATES only when EMAIL_USER + EMAIL_PASS (Gmail app password) are added to Render env vars.
6. **Responsive UI** – mobile/laptop friendly (modals scroll on small screens, forms stack).
7. **Est. year badges** – established + bankLoan added to schema; 28 listings backfilled.

## Listings added by user (5 new)
| Listing | Price |
|---|---|
| Coimbatore Engineering College (20.16 ac, 1,284 students, AICTE/Anna Univ) | ₹265 Cr (Negotiable) |
| Rasipuram Vedha Vikas School (6 ac, 2L sqft, 72 rooms) | ₹45 Cr (Negotiable) |
| Kallakurichi CBSE School | On request |
| IVL Matric School, Morappur, Dharmapuri (3,800 students) | On request |
| Bharathi Vidyalaya, Tamil Nadu (15 ac municipal-limit land, 2,25,689 sqft built, asset valuation ₹510.50 Cr) | ₹510.50 Cr |

## Server resilience
- Server starts and serves the site even if MongoDB is down (leads fall back to local storage).
- `seedNewListings()` now upserts curated `NEW_LISTINGS` by `location` (updates existing rows when details change) instead of only adding new ones — so the Bharathi Vidyalaya record in Atlas updates to the new ₹510.50 Cr asset valuation on next deploy, without a duplicate.

## Keep-alive
- Windows scheduled task `CampusVentureKeepAlive` pings the Render site every 10 min (while this PC is on).
- Remove with: `Unregister-ScheduledTask -TaskName CampusVentureKeepAlive`

## Verified on live site
- /api/health OK, admin login OK, listings 71, lead capture + dedupe OK, admin CRUD (create/edit/delete) OK.

## Still pending (needs user)
1. Gmail app password → Render env vars `EMAIL_USER` / `EMAIL_PASS` (for lead emails). Generate at https://myaccount.google.com/apppasswords (requires 2-Step Verification).
2. Bharathi Vidyalaya exact district/city (currently shown as "Tamil Nadu").
3. Confirm Rasipuram/Kallakurichi listing split.