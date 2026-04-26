import { createRound, DECK_SIZE, MAX_PLAYERS, MIN_PLAYERS, PlayerId, RoundState } from "./roundState.js"
import { initScores, ScoreState, scoreRound } from "./scoring.js"

export type GameState = {
  playerOrder: PlayerId[]
  dealerIndex: number

  maxCardsPerPlayer: number
  schedule: number[] // e.g. [1,1,1,1,2,3,...,9,8,...,1]

  roundIndex: number
  round: RoundState

  scores: ScoreState
}

function buildSchedule(max: number, nPlayers: number): number[] {
  // Start with nPlayers rounds of 1 card each
  const start: number[] = Array(nPlayers).fill(1)
  
  // Then go up from 2 to max
  const up: number[] = []
  for (let i = 2; i <= max; i++) up.push(i)
  
  // Then go down from max-1 to 1
  const down: number[] = []
  for (let i = max - 1; i >= 1; i--) down.push(i)
  
  return [...start, ...up, ...down]
}

function nextDealerIndex(current: number, n: number): number {
  return (current + 1) % n
}

export function computeMaxCardsPerPlayer(nPlayers: number): number {
  return Math.floor(DECK_SIZE / nPlayers)
}

export function createGame(args: {
  playerOrder: PlayerId[]
  dealerIndex?: number
  rng?: () => number
}): GameState {
  const { playerOrder, rng } = args
  if (playerOrder.length < MIN_PLAYERS || playerOrder.length > MAX_PLAYERS) {
    throw new Error("Need 3 to 6 players")
  }
  if (new Set(playerOrder).size !== playerOrder.length) throw new Error("Player IDs must be unique")

  const dealerIndex = args.dealerIndex ?? 0
  if (dealerIndex < 0 || dealerIndex >= playerOrder.length) throw new Error("Invalid dealerIndex")

  const maxCardsPerPlayer = computeMaxCardsPerPlayer(playerOrder.length)
  const schedule = buildSchedule(maxCardsPerPlayer, playerOrder.length)

  const roundIndex = 0
  const round = createRound({
    roundIndex,
    playerOrder,
    dealerIndex,
    cardsPerPlayer: schedule[0],
    rng,
  })

  return {
    playerOrder,
    dealerIndex,
    maxCardsPerPlayer,
    schedule,
    roundIndex,
    round,
    scores: initScores(playerOrder),
  }
}

export function finishRoundAndStartNext(game: GameState, rng?: () => number): GameState {
  // score current round
  const scored = scoreRound(game.round, game.scores)

  const nextRoundIndex = game.roundIndex + 1
  const nextDealer = nextDealerIndex(game.dealerIndex, game.playerOrder.length)

  // If schedule ended, game ends (for now we just stop advancing)
  if (nextRoundIndex >= game.schedule.length) {
    return {
      ...game,
      roundIndex: nextRoundIndex,
      dealerIndex: nextDealer,
      round: scored.round, // Done
      scores: scored.scores,
    }
  }

  const nextRound = createRound({
    roundIndex: nextRoundIndex,
    playerOrder: game.playerOrder,
    dealerIndex: nextDealer,
    cardsPerPlayer: game.schedule[nextRoundIndex],
    rng,
  })

  return {
    ...game,
    roundIndex: nextRoundIndex,
    dealerIndex: nextDealer,
    round: nextRound,
    scores: scored.scores,
  }
}
