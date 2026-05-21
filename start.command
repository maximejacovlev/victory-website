#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  Victory. — serveur local"
echo "  Ouvrez : http://localhost:3000"
echo "  Arrêt : Ctrl+C"
echo ""
python3 -m http.server 3000
