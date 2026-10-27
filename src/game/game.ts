export const SUITS = [
  'Portieri',
  'Difensori',
  'Centrocampisti',
  'Attaccanti',
] as const
export type Suit = (typeof SUITS)[number]

export interface Card {
  id: string
  rank: number
  suit: Suit
}

export type HandCategory =
  | 'Carta alta'
  | 'Coppia'
  | 'Doppia coppia'
  | 'Tris'
  | 'Scala'
  | 'Colore'
  | 'Full'
  | 'Poker'
  | 'Scala colore'

export interface Joker {
  id: string
  name: string
  description: string
  price: number
  effect: 'always' | 'straight' | 'group' | 'flush'
}

export interface HandResult {
  category: HandCategory
  baseChips: number
  cardValues: number
  bonusChips: number
  chips: number
  baseMultiplier: number
  bonusMultiplier: number
  multiplier: number
  points: number
  scoringCardIds: string[]
}

export type GamePhase = 'playing' | 'shop' | 'won' | 'lost'

export interface GameState {
  deck: Card[]
  discardPile: Card[]
  hand: Card[]
  round: number
  score: number
  handsLeft: number
  discardsLeft: number
  money: number
  jokers: Joker[]
  shop: Joker[]
  phase: GamePhase
  lastResult: HandResult | null
  message: string
}

export const ROUND_TARGETS = [300, 600, 1000]

export const HAND_SCORES: Record<
  HandCategory,
  { chips: number; multiplier: number }
> = {
  'Carta alta': { chips: 5, multiplier: 1 },
  Coppia: { chips: 10, multiplier: 2 },
  'Doppia coppia': { chips: 20, multiplier: 2 },
  Tris: { chips: 30, multiplier: 3 },
  Scala: { chips: 30, multiplier: 4 },
  Colore: { chips: 35, multiplier: 4 },
  Full: { chips: 40, multiplier: 4 },
  Poker: { chips: 60, multiplier: 7 },
  'Scala colore': { chips: 100, multiplier: 8 },
}

export const JOKER_CATALOG: Joker[] = [
  {
    id: 'fascia-capitano',
    name: 'Fascia da capitano',
    description: '+20 fiches a ogni mano.',
    price: 4,
    effect: 'always',
  },
  {
    id: 'calcio-angolo',
    name: 'Calcio d’angolo',
    description: '+2 al moltiplicatore con una scala o scala colore.',
    price: 5,
    effect: 'straight',
  },
  {
    id: 'numero-dieci',
    name: 'Il numero 10',
    description: '+3 al moltiplicatore con una combinazione di gruppo.',
    price: 6,
    effect: 'group',
  },
  {
    id: 'muro-difensivo',
    name: 'Muro difensivo',
    description: '+30 fiches con un colore o scala colore.',
    price: 5,
    effect: 'flush',
  },
]

const RANK_NAMES: Record<number, string> = {
  11: 'Fante',
  12: 'Regina',
  13: 'Re',
  14: 'Asso',
}

export function rankName(rank: number): string {
  return RANK_NAMES[rank] ?? String(rank)
}

export function cardValue(rank: number): number {
  return rank === 14 ? 11 : Math.min(rank, 10)
}

export function cardLabel(card: Card): string {
  return `${rankName(card.rank)} · ${card.suit}`
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ]
  }
  return shuffled
}

function createDeck(): Card[] {
  return shuffle(
    SUITS.flatMap((suit) =>
      Array.from({ length: 13 }, (_, index) => ({
        id: `${suit}-${index + 2}`,
        rank: index + 2,
        suit,
      })),
    ),
  )
}

function drawCards(
  deck: Card[],
  discardPile: Card[],
  count: number,
): { deck: Card[]; discardPile: Card[]; drawn: Card[] } {
  let remainingDeck = [...deck]
  let remainingDiscards = [...discardPile]
  const drawn: Card[] = []

  while (drawn.length < count) {
    if (remainingDeck.length === 0) {
      if (remainingDiscards.length === 0) break
      remainingDeck = shuffle(remainingDiscards)
      remainingDiscards = []
    }
    const card = remainingDeck.pop()
    if (!card) break
    drawn.push(card)
  }

  return { deck: remainingDeck, discardPile: remainingDiscards, drawn }
}

function shuffledShop(): Joker[] {
  return shuffle(JOKER_CATALOG).slice(0, 3)
}

export function createNewGame(): GameState {
  const deck = createDeck()
  const initialDraw = drawCards(deck, [], 8)
  return {
    ...initialDraw,
    hand: initialDraw.drawn,
    round: 1,
    score: 0,
    handsLeft: 4,
    discardsLeft: 3,
    money: 5,
    jokers: [],
    shop: [],
    phase: 'playing',
    lastResult: null,
    message: 'Nuova partita. Seleziona da una a cinque carte.',
  }
}

export function scoreHand(cards: Card[], jokers: Joker[]): HandResult {
  if (cards.length === 0 || cards.length > 5) {
    throw new Error('Il punteggio richiede da una a cinque carte.')
  }

  const counts = new Map<number, number>()
  cards.forEach((card) =>
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1),
  )
  const groups = [...counts.entries()].sort(
    ([rankA, countA], [rankB, countB]) => countB - countA || rankB - rankA,
  )
  const pairs = groups.filter(([, count]) => count === 2)
  const three = groups.find(([, count]) => count === 3)?.[0]
  const four = groups.find(([, count]) => count === 4)?.[0]
  const flush =
    cards.length === 5 && cards.every((card) => card.suit === cards[0].suit)
  const ranks = [...new Set(cards.map((card) => card.rank))].sort(
    (a, b) => a - b,
  )
  const straightHigh =
    ranks.length === 5 && ranks[4] - ranks[0] === 4
      ? ranks[4]
      : ranks.join(',') === '2,3,4,5,14'
        ? 5
        : null
  const straight = cards.length === 5 && straightHigh !== null

  let category: HandCategory
  let scoringCards: Card[]

  if (straight && flush) {
    category = 'Scala colore'
    scoringCards = cards
  } else if (four !== undefined) {
    category = 'Poker'
    scoringCards = cards.filter((card) => card.rank === four)
  } else if (three !== undefined && pairs.length > 0) {
    category = 'Full'
    scoringCards = cards.filter(
      (card) => card.rank === three || card.rank === pairs[0][0],
    )
  } else if (flush) {
    category = 'Colore'
    scoringCards = cards
  } else if (straight) {
    category = 'Scala'
    scoringCards = cards
  } else if (three !== undefined) {
    category = 'Tris'
    scoringCards = cards.filter((card) => card.rank === three)
  } else if (pairs.length >= 2) {
    category = 'Doppia coppia'
    const pairRanks = new Set(pairs.slice(0, 2).map(([rank]) => rank))
    scoringCards = cards.filter((card) => pairRanks.has(card.rank))
  } else if (pairs.length === 1) {
    category = 'Coppia'
    scoringCards = cards.filter((card) => card.rank === pairs[0][0])
  } else {
    category = 'Carta alta'
    const highestRank = Math.max(...cards.map((card) => card.rank))
    scoringCards = cards
      .filter((card) => card.rank === highestRank)
      .slice(0, 1)
  }

  const base = HAND_SCORES[category]
  const bonusChips = jokers.reduce((bonus, joker) => {
    if (joker.effect === 'always') return bonus + 20
    if (
      joker.effect === 'flush' &&
      (category === 'Colore' || category === 'Scala colore')
    ) {
      return bonus + 30
    }
    return bonus
  }, 0)
  const bonusMultiplier = jokers.reduce((bonus, joker) => {
    if (
      joker.effect === 'straight' &&
      (category === 'Scala' || category === 'Scala colore')
    ) {
      return bonus + 2
    }
    if (
      joker.effect === 'group' &&
      ['Coppia', 'Doppia coppia', 'Tris', 'Full', 'Poker'].includes(category)
    ) {
      return bonus + 3
    }
    return bonus
  }, 0)
  const cardValues = scoringCards.reduce(
    (sum, card) => sum + cardValue(card.rank),
    0,
  )
  const chips = base.chips + cardValues + bonusChips
  const multiplier = base.multiplier + bonusMultiplier

  return {
    category,
    baseChips: base.chips,
    cardValues,
    bonusChips,
    chips,
    baseMultiplier: base.multiplier,
    bonusMultiplier,
    multiplier,
    points: chips * multiplier,
    scoringCardIds: scoringCards.map((card) => card.id),
  }
}

export type GameAction =
  | { type: 'play'; selectedIds: string[] }
  | { type: 'discard'; selectedIds: string[] }
  | { type: 'buy'; jokerId: string }
  | { type: 'continue' }
  | { type: 'new-game' }

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'new-game') return createNewGame()

  if (action.type === 'continue') {
    if (state.phase !== 'shop') return state
    const nextRound = state.round + 1
    const nextDraw = drawCards(
      state.deck,
      [...state.discardPile, ...state.hand],
      8,
    )
    return {
      ...state,
      ...nextDraw,
      hand: nextDraw.drawn,
      round: nextRound,
      score: 0,
      handsLeft: 4,
      discardsLeft: 3,
      shop: [],
      phase: 'playing',
      lastResult: null,
      message: `Partita ${nextRound}. Obiettivo: ${ROUND_TARGETS[nextRound - 1]} punti.`,
    }
  }

  if (action.type === 'buy') {
    if (state.phase !== 'shop') return state
    const joker = state.shop.find((item) => item.id === action.jokerId)
    if (!joker || state.money < joker.price || state.jokers.length >= 5) {
      return state
    }
    return {
      ...state,
      money: state.money - joker.price,
      jokers: [...state.jokers, joker],
      shop: state.shop.filter((item) => item.id !== joker.id),
      message: `${joker.name} aggiunto alla tua panchina.`,
    }
  }

  if (state.phase !== 'playing') return state
  const selectedCards = state.hand.filter((card) =>
    action.selectedIds.includes(card.id),
  )
  if (
    selectedCards.length === 0 ||
    selectedCards.length > 5 ||
    selectedCards.length !== action.selectedIds.length
  ) {
    return { ...state, message: 'Seleziona da una a cinque carte della mano.' }
  }

  if (action.type === 'discard' && state.discardsLeft === 0) {
    return { ...state, message: 'Non hai più scarti in questa partita.' }
  }

  if (action.type === 'play' && state.handsLeft === 0) {
    return { ...state, message: 'Non hai più mani in questa partita.' }
  }

  const nextHand = state.hand.filter(
    (card) => !action.selectedIds.includes(card.id),
  )
  const nextDiscards = [...state.discardPile, ...selectedCards]
  const draw = drawCards(state.deck, nextDiscards, selectedCards.length)
  const hand = [...nextHand, ...draw.drawn]

  if (action.type === 'discard') {
    return {
      ...state,
      deck: draw.deck,
      discardPile: draw.discardPile,
      hand,
      discardsLeft: state.discardsLeft - 1,
      lastResult: null,
      message: `${selectedCards.length} carte scartate e sostituite.`,
    }
  }

  const result = scoreHand(selectedCards, state.jokers)
  const score = state.score + result.points
  const handsLeft = state.handsLeft - 1
  const target = ROUND_TARGETS[state.round - 1]
  const cleared = score >= target
  const phase: GamePhase = cleared
    ? state.round === ROUND_TARGETS.length
      ? 'won'
      : 'shop'
    : handsLeft === 0
      ? 'lost'
      : 'playing'
  const missing = Math.max(0, target - score)
  const message = cleared
    ? state.round === ROUND_TARGETS.length
      ? `${result.category}: ${result.points} punti. Hai vinto il campionato!`
      : `${result.category}: ${result.points} punti. Obiettivo raggiunto: +4 crediti per il calciomercato.`
    : phase === 'lost'
      ? `${result.category}: ${result.points} punti. Partita terminata: mancavano ${missing} punti.`
      : `${result.category}: ${result.points} punti. Mancano ${missing} punti all'obiettivo.`

  return {
    ...state,
    deck: draw.deck,
    discardPile: draw.discardPile,
    hand,
    score,
    handsLeft,
    money: state.money + (cleared ? 4 : 0),
    phase,
    shop: cleared && phase === 'shop' ? shuffledShop() : state.shop,
    lastResult: result,
    message,
  }
}
