import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  cardLabel,
  createNewGame,
  gameReducer,
  JOKER_CATALOG,
  ROUND_TARGETS,
  rankName,
  scoreHand,
  SUITS,
  type Card,
  type GameState,
  type Joker,
  type Suit,
} from './game/game'
import './App.css'

const SAVE_KEY = 'la-tua-formazione-save-v2'

const ROLE_SYMBOLS: Record<Suit, string> = {
  Portieri: '🧤',
  Difensori: '🛡',
  Centrocampisti: '◈',
  Attaccanti: '⚽',
}

const ROLE_CLASSES: Record<Suit, string> = {
  Portieri: 'role-goalkeeper',
  Difensori: 'role-defender',
  Centrocampisti: 'role-midfielder',
  Attaccanti: 'role-forward',
}

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== 'object') return false
  const card = value as Partial<Card>
  return (
    typeof card.id === 'string' &&
    typeof card.rank === 'number' &&
    Number.isInteger(card.rank) &&
    card.rank >= 2 &&
    card.rank <= 14 &&
    SUITS.some((suit) => suit === card.suit)
  )
}

function isJoker(value: unknown): value is Joker {
  if (!value || typeof value !== 'object') return false
  const joker = value as Partial<Joker>
  return (
    typeof joker.id === 'string' &&
    typeof joker.name === 'string' &&
    typeof joker.description === 'string' &&
    typeof joker.price === 'number' &&
    ['always', 'straight', 'group', 'flush'].includes(joker.effect ?? '')
  )
}

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false
  const game = value as Partial<GameState>
  return (
    Array.isArray(game.deck) &&
    game.deck.every(isCard) &&
    Array.isArray(game.discardPile) &&
    game.discardPile.every(isCard) &&
    Array.isArray(game.hand) &&
    game.hand.length <= 8 &&
    game.hand.every(isCard) &&
    Array.isArray(game.jokers) &&
    game.jokers.every(isJoker) &&
    Array.isArray(game.shop) &&
    game.shop.every(isJoker) &&
    [1, 2, 3].includes(game.round ?? 0) &&
    typeof game.score === 'number' &&
    Number.isFinite(game.score) &&
    typeof game.handsLeft === 'number' &&
    typeof game.discardsLeft === 'number' &&
    typeof game.money === 'number' &&
    ['playing', 'shop', 'won', 'lost'].includes(game.phase ?? '') &&
    typeof game.message === 'string'
  )
}

function readSavedGame(): { game: GameState; error: string } {
  try {
    const saved = localStorage.getItem(SAVE_KEY)
    if (!saved) return { game: createNewGame(), error: '' }
    const parsed: unknown = JSON.parse(saved)
    if (!isGameState(parsed)) throw new Error('Formato del salvataggio non valido.')
    const currentJoker = (joker: Joker) =>
      JOKER_CATALOG.find((item) => item.id === joker.id) ?? joker
    return {
      game: {
        ...parsed,
        jokers: parsed.jokers.map(currentJoker),
        shop: parsed.shop.map(currentJoker),
      },
      error: '',
    }
  } catch (error) {
    console.error('Impossibile ripristinare la partita salvata:', error)
    return {
      game: createNewGame(),
      error: 'Salvataggio non disponibile: è iniziata una nuova partita.',
    }
  }
}

function App() {
  const [initialSave] = useState(readSavedGame)
  const [game, dispatch] = useReducer(gameReducer, initialSave.game)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectionMessage, setSelectionMessage] = useState('')
  const [sortMode, setSortMode] = useState<'rank' | 'suit'>('rank')
  const [helpOpen, setHelpOpen] = useState(false)
  const [storageMessage, setStorageMessage] = useState(initialSave.error)
  const [pwaMessage, setPwaMessage] = useState('')
  const firstCardRef = useRef<HTMLButtonElement>(null)
  const firstJokerRef = useRef<HTMLButtonElement>(null)
  const helpCloseRef = useRef<HTMLButtonElement>(null)
  const helpDoneRef = useRef<HTMLButtonElement>(null)
  const previousGameRef = useRef<GameState | null>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const storageWarningRef = useRef(Boolean(initialSave.error))

  const sortedHand = useMemo(() => {
    return [...game.hand].sort((a, b) =>
      sortMode === 'rank'
        ? a.rank - b.rank || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
        : SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || a.rank - b.rank,
    )
  }, [game.hand, sortMode])

  const selectedCards = useMemo(
    () => game.hand.filter((card) => selectedIds.includes(card.id)),
    [game.hand, selectedIds],
  )
  const preview = useMemo(
    () => (selectedCards.length ? scoreHand(selectedCards, game.jokers) : null),
    [selectedCards, game.jokers],
  )
  const target = ROUND_TARGETS[game.round - 1] ?? ROUND_TARGETS[0]
  const progress = Math.min(100, (game.score / target) * 100)
  const firstBuyableJokerId = game.shop.find(canBuy)?.id

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(game))
      if (storageWarningRef.current) {
        storageWarningRef.current = false
        window.setTimeout(() => setStorageMessage(''), 0)
      }
    } catch (error) {
      console.error('Impossibile salvare la partita:', error)
      if (!storageWarningRef.current) {
        storageWarningRef.current = true
        window.setTimeout(
          () => setStorageMessage('Salvataggio non disponibile in questo browser.'),
          0,
        )
      }
    }
  }, [game])

  useEffect(() => {
    if ('serviceWorker' in navigator && !import.meta.env.DEV) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => setPwaMessage('Pronta per essere usata offline.'))
        .catch((error: unknown) => {
          console.error('Impossibile registrare il service worker:', error)
          setPwaMessage('Modalità offline non disponibile.')
        })
    }
  }, [])

  useEffect(() => {
    const previousGame = previousGameRef.current
    previousGameRef.current = game
    if (!previousGame) return

    requestAnimationFrame(() => {
      if (game.phase === 'shop') {
        const fallback = document.querySelector<HTMLButtonElement>(
          '.market-screen .continue-button',
        )
        const firstOffer = firstJokerRef.current
        ;(firstOffer && !firstOffer.disabled ? firstOffer : fallback)?.focus()
      } else if (game.phase === 'playing') {
        firstCardRef.current?.focus()
      } else {
        document
          .querySelector<HTMLButtonElement>('.end-panel .restart-button')
          ?.focus()
      }
    })
  }, [game])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (helpOpen) {
        if (event.key === 'Escape') {
          event.preventDefault()
          closeHelp()
        }
        return
      }
      const active = event.target
      const typing =
        active instanceof HTMLElement &&
        (active.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName))
      if (typing || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === '?') {
        event.preventDefault()
        openHelp()
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        startNewGame()
      } else if (/^[1-8]$/.test(event.key) && game.phase === 'playing') {
        const index = Number(event.key) - 1
        const card = sortedHand[index]
        if (card) {
          event.preventDefault()
          document.querySelectorAll<HTMLButtonElement>('.playing-card')[index]?.focus()
          toggleCard(card.id)
        }
      } else if (/^[1-3]$/.test(event.key) && game.phase === 'shop') {
        const index = Number(event.key) - 1
        const joker = game.shop[index]
        if (joker) {
          event.preventDefault()
          document
            .querySelectorAll<HTMLButtonElement>('.market-main .buy-button')[index]
            ?.focus()
          if (canBuy(joker)) dispatch({ type: 'buy', jokerId: joker.id })
        }
      } else if (event.key.toLowerCase() === 'p') {
        event.preventDefault()
        playSelected()
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        discardSelected()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function formatScore(score: number): string {
    return score.toLocaleString('it-IT')
  }

  function toggleCard(cardId: string): void {
    setSelectionMessage('')
    if (selectedIds.includes(cardId)) {
      setSelectedIds(selectedIds.filter((id) => id !== cardId))
    } else if (selectedIds.length >= 5) {
      setSelectionMessage('Puoi selezionare al massimo cinque carte.')
    } else {
      setSelectedIds([...selectedIds, cardId])
    }
  }

  function playSelected(): void {
    if (game.phase !== 'playing' || selectedIds.length === 0) return
    dispatch({ type: 'play', selectedIds })
    setSelectedIds([])
  }

  function discardSelected(): void {
    if (game.phase !== 'playing' || selectedIds.length === 0) return
    dispatch({ type: 'discard', selectedIds })
    setSelectedIds([])
  }

  function onCardKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      return
    }
    const cardGrid = event.currentTarget.parentElement
    if (!cardGrid) return

    const columnCount = getComputedStyle(cardGrid).gridTemplateColumns
      .trim()
      .split(/\s+/).length
    const column = index % columnCount
    let nextIndex = index

    if (event.key === 'ArrowLeft' && column > 0) nextIndex -= 1
    if (
      event.key === 'ArrowRight' &&
      column < columnCount - 1 &&
      index < sortedHand.length - 1
    ) {
      nextIndex += 1
    }
    if (event.key === 'ArrowUp') nextIndex = Math.max(0, index - columnCount)
    if (event.key === 'ArrowDown') {
      nextIndex = Math.min(sortedHand.length - 1, index + columnCount)
    }

    event.preventDefault()
    requestAnimationFrame(() => {
      const nextCard =
        cardGrid.querySelectorAll<HTMLButtonElement>('.playing-card')[nextIndex]
      nextCard?.focus()
    })
  }

  function onJokerKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.market-main .buy-button:not(:disabled)',
      ),
    )
    if (buttons.length < 2) return

    const currentIndex = buttons.indexOf(event.currentTarget)
    if (currentIndex === -1) return
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex = (currentIndex + direction + buttons.length) % buttons.length
    event.preventDefault()
    buttons[nextIndex]?.focus()
  }

  function openHelp(): void {
    lastFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setHelpOpen(true)
    requestAnimationFrame(() => helpCloseRef.current?.focus())
  }

  function closeHelp(): void {
    setHelpOpen(false)
    requestAnimationFrame(() => lastFocusedRef.current?.focus())
  }

  function trapDialogFocus(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const arrowDirection =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0
    if (event.key !== 'Tab' && !arrowDirection) return
    const buttons = [helpCloseRef.current, helpDoneRef.current].filter(
      (button): button is HTMLButtonElement => button !== null,
    )
    if (!buttons.length) return
    const currentIndex = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    )
    if (currentIndex === -1) return
    if (event.key === 'Tab' && !event.shiftKey && currentIndex < buttons.length - 1) {
      return
    }
    if (event.key === 'Tab' && event.shiftKey && currentIndex > 0) return
    const nextIndex =
      (currentIndex +
        (arrowDirection || (event.shiftKey ? -1 : 1)) +
        buttons.length) %
      buttons.length
    event.preventDefault()
    buttons[nextIndex]?.focus()
  }

  function canBuy(joker: Joker): boolean {
    return game.money >= joker.price && game.jokers.length < 5
  }

  function startNewGame(): void {
    dispatch({ type: 'new-game' })
    setSelectedIds([])
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#main-content"
          aria-label="La tua formazione, vai al gioco"
        >
          <span className="brand-mark" aria-hidden="true">⚽</span>
          <span>LA TUA <strong>FORMAZIONE</strong></span>
        </a>
        <p className="tagline">Il campionato si gioca carta dopo carta</p>
        <button
          className="help-button"
          type="button"
          aria-haspopup="dialog"
          onClick={openHelp}
        >
          <span aria-hidden="true">?</span>
          <span className="help-label">Comandi</span>
          <kbd aria-hidden="true">?</kbd>
        </button>
      </header>

      {game.phase === 'shop' ? (
        <main className="market-screen" id="main-content" aria-labelledby="market-title">
          <p className="visually-hidden" aria-live="polite" aria-atomic="true">
            {game.message}
          </p>
          <div className="market-layout">
            <section className="market-main">
              <div className="market-overline">
                <span className="eyebrow">CALCIOMERCATO · DOPO LA PARTITA {game.round}</span>
                <span className="market-whistle" aria-hidden="true">◉</span>
              </div>
              <div className="market-heading">
                <div>
                  <p className="eyebrow">INTERVALLO, MISTER.</p>
                  <h1 id="market-title">Rinforza la formazione</h1>
                  <p className="market-subtitle">
                    La vittoria ti premia con 4 crediti. Scegli un Jolly prima del prossimo fischio d’inizio.
                  </p>
                </div>
                <div className="shop-wallet" aria-label={`${game.money} crediti disponibili`}>
                  <span aria-hidden="true">✦</span>
                  <strong>{game.money}</strong>
                  <span>crediti</span>
                </div>
              </div>

              <div className="market-summary">
                <span className="summary-whistle" aria-hidden="true">✓</span>
                <span>
                  <strong>PARTITA CONQUISTATA</strong>
                  <span>+4 crediti aggiunti al tuo budget</span>
                </span>
                <span className="summary-score">
                  {formatScore(game.score)}<small>punti</small>
                </span>
              </div>

              <section className="market-offers" aria-labelledby="offers-title">
                <div className="market-section-heading">
                  <div>
                    <p className="eyebrow">IL TUO COLPO DI MERCATO</p>
                    <h2 id="offers-title">Jolly in vendita</h2>
                  </div>
                  <span className="joker-counter">{game.jokers.length}/5 in formazione</span>
                </div>
                <div className="joker-list">
                  {game.shop.length ? game.shop.map((joker, index) => (
                    <article className="joker-card" key={joker.id}>
                      <span className="joker-glyph" aria-hidden="true">⚽</span>
                      <div className="joker-details">
                        <h3>{joker.name}</h3>
                        <p>{joker.description}</p>
                      </div>
                      <button
                        className="buy-button"
                        ref={firstBuyableJokerId === joker.id ? firstJokerRef : undefined}
                        type="button"
                        disabled={!canBuy(joker)}
                        aria-label={`Offerta ${index + 1}, tasto ${index + 1}. Acquista ${joker.name} per ${joker.price} crediti${!canBuy(joker) && game.jokers.length >= 5 ? ', panchina completa' : !canBuy(joker) ? ', crediti insufficienti' : ''}`}
                        onKeyDown={onJokerKeyDown}
                        onClick={() => dispatch({ type: 'buy', jokerId: joker.id })}
                      >
                        <span className="joker-shortcut" aria-hidden="true">{index + 1}</span>
                        <span aria-hidden="true">✦</span> {joker.price}
                      </button>
                    </article>
                  )) : <p className="market-empty">Hai già acquistato tutte le offerte disponibili.</p>}
                </div>
                {game.jokers.length >= 5 ? (
                  <p className="market-hint">La panchina è completa: hai già cinque Jolly in squadra.</p>
                ) : (
                  <p className="market-hint">Acquista con i crediti a disposizione. I Jolly restano attivi per tutto il campionato.</p>
                )}
                {game.shop.length > 0 && (
                  <p className="market-keyboard-hint">
                    Tastiera: <kbd>1</kbd>–<kbd>{game.shop.length}</kbd> acquista l’offerta numerata; usa <kbd>↑</kbd> e <kbd>↓</kbd> per passare tra i Jolly disponibili.
                  </p>
                )}
                <button
                  className="primary-action continue-button"
                  type="button"
                  onClick={() => dispatch({ type: 'continue' })}
                >
                  <span>Scendi in campo — partita {game.round + 1}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </section>
            </section>
            <aside className="market-sidebar" aria-label="La tua panchina">
              <section className="side-card market-team-card">
                <div className="side-card-heading">
                  <span className="side-icon" aria-hidden="true">⚽</span>
                  <h2>La tua panchina</h2>
                  <span className="joker-counter">{game.jokers.length}/5</span>
                </div>
                {game.jokers.length ? (
                  <ul className="owned-jokers">
                    {game.jokers.map((joker) => (
                      <li key={joker.id}>
                        <span aria-hidden="true">✦</span>
                        <div><strong>{joker.name}</strong><small>{joker.description}</small></div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-jokers">Ancora nessun Jolly. Questo è il momento giusto per rinforzare la squadra.</p>
                )}
              </section>
              <section className="match-reminder">
                <span aria-hidden="true">◷</span>
                <p>
                  <strong>PROSSIMA PARTITA</strong>
                  <span>Obiettivo: {game.round + 1 === 2 ? '600' : '1.000'} punti</span>
                </p>
              </section>
              <button type="button" className="text-button market-new-game" onClick={startNewGame}>
                ↻ Ricomincia il campionato
              </button>
            </aside>
          </div>
        </main>
      ) : (
        <main className="layout" id="main-content">
          <section className="game-panel" aria-labelledby={game.phase === 'playing' ? 'game-title' : 'end-title'}>
            {game.phase === 'playing' ? (
              <>
                <div className="game-heading">
                  <div>
                    <p className="eyebrow">IL TUO TAVOLO DA MISTER</p>
                    <h1 id="game-title">La tua formazione</h1>
                  </div>
                  <div className="round-badge">
                    <span>PARTITA</span>
                    <strong>{game.round}<span className="round-divider">/</span>3</strong>
                  </div>
                </div>

                <div className="scoreboard" aria-label={`Punteggio partita ${game.round}`}>
                  <div className="score-numbers">
                    <div><span className="metric-label">PUNTEGGIO</span><strong className="score-value">{formatScore(game.score)}</strong></div>
                    <div className="target-number"><span className="metric-label">OBIETTIVO</span><strong>{formatScore(target)}</strong></div>
                  </div>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label="Avanzamento verso l’obiettivo della partita"
                    aria-valuemin={0}
                    aria-valuemax={target}
                    aria-valuenow={Math.min(game.score, target)}
                    aria-valuetext={`${formatScore(game.score)} punti su ${formatScore(target)}`}
                  >
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="round-resources">
                    <span><i className="resource-dot dot-hands" aria-hidden="true" /> Mani <strong>{game.handsLeft}</strong></span>
                    <span><i className="resource-dot dot-discards" aria-hidden="true" /> Scarti <strong>{game.discardsLeft}</strong></span>
                    <span><i className="resource-dot dot-money" aria-hidden="true">✦</i> Crediti <strong>{game.money}</strong></span>
                  </div>
                </div>

                <section className="hand-section" aria-labelledby="hand-title">
                  <div className="section-heading">
                    <div>
                      <h2 id="hand-title">La tua mano</h2>
                      <p>Seleziona da 1 a 5 carte · {game.hand.length} carte in mano</p>
                    </div>
                    <div className="sort-controls" role="group" aria-label="Ordina le carte">
                      <button className={`sort-button ${sortMode === 'rank' ? 'active' : ''}`} type="button" aria-pressed={sortMode === 'rank'} onClick={() => setSortMode('rank')}>Valore</button>
                      <button className={`sort-button ${sortMode === 'suit' ? 'active' : ''}`} type="button" aria-pressed={sortMode === 'suit'} onClick={() => setSortMode('suit')}>Ruolo</button>
                    </div>
                  </div>
                  <div className="card-hand" role="group" aria-label="Carte in formazione">
                    {sortedHand.map((card, index) => (
                      <button
                        className={`playing-card ${ROLE_CLASSES[card.suit]} ${selectedIds.includes(card.id) ? 'selected' : ''}`}
                        key={card.id}
                        ref={index === 0 ? firstCardRef : undefined}
                        type="button"
                        aria-pressed={selectedIds.includes(card.id)}
                        aria-label={`Carta ${index + 1}, tasto ${index + 1}: ${cardLabel(card)}${selectedIds.includes(card.id) ? ', selezionata' : ''}`}
                        onClick={() => toggleCard(card.id)}
                        onKeyDown={(event) => onCardKeyDown(event, index)}
                      >
                        <span className="card-rank">{rankName(card.rank)}</span>
                        <span className="card-suit" aria-hidden="true">{ROLE_SYMBOLS[card.suit]}</span>
                        <span className="card-suit-name">{card.suit}</span>
                        <span className="card-shortcut" aria-hidden="true">{index + 1}</span>
                        <span className="card-corner" aria-hidden="true">{ROLE_SYMBOLS[card.suit]}</span>
                      </button>
                    ))}
                  </div>
                  <p className="selection-status" aria-live="polite">
                    {selectionMessage || `${selectedIds.length} carte selezionate su 5.`}
                  </p>

                  <div className={`preview-panel ${preview ? '' : 'preview-empty'}`} aria-live="polite" aria-atomic="true" aria-label="Anteprima del punteggio">
                    {preview ? (
                      <>
                        <span className="preview-whistle" aria-hidden="true">⚽</span>
                        <span className="preview-copy">
                          <strong>{preview.category}</strong>
                          <span className="preview-equation">
                            {preview.baseChips} fiches combinazione + {preview.cardValues} valore carte + {preview.bonusChips} bonus Jolly = {preview.chips} fiches × ({preview.baseMultiplier} moltiplicatore + {preview.bonusMultiplier} bonus Jolly)
                          </span>
                        </span>
                        <strong className="preview-points">= {formatScore(preview.points)}<small>punti attesi</small></strong>
                      </>
                    ) : (
                      <>
                        <span className="preview-whistle" aria-hidden="true">◎</span>
                        <span className="preview-copy">
                          <strong>Anteprima punteggio</strong>
                          <span className="preview-equation">Seleziona una o più carte per vedere combinazione e calcolo prima di giocare.</span>
                        </span>
                      </>
                    )}
                  </div>
                </section>

                <div className="action-row">
                  <button className="primary-action" type="button" disabled={!selectedIds.length || !game.handsLeft} onClick={playSelected}>
                    <span className="action-icon" aria-hidden="true">⚽</span> Gioca la mano <kbd aria-hidden="true">P</kbd>
                  </button>
                  <button className="secondary-action" type="button" disabled={!selectedIds.length || !game.discardsLeft} onClick={discardSelected}>
                    Scarta <kbd aria-hidden="true">S</kbd>
                  </button>
                  <span className="selection-count">{selectedIds.length}/5 selezionate</span>
                </div>

                {game.lastResult && (
                  <div className="last-hand">
                    <span className="last-hand-symbol" aria-hidden="true">⚽</span>
                    <span><strong>{game.lastResult.category}</strong><span>{game.lastResult.chips} fiches × {game.lastResult.multiplier}</span></span>
                    <strong className="last-hand-points">+{formatScore(game.lastResult.points)}</strong>
                  </div>
                )}
                <p className="game-announcement" aria-live="polite" aria-atomic="true">{game.message}</p>
              </>
            ) : (
              <section className={`end-panel ${game.phase === 'won' ? 'won' : 'lost'}`} aria-labelledby="end-title">
                <div className="end-heading">
                  <span className="end-mark" aria-hidden="true">{game.phase === 'won' ? '🏆' : '⚽'}</span>
                  <div>
                    <p className="eyebrow">{game.phase === 'won' ? 'CAMPIONI!' : 'FISCHIO FINALE'}</p>
                    <h1 id="end-title">{game.phase === 'won' ? 'Hai vinto il campionato!' : 'La prossima partita è quella buona.'}</h1>
                    <p className="end-message">{game.phase === 'won' ? 'Hai superato tutti e tre gli obiettivi. Grande partita, mister!' : 'Questa volta l’obiettivo è sfuggito, ma la squadra è pronta per ripartire.'}</p>
                  </div>
                </div>
                <dl className="end-stats" aria-label="Risultato finale">
                  <div>
                    <dt>PUNTEGGIO</dt>
                    <dd>{formatScore(game.score)}<span>punti</span></dd>
                  </div>
                  <div>
                    <dt>OBIETTIVO</dt>
                    <dd>{formatScore(target)}<span>punti</span></dd>
                  </div>
                  <div>
                    <dt>PARTITA</dt>
                    <dd>{game.round}<span>di 3</span></dd>
                  </div>
                </dl>
                {game.lastResult && (
                  <p className="end-last-hand">
                    Ultima mano: <strong>{game.lastResult.category}</strong>
                    <span>+{formatScore(game.lastResult.points)} punti</span>
                  </p>
                )}
                <button className="primary-action restart-button" type="button" onClick={startNewGame}>
                  <span aria-hidden="true">↻</span> Nuovo campionato <kbd aria-hidden="true">N</kbd>
                </button>
              </section>
            )}
          </section>

          <aside className="side-panel" aria-label="Informazioni della partita">
            <section className="side-card">
              <div className="side-card-heading"><span className="side-icon" aria-hidden="true">⚽</span><h2>Schemi vincenti</h2></div>
              <ol className="combination-list">
                <li><span>Scala colore</span><b>100 × 8</b></li>
                <li><span>Poker</span><b>60 × 7</b></li>
                <li><span>Full</span><b>40 × 4</b></li>
                <li><span>Colore</span><b>35 × 4</b></li>
                <li><span>Scala</span><b>30 × 4</b></li>
                <li><span>Tris</span><b>30 × 3</b></li>
                <li><span>Doppia coppia</span><b>20 × 2</b></li>
                <li><span>Coppia</span><b>10 × 2</b></li>
                <li><span>Carta alta</span><b>5 × 1</b></li>
              </ol>
              <p className="side-note">Fiches base + valore delle carte, poi moltiplicatore. I Jolly danno bonus extra.</p>
            </section>
            <section className="side-card joker-side-card">
              <div className="side-card-heading"><span className="side-icon" aria-hidden="true">★</span><h2>La tua panchina</h2><span className="joker-counter">{game.jokers.length}/5</span></div>
              {game.jokers.length ? (
                <ul className="owned-jokers">{game.jokers.map((joker) => <li key={joker.id}><span aria-hidden="true">✦</span><div><strong>{joker.name}</strong><small>{joker.description}</small></div></li>)}</ul>
              ) : (
                <p className="empty-jokers">Nessun Jolly per ora. La prima finestra di mercato si apre a fine partita.</p>
              )}
            </section>
            <section className="key-hint-card" aria-label="Suggerimento">
              <span aria-hidden="true">⌨</span>
              <p>In campo dal primo all’ultimo passaggio: non serve il mouse.</p>
              <button
                type="button"
                aria-keyshortcuts="?"
                onClick={openHelp}
              >
                Scopri i comandi <kbd aria-hidden="true">?</kbd>
                <span aria-hidden="true">→</span>
              </button>
            </section>
            <div className="new-game-area">
              <button
                type="button"
                className="text-button"
                aria-keyshortcuts="N"
                onClick={startNewGame}
              >
                <span aria-hidden="true">↻</span> Ricomincia il campionato
                <kbd aria-hidden="true">N</kbd>
              </button>
            </div>
          </aside>
        </main>
      )}

      <footer className="app-footer">
        <span>LA TUA FORMAZIONE <span aria-hidden="true">·</span> Il campionato di carte accessibile</span>
        <span className="footer-status" aria-live="polite">{pwaMessage}</span>
      </footer>
      {storageMessage && <p className="persistent-warning" role="status">{storageMessage}</p>}

      {helpOpen && (
        <div className="dialog-backdrop">
          <div className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" onKeyDown={trapDialogFocus}>
            <div className="dialog-heading">
              <div><p className="eyebrow">GUIDA RAPIDA</p><h2 id="help-title">Comandi da tastiera</h2></div>
              <button ref={helpCloseRef} type="button" className="dialog-close" aria-label="Chiudi la guida" onClick={closeHelp}>×</button>
            </div>
            <dl className="shortcut-list">
              <div><dt>N</dt><dd>Inizia un nuovo campionato, anche dalla schermata di vittoria o sconfitta.</dd></div>
              <div><dt>1–8</dt><dd>Seleziona o deseleziona la carta con il numero corrispondente; l’ordine segue l’ordinamento scelto.</dd></div>
              <div><dt>1–3 mercato</dt><dd>Acquista l’offerta numerata. Con le frecce su e giù spostati tra i Jolly disponibili.</dd></div>
              <div><dt>Frecce</dt><dd>Spostati tra le carte; su e giù tra le righe.</dd></div>
              <div><dt>Spazio</dt><dd>Seleziona o deseleziona la carta evidenziata.</dd></div>
              <div><dt>P</dt><dd>Gioca le carte selezionate.</dd></div>
              <div><dt>S</dt><dd>Scarta le carte selezionate.</dd></div>
              <div><dt>?</dt><dd>Apri questa guida.</dd></div>
              <div><dt>Esc</dt><dd>Chiudi questa guida.</dd></div>
            </dl>
            <p className="dialog-note">Il nome accessibile di ogni carta include valore e ruolo. Puoi giocare combinazioni anche con meno di cinque carte.</p>
            <button ref={helpDoneRef} className="primary-action dialog-done" type="button" onClick={closeHelp}>Ho capito</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
