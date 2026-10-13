-- Güven Tercüme veritabanı şeması. Supabase panelinde SQL Editor'e yapıştırıp bir kez çalıştırın.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id boolean primary key default true check (id),
  notification_email text not null default 'guventercume@hotmail.com'
);
insert into public.settings (id) values (true) on conflict do nothing;

create table if not exists public.rates (
  code text primary key,
  name text not null,
  rate numeric(12, 2) not null default 2.50 check (rate >= 0 and rate <= 100000)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_name text not null,
  email text not null,
  phone text not null,
  file_name text not null,
  note text not null default '',
  word_count integer not null check (word_count between 1 and 5000000),
  source_language text not null references public.rates (code),
  target_language text not null references public.rates (code),
  rate_per_word numeric(12, 2) not null,
  estimated_total numeric(14, 2) not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'completed')),
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'smtp_not_configured', 'failed')),
  created_at timestamptz not null default now()
);
create index if not exists quotes_user_created_idx on public.quotes (user_id, created_at desc);

-- Yetki kontrolü: yalnızca profiles.role = 'admin' olanlar yönetici sayılır.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Her yeni kayıt (Google veya e-posta) otomatik olarak yetkisiz 'user' profili alır.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name, avatar_url)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', ''), raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.rates enable row level security;
alter table public.quotes enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- Tarifeler yalnızca giriş yapmış kullanıcılara açıktır; misafir fiyat göremez.
drop policy if exists rates_select on public.rates;
create policy rates_select on public.rates
  for select to authenticated using (true);

drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select to authenticated using (public.is_admin());

drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists quotes_update on public.quotes;
create policy quotes_update on public.quotes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists quotes_delete on public.quotes;
create policy quotes_delete on public.quotes
  for delete to authenticated using (public.is_admin());

-- Teklif oluşturma: fiyat tarifeden sunucuda hesaplanır, istemci tutarı belirleyemez.
create or replace function public.create_quote(
  p_customer_name text,
  p_email text,
  p_phone text,
  p_file_name text,
  p_note text,
  p_word_count integer,
  p_source_language text,
  p_target_language text
)
returns public.quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric(12, 2);
  v_quote public.quotes;
begin
  if auth.uid() is null then
    raise exception 'Teklif göndermek için giriş yapmalısınız.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) < 2 or length(p_customer_name) > 140 then
    raise exception 'Ad soyad zorunludur.';
  end if;
  if p_email is null or length(p_email) > 180 or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Geçerli bir e-posta adresi girin.';
  end if;
  if p_phone is null or length(p_phone) > 40 or length(regexp_replace(p_phone, '\D', '', 'g')) < 10 then
    raise exception 'Geçerli bir telefon numarası girin.';
  end if;
  if p_word_count is null or p_word_count < 1 or p_word_count > 5000000 then
    raise exception 'Sözcük sayısı geçersiz.';
  end if;
  if (select count(*) from public.quotes where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Çok fazla teklif gönderdiniz. Lütfen daha sonra tekrar deneyin.';
  end if;

  select rate into v_rate from public.rates where code = p_source_language;
  if v_rate is null or not exists (select 1 from public.rates where code = p_target_language) then
    raise exception 'Dil seçimi geçersiz.';
  end if;

  insert into public.quotes (
    user_id, customer_name, email, phone, file_name, note,
    word_count, source_language, target_language, rate_per_word, estimated_total
  )
  values (
    auth.uid(), trim(p_customer_name), trim(p_email), trim(p_phone),
    left(coalesce(p_file_name, ''), 180), left(coalesce(p_note, ''), 1000),
    p_word_count, p_source_language, p_target_language, v_rate, round(p_word_count * v_rate, 2)
  )
  returning * into v_quote;

  return v_quote;
end;
$$;

create or replace function public.admin_save_rates(items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz işlem.' using errcode = '42501';
  end if;
  if jsonb_typeof(items) <> 'array' then
    raise exception 'Tarife listesi geçersiz.';
  end if;
  update public.rates r
  set rate = round(i.rate, 2)
  from jsonb_to_recordset(items) as i (code text, rate numeric)
  where r.code = i.code;
end;
$$;

create or replace function public.admin_set_role(target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz işlem.' using errcode = '42501';
  end if;
  if new_role not in ('user', 'admin') then
    raise exception 'Geçersiz rol.';
  end if;
  if target = auth.uid() then
    raise exception 'Kendi yetkinizi değiştiremezsiniz.';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

revoke execute on function public.create_quote(text, text, text, text, text, integer, text, text) from public, anon;
revoke execute on function public.admin_save_rates(jsonb) from public, anon;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.create_quote(text, text, text, text, text, integer, text, text) to authenticated;
grant execute on function public.admin_save_rates(jsonb) to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- 183 dil için başlangıç tarifesi (2,50 TL / sözcük). Fiyatları yönetim panelinden değiştirin.
insert into public.rates (code, name, rate) values
  ('ab', 'Abkhaz', 2.50),
  ('aa', 'Afar', 2.50),
  ('af', 'Afrikaans', 2.50),
  ('ak', 'Akan', 2.50),
  ('sq', 'Albanian', 2.50),
  ('am', 'Amharic', 2.50),
  ('ar', 'Arabic', 2.50),
  ('an', 'Aragonese', 2.50),
  ('hy', 'Armenian', 2.50),
  ('as', 'Assamese', 2.50),
  ('av', 'Avaric', 2.50),
  ('ae', 'Avestan', 2.50),
  ('ay', 'Aymara', 2.50),
  ('az', 'Azerbaijani', 2.50),
  ('bm', 'Bambara', 2.50),
  ('ba', 'Bashkir', 2.50),
  ('eu', 'Basque', 2.50),
  ('be', 'Belarusian', 2.50),
  ('bn', 'Bengali', 2.50),
  ('bi', 'Bislama', 2.50),
  ('bs', 'Bosnian', 2.50),
  ('br', 'Breton', 2.50),
  ('bg', 'Bulgarian', 2.50),
  ('my', 'Burmese', 2.50),
  ('ca', 'Catalan', 2.50),
  ('ch', 'Chamorro', 2.50),
  ('ce', 'Chechen', 2.50),
  ('ny', 'Chichewa', 2.50),
  ('zh', 'Chinese', 2.50),
  ('cv', 'Chuvash', 2.50),
  ('kw', 'Cornish', 2.50),
  ('co', 'Corsican', 2.50),
  ('cr', 'Cree', 2.50),
  ('hr', 'Croatian', 2.50),
  ('cs', 'Czech', 2.50),
  ('da', 'Danish', 2.50),
  ('dv', 'Divehi', 2.50),
  ('nl', 'Dutch', 2.50),
  ('dz', 'Dzongkha', 2.50),
  ('en', 'English', 2.50),
  ('eo', 'Esperanto', 2.50),
  ('et', 'Estonian', 2.50),
  ('ee', 'Ewe', 2.50),
  ('fo', 'Faroese', 2.50),
  ('fj', 'Fijian', 2.50),
  ('fi', 'Finnish', 2.50),
  ('fr', 'French', 2.50),
  ('ff', 'Fula', 2.50),
  ('gl', 'Galician', 2.50),
  ('lg', 'Ganda', 2.50),
  ('ka', 'Georgian', 2.50),
  ('de', 'German', 2.50),
  ('el', 'Greek', 2.50),
  ('gn', 'Guaraní', 2.50),
  ('gu', 'Gujarati', 2.50),
  ('ht', 'Haitian', 2.50),
  ('ha', 'Hausa', 2.50),
  ('he', 'Hebrew', 2.50),
  ('hz', 'Herero', 2.50),
  ('hi', 'Hindi', 2.50),
  ('ho', 'Hiri Motu', 2.50),
  ('hu', 'Hungarian', 2.50),
  ('is', 'Icelandic', 2.50),
  ('io', 'Ido', 2.50),
  ('ig', 'Igbo', 2.50),
  ('id', 'Indonesian', 2.50),
  ('ia', 'Interlingua', 2.50),
  ('ie', 'Interlingue', 2.50),
  ('iu', 'Inuktitut', 2.50),
  ('ik', 'Inupiaq', 2.50),
  ('ga', 'Irish', 2.50),
  ('it', 'Italian', 2.50),
  ('ja', 'Japanese', 2.50),
  ('jv', 'Javanese', 2.50),
  ('kl', 'Kalaallisut', 2.50),
  ('kn', 'Kannada', 2.50),
  ('kr', 'Kanuri', 2.50),
  ('ks', 'Kashmiri', 2.50),
  ('kk', 'Kazakh', 2.50),
  ('km', 'Khmer', 2.50),
  ('ki', 'Kikuyu', 2.50),
  ('rw', 'Kinyarwanda', 2.50),
  ('rn', 'Kirundi', 2.50),
  ('kv', 'Komi', 2.50),
  ('kg', 'Kongo', 2.50),
  ('ko', 'Korean', 2.50),
  ('ku', 'Kurdish', 2.50),
  ('kj', 'Kwanyama', 2.50),
  ('ky', 'Kyrgyz', 2.50),
  ('lo', 'Lao', 2.50),
  ('la', 'Latin', 2.50),
  ('lv', 'Latvian', 2.50),
  ('li', 'Limburgish', 2.50),
  ('ln', 'Lingala', 2.50),
  ('lt', 'Lithuanian', 2.50),
  ('lu', 'Luba-Katanga', 2.50),
  ('lb', 'Luxembourgish', 2.50),
  ('mk', 'Macedonian', 2.50),
  ('mg', 'Malagasy', 2.50),
  ('ms', 'Malay', 2.50),
  ('ml', 'Malayalam', 2.50),
  ('mt', 'Maltese', 2.50),
  ('gv', 'Manx', 2.50),
  ('mi', 'Māori', 2.50),
  ('mr', 'Marathi', 2.50),
  ('mh', 'Marshallese', 2.50),
  ('mn', 'Mongolian', 2.50),
  ('na', 'Nauru', 2.50),
  ('nv', 'Navajo', 2.50),
  ('ng', 'Ndonga', 2.50),
  ('ne', 'Nepali', 2.50),
  ('nd', 'Northern Ndebele', 2.50),
  ('se', 'Northern Sami', 2.50),
  ('no', 'Norwegian', 2.50),
  ('nb', 'Norwegian Bokmål', 2.50),
  ('nn', 'Norwegian Nynorsk', 2.50),
  ('ii', 'Nuosu', 2.50),
  ('oc', 'Occitan', 2.50),
  ('oj', 'Ojibwe', 2.50),
  ('cu', 'Old Church Slavonic', 2.50),
  ('or', 'Oriya', 2.50),
  ('om', 'Oromo', 2.50),
  ('os', 'Ossetian', 2.50),
  ('pi', 'Pāli', 2.50),
  ('pa', 'Panjabi', 2.50),
  ('ps', 'Pashto', 2.50),
  ('fa', 'Persian', 2.50),
  ('pl', 'Polish', 2.50),
  ('pt', 'Portuguese', 2.50),
  ('qu', 'Quechua', 2.50),
  ('ro', 'Romanian', 2.50),
  ('rm', 'Romansh', 2.50),
  ('ru', 'Russian', 2.50),
  ('sm', 'Samoan', 2.50),
  ('sg', 'Sango', 2.50),
  ('sa', 'Sanskrit', 2.50),
  ('sc', 'Sardinian', 2.50),
  ('gd', 'Scottish Gaelic', 2.50),
  ('sr', 'Serbian', 2.50),
  ('sn', 'Shona', 2.50),
  ('sd', 'Sindhi', 2.50),
  ('si', 'Sinhala', 2.50),
  ('sk', 'Slovak', 2.50),
  ('sl', 'Slovenian', 2.50),
  ('so', 'Somali', 2.50),
  ('nr', 'Southern Ndebele', 2.50),
  ('st', 'Southern Sotho', 2.50),
  ('es', 'Spanish', 2.50),
  ('su', 'Sundanese', 2.50),
  ('sw', 'Swahili', 2.50),
  ('ss', 'Swati', 2.50),
  ('sv', 'Swedish', 2.50),
  ('tl', 'Tagalog', 2.50),
  ('ty', 'Tahitian', 2.50),
  ('tg', 'Tajik', 2.50),
  ('ta', 'Tamil', 2.50),
  ('tt', 'Tatar', 2.50),
  ('te', 'Telugu', 2.50),
  ('th', 'Thai', 2.50),
  ('bo', 'Tibetan', 2.50),
  ('ti', 'Tigrinya', 2.50),
  ('to', 'Tonga', 2.50),
  ('ts', 'Tsonga', 2.50),
  ('tn', 'Tswana', 2.50),
  ('tr', 'Turkish', 2.50),
  ('tk', 'Turkmen', 2.50),
  ('tw', 'Twi', 2.50),
  ('uk', 'Ukrainian', 2.50),
  ('ur', 'Urdu', 2.50),
  ('ug', 'Uyghur', 2.50),
  ('uz', 'Uzbek', 2.50),
  ('ve', 'Venda', 2.50),
  ('vi', 'Vietnamese', 2.50),
  ('vo', 'Volapük', 2.50),
  ('wa', 'Walloon', 2.50),
  ('cy', 'Welsh', 2.50),
  ('fy', 'Western Frisian', 2.50),
  ('wo', 'Wolof', 2.50),
  ('xh', 'Xhosa', 2.50),
  ('yi', 'Yiddish', 2.50),
  ('yo', 'Yoruba', 2.50),
  ('za', 'Zhuang', 2.50),
  ('zu', 'Zulu', 2.50)
on conflict (code) do nothing;
