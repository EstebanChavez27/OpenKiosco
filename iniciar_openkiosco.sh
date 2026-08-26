#!/usr/bin/env bash

# OpenKiosco - Launcher para Linux (Debian, Ubuntu, Fedora, Arch, etc.)
# Permite iniciar OpenKiosco en modo desarrollo/local sin necesidad de compilar Rust.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

API_PID=""
WEB_PID=""

# Colores para terminal
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

cleanup() {
  echo ""
  echo -e "${YELLOW}Deteniendo OpenKiosco...${NC}"
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [ -n "$WEB_PID" ] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
  # Matar procesos hijos si quedaran
  pkill -P $$ 2>/dev/null || true
  echo -e "${GREEN}Servidores detenidos correctamente.${NC}"
}

trap cleanup EXIT INT TERM HUP

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}        OpenKiosco - Launcher Linux     ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. Comprobar Node.js
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}[ERROR] Node.js no está instalado o no se encuentra en el PATH.${NC}"
  echo "Por favor instálalo (versión 20 o superior):"
  echo "  - Debian/Ubuntu: sudo apt install nodejs npm (o vía NodeSource / nvm)"
  echo "  - Fedora: sudo dnf install nodejs npm"
  echo "  - Arch: sudo pacman -S nodejs npm"
  echo "Presiona Enter para salir."
  read -r _
  exit 1
fi

NODE_VER=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  echo -e "${RED}[ERROR] Se requiere Node.js 20 o superior. Versión detectada: $(node -v)${NC}"
  echo "Presiona Enter para salir."
  read -r _
  exit 1
fi

# 2. Comprobar dependencias
if [ ! -d "node_modules" ]; then
  echo -e "${CYAN}[1/4] Primera vez: instalando dependencias (puede tardar un momento)...${NC}"
  npm install --no-audit --no-fund
else
  echo -e "${GREEN}[1/4] Dependencias verificadas.${NC}"
fi

# 3. Comprobar base de datos
if [ ! -f "apps/api/prisma/dev.db" ]; then
  echo -e "${CYAN}[2/4] Preparando base de datos inicial (migraciones + seed)...${NC}"
  (
    cd apps/api
    npx prisma migrate deploy
    npx tsx prisma/seed.ts
  )
else
  echo -e "${GREEN}[2/4] Base de datos SQLite lista.${NC}"
fi

# 4. Iniciar servicios en segundo plano
echo -e "${CYAN}[3/4] Iniciando backend y frontend...${NC}"

npm run dev -w apps/api > "$DIR/api.log" 2> "$DIR/api.err.log" &
API_PID=$!

npm run dev -w apps/web > "$DIR/web.log" 2> "$DIR/web.err.log" &
WEB_PID=$!

# 5. Esperar disponibilidad
echo -e "${CYAN}[4/4] Esperando a que OpenKiosco esté disponible en http://localhost:5173...${NC}"

READY=0
for i in {1..45}; do
  sleep 1
  if command -v curl >/dev/null 2>&1; then
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 | grep -q "200"; then
      READY=1
      break
    fi
  elif command -v wget >/dev/null 2>&1; then
    if wget -q --spider http://localhost:5173; then
      READY=1
      break
    fi
  else
    # Fallback con node
    if node -e 'fetch("http://localhost:5173").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))' 2>/dev/null; then
      READY=1
      break
    fi
  fi
done

if [ "$READY" -ne 1 ]; then
  echo -e "${RED}[ERROR] El servidor no respondió a tiempo.${NC}"
  echo "Revisa 'api.log' y 'web.log' para más información."
  exit 1
fi

echo ""
echo -e "${GREEN}✔ OpenKiosco está listo:${NC}"
echo -e "   ${CYAN}App Web:${NC} http://localhost:5173"
echo -e "   ${CYAN}API:${NC}     http://localhost:3000/api"
echo ""
echo -e "${YELLOW}Credenciales demo:${NC}"
echo "   - Administrador: usuario 'admin', PIN '1234' (contraseña: admin123)"
echo "   - Cajero:        usuario 'caja1', PIN '1111'"
echo ""

# Abrir navegador si está disponible
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:5173" >/dev/null 2>&1 || true
elif command -v sensible-browser >/dev/null 2>&1; then
  sensible-browser "http://localhost:5173" >/dev/null 2>&1 || true
elif command -v gio >/dev/null 2>&1; then
  gio open "http://localhost:5173" >/dev/null 2>&1 || true
fi

echo -e "Presiona ${YELLOW}[Q]${NC} o ${YELLOW}[Ctrl + C]${NC} para detener los servidores."

while true; do
  read -rsn1 input
  if [ "$input" = "q" ] || [ "$input" = "Q" ]; then
    break
  fi
done
