/* Sync PDP variant buttons with Shopify (prices + variant GIDs). */
(function () {
  'use strict';

  function euro(cents) {
    return '€' + (cents / 100).toFixed(2).replace('.', ',');
  }

  function perLiter(cents, size) {
    const cl = parseInt(String(size).replace(/cl$/i, ''), 10);
    if (!cl) return '';
    const per = (cents / 100) / (cl / 100);
    return '€' + per.toFixed(2).replace('.', ',') + ' / L';
  }

  function applyVariant(btn, variant, size) {
    const cents = window.VictoryShopify.centsFromAmount(variant.price.amount);
    btn.dataset.variant = variant.id;
    btn.dataset.cents = String(cents);
    btn.dataset.size = size || (variant.title === 'Default Title' ? '50cl' : `${variant.title}cl`);
    btn.disabled = !variant.availableForSale;

    const amt = btn.querySelector('.amt');
    const per = btn.querySelector('.per');
    if (amt) amt.textContent = euro(cents);
    if (per && size) per.textContent = perLiter(cents, btn.dataset.size);
  }

  async function initPdpShopify() {
    const handle = document.body.dataset.shopifyHandle;
    if (!handle || !window.VictoryShopify) return null;

    const product = await window.VictoryShopify.fetchProductByHandle(handle);
    const buttons = document.querySelectorAll('.pdp-var');

    if (buttons.length) {
      buttons.forEach((btn) => {
        const variant = window.VictoryShopify.findVariantBySize(product, btn.dataset.size);
        if (variant) applyVariant(btn, variant, btn.dataset.size);
        else btn.disabled = true;
      });
    } else {
      // Single-variant product (e.g. Gin)
      window.__pdpDefaultVariant = window.VictoryShopify.defaultVariant(product);
    }

    const active = document.querySelector('.pdp-var.active:not([disabled])')
      || document.querySelector('.pdp-var:not([disabled])');
    if (active) active.click();

    return product;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.dataset.shopifyHandle) return;
    initPdpShopify().catch((e) => console.error('[PDP Shopify]', e));
  });

  window.initPdpShopify = initPdpShopify;
})();
