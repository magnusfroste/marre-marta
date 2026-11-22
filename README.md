# Marre & Marta – städjakten

Spel för barn 4–8 år. Marre är på förskolan och måste plocka undan innan fröken
Marta ringer föräldrarna. Sakerna ska samlas i den ordning receptet visar – då
ringer jultomten och nissarna bygger en julklapp av det Marre hittat. Fler
fröknar dyker upp på varje nivå.

Live: https://marre-marta.shipholm.dev/ (shipholm), kort i katalogen på
https://www.skolappar.com/.

## Så hänger filerna ihop

* `public/app.js` – spelplan 13×9 rutor i canvas, fröknarnas rundor med BFS,
  städtakt (oredamätaren), recept och julklappar, WebAudio-ljud och svensk
  talsyntes.
* `public/styles.css` – HUD, receptrad, kontroller, samtal- och klarrutor. Allt
  ryms på iPad i landskap utan sidscroll.
* `public/index.html` – SEO, Open Graph, JSON-LD och startskärm (genereras av
  `skolappar-port/start_screen.py`).
* `public/` i övrigt – ikoner (ritade av `bygg_ikoner.py`), Fredoka-typsnitt,
  manifest, robots, sitemap, `kort.png` (1200×900 till katalogen) och `og.png`.
* `Dockerfile` + `deploy/nginx.conf` – statisk sajt: `public/` kopieras rakt in i
  nginx. **index.html måste ligga i `public/`** – kopierar man bara `public/`
  in i `/usr/share/nginx/html` utan att `index.html` följer med blir det kvar
  nginx egen välkomstsida.

## Utveckla lokalt

```bash
cd public && python3 -m http.server 8420   # allt serveras från public/ direkt
```

## Publicera

```bash
git add -A && git commit -m "..." && git push
python3 ../skolappar-port/rebuild_until.py marre-marta   # väntar på built_sha == HEAD
```

Tack till Magnus Froste. Gratis, ingen inloggning, ingen reklam, inga
tredjepartsanrop – ingen data lämnar webbläsaren.