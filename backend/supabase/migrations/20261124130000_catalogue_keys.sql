-- Catalogue keys the client already routes by (W2).
-- Categories gain a slug because the client's category chips use string ids
-- (`cleaning`, `upholstery`, ...), while bookings still store the category UUID.
-- Services gain the presentation fields Home needs (popular rank/tag) so the
-- catalogue can move off the bundled config without changing the screens.

alter table public.categories add column slug text;

update public.categories
set slug = case name
  when 'Cleaning' then 'cleaning'
  when 'Upholstery and carpets' then 'upholstery'
  when 'Surface care' then 'surface-care'
  when 'Pest control' then 'pest-control'
  when 'Repairs and installations' then 'repairs'
  when 'Building and finishing' then 'building'
  when 'Outdoor and landscaping' then 'outdoor'
  else 'category-' || substr(id::text, 1, 8)
end
where slug is null;

alter table public.categories alter column slug set not null;
create unique index categories_slug_key on public.categories (slug);

alter table public.services add column popular_rank int;
alter table public.services add column tag text;
