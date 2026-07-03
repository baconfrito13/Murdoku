// Tiny DOM helpers.

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

let toastTimer = null;
export function toast(msg, kind = '') {
  const t = qs('#toast');
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2800);
}

export function announce(msg) {
  qs('#sr-live').textContent = msg;
}

export function openDialog(dlg) {
  if (!dlg.open) dlg.showModal();
}

export function wireDialogClose() {
  qsa('dialog').forEach((dlg) => {
    qsa('[data-close]', dlg).forEach((btn) => btn.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('click', (e) => {
      // click on backdrop closes
      if (e.target === dlg) {
        const r = dlg.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right
          && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) dlg.close();
      }
    });
  });
}

export function confettiBurst(count = 120) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = qs('#confetti');
  host.innerHTML = '';
  const colors = ['#e8b34b', '#e05252', '#58b368', '#7cc4ff', '#ec4899', '#f97316'];
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.style.left = `${Math.random() * 100}vw`;
    s.style.background = colors[i % colors.length];
    s.style.animationDuration = `${2.2 + Math.random() * 2}s`;
    s.style.animationDelay = `${Math.random() * .8}s`;
    s.style.transform = `rotate(${Math.random() * 360}deg)`;
    host.append(s);
  }
  setTimeout(() => { host.innerHTML = ''; }, 5200);
}
