# BLAGO home

First corporate design (blue/white), responsive static demo for GitHub Pages.

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

The public site currently reads `data/properties.json`. Admin lives at `/admin/`.
**Admin is implemented but is not operational until a Supabase project is connected.**
It uses email/password authentication; only explicitly allowlisted admin users may change data.
No fake login, client-side passwords, or browser-local edits represented as publication.

Connection steps:
1. Create a Supabase project; run `setup/supabase.sql` once.
2. Create the owner's user in Authentication. Disable public signups.
3. Add the user UUID to `site_admins` using the commented SQL statement.
4. Run `setup/seed.sql` to import the initial property catalogue.
5. Set the public URL and anon/publishable key in `config.js`. Never use service_role.
6. Verify anonymous writes are denied, an ordinary user cannot edit, and the owner can log in, add/hide/edit properties, upload and reorder photos.

Sessions are held in memory; reload signs out, and expired tokens require login.
Uploads limited to JPG/PNG/WebP ≤5 MB. Removing a photo from a listing does not delete the underlying storage object (prevents accidental loss); unused uploads require periodic cleanup.
With configured backend, failed requests display an error rather than falling back to potentially stale public data.

## Assets and known limitations

Apartment screenshots supplied by the owner, grouped by their visible LA 1–4 labels.
They are displayed using CSS frames; original image bytes are unchanged.
Please replace screenshots with original apartment images for better quality.
No fabricated prices, capacity, addresses, reviews, or 24/7 claims.
Only Russian copy for this first iteration.
Eilat hero: Tango7000, https://commons.wikimedia.org/wiki/File:Eilat2.jpg (public domain, 2005).
Villa photos have not yet been provided; no invented villa listing is shown.
