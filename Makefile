.PHONY: up down build logs restart backend-logs ingest-default

# Tüm servisleri başlat
up:
	docker compose up -d

# Tüm servisleri durdur
down:
	docker compose down

# Build et ve başlat
build:
	docker compose up -d --build

# Logları göster
logs:
	docker compose logs -f

# Backend logları
backend-logs:
	docker compose logs -f backend

# Restart
restart:
	docker compose restart backend

# Qdrant UI
qdrant-ui:
	@echo "Qdrant Dashboard: http://localhost:16333/dashboard"

# Default konularla ingestion başlat
ingest-default:
	curl -s -X POST http://localhost:8000/api/v1/ingest/topics \
		-H "Content-Type: application/json" \
		-d '{"pages_per_topic": 2}' | python3 -m json.tool

# Ingestion durumu
ingest-status:
	curl -s http://localhost:8000/api/v1/ingest/status | python3 -m json.tool

# Arama testi
test-search:
	curl -s -X POST http://localhost:8000/api/v1/search/ictihat \
		-H "Content-Type: application/json" \
		-d '{"query": "işe iade davası savunma alınmadan fesih"}' | python3 -m json.tool

# Mevzuat arama testi
test-mevzuat:
	curl -s -X POST http://localhost:8000/api/v1/search/mevzuat \
		-H "Content-Type: application/json" \
		-d '{"query": "iş kanunu"}' | python3 -m json.tool

# Citation verification testi
test-verify:
	curl -s -X POST http://localhost:8000/api/v1/search/verify \
		-H "Content-Type: application/json" \
		-d '{"text": "Yargıtay 9. HD 2023/1234 E., 2023/5678 K. sayılı kararında belirtildiği üzere, 4857 sayılı Kanun md. 18 gereğince..."}' | python3 -m json.tool

# RAG soru-cevap testi (LLM gerektirir)
test-ask:
	curl -s -X POST http://localhost:8000/api/v1/search/ask \
		-H "Content-Type: application/json" \
		-d '{"query": "İşverenin savunma almadan fesih yapması durumunda işe iade olasılığı nedir?"}' | python3 -m json.tool

# Sağlık kontrolü
health:
	curl -s http://localhost:8000/health | python3 -m json.tool

health-detail:
	curl -s http://localhost:8000/health/details | python3 -m json.tool

# === PRODUCTION DEPLOY ===

# Sunucuya dosyalari gonder
deploy-sync:
	rsync -avz --delete \
		--exclude='.git' \
		--exclude='node_modules' \
		--exclude='.next' \
		--exclude='__pycache__' \
		--exclude='.env' \
		--exclude='*.pyc' \
		--exclude='.venv' \
		--exclude='OPTIMIZATION_ROADMAP.md' \
		./ root@204.168.136.223:/opt/lexora/

# Sunucuda build et ve baslat
deploy-build:
	ssh root@204.168.136.223 "cd /opt/lexora && docker compose -f docker-compose.prod.yml up -d --build"

# Tam deploy: sync + build
deploy: deploy-sync deploy-build
	@echo "Deploy tamamlandi! https://getlexora.net"

# Sadece frontend deploy
deploy-frontend:
	rsync -avz --delete \
		--exclude='node_modules' \
		--exclude='.next' \
		./frontend/ root@204.168.136.223:/opt/lexora/frontend/
	ssh root@204.168.136.223 "cd /opt/lexora && docker compose -f docker-compose.prod.yml up -d --build frontend"

# Sadece backend deploy
deploy-backend:
	rsync -avz --delete \
		--exclude='__pycache__' \
		--exclude='*.pyc' \
		--exclude='.venv' \
		./backend/ root@204.168.136.223:/opt/lexora/backend/
	ssh root@204.168.136.223 "cd /opt/lexora && docker compose -f docker-compose.prod.yml up -d --build backend"

# Sunucu loglari
deploy-logs:
	ssh root@204.168.136.223 "cd /opt/lexora && docker compose -f docker-compose.prod.yml logs -f --tail=50"

# Sunucu durumu
deploy-status:
	ssh root@204.168.136.223 "cd /opt/lexora && docker compose -f docker-compose.prod.yml ps"
