-- Étape 14, incrément 1 : « Suivi individuel » sous drapeau. Socle commun aux modules (nutrition, sommeil…) :
-- drapeau, modules, demandes d'entretien, notes d'entretien, inscriptions joueur ↔ module, objectifs.
-- Décisions du 14/11/2026 (D11) : côté staff, admin seul ; rien de visible en production tant que le drapeau est fermé.

-- ============ DRAPEAU ============
create table public.feature_flags (
  feature     text primary key check (length(feature) between 2 and 40),
  open_to_all boolean not null default false
);
create table public.feature_testers (
  feature    text not null references public.feature_flags(feature) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (feature, profile_id)
);
alter table public.feature_flags enable row level security;
alter table public.feature_testers enable row level security;
-- Seul l'admin lit et règle les drapeaux ; les autres comptes passent par has_feature()
create policy "flags_admin" on public.feature_flags for all using (public.is_admin()) with check (public.is_admin());
create policy "testers_admin" on public.feature_testers for all using (public.is_admin()) with check (public.is_admin());

create function public.has_feature(p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select open_to_all from public.feature_flags where feature = p_feature), false)
      or exists (select 1 from public.feature_testers where feature = p_feature and profile_id = auth.uid())
$$;
revoke execute on function public.has_feature(text) from public, anon;
grant execute on function public.has_feature(text) to authenticated;

insert into public.feature_flags (feature) values ('suivi_individuel'); -- fermé ; la base de dev l'ouvre par un seed

-- Compte de test inscrit comme testeur : il doit pouvoir écrire (état de forme compris, pour enchaîner sur le sommeil).
-- Il reste is_test : caché des chiffres du staff.
create or replace function public.is_test_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_test from public.profiles where id = auth.uid()), false)
     and not exists (select 1 from public.feature_testers where profile_id = auth.uid())
$$;

-- ============ MODULES ============
create table public.follow_modules (
  code     text primary key check (code ~ '^[a-z_]{2,20}$'),
  label    text not null check (length(label) between 2 and 40),
  position int not null default 0,
  active   boolean not null default true
);
insert into public.follow_modules (code, label, position) values ('nutrition', 'Nutrition', 1), ('sommeil', 'Sommeil', 2);

-- ============ DEMANDES D'ENTRETIEN ============
create table public.follow_requests (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.profiles(id) on delete cascade,
  module_code    text not null references public.follow_modules(code),
  slots          timestamptz[] not null check (cardinality(slots) between 1 and 5), -- disponibilités proposées par le joueur
  comment        text check (length(comment) <= 500),
  status         text not null default 'en_attente'
                 check (status in ('en_attente', 'confirme', 'autre_creneau', 'refuse', 'realise', 'annule')),
  confirmed_slot timestamptz,
  proposed_slot  timestamptz, -- contre-proposition du staff (statut « autre_creneau »)
  created_at     timestamptz not null default now(),
  handled_by     uuid references public.profiles(id),
  check (status <> 'confirme' or confirmed_slot is not null),
  check (status <> 'autre_creneau' or proposed_slot is not null)
);
create index follow_requests_player on public.follow_requests (player_id, created_at desc);
-- Une seule demande ouverte par joueur et par module
create unique index follow_requests_open on public.follow_requests (player_id, module_code)
  where status in ('en_attente', 'confirme', 'autre_creneau');

-- Notes d'entretien : table à part, jamais lisible par le joueur (la RLS filtre des lignes, pas des colonnes)
create table public.follow_request_notes (
  request_id uuid primary key references public.follow_requests(id) on delete cascade,
  notes      text not null check (length(notes) <= 2000),
  updated_by uuid references public.profiles(id) default auth.uid(),
  updated_at timestamptz not null default now()
);

-- ============ INSCRIPTIONS JOUEUR ↔ MODULE ============
create table public.follow_enrollments (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.profiles(id) on delete cascade,
  module_code     text not null references public.follow_modules(code),
  status          text not null default 'actif' check (status in ('actif', 'termine')),
  activated_by    uuid references public.profiles(id) default auth.uid(),
  activated_at    timestamptz not null default now(),
  consented_at    timestamptz,       -- posé par accept_follow_consent(), par le joueur lui-même
  consent_version text,
  ended_at        timestamptz,
  data_deleted_at timestamptz,       -- trace de la suppression des données, sans donnée de santé
  deleted_by      uuid references public.profiles(id),
  unique (player_id, module_code)
);

-- ============ OBJECTIFS ============
create table public.follow_goals (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.follow_enrollments(id) on delete cascade,
  player_id     uuid not null references public.profiles(id) on delete cascade,
  central       text not null check (length(trim(central)) between 3 and 200),          -- « je veux prendre du poids »
  means         text[] not null check (cardinality(means) between 1 and 6),              -- moyens d'action
  target_label  text not null check (length(trim(target_label)) between 1 and 80),      -- « +3 kg », « 8 h par nuit »
  target_value  numeric check (target_value between -1000 and 100000),
  baseline      numeric check (baseline between -1000 and 100000),
  unit          text check (length(unit) <= 12),
  due_on        date not null,
  status        text not null default 'propose' check (status in ('propose', 'en_cours', 'atteint', 'non_atteint', 'abandonne')),
  created_by    uuid references public.profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  validated_by  uuid references public.profiles(id),
  validated_at  timestamptz
);
create index follow_goals_enrollment on public.follow_goals (enrollment_id, created_at desc);

-- ============ RLS ============
alter table public.follow_modules enable row level security;
alter table public.follow_requests enable row level security;
alter table public.follow_request_notes enable row level security;
alter table public.follow_enrollments enable row level security;
alter table public.follow_goals enable row level security;

-- Drapeau : politique restrictive sur chaque table (s'ajoute aux autres, aucune politique ultérieure ne peut la rouvrir)
do $$
declare t text;
begin
  foreach t in array array['follow_modules', 'follow_requests', 'follow_request_notes', 'follow_enrollments', 'follow_goals'] loop
    execute format('create policy "feature_gate" on public.%I as restrictive for all to authenticated
                    using (public.has_feature(''suivi_individuel'')) with check (public.has_feature(''suivi_individuel''))', t);
  end loop;
end $$;

create policy "modules_read" on public.follow_modules for select to authenticated using (true);
create policy "modules_admin" on public.follow_modules for all using (public.is_admin()) with check (public.is_admin());

create policy "requests_admin" on public.follow_requests for all using (public.is_admin()) with check (public.is_admin());
create policy "requests_own_read" on public.follow_requests for select using (player_id = auth.uid());
-- Le joueur dépose une demande « en attente » ; il ne la modifie jamais directement (statut, créneau : fonctions dédiées)
create policy "requests_own_insert" on public.follow_requests for insert with check (
  player_id = auth.uid() and status = 'en_attente' and confirmed_slot is null and proposed_slot is null and handled_by is null
  and not exists (select 1 from public.follow_enrollments e
                  where e.player_id = auth.uid() and e.module_code = follow_requests.module_code and e.status = 'actif'));

create policy "notes_admin" on public.follow_request_notes for all using (public.is_admin()) with check (public.is_admin());

create policy "enrollments_admin" on public.follow_enrollments for all using (public.is_admin()) with check (public.is_admin());
create policy "enrollments_own_read" on public.follow_enrollments for select using (player_id = auth.uid());

create policy "goals_admin" on public.follow_goals for all using (public.is_admin()) with check (public.is_admin());
create policy "goals_own_read" on public.follow_goals for select using (player_id = auth.uid());
-- Le joueur propose un objectif sur son inscription active et consentie ; la validation revient à l'admin
create policy "goals_own_insert" on public.follow_goals for insert with check (
  player_id = auth.uid() and status = 'propose' and validated_by is null and validated_at is null
  and exists (select 1 from public.follow_enrollments e where e.id = enrollment_id and e.player_id = auth.uid()
              and e.status = 'actif' and e.consented_at is not null));
create policy "goals_own_update" on public.follow_goals for update
  using (player_id = auth.uid() and status = 'propose')
  with check (player_id = auth.uid() and status = 'propose' and validated_by is null and validated_at is null);
create policy "goals_own_delete" on public.follow_goals for delete using (player_id = auth.uid() and status = 'propose');

-- ============ FONCTIONS DU JOUEUR ============
-- Consentement : daté côté serveur, par le joueur lui-même, une seule fois
create function public.accept_follow_consent(p_module text, p_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_feature('suivi_individuel') then raise exception 'indisponible' using errcode = '42501'; end if;
  update public.follow_enrollments set consented_at = now(), consent_version = left(p_version, 20)
  where player_id = auth.uid() and module_code = p_module and status = 'actif' and consented_at is null;
  if not found then raise exception 'aucun module à accepter' using errcode = 'P0002'; end if;
end $$;

-- Réponse du joueur à une demande ouverte : accepter le créneau proposé par le staff, ou annuler sa demande
create function public.answer_follow_request(p_request uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_feature('suivi_individuel') then raise exception 'indisponible' using errcode = '42501'; end if;
  if p_accept then
    update public.follow_requests set status = 'confirme', confirmed_slot = proposed_slot
    where id = p_request and player_id = auth.uid() and status = 'autre_creneau';
  else
    update public.follow_requests set status = 'annule'
    where id = p_request and player_id = auth.uid() and status in ('en_attente', 'autre_creneau', 'confirme');
  end if;
  if not found then raise exception 'demande introuvable' using errcode = 'P0002'; end if;
end $$;

revoke execute on function public.accept_follow_consent(text, text) from public, anon;
revoke execute on function public.answer_follow_request(uuid, boolean) from public, anon;
grant execute on function public.accept_follow_consent(text, text) to authenticated;
grant execute on function public.answer_follow_request(uuid, boolean) to authenticated;
