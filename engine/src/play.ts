import { Card, Rank, Suit } from "./cards.js"
import { PlayerId, RoundPhase, RoundState, PlayedCard } from "./roundState.js"

function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank
}

function removeCardFromHand(hand: Card[], card: Card): Card[] {
  const idx = hand.findIndex((c) => sameCard(c, card))
  if (idx === -1) throw new Error("Card not in hand")
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)]
}

function hasSuit(hand: Card[], suit: Suit): boolean {
  return hand.some((c) => c.suit === suit)
}

function isLegalPlay(round: RoundState, playerId: PlayerId, card: Card): boolean {
  const hand = round.hands[playerId]
  if (!hand) throw new Error("Unknown player")
  if (!hand.some((c) => sameCard(c, card))) return false

  const trick = round.currentTrick
  const isLeading = trick.plays.length === 0
  if (isLeading) return true

  const leadSuit = trick.leadSuit
  if (!leadSuit) throw new Error("leadSuit missing")

  // Must follow suit if possible
  if (hasSuit(hand, leadSuit)) {
    return card.suit === leadSuit
  }

  // If cannot follow suit, must play trump if possible
  if (hasSuit(hand, round.trumpSuit)) {
    return card.suit === round.trumpSuit
  }

  // Otherwise any card allowed (player chooses)
  return true
}

function trickWinner(round: RoundState): PlayerId {
  const { trumpSuit } = round
  const trick = round.currentTrick
  const leadSuit = trick.leadSuit
  if (!leadSuit) throw new Error("leadSuit missing")

  const beats = (a: PlayedCard, b: PlayedCard): boolean => {
    const aTrump = a.card.suit === trumpSuit
    const bTrump = b.card.suit === trumpSuit
    if (aTrump && !bTrump) return true
    if (!aTrump && bTrump) return false

    // same trump-status: compare only if same suit as each other and relevant
    if (a.card.suit === b.card.suit) return a.card.rank > b.card.rank

    // both non-trump: only lead suit competes
    const aLead = a.card.suit === leadSuit
    const bLead = b.card.suit === leadSuit
    if (aLead && !bLead) return true
    if (!aLead && bLead) return false

    // neither is trump nor lead: cannot beat lead/trump, so b stays winner
    return false
  }

  let best = trick.plays[0]
  for (let i = 1; i < trick.plays.length; i++) {
    const cur = trick.plays[i]
    if (beats(cur, best)) best = cur
  }
  return best.playerId
}

function nextPlayerToAct(round: RoundState): PlayerId {
  const n = round.playerOrder.length
  const leaderIndex = round.playerOrder.indexOf(round.currentTrick.leaderId)
  const offset = round.currentTrick.plays.length
  return round.playerOrder[(leaderIndex + offset) % n]
}

export function playCard(round: RoundState, playerId: PlayerId, card: Card): RoundState {
  if (round.phase !== RoundPhase.Playing) throw new Error("Not in playing phase")

  const expected = nextPlayerToAct(round)
  if (playerId !== expected) throw new Error("Not this player's turn")

  if (!isLegalPlay(round, playerId, card)) throw new Error("Illegal card play")

  const trick = round.currentTrick
  const newPlays: PlayedCard[] = [...trick.plays, { playerId, card }]
  const leadSuit = trick.leadSuit ?? card.suit

  // update hand
  const newHands = {
    ...round.hands,
    [playerId]: removeCardFromHand(round.hands[playerId], card),
  }

  const nPlayers = round.playerOrder.length
  const trickComplete = newPlays.length === nPlayers

  if (!trickComplete) {
    return {
      ...round,
      hands: newHands,
      currentTrick: {
        ...trick,
        plays: newPlays,
        leadSuit,
      },
    }
  }

  const winnerId = trickWinner({
    ...round,
    hands: newHands,
    currentTrick: { ...trick, plays: newPlays, leadSuit },
  })

  const newTricksWon = {
    ...round.tricksWon,
    [winnerId]: round.tricksWon[winnerId] + 1,
  }

  const tricksPlayedSoFar = Object.values(newTricksWon).reduce((a, b) => a + b, 0)
  const roundDone = tricksPlayedSoFar === round.cardsPerPlayer

  return {
    ...round,
    hands: newHands,
    tricksWon: newTricksWon,
    phase: roundDone ? RoundPhase.Scoring : RoundPhase.Playing,
    currentTrick: roundDone
      ? { ...round.currentTrick, plays: newPlays, leadSuit, winnerId }
      : { leaderId: winnerId, plays: [] },
  }
}
