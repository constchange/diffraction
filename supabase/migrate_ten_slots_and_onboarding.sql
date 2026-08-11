-- 已部署旧版公共空间时，在 Supabase SQL Editor 执行本文件。
-- 它把公共上传档位扩展到 10 个，并增加仅保存加盐 IP 摘要的首次访问登记表。

alter table public.community_apertures
  drop constraint if exists community_apertures_slot_check;

alter table public.community_apertures
  add constraint community_apertures_slot_check check (slot between 1 and 10);

comment on column public.community_apertures.slot is
  '同一 IP 摘要可使用 1–10 号公共上传档位。';

create table if not exists public.community_onboarding_visits (
  owner_hash text primary key check (char_length(owner_hash) = 64),
  first_seen_at timestamptz not null default now()
);

comment on table public.community_onboarding_visits is
  '首次访问引导登记；只保存 EdgeOne 服务端生成的加盐 IP 摘要，不保存原始 IP。';

alter table public.community_onboarding_visits enable row level security;
revoke all on table public.community_onboarding_visits from anon, authenticated;
grant select, insert on table public.community_onboarding_visits to service_role;
