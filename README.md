# Marre & Marta – städjakten

Spel för barn 4–8 år. Marre är på förskolan och måste plocka undan innan fröken
Marta ringer föräldrarna. Sakerna ska samlas i den ordning receptet visar – då
ringer jultomten och nissarna bygger en julklapp av det Marre hittat. Fler
fröknar dyker upp på varje nivå.

* `app.js` – spelplan 13×9 rutor i canvas, fröknarnas rundor med BFS, städtakt
  (oredamätaren), recept och julklappar, WebAudio-ljud och svensk talsyntes.
* `styles.css` – HUD, receptrad, kontroller, samtal- och klarrutor. Allt ryms på
  iPad i landskap utan sidscroll.
* `index.html` – SEO, Open Graph, JSON-LD och startskärm (genereras av
  `skolappar-port/start_screen.py`).
* `public/` – ikoner (ritade av `bygg_ikoner.py`), Fredoka-typsnitt, manifest,
  robots och sitemap.

Tack till Magnus Froste. Gratis, ingen inloggning, ingen reklam, inga
tredjepartsanrop – ingen data lämnar webbläsaren.
