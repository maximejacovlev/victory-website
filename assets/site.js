/* =========================================================
   VICTORY. — Shared cart / nav / drawer logic
   ========================================================= */

const PRODUCTS = {
  'victory-rose': {
    title: 'Victory Rosé',
    sub:   'St. Tropez',
    price: 1790,
    variant: '40123456789',
    image: 'assets/rose-1.png',
    href: 'products/rose.html'
  },
  'victory-gin': {
    title: 'Victory Gin',
    sub:   'London Dry',
    price: 2990,
    variant: '40123456790',
    image: 'assets/gin-1.png',
    href: 'products/gin.html'
  },
  'victory-rouge': {
    title: 'Victory Rouge',
    sub:   'St. Tropez',
    price: 2990,
    variant: '40123456791',
    image: 'assets/rouge-1.png',
    href: 'products/rouge.html'
  },
  'victory-blanc': {
    title: 'Victory Blanc',
    sub:   'Sancerre',
    price: 2990,
    variant: '40123456792',
    image: 'assets/blanc-1.png',
    href: 'products/blanc.html'
  }
};

// allow product pages (subfolder) to fix asset paths
function rebasePaths(prefix){
  Object.values(PRODUCTS).forEach(p => {
    if(!p.image.startsWith(prefix)) p.image = prefix + p.image;
    if(!p.href.startsWith(prefix))  p.href  = prefix + p.href;
  });
}

const cart = JSON.parse(localStorage.getItem('victory-cart') || '[]');
function persistCart(){ localStorage.setItem('victory-cart', JSON.stringify(cart)); }

async function addToShopifyCart(variantId, qty){
  // Replace with: fetch('/cart/add.js', {...})
  console.log('[Shopify-stub] POST /cart/add.js', {id: variantId, quantity: qty});
  return { ok:true };
}

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

function fmt(cents){ return '€' + (cents/100).toFixed(2).replace('.', ','); }

// A cart line is {id, qty, size, price}. `size` + `price` are optional and
// only set when a product page picked a non-default format.
function lineKey(l){ return l.id + '::' + (l.size || ''); }
function linePrice(l){ return l.price != null ? l.price : (PRODUCTS[l.id]?.price || 0); }
function lineSub(l){
  const p = PRODUCTS[l.id];
  return l.size ? (p ? p.sub + ' · ' + l.size : l.size) : (p ? p.sub : '');
}

function renderCart(){
  const body = $('#drawerBody');
  const foot = $('#drawerFoot');
  const count = cart.reduce((s,l)=>s+l.qty,0);
  const cc = $('#cartCount'); if(cc) cc.textContent = count;
  if(!body) return;

  if(!cart.length){
    body.innerHTML = `<div class="cart-empty"><p>Empty for now.</p><small>Add a bottle and it will rest here.</small></div>`;
    if (window.translateNode && window.__lang) translateNode(body, window.__lang);
    if(foot) foot.style.display = 'none';
    return;
  }
  if(foot) foot.style.display = '';
  body.innerHTML = cart.map(line => {
    const p = PRODUCTS[line.id]; if(!p) return '';
    return `
      <div class="cart-item">
        <div class="thumb"><img src="${p.image}" alt=""></div>
        <div>
          <div class="name">${p.title}</div>
          <div class="meta">${lineSub(line)}</div>
          <div class="qty">
            <button onclick="changeQty('${lineKey(line)}', -1)" aria-label="Decrease">−</button>
            <span>${line.qty}</span>
            <button onclick="changeQty('${lineKey(line)}', 1)" aria-label="Increase">+</button>
          </div>
        </div>
        <div class="price">${fmt(linePrice(line) * line.qty)}</div>
      </div>
    `;
  }).join('');

  const total = cart.reduce((s,l)=> s + linePrice(l) * l.qty, 0);
  const ct = $('#cartTotal'); if(ct) ct.textContent = fmt(total);
  if (window.translateNode && window.__lang) translateNode(body, window.__lang);
}

function changeQty(key, delta){
  const line = cart.find(l => lineKey(l) === key);
  if(!line) return;
  line.qty += delta;
  if(line.qty <= 0) cart.splice(cart.indexOf(line), 1);
  persistCart();
  renderCart();
}

async function addToCart(id, qty=1, opts={}){
  const p = PRODUCTS[id];
  if(!p) return;
  const size  = opts.size || null;
  const price = opts.price != null ? opts.price : p.price;
  const key   = id + '::' + (size || '');
  const line  = cart.find(l => lineKey(l) === key);
  if(line) line.qty += qty; else cart.push({id, qty, size, price});
  await addToShopifyCart(opts.variant || p.variant, qty);
  persistCart();
  renderCart();
  openDrawer();
  toast(`${p.title} — added`);
}

function openDrawer(){ $('#drawer')?.classList.add('show'); $('#scrim')?.classList.add('show'); }
function closeDrawer(){ $('#drawer')?.classList.remove('show'); $('#scrim')?.classList.remove('show'); }
function openMenu(){ $('#menuOverlay')?.classList.add('show'); }
function closeMenu(){ $('#menuOverlay')?.classList.remove('show'); }

let toastT;
function toast(msg){
  const el = $('#toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(()=>el.classList.remove('show'), 2200);
}

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

  // reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, {threshold: .12, rootMargin: '0px 0px -8% 0px'});
  $$('.reveal').forEach(el => io.observe(el));

  renderCart();
}

document.addEventListener('DOMContentLoaded', wireUi);
