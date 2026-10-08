# XN-KODASSY — Boutique en ligne de chaussures de football

**PLAY HARD. LOOK PRO.**

Site e-commerce full-stack : boutique publique, panier, commande en ligne (paiement à la livraison), espace administrateur (produits, images, promotions, commandes, avis).

---

## 1. Architecture

```
Navigateur (HTML + CSS + JS modules, sans framework)
        │  fetch('/api/...')            ← le front ne contient AUCUN produit en dur
        ▼
Express 5 (un seul serveur Node.js)
  ├── /api/*            API REST JSON (validation zod, JWT, rate limiting)
  ├── /, /boutique, /produit/:slug …   pages HTML rendues avec header/footer partagés + SEO
  ├── /admin            interface d'administration (SPA légère)
  └── /uploads          images importées (converties en WebP)
        │
        ▼
MongoDB (Mongoose) : Product · Order · User · Review · Subscriber · Counter
```

**Choix techniques**

| Besoin | Choix | Pourquoi |
|---|---|---|
| Front | HTML5, CSS moderne, JavaScript ES modules | Pas de build, chargement rapide, aucune dépendance front. React n'apporterait rien ici. Bootstrap non utilisé : un CSS sur mesure de ~40 Ko colle mieux à l'identité de marque. |
| Back | Node.js + Express 5 | Standard, simple à héberger. |
| Base | MongoDB + Mongoose 8 | Modèles demandés, schémas validés. |
| Auth | JWT (HS256) dans un **cookie httpOnly, SameSite=Strict** + bcrypt (coût 12) | Le token n'est jamais lisible par le JavaScript (protection XSS) ni envoyé depuis un autre site (protection CSRF). |
| Validation | zod | Toutes les entrées sont typées et nettoyées côté serveur. |
| Images | multer + sharp | Redimensionnement 1400 px max, suppression EXIF, conversion WebP. |

Un seul serveur sert le front, l'API et l'admin : pas de CORS à gérer, un seul déploiement.

## 2. Structure du projet

```
kodassy/
├── backend/
│   ├── server.js             démarrage (connexion MongoDB puis HTTP)
│   ├── app.js                application Express (sécurité, routes, pages)
│   ├── dev-memory.js         mode démo sans MongoDB installé
│   ├── config/               env.js, db.js, catalog.js (catégories, statuts)
│   ├── models/               Product, Order, User, Review, Subscriber, Counter
│   ├── controllers/          product, order, auth, admin, review
│   ├── routes/               products, orders, auth, admin, public
│   ├── middleware/           auth (JWT), validate (zod), sanitize, rateLimits, upload, error
│   ├── validators/schemas.js schémas zod de toutes les entrées
│   ├── utils/                pages (rendu HTML + SEO), images (sharp), text, httpError
│   ├── seed/                 seed.js, products.js (démo), generate-images.js, create-admin.js
│   ├── tests/api.test.js     24 tests d'API (vraie base MongoDB en mémoire)
│   └── uploads/              images importées depuis l'admin (non versionnées)
├── frontend/
│   ├── index.html, shop.html, product.html, cart.html, checkout.html, confirmation.html
│   ├── contact.html, cgv.html, privacy.html, 404.html
│   ├── partials/             header.html, footer.html (insérés par le serveur)
│   ├── css/style.css
│   ├── js/                   api, cart, ui, app, home, shop, product, cart-page, checkout, confirmation
│   └── images/               brand/ (logos, favicons), products/ (visuels démo), placeholder.svg
├── admin/
│   ├── index.html
│   ├── css/admin.css
│   └── js/                   core, main (auth + routeur), dashboard, products, orders, reviews
├── brand/                    identité visuelle (logos SVG, brand book, générateurs)
├── .env.example              modèle de configuration
├── Dockerfile, ecosystem.config.js
└── package.json
```

## 3. Modèle de données

**Product** : `name, slug (URL), reference, brand, category (fg|ag|sg|tf|ic|kids), description, features[], price, oldPrice, discount (calculé), images[], sizes[{size, stock}], stock (calculé = somme), featured, active, salesCount, createdAt, updatedAt`

**Order** : `orderNumber (#1001…), customer{name, phone, email, city, address, postalCode, comment}, products[{productId, name, brand, reference, image, size, quantity, price}], subtotal, shipping, total, deliveryMethod, paymentMethod, status, statusHistory[], adminNote, createdAt, updatedAt`

**User** : `name, email, passwordHash (bcrypt, jamais renvoyé par l'API), role: admin, lastLoginAt, createdAt`

**Review** : `product, name, city, rating 1–5, comment, approved` · **Subscriber** : `email` · **Counter** : numérotation des commandes.

## 4. API REST

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/api/products` | public | Liste. Paramètres : `q, brand, category, minPrice, maxPrice, size, promo, featured, inStock, sort (newest, price_asc, price_desc, popular, discount), page, limit` |
| GET | `/api/products/meta` | public | Marques, catégories (avec compteurs), pointures, fourchette de prix |
| GET | `/api/products/:id` | public | Détail par id ou slug |
| POST | `/api/products` | admin | Créer |
| PUT | `/api/products/:id` | admin | Modifier |
| DELETE | `/api/products/:id` | admin | Supprimer (et ses images importées) |
| PATCH | `/api/products/:id/promotion` | admin | `{percent}` : mettre ou retirer une promotion |
| POST | `/api/cart/validate` | public | Recalcule le panier avec les prix et stocks réels |
| POST | `/api/orders` | public | Créer une commande |
| GET | `/api/orders` | admin | Liste (`status, q, page`) |
| GET | `/api/orders/:id` | admin | Détail (id ou numéro) |
| PUT | `/api/orders/:id/status` | admin | `{status, adminNote}` |
| POST | `/api/auth/login` · `/logout` | public | Connexion / déconnexion |
| GET | `/api/auth/me` | admin | Session courante |
| GET | `/api/admin/stats` | admin | Tableau de bord |
| POST | `/api/admin/uploads` | admin | Import d'images (champ `images`, 8 max, 5 Mo chacune) |
| GET/PATCH/DELETE | `/api/admin/reviews[/:id]` | admin | Modération des avis |
| GET/POST | `/api/reviews` · POST `/api/newsletter` · GET `/api/config` | public | Avis, newsletter, configuration |

Erreurs : toujours `{ "error": "message lisible", "details": [{field, message}] }` avec le bon code HTTP (400, 401, 403, 404, 409, 413, 429, 500).

## 5. Flux de commande

1. Le client ajoute des articles (taille obligatoire). Le panier est stocké dans `localStorage` : il survit à la navigation, au rechargement et se synchronise entre onglets.
2. Les pages Panier et Commande appellent `/api/cart/validate` : **les prix, remises, stocks et frais de livraison viennent de la base**, jamais du navigateur.
3. « Confirmer ma commande » → `POST /api/orders` avec seulement `{productId, size, quantity}` + infos client.
4. Le serveur revalide tout, **réserve le stock de façon atomique** (aucune survente possible même avec deux clients simultanés), attribue un numéro (#1001…) et enregistre la commande au statut **Nouvelle**.
5. Le client voit la page de confirmation (numéro, récapitulatif, étapes suivantes).
6. Dans l'admin : badge rouge « Commandes », appel au client, puis statut **Confirmée → En préparation → Expédiée → Livrée**. **Annulée** remet automatiquement les articles en stock.

Livraison : 30 DH, offerte dès 1 500 DH (modifiable dans `.env`).

## 6. Sécurité

- Mots de passe hashés avec bcrypt (coût 12). Temps de réponse constant au login (pas d'énumération d'emails).
- JWT signé HS256, durée 8 h, dans un cookie `httpOnly; SameSite=Strict; Secure` (en production).
- Routes admin protégées par le middleware `requireAdmin` (vérifie le token **et** l'existence de l'utilisateur en base).
- Validation zod de chaque entrée : types, longueurs, formats (téléphone marocain, email), prix positifs, ancien prix > prix, quantités 1–10, pointures 28–48.
- Anti-injection NoSQL : schémas typés + suppression des clés `$`/`.` + parseur de query Express 5 (aucun objet possible dans l'URL). Recherche texte échappée (pas de ReDoS).
- Prix et totaux toujours recalculés côté serveur.
- Helmet : Content-Security-Policy stricte (aucun script inline ni externe), anti-clickjacking, HSTS…
- Rate limiting : login 10 essais / 15 min, commandes 10 / 10 min, formulaires 8 / 10 min, API 600 / 15 min.
- Champs pièges anti-robots sur la commande et les avis.
- Uploads : types d'image uniquement, 5 Mo max, réencodés par sharp (un fichier piégé ne passe pas).
- Secrets uniquement dans `.env` (ignoré par git). Aucun secret côté front.
- CORS fermé par défaut (même origine) ; ouvrable via `CORS_ORIGINS`.

---

## 7. Installation

### Prérequis
- **Node.js 20 ou plus récent** : https://nodejs.org (version LTS)
- **MongoDB** : au choix
  - **MongoDB Atlas (recommandé, gratuit)** : voir ci-dessous
  - MongoDB Community en local : https://www.mongodb.com/try/download/community
  - ou aucun, pour un simple essai : `npm run dev:memory`

### Dépendances

```bash
npm install
```

| Production | Rôle |
|---|---|
| express 5 | serveur HTTP |
| mongoose 8 | MongoDB |
| bcryptjs | hash des mots de passe (algorithme bcrypt, en JavaScript pur : pas de compilation native) |
| jsonwebtoken | JWT |
| cookie-parser | lecture du cookie de session |
| helmet | en-têtes de sécurité / CSP |
| cors | CORS (désactivé par défaut) |
| compression | gzip |
| express-rate-limit | limitation de débit |
| multer 2 | réception des fichiers |
| sharp | optimisation des images |
| zod | validation |
| dotenv | lecture de `.env` |
| morgan | journal des requêtes |

| Développement | Rôle |
|---|---|
| supertest | tests HTTP |
| mongodb-memory-server | vrai MongoDB en mémoire pour les tests et le mode démo |

### Configuration `.env`

```bash
cp .env.example .env
```

Puis remplissez :

```env
NODE_ENV=development
PORT=3000
SITE_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/xn-kodassy
JWT_SECRET=<64+ caractères aléatoires>
JWT_EXPIRES_IN=8h
ADMIN_NAME=Admin XN-KODASSY
ADMIN_EMAIL=admin@xn-kodassy.ma
ADMIN_PASSWORD=<mot de passe solide>
SHIPPING_FEE=30
FREE_SHIPPING_THRESHOLD=1500
CORS_ORIGINS=
```

Générer un `JWT_SECRET` :
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> Un fichier `.env` de développement a déjà été généré avec un secret aléatoire. **Ne le publiez jamais** (il est dans `.gitignore`).

### Configuration MongoDB Atlas (gratuit)

1. Créez un compte sur https://www.mongodb.com/cloud/atlas/register
2. **Create a cluster** → offre **M0 Free** → région proche (ex. Paris / Francfort).
3. **Database Access** → *Add New Database User* → identifiant + mot de passe (rôle *Read and write to any database*).
4. **Network Access** → *Add IP Address* → votre IP (en développement) ; pour un hébergeur cloud, l'IP du serveur ou `0.0.0.0/0` si l'hébergeur n'a pas d'IP fixe.
5. **Connect** → *Drivers* → copiez l'URI et ajoutez le nom de la base :
   ```
   MONGODB_URI=mongodb+srv://UTILISATEUR:MOTDEPASSE@cluster0.xxxxx.mongodb.net/xn-kodassy?retryWrites=true&w=majority
   ```

MongoDB local : laissez `MONGODB_URI=mongodb://127.0.0.1:27017/xn-kodassy` après avoir installé et démarré MongoDB Community.

### Charger les données de démonstration

```bash
npm run seed            # 16 produits, 6 avis, compte admin (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run seed -- --reset # vide produits, commandes et avis puis recharge
```

## 8. Lancer le projet

Le front, l'API et l'admin sont servis par **le même serveur** : un seul processus à lancer.

```bash
npm run dev     # développement (redémarre à chaque modification du back-end)
npm start       # production
```

- Boutique : http://localhost:3000
- Administration : http://localhost:3000/admin
- API : http://localhost:3000/api/products

**Essai immédiat sans installer MongoDB :**
```bash
npm run dev:memory
```
Lance un vrai serveur MongoDB en mémoire, le remplit avec la démo et démarre le site. Les données sont perdues à l'arrêt : réservé aux essais.

**Tests :**
```bash
npm test        # 24 tests : catalogue, filtres, auth, CRUD, commandes, stock, statuts, uploads
```

## 9. Compte administrateur de test

| Email | Mot de passe |
|---|---|
| `admin@xn-kodassy.ma` | `Kodassy2026!` |

Créé par `npm run seed` à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD`. **Changez-le avant la mise en ligne** :
```bash
npm run create-admin -- votre@email.ma "UnMotDePasseTresSolide" "Votre nom"
```
(crée le compte, ou réinitialise le mot de passe s'il existe déjà).

### Plusieurs administrateurs
Dans **/admin → Administrateurs** :
- **Ajouter un administrateur** : nom, email, mot de passe (10 caractères min., lettres + chiffres). Tous les admins ont les mêmes droits : commandes, chiffre d'affaires, produits, promotions, avis.
- 🔑 : définir un nouveau mot de passe pour un admin qui l'a oublié (ses sessions sont déconnectées).
- 🗑 : supprimer un admin (accès coupé immédiatement). On ne peut pas supprimer son propre compte ni le dernier admin.
- **Mon mot de passe** : changer son mot de passe ; les sessions ouvertes sur d'autres appareils sont déconnectées.

API : `GET/POST /api/admin/users`, `PUT /api/admin/users/:id/password`, `DELETE /api/admin/users/:id`, `PUT /api/auth/password`.

## 10. Ajouter un produit

1. Ouvrez `/admin` et connectez-vous.
2. **Produits** → **Ajouter un produit**.
3. Remplissez nom, marque, catégorie, description, caractéristiques (une par ligne).
4. **Images** : glissez vos photos ou cliquez pour les choisir. Elles sont prévisualisées tout de suite, importées et converties en WebP. La première est l'image principale ; réordonnez avec les flèches.
5. **Prix** : prix actuel. Pour une promotion, saisissez un **ancien prix** plus élevé : la réduction (%) est calculée automatiquement.
6. **Pointures et stock** : bouton *Grille 39–46* (ou *Enfants 28–38*), puis stock par pointure.
7. Cochez *Produit vedette* pour l'afficher dans le hero de l'accueil.
8. **Créer le produit** : il est en ligne immédiatement.

Promotion rapide : dans la liste, bouton étiquette → pourcentage (0 % retire la promo). Retirer temporairement un produit : décochez *Visible sur la boutique*.

Toutes les photos ont un rendu uniforme quel que soit leur format (zone carrée + `object-fit: contain`). Idéalement : fond clair, chaussure de profil, 1200 × 1200 px.

## 11. Recevoir et gérer une commande

1. Une commande passée apparaît instantanément dans **Commandes** (badge rouge) et sur le tableau de bord.
2. Ouvrez-la : articles, pointures, adresse, commentaire, total à encaisser.
3. Boutons **Appeler** et **WhatsApp** (message pré-rempli) pour confirmer avec le client.
4. Changez le statut : *Confirmée → En préparation → Expédiée → Livrée*. Chaque changement est historisé avec l'auteur et l'heure.
5. **Annulée** remet le stock à jour automatiquement.
6. **Note interne** pour l'équipe ; **Imprimer** produit un bon de préparation.

Avis clients : déposés sur les fiches produit, publiés uniquement après validation dans **Avis clients**.

## 12. Déploiement

### Avant la mise en ligne
- `NODE_ENV=production`, `SITE_URL=https://votre-domaine.ma`
- `JWT_SECRET` neuf (64+ caractères), mot de passe admin changé
- MongoDB Atlas configuré
- Contacts déjà en place : WhatsApp 06 11 31 95 37 (`wa.me/212611319537`) et Instagram @xn_kodassy1. Pour les changer : `frontend/partials/header.html`, `footer.html`, `frontend/contact.html`, `frontend/js/product.js`, `frontend/js/confirmation.js`
- Remplacer les visuels de démonstration par de vraies photos depuis l'admin

### Option A — Render / Railway (le plus simple)
1. Poussez le projet sur GitHub (le `.env` n'est pas envoyé).
2. Créez un *Web Service* Node : build `npm ci --omit=dev`, start `npm start`.
3. Ajoutez les variables d'environnement du `.env`, plus `TRUST_PROXY=1`.
4. Lancez une fois `npm run seed` (shell de l'hébergeur) pour créer l'admin.
5. **Images** : le disque de ces plateformes est éphémère. Ajoutez un *disque persistant* monté sur `/app/backend/uploads` (Render : *Disks* ; Railway : *Volumes*), sinon les images importées disparaissent au redéploiement.
6. Associez votre nom de domaine ; le HTTPS est automatique.

### Option B — VPS (Ubuntu) avec PM2 + Nginx
```bash
# sur le serveur
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs nginx
git clone <votre-repo> xn-kodassy && cd xn-kodassy
npm ci --omit=dev
cp .env.example .env && nano .env      # NODE_ENV=production, TRUST_PROXY=1, …
npm run seed
sudo npm i -g pm2 && pm2 start ecosystem.config.js && pm2 save && pm2 startup
```
Nginx (`/etc/nginx/sites-available/xn-kodassy`) :
```nginx
server {
  server_name votre-domaine.ma www.votre-domaine.ma;
  client_max_body_size 40M;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/xn-kodassy /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d votre-domaine.ma -d www.votre-domaine.ma
```

### Option C — Docker
```bash
docker build -t xn-kodassy .
docker run -d -p 3000:3000 --env-file .env -v xnk_uploads:/app/backend/uploads xn-kodassy
```

### Sauvegardes
Atlas M0 n'inclut pas de sauvegarde automatique : planifiez un `mongodump --uri "$MONGODB_URI"` régulier, et sauvegardez `backend/uploads/`.

---

## SEO intégré
- Title, meta description, canonical, Open Graph et Twitter Card sur chaque page.
- Fiches produit rendues côté serveur avec leurs vraies balises et des **données structurées `Product`** (JSON-LD : prix, stock, marque, SKU).
- URLs propres : `/boutique`, `/produit/adidas-f50-elite-fg`.
- `sitemap.xml` (produits inclus) et `robots.txt` dynamiques.
- HTML sémantique, textes alternatifs, fil d'Ariane.

## Performance
- Zéro framework front, zéro bibliothèque JS côté client ; compression gzip.
- Images WebP redimensionnées, `loading="lazy"`, dimensions déclarées (pas de décalage de mise en page), image de secours automatique.
- Squelettes de chargement, requêtes annulées quand les filtres changent, cache HTTP court sur le catalogue.
- Index MongoDB sur les tris et filtres principaux.
