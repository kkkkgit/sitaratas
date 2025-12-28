// engine/src/demo.ts

import { createGame, finishRoundAndStartNext } from "./gameState.js"
import { addBid } from "./roundState.js"
import { playCard } from "./play.js"
import { RoundPhase } from "./roundState.js"
import type { PlayerId } from "./roundState"
import type { Card } from "./cards"

function seededRng(seed: number): () => number {
  // simple LCG for repeatable tests
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

function pickBid(cardsPerPlayer: number): number {
  // dumb but stable: always bid 0 if 1 card, otherwise 1
  return cardsPerPlayer === 1 ? 0 : 1
}

function pickLegalCard(hand: Card[], leadSuit: any, trumpSuit: any): Card {
  // very simple: follow rules minimally
  if (!leadSuit) return hand[0]

  const sameSuit = hand.filter((c) => c.suit === leadSuit)
  if (sameSuit.length) return sameSuit[0]

  const trumps = hand.filter((c) => c.suit === trumpSuit)
  if (trumps.length) return trumps[0]

  return hand[0]
}

function logRoundHeader(gameRoundIndex: number, cardsPerPlayer: number, trumpSuit: string) {
  console.log(`\nRound ${gameRoundIndex} | cardsPerPlayer=${cardsPerPlayer} | trump=${trumpSuit}`)
}

function logScores(scores: Record<PlayerId, number>) {
  console.log("Scores:", scores)
}

export function runDemo(nPlayers: number, seed = 1) {
  if (nPlayers < 3) throw new Error("Need at least 3 players")
  if (nPlayers > 36) throw new Error("Too many players for a 36-card deck")

  const players: PlayerId[] = Array.from({ length: nPlayers }, (_, i) => `P${i + 1}`)
  const rng = seededRng(seed)

  let game = createGame({ playerOrder: players, rng })

  while (true) {
    const round = game.round
    logRoundHeader(game.roundIndex, round.cardsPerPlayer, round.trumpSuit)

    // Bidding
    while (game.round.phase === RoundPhase.Bidding) {
      const n = game.round.playerOrder.length
      const nextBidder = game.round.playerOrder[
        (game.round.playerOrder.indexOf(game.round.currentTrick.leaderId) + game.round.bids.length) % n
      ]

      let bid = pickBid(game.round.cardsPerPlayer)

      // avoid dealer forbidden sum in this demo
      const dealerId = game.round.playerOrder[game.round.dealerIndex]
      if (nextBidder === dealerId) {
        const sumSoFar = game.round.bids.reduce((a, b) => a + b.tricks, 0)
        if (sumSoFar + bid === game.round.cardsPerPlayer) {
          bid = (bid + 1) % (game.round.cardsPerPlayer + 1)
        }
      }

      game = { ...game, round: addBid(game.round, { playerId: nextBidder, tricks: bid }) }
    }

    // Playing
    while (game.round.phase === RoundPhase.Playing) {
      const r = game.round
      const n = r.playerOrder.length
      const leaderIndex = r.playerOrder.indexOf(r.currentTrick.leaderId)
      const playerToAct = r.playerOrder[(leaderIndex + r.currentTrick.plays.length) % n]

      const hand = r.hands[playerToAct]
      const card = pickLegalCard(hand, r.currentTrick.leadSuit, r.trumpSuit)
      game = { ...game, round: playCard(game.round, playerToAct, card) }
    }

    // Scoring -> next round
    if (game.round.phase === RoundPhase.Scoring) {
      const before = { ...game.scores }
      game = finishRoundAndStartNext(game, rng)
      logScores(game.scores)

      // end condition: schedule finished (we advanced roundIndex beyond schedule length)
      if (game.round.phase === RoundPhase.Done && game.roundIndex >= game.schedule.length) {
        console.log("\nGame finished.")
        logScores(game.scores)
        break
      }

      // just a sanity check: scores should never decrease
      for (const p of players) {
        if (game.scores[p] < before[p]) throw new Error("Score decreased unexpectedly")
      }
      continue
    }

    // If we land here, something is inconsistent
    if (game.round.phase === RoundPhase.Done) break
    throw new Error("Unexpected round phase")
  }
}

runDemo(4, 123)