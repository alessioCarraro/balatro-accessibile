# La tua formazione

Un roguelike di carte a tema calcistico: costruisci combinazioni di poker, supera tre partite e rinforza la squadra al calciomercato. L'interfaccia e' in italiano ed e' progettata per essere utilizzabile con mouse, touch e tastiera.

## Tecnologie e scelte

- **React 18** gestisce l'interfaccia a componenti e gli aggiornamenti di stato. Il reducer mantiene le regole della partita in un unico punto.
- **TypeScript** descrive carte, Jolly, fasi e azioni, aiutando a individuare errori durante lo sviluppo.
- **Vite** fornisce un server di sviluppo rapido e produce asset statici per la distribuzione, senza introdurre un meta-framework non necessario per questa applicazione.
- **API native del browser**: `localStorage` salva la partita; manifest e service worker abilitano installazione e cache offline senza dipendenze aggiuntive.
- **CSS** realizza layout responsive e stati di accessibilita' senza un framework grafico esterno.

Le dipendenze runtime sono React e React DOM; gli strumenti di sviluppo sono Vite, TypeScript ed ESLint. I dettagli sono in [package.json](./package.json).

## Avvio e verifiche

Richiede Node.js e npm.

```sh
npm install
npm run dev
```

Il server di sviluppo mostra l'indirizzo locale da aprire nel browser. Per creare e verificare la build di produzione:

```sh
npm run build
npm run lint
npm run preview
```

## Regole

Il mazzo contiene 52 carte: 13 valori per ciascuno dei quattro ruoli — **Portieri, Difensori, Centrocampisti e Attaccanti**. All'inizio di ogni partita il giocatore riceve 8 carte e puo' selezionarne da 1 a 5.

La selezione aggiorna l'anteprima della combinazione e del punteggio: `(fiches della combinazione + valore delle carte + bonus Jolly) × moltiplicatore`. Una vittoria assegna 4 crediti; tra le partite si apre una schermata di calciomercato per acquistare Jolly che influenzano le mani successive. Per le regole complete, vedere [docs/regole.md](./docs/regole.md).

## Accessibilita'

### Comandi da tastiera

| Tasto | Azione |
|---|---|
| `1`–`8` | Seleziona o deseleziona la carta numerata; l'ordine segue l'ordinamento scelto |
| Frecce | Sposta il focus tra le carte; nella guida sposta il focus tra “Chiudi” e “Ho capito” |
| `Spazio` | Seleziona o deseleziona la carta evidenziata |
| `P` | Gioca le carte selezionate |
| `S` | Scarta le carte selezionate |
| `1`–`3` nel calciomercato | Acquista l'offerta numerata |
| `↑` / `↓` nel calciomercato | Sposta il focus tra i Jolly acquistabili |
| `N` | Inizia un nuovo campionato |
| `?` | Apre la guida dei comandi |
| `Esc` | Chiude la guida e ripristina il focus precedente |

I pulsanti della pagina sono raggiungibili anche con `Tab` e si attivano con `Invio` o `Spazio`. Le carte comunicano nome, ruolo e stato di selezione; anteprima, stato della selezione, risultati e messaggi del gioco sono esposti tramite semantica e regioni live. Sono presenti indicatori di focus, target tattili ampi, adattamento alle aree sicure dei dispositivi mobili, supporto a `prefers-reduced-motion` e ai colori forzati del sistema. Le schermate di vittoria e sconfitta riepilogano punteggio, obiettivo e partita.

### Fonti di riferimento

Questi riferimenti ufficiali sono stati consultati per le scelte di tastiera, focus, dialoghi, movimento ridotto e supporto offline:

- [WCAG 2.2 — W3C Recommendation](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Authoring Practices: Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [WAI-ARIA Authoring Practices: Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [MDN: `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

Le fonti guidano l'implementazione, ma non costituiscono una certificazione di conformita'. Build e lint non sostituiscono test con lettori di schermo, controlli manuali di contrasto o audit automatici.

## PWA e distribuzione

La PWA e' definita da [public/manifest.webmanifest](./public/manifest.webmanifest) e [public/sw.js](./public/sw.js). In una build non di sviluppo, il service worker precarica l'app shell e gli asset generati e usa la cache per le richieste successive e il caricamento offline. L'uso offline dipende da una prima visita completata con rete disponibile. Il service worker non viene registrato dal server di sviluppo; per provarlo usare una build di produzione servita da localhost o da un'origine HTTPS. Per una nuova versione, aggiornare `CACHE_NAME` nel service worker.

## Diario dello sviluppo assistito

Il feedback e le prove manuali hanno fatto emergere lacune che la prima implementazione non copriva:

| Limite iniziale | Come e' emerso | Correzione |
|---|---|---|
| La prima griglia delle carte era troppo compressa su alcune larghezze e le frecce non seguivano sempre la disposizione a righe. | Prova della pagina a larghezze mobile e tablet e verifica da tastiera. | Breakpoint responsive per la mano, etichette che possono andare a capo e spostamento del focus basato sulle colonne effettive della griglia. |
| Nella schermata di mercato i Jolly non avevano un comando rapido esplicito; il solo percorso di focus non rendeva chiara la selezione delle offerte. | Segnalazione durante la verifica da tastiera. | Numeri sulle offerte, `1`–`3` per acquistare e frecce su/giu' tra i pulsanti acquistabili; comandi aggiunti alla guida. |
| “Nuovo campionato” e “Scopri i comandi” erano pulsanti raggiungibili con Tab, ma le scorciatoie non erano visibili in quella sezione. | Segnalazione e prova manuale della navigazione della pagina. | Indicazioni visibili `N` e `?`; entrambi i pulsanti mantengono attivazione nativa da tastiera. |
| Nella guida, Tab gestiva il focus, ma le frecce non permettevano di raggiungere “Ho capito”. | Segnalazione durante l'uso della finestra di guida. | Frecce su/giu' e destra/sinistra spostano il focus tra “Chiudi” e “Ho capito”; Tab continua a funzionare. |

Le correzioni sono state provate con verifiche mirate nel browser e con `npm run build` e `npm run lint`. Non e' stato eseguito un audit completo WCAG, Lighthouse o axe, ne' un collaudo formale con tecnologie assistive; tali verifiche restano da fare prima di dichiarare conformita'.
