/* =========================================================
   VICTORY. — Shopify Storefront (Buy SDK, no Buy Button UI)
   Uses the same credentials as the Shopify Buy Button embed.
   ========================================================= */

(function (global) {
  'use strict';

  const SDK_URL = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
  const CHECKOUT_KEY = 'victory-shopify-checkout-id';

  const config = {
    domain: 'e0xbf0-wi.myshopify.com',
    storefrontAccessToken: '1a6aa4de07dfe43c9e7af609c069d41d',
  };

  let client = null;
  let ready = null;
  const productCache = new Map();

  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (global.ShopifyBuy) return resolve();
      const script = document.createElement('script');
      script.async = true;
      script.src = SDK_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Shopify SDK failed to load'));
      (document.head || document.body).appendChild(script);
    });
  }

  function initClient() {
    client = global.ShopifyBuy.buildClient(config);
    return client;
  }

  async function fetchProduct(productId) {
    const key = String(productId);
    if (productCache.has(key)) return productCache.get(key);
    const product = await client.product.fetch(key);
    productCache.set(key, product);
    return product;
  }

  function defaultVariant(product) {
    return product.variants.find((v) => v.available) || product.variants[0];
  }

  async function getOrCreateCheckout() {
    const storedId = localStorage.getItem(CHECKOUT_KEY);
    if (storedId) {
      try {
        return await client.checkout.fetch(storedId);
      } catch (e) {
        localStorage.removeItem(CHECKOUT_KEY);
      }
    }
    const checkout = await client.checkout.create();
    localStorage.setItem(CHECKOUT_KEY, checkout.id);
    return checkout;
  }

  function money(amount) {
    const n = parseFloat(amount);
    if (Number.isNaN(n)) return '€0';
    return '€' + (Number.isInteger(n) ? n : n.toFixed(2).replace(/\.00$/, ''));
  }

  async function addLineItem(productId, quantity) {
    const product = await fetchProduct(productId);
    const variant = defaultVariant(product);
    if (!variant) throw new Error('Product unavailable');

    let checkout = await getOrCreateCheckout();
    const existing = checkout.lineItems.find((li) => li.variant && li.variant.id === variant.id);

    if (existing) {
      checkout = await client.checkout.updateLineItems(checkout.id, [{
        id: existing.id,
        quantity: existing.quantity + (quantity || 1),
      }]);
    } else {
      checkout = await client.checkout.addLineItems(checkout.id, [{
        variantId: variant.id,
        quantity: quantity || 1,
      }]);
    }

    localStorage.setItem(CHECKOUT_KEY, checkout.id);
    return { checkout, product, variant };
  }

  async function fetchCheckout() {
    const id = localStorage.getItem(CHECKOUT_KEY);
    if (!id) return null;
    try {
      return await client.checkout.fetch(id);
    } catch (e) {
      localStorage.removeItem(CHECKOUT_KEY);
      return null;
    }
  }

  async function changeLineQuantity(lineItemId, quantity) {
    const checkout = await fetchCheckout();
    if (!checkout) return null;

    if (quantity <= 0) {
      return client.checkout.removeLineItems(checkout.id, [lineItemId]);
    }
    return client.checkout.updateLineItems(checkout.id, [{ id: lineItemId, quantity }]);
  }

  async function getCartSummary() {
    const checkout = await fetchCheckout();
    if (!checkout || !checkout.lineItems.length) {
      return { count: 0, lines: [], total: 0, checkout: null };
    }

    const lines = checkout.lineItems.map((line) => ({
      id: line.id,
      title: line.title,
      variantTitle: line.variant && line.variant.title !== 'Default Title' ? line.variant.title : '',
      quantity: line.quantity,
      image: line.variant && line.variant.image ? line.variant.image.src : '',
      unitPrice: line.variant && line.variant.price ? line.variant.price.amount : 0,
      linePrice: line.linePrice ? line.linePrice.amount : 0,
    }));

    const count = lines.reduce((s, l) => s + l.quantity, 0);
    const total = checkout.subtotalPrice
      ? parseFloat(checkout.subtotalPrice.amount)
      : parseFloat(checkout.totalPrice.amount);

    return { count, lines, total, checkout };
  }

  ready = loadSdk().then(initClient);

  global.VictoryShopify = {
    config,
    init: () => ready,
    money,
    addLineItem,
    fetchCheckout,
    changeLineQuantity,
    getCartSummary,
    async redirectToCheckout() {
      await ready;
      const checkout = await fetchCheckout();
      if (checkout && checkout.webUrl) {
        window.location.href = checkout.webUrl;
        return;
      }
      throw new Error('Cart is empty');
    },
  };
})(window);
