#!/usr/bin/env bash
#
# Déploiement d'un environnement Equime sur le VPS.
#
# Exécuté par la CI via SSH, après un `git pull --ff-only` dans le checkout
# correspondant. Le script suppose donc que le code est déjà à jour et que le
# fichier d'environnement (non suivi par git) est présent.
#
# Usage : bash scripts/deploy-vps.sh preprod|prod
#
set -euo pipefail

ENVIRONMENT="${1:?usage: deploy-vps.sh preprod|prod}"

case "$ENVIRONMENT" in
  preprod)
    COMPOSE_FILE=docker-compose.preprod.yml
    ENV_FILE=.env.preprod
    HEALTH_URL=http://127.0.0.1:3002/health
    WEB_URL=http://127.0.0.1:8080/
    ;;
  prod)
    COMPOSE_FILE=docker-compose.prod.yml
    ENV_FILE=.env.prod
    HEALTH_URL=http://127.0.0.1:3001/health
    WEB_URL=http://127.0.0.1:8081/
    ;;
  *)
    echo "Environnement inconnu : $ENVIRONMENT (attendu : preprod ou prod)" >&2
    exit 1
    ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE introuvable dans $(pwd) — le déploiement est annulé." >&2
  exit 1
fi

echo "▸ Déploiement $ENVIRONMENT — $(git rev-parse --short HEAD) ($(git log -1 --format=%s))"

# La production est sauvegardée avant toute reconstruction : c'est le seul
# moment où l'on peut encore revenir en arrière sans perte de données.
if [ "$ENVIRONMENT" = "prod" ]; then
  if [ -x "$HOME/backups/equime-backup.sh" ]; then
    echo "▸ Sauvegarde préalable"
    "$HOME/backups/equime-backup.sh"
  else
    echo "Sauvegarde introuvable ($HOME/backups/equime-backup.sh) — déploiement annulé." >&2
    exit 1
  fi
fi

echo "▸ Build et démarrage des conteneurs"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

# Le service `migrate` joue les migrations Prisma avant que l'API ne démarre
# (depends_on: service_completed_successfully), il n'y a rien à lancer ici.

echo "▸ Vérification de santé"
for attempt in $(seq 1 45); do
  if curl -fsS --max-time 5 "$HEALTH_URL" > /dev/null 2>&1; then
    echo "  API en ligne après ${attempt} tentative(s)"
    if ! curl -fsS --max-time 5 -o /dev/null "$WEB_URL"; then
      echo "L'API répond mais le front ne sert rien sur $WEB_URL" >&2
      exit 1
    fi
    echo "  Front en ligne"
    docker image prune -f > /dev/null
    echo "▸ Déploiement $ENVIRONMENT terminé"
    exit 0
  fi
  sleep 2
done

echo "Health check en échec sur $HEALTH_URL après 90 s." >&2
echo "--- 60 dernières lignes du service api ---" >&2
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=60 api >&2 || true
echo "--- service migrate ---" >&2
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=30 migrate >&2 || true
exit 1
