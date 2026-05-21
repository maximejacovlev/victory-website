/* =========================================================
   VICTORY. — Shopify Storefront Cart API (headless, no embed UI)
   Replaces deprecated JS Buy SDK checkout API.
   ========================================================= */

(function (global) {
  'use strict';

  const CART_KEY = 'victory-shopify-cart-id';
  const LEGACY_CHECKOUT_KEY = 'victory-shopify-checkout-id';
  const API_VERSION = '2024-01';

  const config = {
    domain: 'e0xbf0-wi.myshopify.com',
    storefrontAccessToken: '1a6aa4de07dfe43c9e7af609c069d41d',
  };

  const endpoint = `https://${config.domain}/api/${API_VERSION}/graphql.json`;
  const productCache = new Map();

  // Drop stale checkout IDs from the old Buy SDK integration
  try { localStorage.removeItem(LEGACY_CHECKOUT_KEY); } catch (e) { /* ignore */ }

  async function storefront(query, variables) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': config.storefrontAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(`Shopify request failed (${res.status})`);
    }

    const json = await res.json();
    if (json.errors && json.errors.length) {
      throw new Error(json.errors[0].message || 'Shopify error');
    }
    return json.data;
  }

  function productGid(numericId) {
    return `gid://shopify/Product/${numericId}`;
  }

  function money(amount) {
    const n = parseFloat(amount);
    if (Number.isNaN(n)) return '€0';
    return '€' + (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, ''));
  }

  function pickUserError(userErrors) {
    if (userErrors && userErrors.length) {
      throw new Error(userErrors[0].message || 'Cart update failed');
    }
  }

  async function fetchProduct(productId) {
    const key = String(productId);
    if (productCache.has(key)) return productCache.get(key);

    const data = await storefront(
      `query Product($id: ID!) {
        product(id: $id) {
          title
          variants(first: 10) {
            edges {
              node {
                id
                title
                availableForSale
                price { amount currencyCode }
                image { url altText }
              }
            }
          }
        }
      }`,
      { id: productGid(key) }
    );

    if (!data.product) throw new Error('Product not found');
    const product = {
      title: data.product.title,
      variants: data.product.variants.edges.map((e) => e.node),
    };
    productCache.set(key, product);
    return product;
  }

  function defaultVariant(product) {
    return product.variants.find((v) => v.availableForSale) || product.variants[0];
  }

  const CART_FIELDS = `
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 50) {
      edges {
        node {
          id
          quantity
          cost { totalAmount { amount } }
          merchandise {
            ... on ProductVariant {
              id
              title
              price { amount }
              image { url }
              product { title }
            }
          }
        }
      }
    }
  `;

  function normalizeCart(cart) {
    if (!cart) return null;
    return cart;
  }

  async function fetchCartById(cartId) {
    const data = await storefront(
      `query Cart($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`,
      { id: cartId }
    );
    return normalizeCart(data.cart);
  }

  async function getOrCreateCart() {
    const storedId = localStorage.getItem(CART_KEY);
    if (storedId) {
      try {
        const cart = await fetchCartById(storedId);
        if (cart) return cart;
      } catch (e) {
        localStorage.removeItem(CART_KEY);
      }
    }

    const data = await storefront(
      `mutation { cartCreate { cart { ${CART_FIELDS} } userErrors { message } } }`
    );
    pickUserError(data.cartCreate.userErrors);
    const cart = data.cartCreate.cart;
    localStorage.setItem(CART_KEY, cart.id);
    return cart;
  }

  function cartLines(cart) {
    return (cart.lines && cart.lines.edges) ? cart.lines.edges.map((e) => e.node) : [];
  }

  async function addLineItem(productId, quantity) {
    const product = await fetchProduct(productId);
    const variant = defaultVariant(product);
    if (!variant) throw new Error('Product unavailable');
    if (!variant.availableForSale) throw new Error('Product sold out');

    const qty = quantity || 1;
    let cart = await getOrCreateCart();
    const existing = cartLines(cart).find(
      (line) => line.merchandise && line.merchandise.id === variant.id
    );

    if (existing) {
      const data = await storefront(
        `mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
          cartLinesUpdate(cartId: $cartId, lines: $lines) {
            cart { ${CART_FIELDS} }
            userErrors { message }
          }
        }`,
        {
          cartId: cart.id,
          lines: [{ id: existing.id, quantity: existing.quantity + qty }],
        }
      );
      pickUserError(data.cartLinesUpdate.userErrors);
      cart = data.cartLinesUpdate.cart;
    } else {
      const data = await storefront(
        `mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart { ${CART_FIELDS} }
            userErrors { message }
          }
        }`,
        {
          cartId: cart.id,
          lines: [{ merchandiseId: variant.id, quantity: qty }],
        }
      );
      pickUserError(data.cartLinesAdd.userErrors);
      cart = data.cartLinesAdd.cart;
    }

    localStorage.setItem(CART_KEY, cart.id);
    return { cart, product, variant };
  }

  async function fetchCart() {
    const id = localStorage.getItem(CART_KEY);
    if (!id) return null;
    try {
      const cart = await fetchCartById(id);
      if (!cart) localStorage.removeItem(CART_KEY);
      return cart;
    } catch (e) {
      localStorage.removeItem(CART_KEY);
      return null;
    }
  }

  async function changeLineQuantity(lineItemId, quantity) {
    const cart = await fetchCart();
    if (!cart) return null;

    if (quantity <= 0) {
      const data = await storefront(
        `mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
          cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
            cart { ${CART_FIELDS} }
            userErrors { message }
          }
        }`,
        { cartId: cart.id, lineIds: [lineItemId] }
      );
      pickUserError(data.cartLinesRemove.userErrors);
      return data.cartLinesRemove.cart;
    }

    const data = await storefront(
      `mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart { ${CART_FIELDS} }
          userErrors { message }
        }
      }`,
      { cartId: cart.id, lines: [{ id: lineItemId, quantity }] }
    );
    pickUserError(data.cartLinesUpdate.userErrors);
    return data.cartLinesUpdate.cart;
  }

  async function getCartSummary() {
    const cart = await fetchCart();
    if (!cart || !cart.totalQuantity) {
      return { count: 0, lines: [], total: 0, checkoutUrl: null, cart: null };
    }

    const lines = cartLines(cart).map((line) => {
      const m = line.merchandise || {};
      return {
        id: line.id,
        title: (m.product && m.product.title) || 'Item',
        variantTitle: m.title && m.title !== 'Default Title' ? m.title : '',
        quantity: line.quantity,
        image: m.image ? m.image.url : '',
        unitPrice: m.price ? m.price.amount : 0,
        linePrice: line.cost && line.cost.totalAmount ? line.cost.totalAmount.amount : 0,
      };
    });

    const total = cart.cost && cart.cost.subtotalAmount
      ? parseFloat(cart.cost.subtotalAmount.amount)
      : 0;

    return {
      count: cart.totalQuantity,
      lines,
      total,
      checkoutUrl: cart.checkoutUrl,
      cart,
    };
  }

  global.VictoryShopify = {
    config,
    init: () => Promise.resolve(),
    money,
    addLineItem,
    fetchCart,
    changeLineQuantity,
    getCartSummary,
    async redirectToCheckout() {
      const summary = await getCartSummary();
      if (summary.checkoutUrl) {
        window.location.href = summary.checkoutUrl;
        return;
      }
      throw new Error('Cart is empty');
    },
  };
})(window);
