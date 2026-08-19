# Déploiement — préproduction & production

Procédure d'installation et d'exploitation d'Equime sur un VPS Debian, avec
**Caddy déjà installé sur l'hôte** et servant éventuellement d'autres sites.

---

## 1. Architecture cible

```
Internet
   │ 443
┌──▼──────────────── VPS Debian ─────────────────────────┐
│  Caddy (hôte) — TLS automatique, plusieurs sites       │
│    equime.fr          /api/* → 127.0.0.1:3001          │
│                       /*     → 127.0.0.1:8081          │
│    preprod.equime.fr  /api/* → 127.0.0.1:3000          │
│                       /*     → 127.0.0.1:8080          │
│                                                         │
│  ┌ equime-prod ──────────┐  ┌ equime-preprod ─────────┐│
│  │ web · api             │  │ web · api               ││
│  │ postgres · redis      │  │ postgres · redis        ││
│  └───────────────────────┘  └─────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

Les deux stacks sont isolées : noms de projet Compose distincts
(`equime-prod`, `equime-preprod`) → réseaux, volumes et bases séparés.

### Plan de ports

| Environnement | web | api |
|---|---|---|
| Préproduction | `127.0.0.1:8080` | `127.0.0.1:3000` |
| Production | `127.0.0.1:8081` | `127.0.0.1:3001` |

Tout est publié **sur la loopback uniquement**. Docker insère ses propres
règles iptables (`DOCKER-USER`) qui court-circuitent ufw : sans le préfixe
`127.0.0.1:`, un port serait joignable depuis Internet malgré le pare-feu.

### Pourquoi Caddy attaque l'API en direct

`apps/api/src/app.js` configure `app.set('trust proxy', 1)` : Express ne fait
confiance qu'à **un seul intermédiaire** pour déterminer `req.ip`. Or
`req.ip` est la clé du rate limiting Redis (`middlewares/rateLimit.js`,
OWASP A07, fail-closed sur les routes d'auth).

Si la chaîne comportait deux proxys (`Caddy → nginx frontal → api`), `req.ip`
vaudrait l'IP du proxy pour **tous** les visiteurs : un compteur unique
partagé, transformant la protection anti-brute-force en déni de service
global. Mesure réalisée sur la stack :

| Chaîne | 10 échecs depuis IP A | 1ʳᵉ requête depuis IP B |
|---|---|---|
| 1 saut (Caddy → api) | `401 ×10` puis `429` | `401` ✅ compteur isolé |
| 2 sauts | `401 ×10` | `429` ❌ victime collatérale |

Caddy réécrit systématiquement `X-Forwarded-For` / `-Proto` / `-Host` et
ignore les valeurs entrantes (anti-spoofing) : il est bien le premier proxy
de la chaîne, et `trust proxy 1` reste correct sans modifier le code.

Le service `nginx` frontal des compose a donc été supprimé. Les contrôles
qu'il portait sont assurés ailleurs :

| Contrôle | Emplacement |
|---|---|
| TLS, HSTS, Permissions-Policy | Caddyfile de l'hôte |
| CSP, X-Frame-Options, nosniff, Referrer-Policy | `docker/nginx/web.conf` (image web) + Helmet (API) |
| Rate limiting `/api/v1/auth/*` | `apps/api/src/middlewares/rateLimit.js` (Redis, fail-closed) |

`docker/nginx/prod.conf` et `preprod.conf` sont conservés à titre
documentaire mais ne sont plus montés.

---

## 2. Prérequis

### 2.1 DNS

Deux enregistrements **A** vers l'IP du VPS :

| Nom | Type | Valeur |
|---|---|---|
| `equime.fr` (ou `@`) | A | `<IP_VPS>` |
| `preprod` | A | `<IP_VPS>` |

```bash
dig +short equime.fr preprod.equime.fr
```

### 2.2 Audit de l'existant

```bash
sudo ss -tlnp                 # ports déjà occupés
docker --version              # Docker présent ?
docker compose version
caddy version                 # < 2.8 ⇒ directive `basicauth` au lieu de `basic_auth`
sudo cat /etc/caddy/Caddyfile # structure de la config existante
sudo ufw status verbose
```

Si l'un des ports 8080 / 8081 / 3000 / 3001 est pris, choisir un port libre
et l'adapter dans le compose **et** dans le Caddyfile.

Sauvegarde obligatoire avant toute modification :

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%F)
```

---

## 3. Installation

### 3.1 Pare-feu

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw default deny incoming && sudo ufw default allow outgoing && sudo ufw --force enable
```

Aucun port applicatif à ouvrir : tout est en loopback derrière Caddy.

### 3.2 Docker (si absent)

```bash
sudo apt update && sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Se déconnecter / reconnecter pour que le groupe prenne effet.

### 3.3 Clonage (deux checkouts distincts)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/equime_deploy -N ""
cat ~/.ssh/equime_deploy.pub   # → GitHub, Settings > Deploy keys (lecture seule)
printf 'Host github-equime\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/equime_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config
mkdir -p ~/apps
git clone git@github-equime:<compte>/<repo>.git ~/apps/equime-prod
git clone git@github-equime:<compte>/<repo>.git ~/apps/equime-preprod
cd ~/apps/equime-prod && git checkout main
cd ~/apps/equime-preprod && git checkout develop
```

### 3.4 Secrets

```bash
openssl rand -base64 48 | tr -d '\n'                      # JWT_ACCESS_SECRET
openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32  # POSTGRES_PASSWORD
```

Un jeu par environnement, conservé dans un gestionnaire de mots de passe.
`config/env.js` refuse toute valeur commençant par `change_me` en production.

---

## 4. Démarrage des stacks

### 4.1 Préproduction

```bash
cd ~/apps/equime-preprod
cp .env.preprod.example .env.preprod && chmod 600 .env.preprod
$EDITOR .env.preprod
docker compose -f docker-compose.preprod.yml --env-file .env.preprod up -d --build
```

Jeu de données de recette (données réalistes anonymisées) :

```bash
docker compose -f docker-compose.preprod.yml --env-file .env.preprod run --rm migrate node prisma/seed-recette.js
```

Vérification :

```bash
curl -s http://127.0.0.1:3000/health && curl -so /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/
```

### 4.2 Production

```bash
cd ~/apps/equime-prod
cp .env.prod.example .env.prod && chmod 600 .env.prod
$EDITOR .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
curl -s http://127.0.0.1:3001/health && curl -so /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/
```

La production n'est **jamais** seedée : le premier administrateur est créé
manuellement (§ 6).

### 4.3 Migrations

Le service `migrate` (cible `api-build`, qui embarque le CLI Prisma retiré de
l'image de runtime par `--omit=dev`) joue `prisma migrate deploy` avant le
démarrage de l'API, via `depends_on: condition: service_completed_successfully`.
Aucune action manuelle n'est requise à chaque déploiement.

---

## 5. Configuration Caddy

L'application est ajoutée **à côté** de la configuration existante, sans la
modifier : un seul `import` est ajouté en fin de Caddyfile.

```bash
sudo mkdir -p /etc/caddy/conf.d
grep -n "import" /etc/caddy/Caddyfile          # ligne déjà présente ?
echo '
import /etc/caddy/conf.d/*.caddy' | sudo tee -a /etc/caddy/Caddyfile
```

Mot de passe de la préproduction :

```bash
caddy hash-password --plaintext '<mot de passe recette>'
```

Puis `/etc/caddy/conf.d/equime.caddy` :

```caddyfile
# ---------------- PRODUCTION ----------------
equime.fr, www.equime.fr {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		-Server
	}

	request_body {
		max_size 8MB
	}

	handle /api/* {
		reverse_proxy 127.0.0.1:3001
	}

	handle /health {
		reverse_proxy 127.0.0.1:3001
	}

	handle {
		reverse_proxy 127.0.0.1:8081
	}

	log {
		output file /var/log/caddy/equime-prod.log
	}
}

# ---------------- PRÉPRODUCTION ----------------
preprod.equime.fr {
	encode zstd gzip

	basic_auth {
		recette <hash bcrypt>
	}

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		X-Robots-Tag "noindex, nofollow"
		-Server
	}

	request_body {
		max_size 8MB
	}

	handle /api/* {
		reverse_proxy 127.0.0.1:3000
	}

	handle {
		reverse_proxy 127.0.0.1:8080
	}

	log {
		output file /var/log/caddy/equime-preprod.log
	}
}
```

Notes :

- `max_size 8MB` reproduit le `client_max_body_size 8m` des confs nginx
  (upload des documents cavaliers).
- CSP, X-Frame-Options et Referrer-Policy ne sont **pas** redéfinis ici :
  `web.conf` les pose sur le statique et Helmet sur l'API. Les redéclarer
  dans Caddy les écraserait.
- Le `basic_auth` couvre aussi `/api/*` ; le navigateur renvoie l'en-tête sur
  les requêtes XHR de même origine, le front fonctionne normalement.

Validation **avant** rechargement — c'est ce qui protège les autres sites :

```bash
sudo caddy fmt --overwrite /etc/caddy/conf.d/equime.caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -f      # suivi de l'émission des certificats
```

Rollback :

```bash
sudo cp /etc/caddy/Caddyfile.bak-<date> /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

---

## 6. Premier administrateur (production)

```bash
cd ~/apps/equime-prod
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T \
  -e ADMIN_EMAIL='admin@equime.fr' -e ADMIN_PASSWORD='<mot de passe>' \
  api node --input-type=module <<'EOF'
import { prisma } from '/app/apps/api/src/lib/prisma.js';
import { hashPassword } from '/app/apps/api/src/lib/passwords.js';

const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD);
const user = await prisma.user.create({
  data: {
    email: process.env.ADMIN_EMAIL,
    passwordHash,
    firstName: 'Admin',
    lastName: 'Equime',
    role: 'admin',
  },
});
console.log('Administrateur créé :', user.email);
process.exit(0);
EOF
history -d $((HISTCMD-1))
```

---

## 7. Recette de déploiement

À exécuter après chaque mise en production.

| # | Contrôle | Commande | Attendu |
|---|---|---|---|
| 1 | Site existant intact | `curl -sI https://<autre-domaine>/` | `200` |
| 2 | Front prod | `curl -sI https://equime.fr/` | `200` + HSTS |
| 3 | API prod | `curl -s https://equime.fr/health` | `{"status":"ok",…,"redis":"up"}` |
| 4 | Préprod protégée | `curl -so /dev/null -w '%{http_code}' https://preprod.equime.fr/` | `401` |
| 5 | Préprod authentifiée | `curl -s -u recette:<mdp> https://preprod.equime.fr/health` | `{"status":"ok",…}` |
| 6 | Fallback SPA | `curl -sI https://equime.fr/connexion` | `200` |
| 7 | Rate limiting sur IP réelle | voir ci-dessous | `401` ×10 puis `429` |

Contrôle 7, **depuis un poste externe** (pas depuis le VPS) :

```bash
for i in $(seq 1 12); do
  curl -so /dev/null -w "%{http_code} " -X POST https://equime.fr/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"inexistant@test.fr","password":"MauvaisMotDePasse1!"}'
done; echo
```

Un `429` dès les premières requêtes alors que le site est inutilisé signale
une chaîne de proxys trop longue : vérifier que Caddy pointe bien sur
`127.0.0.1:3001` **en direct** et non sur le conteneur web.

---

## 8. Exploitation

### Déployer

```bash
# Préproduction (develop)
cd ~/apps/equime-preprod && git pull
docker compose -f docker-compose.preprod.yml --env-file .env.preprod up -d --build

# Production (main) — sauvegarde préalable obligatoire
cd ~/apps/equime-prod && ~/backups/equime-backup.sh && git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### Superviser

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api
docker image prune -af     # nettoyage, sans toucher aux volumes
```

### Sauvegardes (RGPD — art. 32, intégrité et disponibilité)

`~/backups/equime-backup.sh` :

```bash
#!/usr/bin/env bash
set -euo pipefail
DATE=$(date +%F_%H%M)
DEST="$HOME/backups"
cd "$HOME/apps/equime-prod"
set -a; source .env.prod; set +a

docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$DEST/equime_db_$DATE.sql.gz"

docker run --rm -v equime-prod_uploads-prod-data:/data:ro -v "$DEST":/backup alpine \
  tar czf "/backup/equime_uploads_$DATE.tar.gz" -C /data .

find "$DEST" -name 'equime_*.gz' -mtime +14 -delete
```

```bash
chmod +x ~/backups/equime-backup.sh
crontab -e   # 0 3 * * * /home/<user>/backups/equime-backup.sh >> /home/<user>/backups/equime-backup.log 2>&1
```

Les archives doivent être **externalisées** hors du VPS (`scp`), et une
restauration testée au moins une fois : une sauvegarde jamais restaurée n'est
pas une sauvegarde.

### Restaurer

```bash
cd ~/apps/equime-prod
set -a; source .env.prod; set +a
gunzip -c ~/backups/equime_db_<date>.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

### Durcissement de l'hôte

```bash
sudo apt install -y fail2ban unattended-upgrades
sudo systemctl enable --now fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/; s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh   # vérifier la reconnexion dans un second terminal AVANT de fermer
```

---

## 9. Points d'attention connus

- **`prisma.config.js` résout `env('DATABASE_URL')` au chargement.** Prisma 7
  échoue si la variable est absente, y compris pour `generate` qui ne se
  connecte à rien. Les stages `dev` et `api-build` du Dockerfile passent donc
  une valeur factice au moment du build ; la vraie vient de l'environnement au
  runtime.
- **Le client Prisma est généré dans `apps/api/generated`**, exclu par
  `.dockerignore`. Le stage `api-build` le régénère et l'image `prod` le
  recopie — ne pas retirer la ligne `COPY --from=api-build`.
- **`/app/uploads` doit appartenir à `node`** dans l'image : un volume nommé
  monté sur un chemin inexistant serait créé en `root:root` et l'API,
  non-root, ne pourrait pas y écrire.
- **`.dockerignore` : les motifs non préfixés ne matchent que la racine.**
  `.env` seul laissait passer `apps/api/.env` dans les images ; les variantes
  `**/.env` sont indispensables.
- **`environment:` prime sur `env_file:`** dans Compose : `DATABASE_URL`
  reconstruite dans le compose l'emporte toujours sur celle d'un `.env`.
