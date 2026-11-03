-- pg_net (0026) donne par défaut l'appel HTTP aux rôles de l'API : seule la base (send_wellness_reminders, propriétaire
-- postgres) en a besoin. Un joueur ou un visiteur ne doit jamais pouvoir faire appeler une adresse par le serveur.
-- Constaté le 03/11/2026 : ces droits sont accordés par supabase_admin (à PUBLIC), le rôle postgres ne peut pas les
-- retirer (révocation sans effet). Sans danger tant que le schéma net n'est pas exposé par l'API (Settings > API >
-- Exposed schemas : public seulement) : aucun rôle de l'API n'exécute de SQL libre. À ne jamais exposer.
revoke usage on schema net from anon, authenticated;
revoke execute on all functions in schema net from anon, authenticated;
