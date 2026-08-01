/* =========================================================
   VICTORY. — Shared cart / nav / drawer logic
   ========================================================= */

const PRODUCTS = {
  'victory-rose': {
    title: 'Victory Rosé',
    sub:   'St. Tropez',
    price: 1790,
    shopifyHandle: 'rose',
    image: 'assets/rose-1.png',
    href: 'products/rose.html'
  },
  'victory-gin': {
    title: 'Victory Gin',
    sub:   'London Dry',
    price: 2990,
    shopifyHandle: 'gin',
    image: 'assets/gin-1.png',
    href: 'products/gin.html'
  },
  'victory-rouge': {
    title: 'Victory Rouge',
    sub:   'St. Tropez',
    price: 2990,
    shopifyHandle: 'rouge',
    image: 'assets/rouge-1.png',
    href: 'products/rouge.html'
  },
  'victory-blanc': {
    title: 'Victory Blanc',
    sub:   'Sancerre',
    price: 2990,
    shopifyHandle: 'blanc',
    image: 'assets/blanc-1.png',
    href: 'products/blanc.html'
  }
};

function rebasePaths(prefix){
  Object.values(PRODUCTS).forEach(p => {
    if(!p.image.startsWith(prefix)) p.image = prefix + p.image;
    if(!p.href.startsWith(prefix))  p.href  = prefix + p.href;
  });
}

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

function fmt(cents){ return '€' + (cents/100).toFixed(2).replace('.', ','); }

function shopifyReady(){
  return typeof VictoryShopify !== 'undefined';
}

async function renderCart(){
  const body = $('#drawerBody');
  const foot = $('#drawerFoot');
  if(!body) return;

  if (!shopifyReady()) {
    const cc = $('#cartCount'); if(cc) cc.textContent = '0';
    body.innerHTML = `<div class="cart-empty"><p>Empty for now.</p><small>Add a bottle and it will rest here.</small></div>`;
    if (window.translateNode && window.__lang) translateNode(body, window.__lang);
    if(foot) foot.style.display = 'none';
    return;
  }

  try {
    const summary = await VictoryShopify.getCartSummary();
    const cc = $('#cartCount'); if(cc) cc.textContent = summary.count;

    if(!summary.lines.length){
      body.innerHTML = `<div class="cart-empty"><p>Empty for now.</p><small>Add a bottle and it will rest here.</small></div>`;
      if (window.translateNode && window.__lang) translateNode(body, window.__lang);
      if(foot) foot.style.display = 'none';
      return;
    }

    if(foot) foot.style.display = '';
    body.innerHTML = summary.lines.map(line => {
      const meta = line.variantTitle || '';
      const img = line.image || '';
      const unitCents = Math.round(parseFloat(line.unitPrice) * 100);
      return `
        <div class="cart-item">
          <div class="thumb"><img src="${img}" alt=""></div>
          <div>
            <div class="name">${line.title}</div>
            <div class="meta">${meta}</div>
            <div class="qty">
              <button onclick="changeShopifyQty('${line.id}', ${line.quantity - 1})" aria-label="Decrease">−</button>
              <span>${line.quantity}</span>
              <button onclick="changeShopifyQty('${line.id}', ${line.quantity + 1})" aria-label="Increase">+</button>
            </div>
          </div>
          <div class="price">${fmt(unitCents * line.quantity)}</div>
        </div>
      `;
    }).join('');

    const ct = $('#cartTotal');
    if(ct) ct.textContent = VictoryShopify.money(summary.total);
    if (window.translateNode && window.__lang) translateNode(body, window.__lang);
  } catch (e) {
    console.error('[Cart]', e);
  }
}

async function changeShopifyQty(lineItemId, quantity){
  if (!shopifyReady()) return;
  try {
    await VictoryShopify.changeLineQuantity(lineItemId, quantity);
    await renderCart();
  } catch (e) {
    toast('Couldn\'t update cart');
    console.error(e);
  }
}
window.changeShopifyQty = changeShopifyQty;

async function addToCart(id, qty=1, opts={}){
  const p = PRODUCTS[id];
  if(!p) return;

  if (!shopifyReady()) {
    toast('Shop unavailable');
    return;
  }

  try {
    const handle = p.shopifyHandle;
    const size = opts.size || null;
    const { variant } = await VictoryShopify.addLineItemByHandle(handle, size, qty);
    await renderCart();
    openDrawer();
    const sizeLabel = variant.title && variant.title !== 'Default Title'
      ? ` · ${variant.title} cl`
      : '';
    toast(`${p.title}${sizeLabel} — ${typeof t === 'function' ? t('added') : 'added'}`);
  } catch (e) {
    toast(e.message || 'Couldn\'t add to cart');
    console.error('[addToCart]', e);
  }
}

function openDrawer(){ $('#drawer')?.classList.add('show'); $('#scrim')?.classList.add('show'); }
function closeDrawer(){ $('#drawer')?.classList.remove('show'); $('#scrim')?.classList.remove('show'); }
function openMenu(){ $('#menuOverlay')?.classList.add('show'); }
function closeMenu(){ $('#menuOverlay')?.classList.remove('show'); }

let toastT;
function toast(msg){
  const el = $('#toast');
  if(!el) return;
  el.textContent = typeof t === 'function' ? t(msg) : msg;
  if (typeof t === 'function' && t(msg) === msg && msg.includes(' — ')) {
    // already composed
  }
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(()=>el.classList.remove('show'), 2200);
}

async function goToCheckout(){
  if (!shopifyReady()) {
    toast('Shop unavailable — reload via http://localhost:3000');
    return;
  }
  const btn = $('#checkoutBtn');
  if (btn) btn.disabled = true;
  try {
    const summary = await VictoryShopify.getCartSummary();
    if (!summary.count || !summary.checkoutUrl) {
      toast('Cart is empty — add a bottle first');
      return;
    }
    window.location.assign(summary.checkoutUrl);
  } catch (e) {
    toast(e.message || 'Checkout unavailable');
    console.error('[checkout]', e);
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.goToCheckout = goToCheckout;

function wireUi(){
  $('#cartBtn')?.addEventListener('click', openDrawer);
  $('#drawerClose')?.addEventListener('click', closeDrawer);
  $('#scrim')?.addEventListener('click', closeDrawer);
  $('#menuBtn')?.addEventListener('click', openMenu);
  $('#menuClose')?.addEventListener('click', closeMenu);
  $$('#menuOverlay a').forEach(a => a.addEventListener('click', closeMenu));
  $$('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.add, parseInt(btn.dataset.qty || '1', 10)));
  });
  $('#checkoutBtn')?.addEventListener('click', goToCheckout);

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, {threshold: .12, rootMargin: '0px 0px -8% 0px'});
  $$('.reveal').forEach(el => io.observe(el));

  renderCart();
}

document.addEventListener('DOMContentLoaded', wireUi);
document.addEventListener('langchange', () => {
  renderCart();
});
