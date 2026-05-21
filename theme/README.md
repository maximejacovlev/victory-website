# Aurore — Shopify Theme

A refined, editorial Shopify theme for a small-batch wine + spirits maison.
Built around an oversized serif aesthetic (Cormorant Garamond + Manrope),
cream + wine palette, full-bleed hero with animated grain, slide-in cart
drawer, and scroll-driven reveals.

## File structure

```
theme/
├── layout/
│   └── theme.liquid               Main HTML shell, font + asset loading
├── templates/
│   ├── index.json                 Home — sections in order
│   ├── product.json               PDP — uses sections/main-product
│   ├── collection.liquid          Collection page
│   ├── cart.liquid                Full cart page (drawer is global)
│   ├── page.liquid                CMS pages (story, process, etc.)
│   ├── blog.liquid                Blog index
│   ├── article.liquid             Single article
│   └── 404.liquid                 Not found
├── sections/
│   ├── header.liquid              Sticky nav, mix-blend chrome
│   ├── hero.liquid                Animated hero + marquee
│   ├── collection-grid.liquid     2-up product grid
│   ├── story.liquid               Wine-red brand story
│   ├── process.liquid             4-step process w/ block-driven steps
│   ├── featured-product.liquid    Editorial spotlight
│   ├── journal.liquid             3-up journal grid (blog-driven or fallback)
│   ├── newsletter.liquid          Email capture (uses {% form 'customer' %})
│   ├── footer.liquid              Dark footer w/ menu blocks
│   └── main-product.liquid        PDP body
├── snippets/
│   ├── product-card.liquid        Product card w/ AJAX add form
│   ├── product-card-placeholder.liquid  Used when no collection picked yet
│   ├── bottle-svg.liquid          SVG bottle placeholders (rose | gin)
│   ├── cart-drawer.liquid         Slide-in cart drawer
│   ├── mobile-menu.liquid         Full-screen mobile nav
│   └── meta-tags.liquid           OG / Twitter
├── assets/
│   ├── theme.css                  All styles
│   └── theme.js                   Cart AJAX + drawer + reveals + parallax
├── config/
│   ├── settings_schema.json       Global theme settings
│   └── settings_data.json
└── locales/
    └── en.default.json
```

## Install

### Option A — Upload as a `.zip` (fastest)

1. Zip the `theme/` folder so the archive contains `layout/`, `templates/`,
   etc. at the root (no extra wrapper directory).
2. In Shopify admin → **Online Store → Themes**, click
   **Add theme → Upload zip file**.
3. Once uploaded, click **Customize** to open the Theme Editor.
4. Click **Publish** when ready.

### Option B — Shopify CLI (recommended for editing)

```bash
npm i -g @shopify/cli @shopify/theme
cd theme
shopify theme dev --store your-store.myshopify.com
```

This gives you a live preview URL and hot reload as you edit Liquid.

## First-time setup

After installing, in the Theme Editor:

1. **Header** — pick your logo image (or leave the wordmark).
2. **Hero** — drop a vineyard background image; tweak headline + CTA.
3. **Collection grid** — pick the Shopify collection that holds your
   rosé + gin. Until you do, two SVG placeholder cards render.
4. **Story** — drop your vineyard photo; edit founder names.
5. **Process** — four blocks pre-filled, fully editable in the block panel.
6. **Featured product** — pick your hero product (Cuvée N°7).
7. **Journal** — point at your blog (default handle `news`).
8. **Newsletter** — wired to Shopify's customer form; submissions
   land in Customers → tagged `newsletter`.
9. **Footer** — set tagline + each column's menu in Navigation.

### Recommended product tags

The product card reads a few tags to style itself:

- `rose` or `wine`  → blush-pink card gradient
- `gin`             → cream / olive card gradient
- `spec:75cl`, `spec:12.5% abv`, `spec:Grenache` → render as spec chips

## Cart behaviour

`assets/theme.js` uses Shopify's official AJAX Cart API
(`/cart/add.js`, `/cart/change.js`, `/cart.js`). No extra apps needed.

- Any `<form action="/cart/add">` on the page is intercepted, posted via
  fetch, and the drawer opens with the updated line.
- `[data-open-cart]` opens the drawer; `[data-close-cart]` closes it.
- Quantity buttons inside the drawer hit `/cart/change.js`.
- A full `/cart` page is also provided for non-JS fallback.

## Type & color

Fonts are loaded from Google Fonts in `layout/theme.liquid`.
If you self-host fonts later, replace the `<link>` and update the
`--serif` / `--sans` / `--mono` variables at the top of
`assets/theme.css`.

Palette tokens (in `theme.css`):

```
--bone:   #f5efe6   page background
--wine:   #5c1a1a   primary brand
--ink:    #1a1411   text + CTAs
--blush:  #e8c7b8   accent
```

## Accessibility

- Skip-to-content link present.
- All interactive controls are real `<button>` / `<a>` elements.
- Focus states use the browser default — extend in CSS if needed.
- `prefers-reduced-motion`: not yet wired; add a `@media (prefers-reduced-motion: reduce)` block to disable `heroPan`, `spin`, and `float` if required.

## License

Use freely on your own store. The bottle artwork is placeholder SVG —
swap in real product photography before going live.
