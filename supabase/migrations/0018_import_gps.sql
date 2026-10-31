-- Étape 11c (relecture) : import des GPS d'un match en une transaction.
-- Match créé ou retrouvé (groupe, date, adversaire), lignes du fichier enregistrées, et lignes de ce match absentes du
-- fichier supprimées : un réimport corrigé ne laisse jamais à un joueur le GPS d'un autre.
-- p_rows : [{ "player_id", "position", "minutes", "distance_m", "hi_distance_m", "accelerations", "vmax" }]
-- security invoker : la RLS s'applique (écritures réservées au staff).
create function public.import_match_gps(p_group uuid, p_date date, p_opponent text, p_label text, p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_match uuid;
  v_removed int;
begin
  if not public.is_staff() then raise exception 'réservé au staff' using errcode = '42501'; end if;
  if p_date > public.paris_today() then raise exception 'match dans le futur' using errcode = 'P0001'; end if;
  if trim(coalesce(p_opponent, '')) = '' then raise exception 'adversaire manquant' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_rows) = 0 then raise exception 'aucune ligne GPS' using errcode = 'P0001'; end if;

  insert into public.matches (group_id, match_date, opponent, label)
  values (p_group, p_date, trim(p_opponent), nullif(trim(coalesce(p_label, '')), ''))
  on conflict (group_id, match_date, opponent) do update set label = coalesce(excluded.label, public.matches.label)
  returning id into v_match;

  delete from public.gps_records
  where match_id = v_match and player_id not in (select (r->>'player_id')::uuid from jsonb_array_elements(p_rows) r);
  get diagnostics v_removed = row_count;

  insert into public.gps_records (match_id, player_id, position, minutes, distance_m, hi_distance_m, accelerations, vmax)
  select v_match, (r->>'player_id')::uuid, upper(trim(r->>'position')), (r->>'minutes')::numeric, (r->>'distance_m')::numeric,
         (r->>'hi_distance_m')::numeric, (r->>'accelerations')::numeric, (r->>'vmax')::numeric
  from jsonb_array_elements(p_rows) r
  on conflict (match_id, player_id) do update set
    position = excluded.position, minutes = excluded.minutes, distance_m = excluded.distance_m,
    hi_distance_m = excluded.hi_distance_m, accelerations = excluded.accelerations, vmax = excluded.vmax;

  return jsonb_build_object('match_id', v_match, 'rows', jsonb_array_length(p_rows), 'removed', v_removed);
end $$;
