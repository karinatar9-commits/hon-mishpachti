const Q = new URLSearchParams(location.search);
const cv = document.getElementById('c'), g = cv.getContext('2d');
const HE = 'אבגדהוזחטיכלמנסעפצקרשתךםןףץ₪0123456789,.?!:';
await Promise.all([500, 700, 900].map(w => document.fonts.load(`${w} 40px FRL`, HE)));
const film = await import('./film.js');
window.DUR = film.DUR; window.EV = film.events(); window.TEXTS = film.texts;
window.render = t => { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; film.render(g, t, Q); };
window.READY = true;
