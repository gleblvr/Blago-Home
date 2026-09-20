# BLAGO home

Responsive tourist and corporate versions for GitHub Pages, backed by the Frankfurt Supabase project.

## Preview

Run `python3 -m http.server 8000` from this directory. Open http://localhost:8000.
No build step or npm dependencies. Relative paths support `/Blago-Home/`.

## Publish the demo

GitHub → Settings → Pages → Deploy from a branch → main → / (root) → Save.
Expected URL after successful deployment: https://gleblvr.github.io/Blago-Home/
GitHub Pages settings cannot currently be changed through the connected GitHub tools.
This is a design demo, with no booking, lead collection or live commercial CTAs.
Before commercial launch, use a host whose terms allow the intended business use.

## Content and admin

The public site reads `website_properties` and `site_assets` from Supabase. Admin lives at `/admin/` and uses email/password authentication. Only allowlisted administrators can change data.

All images are stored in Supabase Storage and listed in the `image_links` database view:

- `site_assets` contains the single shared logo, favicon, and Eilat background.
- `property_photos` contains property images and their display order/crop positions.
- `property_videos` contains one optional compressed video per property. The admin reduces videos to 720p before uploading them to the size-limited `property-videos` bucket.
- The private admin calendar reads `bookings` and `daily_prices`, supports multi-property occupancy views, check-in/check-out markers, overlap protection, and ILS prices by date range.
- Both tourist and corporate versions load `brand_logo` from the same database row.
- Replacing a shared asset in the admin updates its database URL and changes it everywhere without a code edit.

Only the public Supabase URL and publishable key belong in `config.js`. Never place a service-role or secret key in the repository.

Sessions are held in memory; reload signs out, and expired tokens require login.
Uploads limited to JPG/PNG/WebP ≤5 MB. Removing a photo from a listing does not delete the underlying storage object (prevents accidental loss); unused uploads require periodic cleanup.
With the configured backend, failed requests display an error instead of silently showing stale local data.

## Assets and known limitations

Apartment screenshots supplied by the owner, grouped by their visible LA 1–4 labels.
They are displayed using CSS frames; original image bytes are unchanged.
Please replace screenshots with original apartment images for better quality.
No fabricated prices, capacity, addresses, reviews, or 24/7 claims.
Only Russian copy for this first iteration.
Eilat hero: Tango7000, https://commons.wikimedia.org/wiki/File:Eilat2.jpg (public domain, 2005).
Villa photos have not yet been provided; no invented villa listing is shown.
