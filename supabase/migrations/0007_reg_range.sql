-- Plages de charge du staff : régénération 500-1500, compétition 1500-2500, développement > 2500 UA
update public.week_types set srpe_min = 500, srpe_max = 1500 where code = 'REG';
