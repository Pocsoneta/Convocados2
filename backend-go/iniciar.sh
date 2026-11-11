#!/usr/bin/env bash
# Compila y arranca la API de Convocados.
#
#   ./iniciar.sh
#
# La configuración sale de `.env` (copiá `.env.example` la primera vez).
# Las variables que estén seteadas en el entorno tienen prioridad.
set -euo pipefail

cd "$(dirname "$0")"

# Go instalado en el home (por ejemplo con la toolchain oficial)
if [ -d "$HOME/.local/go/bin" ]; then
  export PATH="$PATH:$HOME/.local/go/bin"
fi

if [ ! -f .env ]; then
  echo "No encontré .env — copiá el ejemplo y completalo:"
  echo "    cp .env.example .env"
  exit 1
fi

BIN="${TMPDIR:-/tmp}/convocados-api"
echo "→ compilando en $BIN ..."
go build -o "$BIN" ./cmd/server

echo "→ levantando (lee .env)"
exec "$BIN"
