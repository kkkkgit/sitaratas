import assert from "node:assert/strict"
import test from "node:test"

import {
  Rank,
  RoundPhase,
  Suit,
  addBid,
  computeMaxCardsPerPlayer,
  createGame,
  createRound,
  initScores,
  makeDeck52,
  playCard,
  scoreRound,
} from "../dist/index.js"

const players = ["P1", "P2", "P3", "P4"]

test("makeDeck52 creates 52 unique cards from 2 to ace", () => {
  const deck = makeDeck52()
  const unique = new Set(deck.map((card) => `${card.suit}:${card.rank}`))

  assert.equal(deck.length, 52)
  assert.equal(unique.size, 52)
  assert.deepEqual(
    deck.filter((card) => card.suit === Suit.Clubs).map((card) => card.rank),
    [
      Rank.Two,
      Rank.Three,
      Rank.Four,
      Rank.Five,
      Rank.Six,
      Rank.Seven,
      Rank.Eight,
      Rank.Nine,
      Rank.Ten,
      Rank.Jack,
      Rank.Queen,
      Rank.King,
      Rank.Ace,
    ]
  )
})

test("game supports 3 to 6 players only", () => {
  assert.throws(() => createGame({ playerOrder: ["P1", "P2"] }), /Need 3 to 6 players/)
  assert.doesNotThrow(() => createGame({ playerOrder: ["P1", "P2", "P3"] }))
  assert.doesNotThrow(() => createGame({ playerOrder: ["P1", "P2", "P3", "P4", "P5", "P6"] }))
  assert.throws(() => createGame({ playerOrder: ["P1", "P2", "P3", "P4", "P5", "P6", "P7"] }), /Need 3 to 6 players/)
})

test("game validates duplicate players and dealer index", () => {
  assert.throws(() => createGame({ playerOrder: ["P1", "P1", "P2"] }), /unique/)
  assert.throws(() => createGame({ playerOrder: players, dealerIndex: -1 }), /Invalid dealerIndex/)
  assert.throws(() => createGame({ playerOrder: players, dealerIndex: 4 }), /Invalid dealerIndex/)
})

test("max cards per player uses a 52-card deck", () => {
  assert.equal(computeMaxCardsPerPlayer(3), 17)
  assert.equal(computeMaxCardsPerPlayer(4), 13)
  assert.equal(computeMaxCardsPerPlayer(5), 10)
  assert.equal(computeMaxCardsPerPlayer(6), 8)
})

test("round creation deals the requested hand size", () => {
  const round = createRound({
    roundIndex: 0,
    playerOrder: players,
    dealerIndex: 0,
    cardsPerPlayer: 5,
    rng: () => 0,
  })

  assert.equal(round.phase, RoundPhase.Bidding)
  assert.equal(round.currentTrick.leaderId, "P2")
  for (const player of players) {
    assert.equal(round.hands[player].length, 5)
  }
})

test("bidding follows order and prevents dealer from matching trick total", () => {
  let round = createRound({
    roundIndex: 0,
    playerOrder: players,
    dealerIndex: 0,
    cardsPerPlayer: 2,
    rng: () => 0,
  })

  assert.throws(() => addBid(round, { playerId: "P3", tricks: 0 }), /Not this player's turn/)

  round = addBid(round, { playerId: "P2", tricks: 1 })
  round = addBid(round, { playerId: "P3", tricks: 0 })
  round = addBid(round, { playerId: "P4", tricks: 0 })

  assert.throws(() => addBid(round, { playerId: "P1", tricks: 1 }), /Dealer cannot/)
  round = addBid(round, { playerId: "P1", tricks: 0 })

  assert.equal(round.phase, RoundPhase.Playing)
})

test("playCard rejects illegal plays and awards trump trick winner", () => {
  const baseRound = {
    roundIndex: 0,
    phase: RoundPhase.Playing,
    playerOrder: players,
    dealerIndex: 0,
    cardsPerPlayer: 1,
    trumpSuit: Suit.Spades,
    hands: {
      P1: [{ suit: Suit.Hearts, rank: Rank.Ace }],
      P2: [{ suit: Suit.Hearts, rank: Rank.Two }],
      P3: [{ suit: Suit.Spades, rank: Rank.Three }],
      P4: [{ suit: Suit.Clubs, rank: Rank.Ace }],
    },
    bids: players.map((playerId) => ({ playerId, tricks: 0 })),
    currentTrick: { leaderId: "P1", plays: [] },
    tricksWon: { P1: 0, P2: 0, P3: 0, P4: 0 },
  }

  assert.throws(() => playCard(baseRound, "P1", { suit: Suit.Clubs, rank: Rank.Ace }), /Illegal card play/)

  let round = playCard(baseRound, "P1", { suit: Suit.Hearts, rank: Rank.Ace })
  round = playCard(round, "P2", { suit: Suit.Hearts, rank: Rank.Two })
  round = playCard(round, "P3", { suit: Suit.Spades, rank: Rank.Three })
  round = playCard(round, "P4", { suit: Suit.Clubs, rank: Rank.Ace })

  assert.equal(round.phase, RoundPhase.Scoring)
  assert.equal(round.currentTrick.winnerId, "P3")
  assert.equal(round.tricksWon.P3, 1)
})

test("scoreRound adds tricks and exact-bid bonus", () => {
  const round = {
    roundIndex: 0,
    phase: RoundPhase.Scoring,
    playerOrder: players,
    dealerIndex: 0,
    cardsPerPlayer: 1,
    trumpSuit: Suit.Spades,
    hands: Object.fromEntries(players.map((player) => [player, []])),
    bids: [
      { playerId: "P1", tricks: 1 },
      { playerId: "P2", tricks: 0 },
      { playerId: "P3", tricks: 0 },
      { playerId: "P4", tricks: 0 },
    ],
    currentTrick: { leaderId: "P1", plays: [], winnerId: "P1" },
    tricksWon: { P1: 1, P2: 0, P3: 0, P4: 0 },
  }

  const result = scoreRound(round, initScores(players))

  assert.equal(result.round.phase, RoundPhase.Done)
  assert.deepEqual(result.scores, { P1: 6, P2: 5, P3: 5, P4: 5 })
})
