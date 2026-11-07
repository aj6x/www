// The VHF+ S2S page: a search, a list of regions and one summit at a time on one band or any, from the small files in this folder.
(async () => {
  const GROUPS = [['duck', 'Rubber duckies, FM', '#fff6cc', 5], ['easy', 'Half-waves, FM', '#ffcf70', 4.5], ['yagi', 'Yagis, CW', '#f39a3c', 4],
                  ['long', 'Long shots, yagis, CW, half of the time', '#c9582a', 3.5], ['far', 'Very long shots, yagis, CW, a tenth of the time', '#8a2f10', 3]];      // as on the summit pages
  const LETTER = 'deylf';      // a summit's file has a letter per link and band: the group, or - for none
  const NAMES = { '2m': '2 m', '6m': '6 m', '1.25m': '1.25 m', '70cm': '70 cm', '23cm': '23 cm', '13cm': '13 cm', '6cm': '6 cm', '3cm': '3 cm',
    '1.2cm': '24 GHz', '6mm': '47 GHz', '4mm': '76 GHz', any: 'any band' };
  const MHZ = { '6m': 52.525, '2m': 146, '1.25m': 223.5, '70cm': 446, '23cm': 1296.2, '13cm': 2304.1, '6cm': 5760.1, '3cm': 10368.1,
    '1.2cm': 24048.1, '6mm': 47088.1, '4mm': 75976.1 };      // as modeled
  const NARROW = new Set(['1.2cm', '6mm', '4mm']);      // beams a degree or two wide: bearings to a tenth of a degree

  const LIGHT = { '6m': '#ff0000', '2m': '#ff8200', '1.25m': '#ffc700', '70cm': '#efff00', '23cm': '#3cff00', '13cm': '#00ffbe',      // the bands red to violet,
    '6cm': '#00e5ff', '3cm': '#00acff', '1.2cm': '#006fff', '6mm': '#1000ff', '4mm': '#7b00ff' };      // evenly spaced in OKLab along the spectrum, 690 to 416 nm
  const COMPASS = 'N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW'.split(' ');
  const TRIANGLE = '<svg viewBox="0 0 28 26" width="28" height="26"><polygon points="14,1 27,25 1,25" fill="#96d1aa" stroke="#000" stroke-width="2"/></svg>';
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  const $ = id => document.getElementById(id);

  function el(tag, props, ...kids) {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids.filter(k => k !== null));
    return e;
  }

  const [index, have, articles] = await Promise.all(['index.json', 'tiles/have.json', 'articles.json'].map(f => fetch(`/s2s/${f}`).then(r => r.json())));
  const summits = index.summits.map(([ref, name, lat, lon, m, act], i) => ({ i, ref, name, lat, lon, m, act }));
  const byRef = new Map(summits.map(s => [s.ref, s]));
  const davidson = byRef.get('W6/NC-423');
  let opening = [davidson.lat, davidson.lon];
  const bands = index.bands ?? ['2m'];
  const setups = index.setups ?? {};
  const ANY = ['The easiest setup of its band', 'The middle setup', 'The best setup', 'Long shots, the best setup, half of the time', 'Very long shots, the best setup, a tenth of the time'];
  function labels(b) {      // the groups' names on one band: 6 m to 70 cm as 2 m, from 23 cm up each band its own setups
    const own = setups[b];
    if (b === 'any') return ANY;
    if (!own) return GROUPS.map(g => g[1]);
    const best = own[2].replace(/, (CW|FM)$/, '');
    if (NARROW.has(b)) return [own[0], own[1], own[2], null, null];      // line of sight only: it works all of the time or never
    return [own[0], own[1], own[2], `Long shots, ${best}, half of the time`, `Very long shots, ${best}, a tenth of the time`];
  }
  if (index.listed) $('s2s-listed').textContent = ` on ${index.listed}`;      // the small print under the map: the date of the SOTA list
  const WEATHER = index.weather ?? [];      // the line-of-sight bands again, as '1.2cm dry' and '1.2cm humid', after the bands in a summit's file
  const DAYS = { dry: 'Dry day', average: 'Average', humid: 'Humid day' };
  let band = '2m', current = null, wet = 'average';
  const humid = b => WEATHER.some(w => w.startsWith(`${b} `)) || (b === 'any' && WEATHER.length > 0);      // where the weather switch shows
  const at = b => (b === '2m' ? '' : `@${b}${humid(b) && wet !== 'average' ? `-${wet}` : ''}`);
  const tail = () => at(band);
  const kOf = b => (WEATHER.includes(`${b} ${wet}`) ? bands.length + WEATHER.indexOf(`${b} ${wet}`) : bands.indexOf(b));      // a band's letters on this day
  const link = s => `#${s.ref}${tail()}`;
  const miles = km => Math.round(km / 1.609344);

  function km(a, b) {
    const r = Math.PI / 180, dp = (b.lat - a.lat) * r, dl = (b.lon - a.lon) * r;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dl / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  function bearing(a, b, exact) {
    const r = Math.PI / 180, dl = (b.lon - a.lon) * r;
    const y = Math.sin(dl) * Math.cos(b.lat * r);
    const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos(dl);
    const deg = (Math.atan2(y, x) / r + 360) % 360;
    return exact ? `${deg.toFixed(1)}°` : COMPASS[Math.round(deg / 22.5) % 16];
  }

  // A tile that is all sea does not exist: the map's background is the sea. The lower zooms cover the world, and
  // show through, stretched, around the relief of the upper zooms.
  const tiles = new Set();
  for (const [z, rows] of Object.entries(have.tiles)) {
    for (const [row, cols] of Object.entries(rows)) cols.forEach(col => tiles.add(`${z}/${col}/${row}`));
  }
  const Relief = L.TileLayer.extend({
    getTileUrl(c) {
      const z = this._getZoomForUrl(), key = `${z}/${c.x}/${c.y}`;
      return tiles.has(key) ? `/s2s/tiles/${key}.webp` : BLANK;
    },
  });
  const map = L.map('s2s-map', { preferCanvas: true, minZoom: 1, maxZoom: 10, attributionControl: false,
    maxBounds: [[-85.05, -1e5], [85.05, 1e5]], maxBoundsViscosity: 1 });      // the poles stay at the edges; east and west run on
  const fill = () => map.setMinZoom(Math.max(1, Math.ceil(Math.log2(map.getSize().y / 256))));    // no zooming out past a window's height of world
  map.on('resize', fill);
  fill();
  new Relief('', { maxNativeZoom: have.world, maxZoom: 10, minZoom: 1 }).addTo(map);
  new Relief('', { maxNativeZoom: have.top, maxZoom: 10, minZoom: have.world + 1 }).addTo(map);
  const strip = el('div', { className: 's2s-strip top', textContent: 'VHF+ S2S' });
  new ResizeObserver(() => map.getContainer().style.setProperty('--strip', `${strip.offsetHeight}px`)).observe(strip);      // a long name wraps on a phone; the controls stay below it
  const footer = document.querySelector('footer.site'), license = footer.querySelector('a[rel=license]');
  map.getContainer().append(strip, el('div', { className: 's2s-strip bottom' }, `${footer.textContent.match(/©[^·]*/)[0].trim()} · aj6x.com · `, license.cloneNode(true)));
  const legend = el('ul', { className: 's2skey s2s-legend', id: 's2s-legend', hidden: true });
  const legendButton = el('button', { type: 'button', className: 's2s-legendbutton', textContent: 'Legend' });
  legendButton.setAttribute('aria-controls', legend.id);
  const fold = hide => {
    legend.hidden = hide;
    legendButton.setAttribute('aria-expanded', !hide);
  };
  fold(true);
  legendButton.addEventListener('click', () => fold(!legend.hidden));
  const Legend = L.Control.extend({      // beside the map, not over it for good: it stays open while the map moves, until asked to close
    options: { position: 'topright' },
    onAdd() {
      const box = el('div', { className: 's2s-legendbox' }, legendButton, legend);
      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.disableScrollPropagation(box);
      return box;
    },
  });
  const Full = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const box = L.DomUtil.create('div', 'leaflet-bar');
      const button = L.DomUtil.create('a', 's2s-fullbutton', box);
      button.href = '#';
      button.setAttribute('role', 'button');
      const set = on => {
        map.getContainer().classList.toggle('s2s-full', on);
        document.documentElement.classList.toggle('s2s-locked', on);
        button.title = on ? 'Back to the page' : 'Full screen';
        button.setAttribute('aria-label', button.title);
        map.invalidateSize();
      };
      set(false);
      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.on(button, 'click', e => {
        L.DomEvent.preventDefault(e);
        set(!map.getContainer().classList.contains('s2s-full'));
      });
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (legend.hidden) return set(false);      // one thing at a time: the legend closes first
        fold(true);
        legendButton.focus();
      });
      return box;
    },
  });
  const bandButtons = [...bands, ...(bands.length > 1 ? ['any'] : [])].map(b => {
    const button = el('button', { type: 'button', textContent: NAMES[b] ?? b, title: b === 'any' ? 'The easiest setup on any band' : b === '6m' ? 'On 6 m without sporadic E: line of sight, diffraction, scatter' : `On ${NAMES[b] ?? b}` });
    button.dataset.band = b;
    if (LIGHT[b]) button.style.setProperty('--light', LIGHT[b]);
    button.addEventListener('click', () => { location.hash = `${current ? current.ref : ''}${at(b)}`; });
    return button;
  });
  const dayButtons = Object.entries(DAYS).map(([w, label]) => {
    const button = el('button', { type: 'button', textContent: label, title: { dry: 'A dry winter day: 2 g/m³ of water vapor at sea level', average: 'An average day: 7.5 g/m³', humid: 'A humid summer day: 15 g/m³' }[w] });
    button.dataset.day = w;
    button.addEventListener('click', () => { wet = w; location.hash = `${current ? current.ref : ''}${tail()}`; });
    return button;
  });
  const days = el('div', { className: 's2s-bands s2s-days', role: 'group', ariaLabel: 'Humidity' }, ...dayButtons);
  const Bands = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const box = el('div', { className: 's2s-bands', role: 'group', ariaLabel: 'Band' }, ...bandButtons);
      L.DomEvent.disableClickPropagation(box);
      return box;
    },
  });
  map.addControl(new Full());
  if (bandButtons.length > 1) map.addControl(new Bands());
  const Days = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      L.DomEvent.disableClickPropagation(days);
      return days;
    },
  });
  if (WEATHER.length) map.addControl(new Days());
  map.addControl(new Legend());
  const canvas = L.canvas({ padding: .3, tolerance: 4 });
  const view = L.layerGroup().addTo(map);
  const placed = [];
  const lonNear = lon => lon + 360 * Math.round((map.getCenter().lng - lon) / 360);
  const dot = (s, color, r, weight = 1, more = '') => {
    const marker = L.circleMarker([s.lat, s.lon], { renderer: canvas, bubblingMouseEvents: false, radius: r, color: '#121e26', weight, fillColor: color, fillOpacity: 1, opacity: 1 })
      .bindTooltip(`${s.ref} ${s.name.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`)}${more}`).on('click', () => { location.hash = link(s); });
    placed.push([marker, s]);
    return marker;
  };
  map.on('moveend', () => {      // the map repeats east and west: each summit goes on the copy of the world in view
    for (const [marker, s] of placed) {
      const lon = lonNear(s.lon);
      if (marker.getLatLng().lng !== lon) marker.setLatLng([s.lat, lon]);
    }
  });

  let spot, waiting;
  map.on('click', e => {       // a click off the summits goes there, and back to all of them; not when it starts a double click
    clearTimeout(waiting);
    waiting = setTimeout(() => {
      if (current) {
        spot = e.latlng;
        location.hash = tail();
      } else map.panTo(e.latlng);
    }, 300);
  });
  map.on('dblclick', () => clearTimeout(waiting));

  function chips(letters) {      // one square per band, in its group's color: every band at a glance in a summit's row
    const box = el('span', { className: 's2schips' }, ...bands.map(b => {
      const g = LETTER.indexOf(letters[kOf(b)]);
      return el('span', { className: `chip ${g < 0 ? 'none' : GROUPS[g][0]}`, title: `${NAMES[b] ?? b}: ${g < 0 ? 'out of reach' : labels(b)[g]}` });
    }));
    box.append(el('span', { className: 's2sunit', textContent: bands.map(b => `${NAMES[b] ?? b} ${LETTER.includes(letters[kOf(b)]) ? labels(b)[LETTER.indexOf(letters[kOf(b)])] : 'none'}`).join('; ') }));
    return box;
  }

  function row(s, from, letters) {      // the short fields first, so they line up whatever the length of the name
    const name = el('a', { href: link(s), textContent: `${s.ref} ${s.name}` });
    const number = (n, unit) => el('small', {}, n.toLocaleString(), el('span', { className: 's2sunit', textContent: ` ${unit} ` }));
    if (from) return el('li', { className: `s2srow far${letters && bands.length > 1 ? ' banded' : ''}` }, number(miles(km(from, s)), 'miles'), el('small', { textContent: bearing(from, s, NARROW.has(band)) }),
      ...(letters && bands.length > 1 ? [chips(letters)] : []), name);
    return el('li', { className: 's2srow' }, number(s.act, 'activations'), name);
  }

  function head(from) {       // read out with each row instead, by the unit in it
    const banded = from && bands.length > 1;
    const line = el('li', { className: `s2srow s2shead${from ? ' far' : ''}${banded ? ' banded' : ''}` },
      ...(from ? ['mi', 'Dir', ...(banded ? ['Bands'] : []), 'Summit'] : ['Activations', 'Summit']).map(textContent => el('small', { textContent })));
    line.setAttribute('aria-hidden', 'true');
    return line;
  }

  const PART_OF = { Alaska: 'USA', France: 'France', Azores: 'Portugal', Madeira: 'Portugal', Corsica: 'France', Sardinia: 'Italy', 'Germany (Alpine)': 'Germany',
    'Germany (Low Mountains)': 'Germany', England: 'United Kingdom', Scotland: 'United Kingdom', Wales: 'United Kingdom', 'Northern Ireland': 'United Kingdom' };
  const TOP_COUNTRIES = 8;
  const folders = new Map();
  let unfolded = [];

  function opens(box) {       // the bar above the list: to one country, the one open before it closed
    unfolded.forEach(b => { b.open = false; });
    unfolded = [box];
    box.open = true;
    box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    box.querySelector('summary').focus({ preventScroll: true });
  }

  function regions() {
    const lands = new Map();
    for (const s of summits) {
      const code = s.ref.split('-')[0], [name, part] = index.regions[code].split(': '), [head, rest] = name.split(' - ');
      const land = PART_OF[head] ?? head, association = code.split('/')[0];
      if (!lands.has(land)) lands.set(land, new Map());
      const associations = lands.get(land);
      if (!associations.has(association)) associations.set(association, { name: PART_OF[head] || !rest ? name : rest, parts: new Map() });
      const parts = associations.get(association).parts;
      if (!parts.has(code)) parts.set(code, { part, list: [] });
      parts.get(code).list.push(s);
    }
    const top = summits.slice().sort((a, b) => b.act - a.act).slice(0, 30);
    const most = el('details', {}, el('summary', { textContent: 'Most activated' }), el('ul', { className: 's2srows' }, head(), ...top.map(s => row(s))));
    const count = parts => [...parts.values()].reduce((n, p) => n + p.list.length, 0);
    const folder = (title, parts) => {
      const box = el('details', {}, el('summary', { textContent: title }));
      box.addEventListener('toggle', () => {       // lists are made when first opened
        if (box.open && box.children.length === 1) {
          for (const [code, p] of parts) {
            box.append(el('h3', { textContent: `${code} ${p.part}` }), el('ul', { className: 's2srows' }, head(), ...p.list.sort((a, b) => b.act - a.act).map(s => row(s))));
          }
        }
      });
      return box;
    };
    const sizes = [];
    const all = [...lands].sort(([a], [b]) => a.localeCompare(b)).map(([land, associations]) => {
      const size = [...associations.values()].reduce((n, a) => n + count(a.parts), 0), title = `${land} (${size.toLocaleString()})`;
      if (associations.size === 1) {
        const [[code, { parts }]] = associations, box = folder(title, parts);
        folders.set(code, [box]);
        sizes.push([land, size, box]);
        return box;
      }
      const box = el('details', {}, el('summary', { textContent: title }));
      box.append(...[...associations].sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([code, { name, parts }]) => {
        const inner = folder(`${code} ${name} (${count(parts).toLocaleString()})`, parts);
        folders.set(code, [box, inner]);
        return inner;
      }));
      sizes.push([land, size, box]);
      return box;
    });
    const bar = el('ul', { className: 's2sbar' }, ...sizes.sort((a, b) => b[1] - a[1]).slice(0, TOP_COUNTRIES).map(([land, size, box]) => {
      const button = el('button', { type: 'button' }, `${land} `, el('small', { textContent: size.toLocaleString() }));
      button.addEventListener('click', () => opens(box));
      return el('li', {}, button);
    }));
    return [el('h2', { textContent: 'By country' }), el('nav', { ariaLabel: 'Countries with the most summits' }, bar), most, ...all];
  }

  function unfold() {       // the list opens on the country and association of the summit nearest the opening spot
    const from = { lat: opening[0], lon: opening[1] };
    const nearest = summits.reduce((a, b) => km(from, b) < km(from, a) ? b : a);
    unfolded.forEach(box => { box.open = false; });
    unfolded = folders.get(nearest.ref.split('/')[0]);
    unfolded.forEach(box => { box.open = true; });
  }

  function pressed(near) {      // a band that reaches nothing from this summit, as 1.25 m outside the Americas, is grayed out
    bandButtons.forEach(b => {
      const k = bands.indexOf(b.dataset.band);
      b.setAttribute('aria-pressed', b.dataset.band === band);
      b.disabled = Boolean(near) && k >= 0 && !near.some(({ letters }) => letters[k] !== '-');
    });
    days.hidden = !humid(band);
    dayButtons.forEach(b => b.setAttribute('aria-pressed', b.dataset.day === wet));
  }

  function home(note) {
    current = null;
    pressed();
    document.title = document.title.replace(/^.*? · /, 'VHF+ S2S · ');
    strip.textContent = 'VHF+ S2S';
    view.clearLayers();
    placed.length = 0;
    summits.forEach(s => view.addLayer(dot(s, '#96d1aa', 2.5, .5)));
    legend.replaceChildren(el('li', {}, el('span', { className: 'dot summit' }), `Summits with 10+ activations: ${summits.length.toLocaleString()}`));
    if (spot) map.panTo(spot);
    else map.setView(opening, 7);
    spot = null;
    $('s2s-title').replaceChildren(el('p', { textContent: note ?? `Summit to summit on ${bands.map(b => NAMES[b] ?? b).join(', ').replace(/, ([^,]*)$/, ' and $1')}: pick a summit to see the others it can reach at 5 W, and what antennas it takes. ${summits.length.toLocaleString()} summits worldwide with 10+ activations.` }));
    $('s2s-body').replaceChildren(...regions());
    unfold();
  }

  const files = new Map();

  async function show(s) {
    if (!files.has(s.ref)) {
      const body = await fetch(`/s2s/links/${s.ref.replace('/', '-')}.json`).then(r => r.json());
      const [steps, ...letters] = Array.isArray(body[0]) ? body : [null];
      let at = -1;
      files.set(s.ref, steps ? steps.map((step, n) => ({ o: summits[at += step], letters: letters.map(l => l[n]).join('') }))
        : body.flatMap((list, g) => list.map(i => ({ o: summits[i], letters: LETTER[g] }))));      // the 2 m only files of before
    }
    const near = files.get(s.ref);
    current = s;
    pressed(near);
    const k = kOf(band);
    const groupOf = l => (band === 'any' ? Math.min(...bands.map(b => LETTER.indexOf(l[kOf(b)])).filter(g => g >= 0)) : LETTER.indexOf(l[k]));
    document.title = document.title.replace(/^.*? · /, `${s.name} ${s.ref} · `);
    strip.textContent = `${s.name} ${s.ref}: what it reaches on ${NAMES[band] ?? band}${band === '6m' ? ' without openings: line of sight, diffraction, scatter' : ''}${humid(band) && wet !== 'average' ? `, on a ${wet} day` : ''}`;
    view.clearLayers();
    placed.length = 0;
    const layers = GROUPS.map(() => L.layerGroup());
    const others = GROUPS.map(() => []), lettersOf = new Map();
    for (const { o, letters } of near) {
      const g = groupOf(letters);
      lettersOf.set(o, letters);
      if (g >= 0 && g < GROUPS.length) others[g].push(o);
    }
    others.forEach(list => list.sort((a, b) => b.act - a.act));
    const tip = o => (bands.length > 1 ? `<br>${bands.map(b => `${NAMES[b] ?? b}: ${LETTER.includes(lettersOf.get(o)[kOf(b)]) ? labels(b)[LETTER.indexOf(lettersOf.get(o)[kOf(b)])] : '–'}`).join('<br>')}` : '');
    for (let g = GROUPS.length - 1; g >= 0; g--) {
      others[g].slice().reverse().forEach(o => layers[g].addLayer(dot(o, GROUPS[g][2], GROUPS[g][3], 1, tip(o))));
      view.addLayer(layers[g]);
    }
    const here = L.marker([s.lat, s.lon], { keyboard: false, zIndexOffset: 1000, icon: L.divIcon({ className: 's2s-here', iconSize: [28, 26], iconAnchor: [14, 16],
      html: TRIANGLE }) }).on('click', () => {});      // a marker no one listens to lets clicks through to the map
    view.addLayer(here);
    placed.push([here, s]);
    const reached = others.flat();
    if (!arguments[1]) map.fitBounds(L.latLngBounds([[s.lat, s.lon], ...reached.map(o => [o.lat, o.lon])]), { padding: [20, 20], maxZoom: 8 });
    const article = articles[s.ref];
    $('s2s-title').replaceChildren(
      el('h2', { textContent: `${s.name} ${s.ref}` }),
      el('p', {}, `${Math.round(s.m / .3048).toLocaleString()}′ (${s.m.toLocaleString()} m), ${s.act.toLocaleString()} activations. `,
        el('a', { href: `https://sotl.as/summits/${s.ref}`, textContent: 'On SOTLAS' }), article ? '. ' : null, article ? el('a', { href: article, textContent: 'Trip report' }) : null,
        '. ', el('a', { href: `#${tail()}`, textContent: 'All summits' }), '.'));
    const boxes = GROUPS.map(() => []);      // the key under the map and the legend on it are two views of the same switches
    const names = labels(band);
    const entry = ([id], g) => {
      const label = names[g];
      const box = el('input', { type: 'checkbox', checked: true });
      boxes[g].push(box);
      box.addEventListener('change', () => {
        boxes[g].forEach(b => { b.checked = box.checked; });
        box.checked ? view.addLayer(layers[g]) : view.removeLayer(layers[g]);
      });
      return el('li', {}, el('label', {}, box, el('span', { className: `dot ${id}` }), `${label}: ${others[g].length.toLocaleString()}`));
    };
    const shown = GROUPS.filter((_, g) => !(band === '6m' && g === 0) && names[g]);      // nobody carries a rubber ducky on 6 m, nor anything small from 24 GHz
    const key = el('ul', { className: 's2skey' }, ...shown.map(e => entry(e, GROUPS.indexOf(e))));
    legend.replaceChildren(el('li', {}, el('span', { className: 's2s-here', innerHTML: TRIANGLE }), `${s.name} ${s.ref}`), ...shown.map(e => entry(e, GROUPS.indexOf(e))));
    const body = GROUPS.map(([id], g) => (others[g].length ? el('details', { open: g === 0 && others[g].length <= 60 }, el('summary', { textContent: `${names[g]}: ${others[g].length.toLocaleString()}` }),
      el('ul', { className: 's2srows s2s' }, head(s), ...others[g].map(o => row(o, s, lettersOf.get(o))))) : null));
    $('s2s-body').replaceChildren(key, ...body.filter(Boolean));
    if (!arguments[1]) $('s2s-title').scrollIntoView({ block: 'start' });
  }

  function route() {
    $('s2s-results').replaceChildren();
    const [ref, asked = ''] = decodeURIComponent(location.hash.slice(1)).split('@');
    const [wanted, day] = asked.split('-');
    const was = [current, band, wet];
    band = [...bands, 'any'].includes(wanted) && bands.length > 1 ? wanted : '2m';
    if (humid(band)) wet = DAYS[day] ? day : 'average';      // elsewhere the day is kept for when a line-of-sight band comes back
    if (!ref) return home();
    const s = byRef.get(ref);
    if (s) return show(s, was[0] === s && (was[1] !== band || was[2] !== wet));       // another band of the same summit keeps the map where it is
    home(`No ${ref} here: this page has summits with 10 or more activations.`);
  }

  const plain = t => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const search = summits.map(s => [plain(s.ref), plain(s.name), s]);

  function found(text) {
    const q = plain(text);
    if (!q) return [];
    return search.filter(([r, n]) => r.includes(q) || n.includes(q))
      .sort((a, b) => b[0].startsWith(q) - a[0].startsWith(q) || b[1].startsWith(q) - a[1].startsWith(q) || b[2].act - a[2].act).slice(0, 12).map(x => x[2]);
  }

  $('s2s-search').addEventListener('input', e => {
    const hits = found(e.target.value);
    $('s2s-results').replaceChildren(...(hits.length ? [head()] : []), ...hits.map(s => row(s)));
  });
  $('s2s-form').addEventListener('submit', e => {
    e.preventDefault();
    const [first] = found($('s2s-search').value);
    if (first) location.hash = link(first);
  });
  window.addEventListener('hashchange', route);
  route();
  if (!location.hash) {       // the page opens where its reader is, if they allow it; the place stays in this browser
    navigator.geolocation?.getCurrentPosition(p => {
      opening = [p.coords.latitude, p.coords.longitude];
      if (location.hash) return;
      map.setView(opening, 7);
      unfold();
    }, () => {}, { timeout: 10000, maximumAge: 3600000 });
  }
})();
