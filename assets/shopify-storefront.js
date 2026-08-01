/* =========================================================
   VICTORY. — Shopify Storefront Cart API (headless)
   Products fetched by handle — no hardcoded variant IDs.
   ========================================================= */

(function (global) {
  'use strict';

  const CART_KEY = 'victory-shopify-cart-id';
  const API_VERSION = '2024-01';

  const config = {
    domain: 'e0xbf0-wi.myshopify.com',
    storefrontAccessToken: '1a6aa4de07dfe43c9e7af609c069d41d',
  };

  const endpoint = `https://${config.domain}/api/${API_VERSION}/graphql.json`;
  const productCache = new Map();

  async function storefront(query, variables) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': config.storefrontAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) throw new Error(`Shopify request failed (${res.status})`);

    const json = await res.json();
    if (json.errors && json.errors.length) {
      throw new Error(json.errors[0].message || 'Shopify error');
    }
    return json.data;
  }

  function money(amount) {
    const n = parseFloat(amount);
    if (Number.isNaN(n)) return '€0';
    const euros = n.toFixed(2).replace('.', ',');
    return '€' + euros.replace(/,00$/, '');
  }

  function centsFromAmount(amount) {
    return Math.round(parseFloat(amount) * 100);
  }

  function pickUserError(userErrors) {
    if (userErrors && userErrors.length) {
      throw new Error(userErrors[0].message || 'Cart update failed');
    }
  }

  function sizeToVariantTitle(size) {
    return String(size || '').replace(/cl$/i, '').trim();
  }

  function normalizeProduct(node) {
    if (!node) return null;
    return {
      id: node.id,
      title: node.title,
      handle: node.handle,
      variants: node.variants.edges.map((e) => ({
        id: e.node.id,
        title: e.node.title,
        availableForSale: e.node.availableForSale,
        price: e.node.price,
        compareAtPrice: e.node.compareAtPrice,
        selectedOptions: e.node.selectedOptions,
        image: e.node.image,
      })),
    };
  }

  async function fetchProductByHandle(handle) {
    const key = String(handle);
    if (productCache.has(key)) return productCache.get(key);

    const data = await storefront(
      `query ProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          handle
          variants(first: 20) {
            edges {
              node {
                id
                title
                availableForSale
                price { amount currencyCode }
                compareAtPrice { amount currencyCode }
                selectedOptions { name value }
                image { url altText }
              }
            }
          }
        }
      }`,
      { handle: key }
    );

    if (!data.productByHandle) throw new Error('Product not found');
    const product = normalizeProduct(data.productByHandle);
    productCache.set(key, product);
    return product;
  }

  function findVariantBySize(product, size) {
    if (!product || !product.variants.length) return null;
    const key = sizeToVariantTitle(size);
    if (key) {
      const match = product.variants.find((v) => v.title === key);
      if (match) return match;
    }
    const single = product.variants.find((v) => v.title === 'Default Title');
    if (single) return single;
    if (product.variants.length === 1) return product.variants[0];
    return product.variants.find((v) => v.availableForSale) || product.variants[0];
  }

  function defaultVariant(product) {
    return findVariantBySize(product, '75cl') || findVariantBySize(product, null);
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
              product { title handle }
            }
          }
        }
      }
    }
  `;

  async function fetchCartById(cartId) {
    const data = await storefront(
      `query Cart($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`,
      { id: cartId }
    );
    return data.cart || null;
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
    return (cart.lines && cart.lines.edges)
      ? cart.lines.edges.map((e) => e.node)
      : [];
  }

  async function addLineItem(variantId, quantity) {
    if (!variantId) throw new Error('Variant unavailable');

    const qty = quantity || 1;
    let cart = await getOrCreateCart();
    const existing = cartLines(cart).find(
      (line) => line.merchandise && line.merchandise.id === variantId
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
          lines: [{ merchandiseId: variantId, quantity: qty }],
        }
      );
      pickUserError(data.cartLinesAdd.userErrors);
      cart = data.cartLinesAdd.cart;
    }

    localStorage.setItem(CART_KEY, cart.id);
    return cart;
  }

  async function addLineItemByHandle(handle, size, quantity) {
    const product = await fetchProductByHandle(handle);
    const variant = size ? findVariantBySize(product, size) : defaultVariant(product);
    if (!variant) throw new Error('Product unavailable');
    if (!variant.availableForSale) throw new Error('Product sold out');
    const cart = await addLineItem(variant.id, quantity);
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
      const sizeLabel = m.title && m.title !== 'Default Title' ? `${m.title}cl` : '';
      return {
        id: line.id,
        title: (m.product && m.product.title) || 'Item',
        variantTitle: m.title && m.title !== 'Default Title' ? `${m.title} cl` : '',
        sizeLabel,
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
    centsFromAmount,
    sizeToVariantTitle,
    fetchProductByHandle,
    findVariantBySize,
    defaultVariant,
    addLineItem,
    addLineItemByHandle,
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
