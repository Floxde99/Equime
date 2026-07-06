# Equime — raccourcis de développement.
# Équivalents npm : npm run dev / down / logs / migrate / seed / lint / test

.PHONY: dev down logs migrate seed lint test

dev: ## Lance l'environnement de dev complet (postgres, redis, api, web)
	docker compose up --build

down: ## Arrête et supprime les conteneurs
	docker compose down

logs: ## Suit les logs de tous les services
	docker compose logs -f

migrate: ## Applique les migrations Prisma (Phase 1)
	@echo "prisma migrate arrive en Phase 1"

seed: ## Alimente la base de données (Phase 1)
	@echo "prisma db seed arrive en Phase 1"

lint: ## Lint l'ensemble du monorepo
	npm run lint

test: ## Lance les tests de tous les workspaces
	npm test
