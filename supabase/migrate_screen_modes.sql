-- 已部署旧版 public.community_apertures 表时，只需在 Supabase SQL Editor 执行本文件。
-- 它允许公共空间分别保存绘制光栅或 LaTeX 屏函数文本，不会改动已有数据。

alter table public.community_apertures
  drop constraint if exists community_apertures_format_check;

alter table public.community_apertures
  add constraint community_apertures_format_check check (
    (
      aperture_data ->> 'format' = 'fraunhofer-aperture-v1'
      and (aperture_data ->> 'size')::integer = 256
      and jsonb_typeof(aperture_data -> 'amplitude') = 'string'
      and jsonb_typeof(aperture_data -> 'phase') = 'string'
    )
    or
    (
      aperture_data ->> 'format' = 'fraunhofer-formula-v1'
      and (aperture_data ->> 'size')::integer = 256
      and jsonb_typeof(aperture_data -> 'formula') = 'string'
      and char_length(trim(aperture_data ->> 'formula')) between 1 and 1200
    )
  );
