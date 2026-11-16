#!/usr/bin/env bash
# Publica la API (y el front que sirve) en internet con un túnel.
#
#   ./iniciar.sh          # en una terminal: la API en :8080
#   ./tunel.sh            # en otra: te da una URL pública
#
# Con ngrok (recomendado): poné NGROK_DOMAIN=tu-dominio.ngrok-free.app en
# .env (o en el entorno). La URL no cambia entre reinicios.
# Sin NGROK_DOMAIN usa cloudflared: URL de prueba que cambia cada vez.
#
# Importante: no uses PUBLIC_URL en .env mientras uses el túnel (la fijaría
# a una dirección de red local). Sin PUBLIC_URL, los links de invitación
# salen con la dirección del túnel.
set -euo pipefail

cd "$(dirname "$0")"
[ -f .env ] && NGROK_DOMAIN="${NGROK_DOMAIN:-$(grep -E '^NGROK_DOMAIN=' .env | tail -1 | cut -d= -f2-)}"

PUERTO="${PUERTO:-8080}"

if ! curl -s -o /dev/null "http://localhost:${PUERTO}/api/health"; then
  echo "La API no responde en el puerto ${PUERTO}. Levantala primero con ./iniciar.sh"
  exit 1
fi

if [ -n "${NGROK_DOMAIN:-}" ]; then
  BIN="$(command -v ngrok || true)"
  [ -z "$BIN" ] && [ -x "$HOME/.local/bin/ngrok" ] && BIN="$HOME/.local/bin/ngrok"
  if [ -z "$BIN" ]; then
    echo "No encontré ngrok. Instalalo desde https://ngrok.com/download"
    exit 1
  fi
  echo "→ túnel ngrok: https://${NGROK_DOMAIN} → http://localhost:${PUERTO} (Ctrl+C para cortar)"
  exec "$BIN" http --url="https://${NGROK_DOMAIN}" "$PUERTO"
fi

BIN="$(command -v cloudflared || true)"
[ -z "$BIN" ] && [ -x "$HOME/.local/bin/cloudflared" ] && BIN="$HOME/.local/bin/cloudflared"
if [ -z "$BIN" ]; then
  echo "No encontré cloudflared ni NGROK_DOMAIN. Configurá ngrok (ver README) o instalá cloudflared."
  exit 1
fi
echo "→ túnel de prueba (URL que cambia) hacia http://localhost:${PUERTO} (Ctrl+C para cortar)"
exec "$BIN" tunnel --url "http://localhost:${PUERTO}"
