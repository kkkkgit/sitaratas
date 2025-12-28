import { Card, Suit } from "./cards.js"
import { Deck } from "./deck.js"

export type PlayerId = string

export enum RoundPhase {
  Bidding = "BIDDING",
  Playing = "PLAYING",
  Scoring = "SCORING",
  Done = "DONE",
}

export type Bid = {
  playerId: PlayerId
  tricks: number
}

export type PlayedCard = {
  playerId: PlayerId
  card: Card
}

export type TrickState = {
  leaderId: PlayerId
  plays: PlayedCard[] // in order
  leadSuit?: Suit
  winnerId?: PlayerId
}

export type RoundState = {
  roundIndex: number
  phase: RoundPhase

  playerOrder: PlayerId[] // clockwise order
  dealerIndex: number

  cardsPerPlayer: number
  trumpSuit: Suit

  hands: Record<PlayerId, Card[]>

  bids: Bid[] // in bidding order
  currentTrick: TrickState
  tricksWon: Record<PlayerId, number>
}

function nextIndex(i: number, n: number): number {
  return (i + 1) % n
}

export function leaderIndexFromDealer(dealerIndex: number, nPlayers: number): number {
  return nextIndex(dealerIndex, nPlayers)
}

export function createRound(args: {
  roundIndex: number
  playerOrder: PlayerId[]
  dealerIndex: number
  cardsPerPlayer: number
  rng?: () => number
}): RoundState {
  const { roundIndex, playerOrder, dealerIndex, cardsPerPlayer, rng } = args
  if (playerOrder.length < 3) throw new Error("Need at least 3 players")
  if (cardsPerPlayer < 1) throw new Error("cardsPerPlayer must be >= 1")

  const deck = new Deck()
  deck.shuffle(rng)

  const hands: Record<PlayerId, Card[]> = Object.fromEntries(
    playerOrder.map((pid) => [pid, [] as Card[]])
  )

  // Deal in clockwise order starting from leader (dealer's next player)
  const n = playerOrder.length
  const leaderIdx = leaderIndexFromDealer(dealerIndex, n)

  let lastDealt: Card | undefined

  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let offset = 0; offset < n; offset++) {
      const idx = (leaderIdx + offset) % n
      const pid = playerOrder[idx]
      const card = deck.draw()
      if (!card) throw new Error("Deck ended unexpectedly while dealing")
      hands[pid].push(card)
      lastDealt = card
    }
  }

  // Trump: top card after dealing; if none left -> last dealt card
  const trumpCard = deck.draw() ?? lastDealt
  if (!trumpCard) throw new Error("No trump card could be determined")

  const leaderId = playerOrder[leaderIdx]

  const tricksWon: Record<PlayerId, number> = Object.fromEntries(
    playerOrder.map((pid) => [pid, 0])
  )

  return {
    roundIndex,
    phase: RoundPhase.Bidding,
    playerOrder,
    dealerIndex,
    cardsPerPlayer,
    trumpSuit: trumpCard.suit,
    hands,
    bids: [],
    currentTrick: { leaderId, plays: [] },
    tricksWon,
  }
}

export function isDealer(round: RoundState, playerId: PlayerId): boolean {
  return round.playerOrder[round.dealerIndex] === playerId
}

export function maxTricksInRound(round: RoundState): number {
  return round.cardsPerPlayer
}

export function addBid(round: RoundState, bid: Bid): RoundState {
  if (round.phase !== RoundPhase.Bidding) throw new Error("Not in bidding phase")

  const alreadyBid = new Set(round.bids.map((b) => b.playerId))
  if (alreadyBid.has(bid.playerId)) throw new Error("Player already bid")
  if (!round.playerOrder.includes(bid.playerId)) throw new Error("Unknown player")

  const n = round.playerOrder.length
  const expectedBidder = round.playerOrder[(leaderIndexFromDealer(round.dealerIndex, n) + round.bids.length) % n]
  if (bid.playerId !== expectedBidder) throw new Error("Not this player's turn to bid")

  const max = maxTricksInRound(round)
  if (bid.tricks < 0 || bid.tricks > max) throw new Error("Invalid bid value")

  const newBids = [...round.bids, bid]

  // Dealer restriction applies only when dealer bids (last bid)
  const dealerId = round.playerOrder[round.dealerIndex]
  const isDealerBid = bid.playerId === dealerId
  if (isDealerBid) {
    const sum = newBids.reduce((acc, b) => acc + b.tricks, 0)
    if (sum === max) throw new Error("Dealer cannot make total bids equal trick count")
  }

  const nextPhase = newBids.length === n ? RoundPhase.Playing : RoundPhase.Bidding

  return {
    ...round,
    bids: newBids,
    phase: nextPhase,
  }
}
