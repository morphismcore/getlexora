#!/bin/bash
KEYWORDS=(
  "tazminat davası"
  "sözleşme ihlali"
  "icra takibi itiraz"
  "kamulaştırma bedeli"
  "velayet nafaka"
  "idari para cezası iptal"
  "marka tecavüzü haksız rekabet"
  "sigorta tazminat rücu"
)

echo "=== Initial count ==="
curl -s http://localhost:16333/collections/ictihat_embeddings | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Current: {d[\"result\"][\"points_count\"]} points')"

for kw in "${KEYWORDS[@]}"; do
  echo ""
  echo "=== Ingesting: $kw ==="
  curl -s -X POST http://localhost:8000/api/v1/ingest/keyword \
    -H "Content-Type: application/json" \
    -d "{\"keyword\": \"$kw\", \"pages\": 5}"
  echo ""
  while true; do
    sleep 30
    RUNNING=$(curl -s http://localhost:8000/api/v1/ingest/status | python3 -c "import sys,json; print(json.load(sys.stdin).get('running', False))" 2>/dev/null)
    if [ "$RUNNING" = "False" ] || [ "$RUNNING" = "false" ]; then
      curl -s http://localhost:16333/collections/ictihat_embeddings | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Points: {d[\"result\"][\"points_count\"]}')"
      break
    fi
  done
done

echo ""
echo "=== Final count ==="
curl -s http://localhost:16333/collections/ictihat_embeddings | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Final: {d[\"result\"][\"points_count\"]} points')"
