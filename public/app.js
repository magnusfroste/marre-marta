/* Marre & Marta – städjakten.
 *
 * Marre är på förskolan. Fröken Marta vill att allt ligger på sin plats och
 * ringer föräldrarna om det blir för stökigt. Marre plockar undan, håller sig
 * undan för fröknarna och samlar saker i rätt ordning – då ringer jultomten och
 * nissarna bygger en julklapp av det Marre samlat.
 *
 * Allt ritas i canvas (inga bildfiler, inga tredjeparts-API:er), ljudet byggs
 * med WebAudio och rösten kommer från webbläsarens egen svenska tolkning.
 */
(() => {
  'use strict';

  /* ---------- planlösning: 13 × 9 rutor --------------------------------
   * '#' möbel, '.' golv, 'P' kuddhörna där fröknarna inte ser Marre. */
  const KARTA = [
    '#############',
    '#P..........#',
    '#.###.#.###.#',
    '#...........#',
    '#.###.#.###.#',
    '#...........#',
    '#.###.#.###.#',
    '#..........P#',
    '#############',
  ];
  const COLS = 13;
  const ROWS = 9;

  const arGolv = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && KARTA[y][x] !== '#';
  const arKudde = (x, y) => KARTA[y][x] === 'P';

  /* ---------- färg ------------------------------------------------------ */
  const F = {
    golv: '#f7f0e4', golv2: '#f1e7d6', golvKant: '#e6d8c2',
    mobel: '#dbc6a8', mobelKant: '#bfa483', mobelTopp: '#e9d9c2',
    black: '#14181f', dampad: '#5b6673', stjarna: '#e9b62f',
    marre: '#e0592f', marreHar: '#3d2a20', hud: '#f6cdaa',
    froknar: ['#2f7d6f', '#7a5bb5', '#c2557a'],
    frokenHar: ['#6b4a3a', '#3c3242', '#8a5c3d'],
    saker: {
      kloss: '#e2574c', krita: '#4a7dcf', mugg: '#4ea86b',
      strumpa: '#9a6bd0', bok: '#e08a2e', boll: '#e3c33a',
    },
  };

  const SAKNAMN = {
    kloss: 'kloss', krita: 'krita', mugg: 'mugg',
    strumpa: 'strumpa', bok: 'bok', boll: 'boll',
  };

  /* ---------- julklappar: saker i en viss ordning ----------------------- */
  const ALLA_RECEPT = [
    { namn: 'sparkcykel', ikon: 'sparkcykel', sak: ['krita', 'kloss', 'boll'] },
    { namn: 'nalle', ikon: 'nalle', sak: ['strumpa', 'mugg', 'boll'] },
    { namn: 'drake', ikon: 'drake', sak: ['bok', 'krita', 'strumpa'] },
    { namn: 'ritlåda', ikon: 'lada', sak: ['krita', 'krita', 'bok'] },
    { namn: 'klosslåda', ikon: 'lada', sak: ['kloss', 'kloss', 'mugg'] },
    { namn: 'docka', ikon: 'docka', sak: ['strumpa', 'kloss', 'strumpa'] },
  ];

  /* ---------- fröknar --------------------------------------------------- */
  const FROKNAR = [
    { namn: 'Marta', farg: F.froknar[0], har: F.frokenHar[0], fart: 330, syn: 5,
      varta: true, glasogon: true, frisyr: 'knut', telefon: true },
    { namn: 'Ulla', farg: F.froknar[1], har: F.frokenHar[1], fart: 270, syn: 4,
      varta: false, glasogon: false, frisyr: 'langt', telefon: false },
    { namn: 'Britt', farg: F.froknar[2], har: F.frokenHar[2], fart: 390, syn: 6,
      varta: false, glasogon: false, frisyr: 'kroll', telefon: false },
  ];

  /* ---------- nivåer ---------------------------------------------------- */
  const NIVÅER = [
    { froknar: 1, mål: 3, saker: 5, oreda: 5.0, text: 'Marta går sin runda. Röj undan så mycket du kan!' },
    { froknar: 2, mål: 3, saker: 6, oreda: 6.5, text: 'Ulla har kommit. Hon ser längre än Marta.' },
    { froknar: 3, mål: 3, saker: 7, oreda: 8.0, text: 'Alla tre fröknarna är ute. Skynda dig!' },
  ];

  /* ---------- DOM ------------------------------------------------------- */
  const duk = document.getElementById('duk');
  const ctx = duk.getContext('2d');
  const scen = document.getElementById('scen');
  const el = {
    poang: document.querySelector('[data-poang]'),
    klappar: document.querySelector('[data-klappar]'),
    oreda: document.querySelector('[data-oreda]'),
    recept: document.querySelector('[data-recept]'),
    froken: document.querySelector('[data-froken]'),
    samtal: document.getElementById('samtal'),
    samtalRubrik: document.querySelector('#samtal [data-rubrik]'),
    samtalText: document.querySelector('#samtal [data-text]'),
    samtalNotis: document.querySelector('#samtal [data-notis]'),
    samtalKnapp: document.querySelector('#samtal [data-knapp]'),
    klart: document.getElementById('klart'),
    paus: document.getElementById('paus'),
    ljud: document.querySelector('[data-ljud]'),
    rost: document.querySelector('[data-rost]'),
    styrspak: document.getElementById('styrspak'),
  };

  /* ---------- tillstånd ------------------------------------------------- */
  const START = { x: 6, y: 1 };
  const S = {
    lage: 'vantar',       // vantar | spel | paus | samtal | klart
    niva: 0,
    poang: 0,
    samtal: 0,
    klappar: [],
    recept: [],
    receptNr: 0,
    sekvens: [],
    oreda: 0,
    froknar: [],
    saker: [],
    marre: null,
    skydd: 0,             // osynlig tid efter kuddhörnan
    skak: 0,
    stig: [],             // rutor Marre går till själv när man pekat dit
    ljud: true,
    rost: true,
  };

  /* ---------- ljud ------------------------------------------------------ */
  let ak = null;

  function ljudMotor() {
    if (!S.ljud) return null;
    try {
      ak = ak || new (window.AudioContext || window.webkitAudioContext)();
      if (ak.state === 'suspended') ak.resume();
      return ak;
    } catch (e) {
      return null;
    }
  }

  function ton(frekvens, langd = 0.12, typ = 'sine', volym = 0.09, fordr = 0) {
    const motor = ljudMotor();
    if (!motor) return;
    const start = motor.currentTime + fordr;
    const osc = motor.createOscillator();
    const gain = motor.createGain();
    osc.type = typ;
    osc.frequency.setValueAtTime(frekvens, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volym, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + langd);
    osc.connect(gain).connect(motor.destination);
    osc.start(start);
    osc.stop(start + langd + 0.02);
  }

  const ljud = {
    plock: () => { ton(760, 0.08, 'triangle', 0.07); ton(1040, 0.09, 'triangle', 0.05, 0.05); },
    ring: () => { ton(420, 0.18, 'square', 0.05); ton(420, 0.18, 'square', 0.05, 0.24); },
    klapp: () => [523, 659, 784, 1046].forEach((f, i) => ton(f, 0.18, 'triangle', 0.06, i * 0.09)),
    bus: () => { ton(330, 0.16, 'sawtooth', 0.05); ton(247, 0.22, 'sawtooth', 0.05, 0.14); },
  };

  function sag(text) {
    if (!S.rost || !text || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'sv-SE';
      u.rate = 0.95;
      u.pitch = 1.05;
      const svensk = window.speechSynthesis.getVoices()
        .find((v) => /sv[-_]SE/i.test(v.lang) || /swedish|svenska/i.test(v.name));
      if (svensk) u.voice = svensk;
      window.speechSynthesis.speak(u);
    } catch (e) { /* rösten är en bonus, aldrig ett krav */ }
  }

  /* ---------- slump ----------------------------------------------------- */
  const slump = (n) => Math.floor(Math.random() * n);
  const SAKSLAG = Object.keys(F.saker);

  function ledigaRutor() {
    const upptagna = new Set();
    S.saker.forEach((s) => upptagna.add(s.x + ',' + s.y));
    if (S.marre) upptagna.add(S.marre.x + ',' + S.marre.y);
    S.froknar.forEach((f) => upptagna.add(f.x + ',' + f.y));
    const ut = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (arGolv(x, y) && !upptagna.has(x + ',' + y)) ut.push({ x, y });
      }
    }
    return ut;
  }

  function nySak() {
    const tomma = ledigaRutor();
    if (!tomma.length) return;
    const r = tomma[slump(tomma.length)];
    // Det receptet behöver dyker upp oftare, så ett barn aldrig fastnar.
    const behovs = (S.recept[S.receptNr] || { sak: [] }).sak.slice(S.sekvens.length);
    const slag = behovs.length && Math.random() < 0.55
      ? behovs[slump(behovs.length)]
      : SAKSLAG[slump(SAKSLAG.length)];
    S.saker.push({ x: r.x, y: r.y, slag, puls: Math.random() * 6.28 });
  }

  // Se till att saken som står på tur finns på golvet – annars kan barnet
  // leta efter något som inte finns och tappa tålamodet.
  function sakSaknas() {
    const recept = S.recept[S.receptNr];
    if (!recept) return;
    const slag = recept.sak[S.sekvens.length];
    if (!slag) return;
    if (S.saker.some((s) => s.slag === slag)) return;
    const tomma = ledigaRutor();
    if (!tomma.length) return;
    const r = tomma[slump(tomma.length)];
    S.saker.push({ x: r.x, y: r.y, slag, puls: 0 });
  }

  /* ---------- vägval ---------------------------------------------------- */
  const NABO = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  function vag(fran, till) {
    if (fran.x === till.x && fran.y === till.y) return [];
    const ko = [fran];
    const kom = new Map([[fran.x + ',' + fran.y, null]]);
    while (ko.length) {
      const n = ko.shift();
      for (const [dx, dy] of NABO) {
        const x = n.x + dx;
        const y = n.y + dy;
        const nyckel = x + ',' + y;
        if (!arGolv(x, y) || kom.has(nyckel)) continue;
        kom.set(nyckel, n);
        if (x === till.x && y === till.y) {
          const ut = [];
          let steg = { x, y };
          while (steg) {
            ut.unshift(steg);
            steg = kom.get(steg.x + ',' + steg.y);
          }
          ut.shift();       // första posten är rutan hon står på
          return ut;
        }
        ko.push({ x, y });
      }
    }
    return [];
  }

  function serFroken(f, m) {
    if (S.skydd > 0) return false;
    const dx = m.x - f.x;
    const dy = m.y - f.y;
    if (dx === 0 && dy === 0) return true;
    if (dx !== 0 && dy !== 0) return Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
    const langd = Math.max(Math.abs(dx), Math.abs(dy));
    if (langd > f.syn) return false;
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    for (let i = 1; i <= langd; i++) {
      if (!arGolv(f.x + sx * i, f.y + sy * i)) return false;
    }
    return true;
  }

  /* ---------- nivå ------------------------------------------------------ */
  function startaNiva(nr) {
    const n = NIVÅER[Math.min(nr, NIVÅER.length - 1)];
    S.niva = nr;
    S.oreda = 0;
    S.sekvens = [];
    S.klappar = [];
    S.saker = [];
    S.skydd = 1.6;      // lugn start – ingen fröken tar dig direkt
    S.samtal = 0;
    S.skak = 0;
    S.stig = [];
    S.marre = {
      x: START.x, y: START.y, px: START.x, py: START.y, riktning: 'ner', ror: 0,
    };
    S.recept = ALLA_RECEPT.slice().sort(() => Math.random() - 0.5).slice(0, n.mål);
    S.receptNr = 0;
    const platser = [{ x: 6, y: 7 }, { x: 11, y: 5 }, { x: 1, y: 5 }];
    S.froknar = FROKNAR.slice(0, n.froknar).map((f, i) => ({
      ...f,
      x: platser[i].x, y: platser[i].y,
      px: platser[i].x, py: platser[i].y,
      nasta: i,
      jagad: 0,
      arg: 0,
      senaste: 0,
    }));
    for (let i = 0; i < n.saker; i++) nySak();
    sakSaknas();
    ritaHUD();
    S.lage = 'spel';
    nivaStart = performance.now();
    rort = false;
    sag(n.text);
  }

  /* ---------- insamling ------------------------------------------------- */
  function plocka(sak) {
    S.saker = S.saker.filter((s) => s !== sak);
    S.poang += 1;
    S.oreda = Math.max(0, S.oreda - 4);
    ljud.plock();
    const recept = S.recept[S.receptNr];
    if (recept) {
      if (sak.slag === recept.sak[S.sekvens.length]) {
        S.sekvens.push(sak.slag);
        if (S.sekvens.length === recept.sak.length) byggKlapp();
      } else if (sak.slag === recept.sak[0]) {
        S.sekvens = [sak.slag];
      } else {
        S.sekvens = [];
      }
    }
    sakSaknas();
    ritaHUD();
  }

  function byggKlapp() {
    const recept = S.recept[S.receptNr];
    S.klappar.push(recept.ikon);
    S.poang += 5;
    S.sekvens = [];
    S.receptNr += 1;
    ljud.klapp();
    sag('Tomten ringer! Nissarna bygger en ' + recept.namn + ' av det du samlat.');
    visaSamtal(
      'Tomten ringer',
      'Nissarna bygger en ' + recept.namn + ' av '
        + recept.sak.map((s) => SAKNAMN[s]).join(' och ') + '. Bra samlat!',
      '+5 stjärnor',
      () => { if (S.receptNr >= S.recept.length) klartNiva(); }
    );
  }

  function martaRinger() {
    S.samtal += 1;
    S.poang = Math.max(0, S.poang - 3);
    S.oreda = 0;
    S.skak = 0.5;
    ljud.ring();
    sag('Marta ringer mamma! Nu måste du plocka undan.');
    visaSamtal('Marta ringer hem', 'Det ligger saker överallt. Marta ringer mamma och berättar.', '−3 stjärnor', null);
    ritaHUD();
  }

  function fastnar(f) {
    if (S.skydd > 0) return;
    S.poang = Math.max(0, S.poang - 2);
    S.skak = 0.4;
    ljud.bus();
    sag(f.namn + ' tog dig! Spring till mattan och plocka vidare.');
    S.marre.x = START.x;
    S.marre.y = START.y;
    S.marre.px = START.x;
    S.marre.py = START.y;
    S.skydd = 2;          // liten fristad så hon inte tar dig direkt igen
    S.froknar.forEach((m) => { m.jagad = 0; m.arg = 1.4; });
    ritaHUD();
  }

  function klartNiva() {
    S.lage = 'klart';
    const sista = S.niva >= NIVÅER.length - 1;
    sag('Alla julklappar är byggda! Du fick ' + S.poang + ' stjärnor.');
    el.klart.hidden = false;
    el.klart.querySelector('[data-rubrik]').textContent = sista ? 'Alla julklappar klara!' : 'Nivån är klar!';
    const antal = (n, ental, Plural) => n + ' ' + (n === 1 ? ental : Plural);
    el.klart.querySelector('[data-resultat]').textContent =
      antal(S.poang, 'stjärna', 'stjärnor') + ' · '
      + antal(S.klappar.length, 'julklapp', 'julklappar') + ' · Marta ringde '
      + antal(S.samtal, 'gång', 'gånger');
    const knapp = el.klart.querySelector('[data-nasta]');
    knapp.textContent = sista ? 'Spela igen' : 'Nästa nivå';
    knapp.dataset.igen = sista ? '1' : '';
  }

  /* ---------- samtal (tomten eller Marta) -------------------------------- */
  function visaSamtal(rubrik, text, notis, narStangd) {
    el.samtalRubrik.textContent = rubrik;
    el.samtalText.textContent = text;
    el.samtalNotis.textContent = notis || '';
    el.samtal.hidden = false;
    const tidigare = S.lage;
    S.lage = 'samtal';
    el.samtalKnapp.onclick = () => {
      el.samtal.hidden = true;
      S.lage = tidigare === 'samtal' ? 'spel' : tidigare;
      if (narStangd) narStangd();
      setTimeout(() => duk.focus(), 10);
    };
    setTimeout(() => el.samtalKnapp.focus(), 30);
  }

  /* ---------- HUD ------------------------------------------------------- */
  function ritaHUD() {
    el.poang.textContent = S.poang;
    el.klappar.textContent = S.klappar.length + '/' + (S.recept.length || 0);
    el.oreda.style.setProperty('--oreda', Math.min(100, Math.round(S.oreda)) + '%');
    el.oreda.dataset.straff = S.oreda > 70 ? 'hog' : '';
    el.froken.textContent = S.froknar.map((f) => f.namn).join(' + ') || 'Marta';
    const recept = S.recept[S.receptNr];
    if (!recept) {
      el.recept.innerHTML = '<span class="recept-klart">Alla julklappar byggda</span>';
      return;
    }
    el.recept.innerHTML = recept.sak.map((s, i) => {
      const gjord = i < S.sekvens.length;
      const nasta = i === S.sekvens.length;
      return '<span class="recept-sak' + (gjord ? ' gjord' : '') + (nasta ? ' nasta' : '')
        + '" style="--farg:' + F.saker[s] + '">'
        + '<i class="sak-ikon ' + s + '" aria-hidden="true"></i>' + SAKNAMN[s] + '</span>';
    }).join('<span class="recept-pil" aria-hidden="true">→</span>')
      + '<span class="recept-namn">= ' + recept.namn + '</span>';
  }

  /* ---------- rita ------------------------------------------------------ */
  let ruta = 0;
  let matt = { w: 0, h: 0 };

  function storlek() {
    const r = scen.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = Math.floor(Math.min(r.width / COLS, r.height / ROWS));
    if (s < 8) return;
    duk.width = Math.floor(s * COLS * dpr);
    duk.height = Math.floor(s * ROWS * dpr);
    duk.style.width = s * COLS + 'px';
    duk.style.height = s * ROWS + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ruta = s;
    matt = { w: s * COLS, h: s * ROWS };
  }

  function runda(x, y, w, h, r) {
    const radie = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radie, y);
    ctx.arcTo(x + w, y, x + w, y + h, radie);
    ctx.arcTo(x + w, y + h, x, y + h, radie);
    ctx.arcTo(x, y + h, x, y, radie);
    ctx.arcTo(x, y, x + w, y, radie);
    ctx.closePath();
  }

  function stjarna(x, y, r, farg) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const v = -Math.PI / 2 + (i * Math.PI) / 5;
      const radie = i % 2 === 0 ? r : r * 0.45;
      ctx[i ? 'lineTo' : 'moveTo'](x + radie * Math.cos(v), y + radie * Math.sin(v));
    }
    ctx.closePath();
    ctx.fillStyle = farg;
    ctx.fill();
  }

  function tecknaGolv() {
    const t = ruta;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!arGolv(x, y)) continue;
        ctx.fillStyle = (x + y) % 2 ? F.golv : F.golv2;
        ctx.fillRect(x * t, y * t, t, t);
      }
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!arKudde(x, y)) continue;
        ctx.fillStyle = '#e8dff5';
        ctx.fillRect(x * t, y * t, t, t);
        ['#cbb6ea', '#bda3e4', '#d8c9ef'].forEach((farg, i) => {
          ctx.fillStyle = farg;
          runda(x * t + t * 0.12 + i * t * 0.19, y * t + t * 0.3 + (i % 2) * t * 0.16, t * 0.44, t * 0.3, t * 0.14);
          ctx.fill();
        });
      }
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (arGolv(x, y)) continue;
        const px = x * t;
        const py = y * t;
        ctx.fillStyle = 'rgba(20,24,31,0.06)';
        runda(px + t * 0.06, py + t * 0.1, t * 0.9, t * 0.86, t * 0.2);
        ctx.fill();
        ctx.fillStyle = F.mobel;
        runda(px + t * 0.04, py + t * 0.04, t * 0.92, t * 0.9, t * 0.2);
        ctx.fill();
        ctx.fillStyle = F.mobelTopp;
        runda(px + t * 0.04, py + t * 0.04, t * 0.92, t * 0.34, t * 0.18);
        ctx.fill();
        ctx.strokeStyle = F.mobelKant;
        ctx.lineWidth = Math.max(1, t * 0.02);
        runda(px + t * 0.04, py + t * 0.04, t * 0.92, t * 0.9, t * 0.2);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = F.golvKant;
    ctx.lineWidth = Math.max(2, t * 0.05);
    ctx.strokeRect(t * 0.02, t * 0.02, matt.w - t * 0.04, matt.h - t * 0.04);
  }

  function tecknaSak(s, tid) {
    const t = ruta;
    const cx = s.x * t + t / 2;
    const cy = s.y * t + t / 2 + Math.sin(tid * 3 + s.puls) * t * 0.04;
    const farg = F.saker[s.slag];
    const r = t * 0.225;
    ctx.save();
    ctx.fillStyle = 'rgba(20,24,31,0.10)';
    ctx.beginPath();
    ctx.ellipse(cx, s.y * t + t * 0.82, t * 0.2, t * 0.06, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = farg;
    if (s.slag === 'kloss') {
      runda(cx - r, cy - r, r * 2, r * 2, t * 0.06);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      runda(cx - r * 0.6, cy - r * 0.6, r * 0.5, r * 0.5, t * 0.03);
      ctx.fill();
    } else if (s.slag === 'krita') {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy - r);
      ctx.lineTo(cx + r * 0.5, cy - r);
      ctx.lineTo(cx + r * 0.25, cy + r);
      ctx.lineTo(cx - r * 0.25, cy + r);
      ctx.closePath();
      ctx.fill();
    } else if (s.slag === 'mugg') {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.8, 0, 6.3);
      ctx.fill();
      ctx.strokeStyle = farg;
      ctx.lineWidth = t * 0.07;
      ctx.beginPath();
      ctx.arc(cx + r * 0.85, cy, r * 0.45, -1.2, 1.2);
      ctx.stroke();
    } else if (s.slag === 'strumpa') {
      runda(cx - r * 0.55, cy - r, r * 1.1, r * 1.7, r * 0.3);
      ctx.fill();
      runda(cx - r * 0.55, cy + r * 0.5, r * 1.7, r * 0.8, r * 0.35);
      ctx.fill();
    } else if (s.slag === 'bok') {
      runda(cx - r, cy - r * 0.8, r * 2, r * 1.6, t * 0.05);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(cx - r * 0.08, cy - r * 0.7, r * 0.16, r * 1.4);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, 0, 6.3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = t * 0.045;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.6, -0.6, 1.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function tecknaMarre(tid) {
    const t = ruta;
    const m = S.marre;
    const cx = m.px * t + t / 2;
    const cy = m.py * t + t / 2 + Math.sin(tid * 8) * t * 0.03;
    const r = t * 0.3;
    ctx.save();
    if (S.skydd > 0) ctx.globalAlpha = 0.6;
    ctx.fillStyle = 'rgba(20,24,31,0.14)';
    ctx.beginPath();
    ctx.ellipse(cx, m.py * t + t * 0.84, r * 0.8, t * 0.07, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = F.marre;
    runda(cx - r * 0.62, cy - r * 0.1, r * 1.24, r * 1.05, r * 0.42);
    ctx.fill();
    ctx.fillStyle = F.hud;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.55, r * 0.62, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = F.marreHar;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.68, r * 0.64, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - r * 0.22, cy - r * 0.95, r * 0.26, 0, 6.3);
    ctx.fill();
    const blink = Math.sin(tid * 1.7) > 0.97;
    ctx.fillStyle = F.black;
    if (blink) {
      ctx.fillRect(cx - r * 0.3, cy - r * 0.57, r * 0.22, r * 0.05);
      ctx.fillRect(cx + r * 0.1, cy - r * 0.57, r * 0.22, r * 0.05);
    } else {
      ctx.beginPath();
      ctx.arc(cx - r * 0.2, cy - r * 0.54, r * 0.08, 0, 6.3);
      ctx.arc(cx + r * 0.2, cy - r * 0.54, r * 0.08, 0, 6.3);
      ctx.fill();
    }
    ctx.strokeStyle = F.black;
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.38, r * 0.24, 0.25, Math.PI - 0.25);
    ctx.stroke();
    const vift = m.ror && performance.now() - m.ror < 220 ? Math.sin(tid * 22) * r * 0.26 : 0;
    ctx.strokeStyle = F.hud;
    ctx.lineWidth = r * 0.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, cy + r * 0.1);
    ctx.lineTo(cx - r * 0.85, cy + r * 0.45 + vift);
    ctx.moveTo(cx + r * 0.6, cy + r * 0.1);
    ctx.lineTo(cx + r * 0.85, cy + r * 0.45 - vift);
    ctx.stroke();
    ctx.restore();
  }

  function tecknaFroken(f, tid) {
    const t = ruta;
    const cx = f.px * t + t / 2;
    const cy = f.py * t + t / 2;
    const r = t * 0.36;
    const gung = Math.sin(tid * 6 + f.nasta) * t * 0.02;
    ctx.save();
    ctx.fillStyle = 'rgba(20,24,31,0.16)';
    ctx.beginPath();
    ctx.ellipse(cx, f.py * t + t * 0.86, r * 0.85, t * 0.075, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = f.farg;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.5, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.95, cy + r * 0.9);
    ctx.lineTo(cx - r * 0.95, cy + r * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = F.hud;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.55 + gung, r * 0.5, 0, 6.3);
    ctx.fill();
    // frisyr: knut, långt hår eller krusigt – fröknarna ska gå att skilja åt
    ctx.fillStyle = f.har;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.66 + gung, r * 0.52, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    if (f.frisyr === 'knut') {
      ctx.beginPath();
      ctx.arc(cx, cy - r * 1.12 + gung, r * 0.22, 0, 6.3);
      ctx.fill();
    } else if (f.frisyr === 'langt') {
      runda(cx - r * 0.58, cy - r * 0.75 + gung, r * 0.2, r * 0.85, r * 0.1);
      ctx.fill();
      runda(cx + r * 0.38, cy - r * 0.75 + gung, r * 0.2, r * 0.85, r * 0.1);
      ctx.fill();
    } else {
      [-0.4, 0, 0.4].forEach((dx, i) => {
        ctx.beginPath();
        ctx.arc(cx + r * dx, cy - r * (1.0 - Math.abs(dx) * 0.25) + gung, r * 0.2, 0, 6.3);
        ctx.fill();
      });
    }
    if (f.glasogon) {
      ctx.strokeStyle = 'rgba(20,24,31,0.55)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.arc(cx - r * 0.19, cy - r * 0.55 + gung, r * 0.12, 0, 6.3);
      ctx.arc(cx + r * 0.19, cy - r * 0.55 + gung, r * 0.12, 0, 6.3);
      ctx.stroke();
    }
    ctx.strokeStyle = F.black;
    ctx.beginPath();
    if (f.arg > 0) ctx.arc(cx, cy - r * 0.3 + gung, r * 0.16, Math.PI + 0.3, -0.3);
    else ctx.arc(cx, cy - r * 0.36 + gung, r * 0.14, 0.35, Math.PI - 0.35);
    ctx.stroke();
    if (f.telefon) {
      ctx.fillStyle = '#333a45';
      runda(cx + r * 0.72, cy + r * 0.2, r * 0.3, r * 0.5, r * 0.08);
      ctx.fill();
      ctx.fillStyle = '#8fb7c9';
      runda(cx + r * 0.78, cy + r * 0.27, r * 0.18, r * 0.3, r * 0.04);
      ctx.fill();
    }
    if (f.varta) {
      ctx.fillStyle = '#b5765a';
      ctx.beginPath();
      ctx.arc(cx + r * 0.05, cy - r * 0.42 + gung, Math.max(1.4, r * 0.055), 0, 6.3);
      ctx.fill();
    }
    if (f.jagad > 0) {
      // Pratbubbla med ett tydligt utropstecken – en "!" som går att läsa även
      // när brickan är liten.
      const bw = r * 0.62;
      const bh = r * 0.72;
      const bx = cx - bw / 2;
      const by = cy - r * 2.05;
      ctx.fillStyle = '#d94a3d';
      runda(bx, by, bw, bh, r * 0.16);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.1, by + bh - 1);
      ctx.lineTo(cx + r * 0.1, by + bh - 1);
      ctx.lineTo(cx, by + bh + r * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      runda(cx - r * 0.045, by + bh * 0.18, r * 0.09, bh * 0.42, r * 0.045);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, by + bh * 0.8, r * 0.05, 0, 6.3);
      ctx.fill();
    }
    ctx.restore();
  }

  // Fröken som fått syn på Marre får en pulserande röd halo i stället för en
  // streckad linje – linjen korsade möbler och såg ut som en ritbugg.
  function tecknaSikt(nu) {
    const t = ruta;
    const puls = 0.5 + 0.5 * Math.sin(nu / 260);
    S.froknar.forEach((f) => {
      if (!f.jagad) return;
      ctx.save();
      ctx.fillStyle = 'rgba(217,74,61,' + (0.10 + puls * 0.10) + ')';
      ctx.beginPath();
      ctx.arc(f.px * t + t / 2, f.py * t + t / 2, t * (0.44 + puls * 0.06), 0, 6.3);
      ctx.fill();
      ctx.restore();
    });
  }

  // En pulserande ring kring den sak som står på tur – barn som inte läser ser
  // ändå vilken sak som ska plockas härnäst.
  function tecknaLedtrad(nu) {
    const recept = S.recept[S.receptNr];
    if (!recept) return;
    const slag = recept.sak[S.sekvens.length];
    if (!slag) return;
    const t = ruta;
    S.saker.forEach((s) => {
      if (s.slag !== slag) return;
      const puls = 0.5 + 0.5 * Math.sin(nu / 320);
      ctx.save();
      ctx.strokeStyle = 'rgba(224,89,47,' + (0.35 + puls * 0.5) + ')';
      ctx.lineWidth = Math.max(2, t * (0.06 + puls * 0.05));
      ctx.beginPath();
      ctx.arc((s.px !== undefined ? s.px : s.x) * t + t / 2, (s.py !== undefined ? s.py : s.y) * t + t / 2,
        t * (0.34 + puls * 0.1), 0, 6.3);
      ctx.stroke();
      ctx.restore();
    });
  }

  function tecknaExtra() {
    const t = ruta;
    S.froknar.forEach((f) => {
      if (!f.jagad) return;
      stjarna(f.px * t + t * 0.84, f.py * t + t * 0.12, t * 0.1, F.stjarna);
    });
    if (S.skydd > 0) {
      const m = S.marre;
      ctx.save();
      ctx.strokeStyle = 'rgba(122,91,181,0.5)';
      ctx.lineWidth = Math.max(1.5, t * 0.035);
      ctx.setLineDash([t * 0.1, t * 0.1]);
      ctx.beginPath();
      ctx.arc(m.px * t + t / 2, m.py * t + t / 2, t * 0.42, 0, 6.3);
      ctx.stroke();
      ctx.restore();
    }
  }

  let forraTid = 0;

  function rita(nu) {
    const tid = nu / 1000;
    const dt = Math.min(0.05, tid - (forraTid || tid));
    forraTid = tid;
    if (!S.marre || !ruta) return;
    ctx.save();
    if (S.skak > 0) {
      S.skak = Math.max(0, S.skak - dt);
      ctx.translate((Math.random() - 0.5) * 9 * S.skak, (Math.random() - 0.5) * 9 * S.skak);
    }
    tecknaGolv();
    S.saker.forEach((s) => tecknaSak(s, tid));
    tecknaLedtrad(nu);
    tecknaSikt(nu);
    S.froknar.forEach((f) => tecknaFroken(f, tid));
    tecknaMarre(tid);
    tecknaExtra();
    ctx.restore();
  }

  /* ---------- rörelse --------------------------------------------------- */
  const STEG_MS = 150;   // ett steg var 150:e ms – hinner se och styra


  // Ett steg till rutan (x, y) – gemensam väg för tumme, piltangenter och
  // "peka dit du vill gå" så att plockning och kuddhörna beter sig lika.
  function stegTill(x, y) {
    const m = S.marre;
    if (!m || S.lage !== 'spel') return false;
    if (!arGolv(x, y)) return false;
    if (!rort) {
      rort = true;
      if (!haller) el.styrspak.classList.remove('vinkar', 'syns');
      else el.styrspak.classList.remove('vinkar');
    }
    m.x = x;
    m.y = y;
    m.ror = performance.now();
    const sak = S.saker.find((s) => s.x === x && s.y === y);
    if (sak) plocka(sak);
    if (arKudde(x, y) && S.skydd <= 0) {
      S.skydd = 6;
      sag('Kuddhörnan! Nu ser fröknarna dig inte.');
      ritaHUD();
    }
    return true;
  }

  function flyttaMarre() {
    const m = S.marre;
    if (!m || S.lage !== 'spel') return;
    let dx = 0;
    let dy = 0;
    if (m.riktning === 'upp') dy = -1;
    else if (m.riktning === 'ner') dy = 1;
    else if (m.riktning === 'vanster') dx = -1;
    else if (m.riktning === 'hoger') dx = 1;
    if (!dx && !dy) return;
    stegTill(m.x + dx, m.y + dy);
  }

  // Peka på en ruta: Marre går dit själv, ett steg i taget. Enklaste vägen in
  // för den som inte kan styra en spak än.
  function gaTillRuta(x, y) {
    if (S.lage !== 'spel' || !arGolv(x, y)) return false;
    if (S.marre.x === x && S.marre.y === y) return false;
    const v = vag({ x: S.marre.x, y: S.marre.y }, { x, y });
    if (!v.length) return false;
    S.stig = v;
    return true;
  }

  /* ---------- fröknarnas runda ------------------------------------------ */
  const RUNDA = [{ x: 1, y: 1 }, { x: 11, y: 1 }, { x: 11, y: 7 }, { x: 1, y: 7 }];

  function stegFroken(f) {
    const m = S.marre;
    if (f.jagad > 0) {
      f.jagad -= 1;
      const v = vag({ x: f.x, y: f.y }, { x: m.x, y: m.y });
      if (v.length) {
        f.x = v[0].x;
        f.y = v[0].y;
      }
      if (f.x === m.x && f.y === m.y) fastnar(f);
      else if (f.jagad === 0) f.nasta = 0;
      return;
    }
    if (serFroken(f, m)) {
      f.jagad = 7;
      f.arg = 2.5;
      ljud.bus();
      sag(f.namn + ' ser dig!');
      return;
    }
    const punkt = RUNDA[f.nasta % RUNDA.length];
    if (f.x === punkt.x && f.y === punkt.y) {
      f.nasta += 1;
      return;
    }
    const v = vag({ x: f.x, y: f.y }, punkt);
    if (v.length) {
      f.x = v[0].x;
      f.y = v[0].y;
    } else {
      f.nasta += 1;
    }
  }

  /* ---------- speltakt -------------------------------------------------- */
  let sistMarre = 0;
  let sistOreda = 0;
  let sistSpawn = 0;
  let nivaStart = 0;
  let rort = false;

  function tick(nu) {
    requestAnimationFrame(tick);
    rita(nu);
    if (S.lage !== 'spel') return;

    S.marre.px += (S.marre.x - S.marre.px) * 0.24;
    S.marre.py += (S.marre.y - S.marre.py) * 0.24;
    S.froknar.forEach((f) => {
      f.px += (f.x - f.px) * 0.18;
      f.py += (f.y - f.py) * 0.18;
      if (f.arg > 0) f.arg = Math.max(0, f.arg - 0.016);
    });

    if (nu - sistMarre > STEG_MS) {
      sistMarre = nu;
      if (S.stig && S.stig.length && !haller) {
        const n = S.stig.shift();
        if (!stegTill(n.x, n.y)) S.stig.length = 0;
      } else {
        flyttaMarre();
      }
    }
    // Visar direkt var tummen kan sättas – och slutar så fort barnet rört sig.
    if (!rort) {
      const vinka = nu - nivaStart > 900;
      if (vinka && !el.styrspak.classList.contains('vinkar')) visaVink();
      else if (!vinka) el.styrspak.classList.remove('vinkar', 'syns');
    }
    if (S.skydd > 0) S.skydd = Math.max(0, S.skydd - 0.016);

    S.froknar.forEach((f) => {
      if (nu - f.senaste > f.fart) {
        f.senaste = nu;
        stegFroken(f);
      }
    });

    // Städtakten: oredan växer när det ligger saker kvar och krymper när det är rent.
    if (nu - sistOreda > 500) {
      const sek = (nu - sistOreda) / 1000;
      sistOreda = nu;
      const takt = NIVÅER[Math.min(S.niva, NIVÅER.length - 1)].oreda;
      const kvar = S.saker.length;
      if (kvar > 2) S.oreda += takt * (0.1 + kvar / 22) * sek;
      else S.oreda -= takt * 0.35 * sek;
      S.oreda = Math.max(0, Math.min(100, S.oreda));
      el.oreda.style.setProperty('--oreda', Math.round(S.oreda) + '%');
      el.oreda.dataset.straff = S.oreda > 70 ? 'hog' : '';
      if (S.oreda >= 100) martaRinger();
    }

    // nya saker – aldrig fler än nivån tillåter
    if (nu - sistSpawn > 3200) {
      sistSpawn = nu;
      const tak = NIVÅER[Math.min(S.niva, NIVÅER.length - 1)].saker + 2;
      if (S.saker.length < tak) nySak();
    }
  }

  /* ---------- input ----------------------------------------------------- */
  const TANGENTER = {
    ArrowUp: 'upp', ArrowDown: 'ner', ArrowLeft: 'vanster', ArrowRight: 'hoger',
    w: 'upp', s: 'ner', a: 'vanster', d: 'hoger',
    W: 'upp', S: 'ner', A: 'vanster', D: 'hoger',
  };

  document.addEventListener('keydown', (e) => {
    if (TANGENTER[e.key] && S.lage === 'spel') {
      S.marre.riktning = TANGENTER[e.key];
      S.stig = [];
      e.preventDefault();
    }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') växlaPaus();
  });

  document.addEventListener('keyup', (e) => {
    // Släpper man tangenten stannar Marre – annars går hon i väggen.
    if (TANGENTER[e.key] && S.marre.riktning === TANGENTER[e.key]) S.marre.riktning = null;
  });

  /* ---------- tumstyrning (Roblox-principen) ---------------------------- */
  // Tummen sätts var som helst på planen: spaken dyker upp under den och Marre
  // går åt det håll tummen pekar. Lyfter man tummen stannar hon. En kort tryck
  // utan dragning betyder "gå dit" och Marre hittar vägen själv.
  const DÖDZON = 12;      // px innan spaken reagerar
  const TRYCK_MS = 260;   // kortare tryck = peka-dit

  let haller = null;      // { id, x0, y0, tid, rort }

  function visaSpak(x, y) {
    el.styrspak.style.left = x + 'px';
    el.styrspak.style.top = y + 'px';
    el.styrspak.style.setProperty('--kx', '0px');
    el.styrspak.style.setProperty('--ky', '0px');
    el.styrspak.classList.remove('vinkar');
    el.styrspak.classList.add('syns');
  }

  function visaVink() {
    // Visar var tummen kan sättas: mitt på planen, strax under mitten.
    const r = duk.getBoundingClientRect();
    const s = el.styrspak.parentElement.getBoundingClientRect();
    el.styrspak.style.left = (r.left - s.left + r.width / 2) + 'px';
    el.styrspak.style.top = (r.top - s.top + r.height * 0.68) + 'px';
    el.styrspak.style.setProperty('--kx', '0px');
    el.styrspak.style.setProperty('--ky', '0px');
    el.styrspak.classList.add('vinkar', 'syns');
  }

  function rutaVid(clientX, clientY) {
    const r = duk.getBoundingClientRect();
    if (!ruta) return null;
    const x = Math.floor((clientX - r.left) / ruta);
    const y = Math.floor((clientY - r.top) / ruta);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    return { x, y };
  }

  duk.addEventListener('pointerdown', (e) => {
    if (S.lage !== 'spel') return;
    e.preventDefault();
    haller = { id: e.pointerId, x0: e.clientX, y0: e.clientY, tid: performance.now(), rort: false };
    S.stig = [];
    if (duk.setPointerCapture) duk.setPointerCapture(e.pointerId);
    visaSpak(e.clientX, e.clientY);
  });

  duk.addEventListener('pointermove', (e) => {
    if (!haller || e.pointerId !== haller.id || S.lage !== 'spel') return;
    e.preventDefault();
    const dx = e.clientX - haller.x0;
    const dy = e.clientY - haller.y0;
    const avst = Math.hypot(dx, dy);
    if (avst < DÖDZON) {
      S.marre.riktning = null;
      el.styrspak.style.setProperty('--kx', '0px');
      el.styrspak.style.setProperty('--ky', '0px');
      return;
    }
    haller.rort = haller.rort || avst > DÖDZON * 2;
    // Kulan följer tummen, men bara en bit – spaken ska kännas, inte slira.
    const m = Math.min(avst, 46);
    el.styrspak.style.setProperty('--kx', (dx / avst) * m + 'px');
    el.styrspak.style.setProperty('--ky', (dy / avst) * m + 'px');
    const riktning = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'hoger' : 'vanster')
      : (dy > 0 ? 'ner' : 'upp');
    if (S.marre.riktning !== riktning) {
      S.marre.riktning = riktning;
      sistMarre = performance.now(); // första steget direkt, inte efter 118 ms
      flyttaMarre();
    }
  });

  function släpp(e) {
    if (!haller || (e && e.pointerId !== haller.id)) return;
    const kortTryck = !haller.rort && performance.now() - haller.tid < TRYCK_MS;
    const start = haller;
    haller = null;
    S.marre.riktning = null;
    el.styrspak.classList.remove('syns', 'vinkar');
    if (kortTryck && S.lage === 'spel') {
      const r = rutaVid(e.clientX, e.clientY);
      if (r) gaTillRuta(r.x, r.y);
    }
  }

  duk.addEventListener('pointerup', släpp);
  duk.addEventListener('pointercancel', släpp);
  duk.addEventListener('pointerleave', släpp);
  duk.addEventListener('contextmenu', (e) => e.preventDefault());

  function växlaPaus() {
    if (S.lage === 'spel') {
      S.lage = 'paus';
      el.paus.hidden = false;
      el.paus.querySelector('[data-fortsatt]').focus();
    } else if (S.lage === 'paus') {
      S.lage = 'spel';
      el.paus.hidden = true;
      duk.focus();
    }
  }

  el.paus.querySelector('[data-fortsatt]').addEventListener('click', växlaPaus);

  el.ljud.addEventListener('click', () => {
    S.ljud = !S.ljud;
    el.ljud.setAttribute('aria-pressed', String(S.ljud));
    el.ljud.dataset.lage = S.ljud ? 'pa' : 'av';
    el.ljud.querySelector('[data-ikon]').textContent = S.ljud ? '♪' : '✕';
    if (S.ljud) ljud.plock();
  });

  el.rost.addEventListener('click', () => {
    S.rost = !S.rost;
    el.rost.setAttribute('aria-pressed', String(S.rost));
    el.rost.dataset.lage = S.rost ? 'pa' : 'av';
    el.rost.querySelector('[data-ikon]').textContent = S.rost ? '🗣' : '✕';
    if (!S.rost && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  });

  el.klart.querySelector('[data-nasta]').addEventListener('click', (e) => {
    el.klart.hidden = true;
    const igen = e.currentTarget.dataset.igen === '1';
    S.poang = 0;
    startaNiva(igen ? 0 : Math.min(S.niva + 1, NIVÅER.length - 1));
  });

  /* ---------- start ----------------------------------------------------- */
  window.addEventListener('resize', storlek);
  if (window.ResizeObserver) new ResizeObserver(storlek).observe(scen);

  document.addEventListener('startskarm:spela', () => {
    storlek();
    if (S.lage === 'vantar') startaNiva(0);
  });

  function starta() {
    storlek();
    if (S.lage === 'vantar' && !document.getElementById('startskarm')) startaNiva(0);
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') starta();
  else window.addEventListener('load', starta);

  // för felsökning i konsolen
  window.__marre = { S, startaNiva, flyttaMarre, stegTill, gaTillRuta, stegFroken, KARTA, vag };
})();