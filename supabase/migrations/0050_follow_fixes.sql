-- Étape 14, incrément 1, après relecture (14/11/2026).

-- Compte de test : seule l'inscription au drapeau « suivi_individuel » lui rend l'écriture (pas n'importe quel drapeau)
create or replace function public.is_test_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_test from public.profiles where id = auth.uid()), false)
     and not exists (select 1 from public.feature_testers where feature = 'suivi_individuel' and profile_id = auth.uid())
$$;

-- Réactivation possible après une fin de suivi : une seule inscription ACTIVE par joueur et par module, les anciennes restent
alter table public.follow_enrollments drop constraint follow_enrollments_player_id_module_code_key;
create unique index follow_enrollments_active on public.follow_enrollments (player_id, module_code) where status = 'actif';

-- Un objectif appartient au joueur de son inscription (un joueur ne peut pas le rattacher à l'inscription d'un autre)
alter table public.follow_enrollments add constraint follow_enrollments_id_player unique (id, player_id);
alter table public.follow_goals drop constraint follow_goals_enrollment_id_fkey;
alter table public.follow_goals add constraint follow_goals_enrollment_player_fkey
  foreign key (enrollment_id, player_id) references public.follow_enrollments (id, player_id) on delete cascade;
-- Un seul objectif en cours et une seule proposition par inscription
create unique index follow_goals_one_current on public.follow_goals (enrollment_id) where status = 'en_cours';
create unique index follow_goals_one_proposed on public.follow_goals (enrollment_id) where status = 'propose';

drop policy "goals_own_update" on public.follow_goals;
create policy "goals_own_update" on public.follow_goals for update
  using (player_id = auth.uid() and status = 'propose')
  with check (player_id = auth.uid() and status = 'propose' and validated_by is null and validated_at is null
    and exists (select 1 from public.follow_enrollments e where e.id = enrollment_id and e.player_id = auth.uid()
                and e.status = 'actif' and e.consented_at is not null));

-- Traçabilité posée par la base (jamais par l'horloge ou le bon vouloir du navigateur)
create function public.follow_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'follow_goals' then
    if new.status = 'en_cours' and (tg_op = 'INSERT' or old.status <> 'en_cours') then
      new.validated_by := auth.uid(); new.validated_at := now();
    end if;
  elsif tg_table_name = 'follow_requests' then
    if new.status is distinct from old.status and auth.uid() is distinct from new.player_id then new.handled_by := auth.uid(); end if;
  else -- follow_request_notes
    new.updated_by := auth.uid(); new.updated_at := now();
  end if;
  return new;
end $$;
revoke execute on function public.follow_stamp() from public, anon, authenticated;
create trigger follow_stamp before insert or update on public.follow_goals for each row execute function public.follow_stamp();
create trigger follow_stamp before update on public.follow_requests for each row execute function public.follow_stamp();
create trigger follow_stamp before insert or update on public.follow_request_notes for each row execute function public.follow_stamp();
