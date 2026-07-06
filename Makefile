# Equime — raccourcis de développement.
# Équivalents npm : npm run dev / down / logs / migrate / seed / lint / test

.PHONY: dev down logs migrate seed lint test

dev: ## Lance l'environnement de dev complet (postgres, redis, api, web)
	docker compose up --build

down: ## Arrête et supprime les conteneurs
	docker compose down

logs: ## Suit les logs de tous les services
	docker compose logs -f

migrate: ## Crée/applique les migrations Prisma (dev)
	npm run migrate -w apps/api

seed: ## Alimente la base avec le jeu de données de développement
	npm run seed -w apps/api

lint: ## Lint l'ensemble du monorepo
	npm run lint

test: ## Lance les tests de tous les workspaces
	npm test
