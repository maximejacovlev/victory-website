# Victory. — Site web

Site statique + thème Shopify (`theme/`).

## Lancer en local

```bash
cd "/Users/maxim/Desktop/PERSO/watches/victoria website WIP"
npm run dev
```

(Pas besoin de `npm install` — le serveur utilise Python.)

Puis ouvrir dans le navigateur :

- **Accueil :** http://localhost:3000
- **Blanc :** http://localhost:3000/products/blanc.html

> Ne pas ouvrir les fichiers `.html` directement (double-clic) — le panier Shopify ne fonctionne pas en `file://`.

## Alternative sans npm

```bash
python3 -m http.server 3000
```

Puis http://localhost:3000
