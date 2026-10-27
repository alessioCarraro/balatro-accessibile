# La tua formazione

Un roguelike di carte a tema calcistico: costruisci combinazioni di poker, supera tre partite e rinforza la squadra al calciomercato.

## Stack

- React **18** con TypeScript
- Vite per sviluppo, compilazione e anteprima
- Nessun Angular, Next.js o altro meta-framework
- API browser native per salvataggio e supporto PWA

## Avvio

```sh
npm install
npm run dev
npm run build
npm run lint
```

## Regole

Il mazzo contiene 52 carte: 13 valori per ciascuno dei quattro ruoli — **Portieri, Difensori, Centrocampisti e Attaccanti**. All'inizio di ogni partita il giocatore riceve 8 carte e puo' selezionarne da 1 a 5.

La selezione aggiorna immediatamente l'anteprima della combinazione e del punteggio: `(fiches della combinazione + valore delle carte + bonus Jolly) × moltiplicatore`. Una vittoria assegna 4 crediti; tra le partite si apre una schermata dedicata al calciomercato per acquistare Jolly che influenzano le mani successive. Le regole dettagliate sono in [docs/regole.md](./docs/regole.md).

## Accessibilita'

Il gioco e' utilizzabile da tastiera: `N` inizia un nuovo campionato anche dalla schermata di vittoria o sconfitta; durante la partita i tasti da `1` a `8` selezionano o deselezionano la carta numerata e le frecce spostano il focus; nel calciomercato i tasti da `1` a `3` acquistano l'offerta numerata e le frecce su/giu' spostano il focus tra i Jolly. Spazio seleziona la carta evidenziata, `P` gioca, `S` scarta, `?` apre la guida ed `Esc` la chiude. Vittoria e sconfitta mostrano il riepilogo di punteggio e obiettivo. I controlli mantengono indicatori di focus visibili e target tattili ampi; l'anteprima, il punteggio e gli acquisti vengono annunciati da regioni live. Il layout si adatta a telefoni e tablet, supporta le aree sicure dei dispositivi mobili e rispetta `prefers-reduced-motion` e i colori a contrasto elevato del sistema.

## PWA

La build Vite produce gli asset statici; il service worker in `public/sw.js` precarica l'app shell e supporta il caricamento offline. Per una nuova versione, incrementare `CACHE_NAME` nel service worker.

## Diario del progetto

- Il progetto e' realizzato esclusivamente con React 18, Vite e TypeScript.
- I semi francesi sono sostituiti dai ruoli calcistici, mentre le combinazioni e il calcolo del punteggio seguono le regole del poker.
- Il mercato e' una schermata di transizione tra le partite e consente di acquistare Jolly con i crediti disponibili.
- L'anteprima usa la stessa funzione di calcolo della giocata, cosi' combinazione e punti attesi sono visibili prima di giocare.

Il progetto va verificato anche con test manuali da tastiera, a dimensioni mobile e con tecnologie assistive: build e lint non sostituiscono le verifiche di accessibilita'.
