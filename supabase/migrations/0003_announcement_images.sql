-- ============================================================
-- Lyceum Connect — announcement images. Run AFTER 0001. Idempotent.
-- Adds an optional cover image to announcements; the front-end falls
-- back to a per-category image when this is null.
-- ============================================================
alter table public.announcements add column if not exists image_url text;

-- Give the seeded announcements matching cover images.
update public.announcements set image_url =
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&h=440&q=70'
  where category = 'it' and image_url is null;
update public.announcements set image_url =
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&h=440&q=70'
  where category = 'hr' and image_url is null;
update public.announcements set image_url =
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&h=440&q=70'
  where category = 'facility' and image_url is null;
update public.announcements set image_url =
  'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=800&h=440&q=70'
  where category = 'achievement' and image_url is null;
update public.announcements set image_url =
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&h=440&q=70'
  where category = 'circular' and image_url is null;
