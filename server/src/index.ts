import { randomUUID } from "node:crypto"
import { createReadStream, existsSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, resolve } from "node:path"
import { WebSocket, WebSocketServer } from "ws"

import {
  Card,
  GameState,
  RoundPhase,
  addBid,
  createGame,
  finishRoundAndStartNext,
  playCard,
} from "@sitaratas/engine"

type Player = {
  id: string
  name: string
  connected: boolean
  socket?: WebSocket
}

type Room = {
  code: string
  hostId: string
  players: Player[]
  game?: GameState
}

type ClientMessage =
  | { type: "CREATE_ROOM"; name: string }
  | { type: "JOIN_ROOM"; roomCode: string; name: string }
  | { type: "START_GAME" }
  | { type: "PLACE_BID"; tricks: number }
  | { type: "PLAY_CARD"; card: Card }
  | { type: "NEXT_ROUND" }

type SocketContext = {
  roomCode?: string
  playerId?: string
}

const rooms = new Map<string, Room>()
const sockets = new Map<WebSocket, SocketContext>()
const webDistPath = resolve(process.cwd(), "../web/dist")

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
}

function cleanName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 24) throw new Error("Name must be 1 to 24 characters")
  return trimmed
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = ""
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
    if (!rooms.has(code)) return code
  }
  throw new Error("Could not generate room code")
}

function getContext(ws: WebSocket): SocketContext {
  const context = sockets.get(ws)
  if (!context) throw new Error("Unknown socket")
  return context
}

function getCurrentRoomAndPlayer(ws: WebSocket): { room: Room; player: Player } {
  const context = getContext(ws)
  if (!context.roomCode || !context.playerId) throw new Error("Join a room first")

  const room = rooms.get(context.roomCode)
  if (!room) throw new Error("Room not found")

  const player = room.players.find((p) => p.id === context.playerId)
  if (!player) throw new Error("Player not found")

  return { room, player }
}

function send(ws: WebSocket, message: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
}

function sendError(ws: WebSocket, message: string): void {
  send(ws, { type: "ERROR", message })
}

function safeGameState(game: GameState, viewerId: string) {
  const handCounts = Object.fromEntries(
    game.playerOrder.map((playerId) => [playerId, game.round.hands[playerId]?.length ?? 0])
  )

  return {
    ...game,
    round: {
      ...game.round,
      yourHand: game.round.hands[viewerId] ?? [],
      handCounts,
      hands: undefined,
    },
  }
}

function safeRoomState(room: Room, viewerId: string) {
  return {
    code: room.code,
    hostId: room.hostId,
    youId: viewerId,
    players: room.players.map(({ id, name, connected }) => ({ id, name, connected })),
    game: room.game ? safeGameState(room.game, viewerId) : undefined,
  }
}

function broadcastRoom(room: Room): void {
  for (const player of room.players) {
    if (player.socket) {
      send(player.socket, { type: "ROOM_STATE", room: safeRoomState(room, player.id) })
    }
  }
}

function attachPlayerToSocket(ws: WebSocket, room: Room, player: Player): void {
  const context = getContext(ws)
  context.roomCode = room.code
  context.playerId = player.id
  player.connected = true
  player.socket = ws
}

function handleCreateRoom(ws: WebSocket, message: Extract<ClientMessage, { type: "CREATE_ROOM" }>): void {
  const name = cleanName(message.name)
  const code = generateRoomCode()
  const player: Player = { id: randomUUID(), name, connected: true, socket: ws }
  const room: Room = { code, hostId: player.id, players: [player] }

  rooms.set(code, room)
  attachPlayerToSocket(ws, room, player)
  broadcastRoom(room)
}

function handleJoinRoom(ws: WebSocket, message: Extract<ClientMessage, { type: "JOIN_ROOM" }>): void {
  const code = message.roomCode.trim().toUpperCase()
  const name = cleanName(message.name)
  const room = rooms.get(code)
  if (!room) throw new Error("Room not found")
  if (room.game) throw new Error("Game already started")
  if (room.players.length >= 6) throw new Error("Room is full")
  if (room.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Name already taken in this room")
  }

  const player: Player = { id: randomUUID(), name, connected: true, socket: ws }
  room.players.push(player)
  attachPlayerToSocket(ws, room, player)
  broadcastRoom(room)
}

function handleStartGame(ws: WebSocket): void {
  const { room, player } = getCurrentRoomAndPlayer(ws)
  if (room.hostId !== player.id) throw new Error("Only the host can start the game")
  if (room.game) throw new Error("Game already started")

  room.game = createGame({ playerOrder: room.players.map((p) => p.id) })
  broadcastRoom(room)
}

function handlePlaceBid(ws: WebSocket, message: Extract<ClientMessage, { type: "PLACE_BID" }>): void {
  const { room, player } = getCurrentRoomAndPlayer(ws)
  if (!room.game) throw new Error("Game has not started")

  room.game = {
    ...room.game,
    round: addBid(room.game.round, { playerId: player.id, tricks: message.tricks }),
  }
  broadcastRoom(room)
}

function handlePlayCard(ws: WebSocket, message: Extract<ClientMessage, { type: "PLAY_CARD" }>): void {
  const { room, player } = getCurrentRoomAndPlayer(ws)
  if (!room.game) throw new Error("Game has not started")

  room.game = {
    ...room.game,
    round: playCard(room.game.round, player.id, message.card),
  }
  broadcastRoom(room)
}

function handleNextRound(ws: WebSocket): void {
  const { room, player } = getCurrentRoomAndPlayer(ws)
  if (!room.game) throw new Error("Game has not started")
  if (room.hostId !== player.id) throw new Error("Only the host can advance the round")
  if (room.game.round.phase !== RoundPhase.Scoring) throw new Error("Round is not ready for scoring")

  room.game = finishRoundAndStartNext(room.game)
  broadcastRoom(room)
}

function handleMessage(ws: WebSocket, raw: WebSocket.RawData): void {
  const message = JSON.parse(raw.toString()) as ClientMessage

  switch (message.type) {
    case "CREATE_ROOM":
      handleCreateRoom(ws, message)
      break
    case "JOIN_ROOM":
      handleJoinRoom(ws, message)
      break
    case "START_GAME":
      handleStartGame(ws)
      break
    case "PLACE_BID":
      handlePlaceBid(ws, message)
      break
    case "PLAY_CARD":
      handlePlayCard(ws, message)
      break
    case "NEXT_ROUND":
      handleNextRound(ws)
      break
    default:
      throw new Error("Unknown message type")
  }
}

function handleClose(ws: WebSocket): void {
  const context = sockets.get(ws)
  sockets.delete(ws)
  if (!context?.roomCode || !context.playerId) return

  const room = rooms.get(context.roomCode)
  if (!room) return

  const player = room.players.find((p) => p.id === context.playerId)
  if (!player) return

  player.connected = false
  player.socket = undefined
  broadcastRoom(room)
}

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0])
  const requestedPath = urlPath === "/" ? "index.html" : urlPath.slice(1)
  const filePath = join(webDistPath, requestedPath)
  const fallbackPath = join(webDistPath, "index.html")
  const safePath = filePath.startsWith(webDistPath) && existsSync(filePath) ? filePath : fallbackPath

  if (!existsSync(safePath)) {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" })
    res.end("Sitaratas server is running. Build the web workspace to serve the GUI.\n")
    return
  }

  res.writeHead(200, { "content-type": contentTypes[extname(safePath)] ?? "application/octet-stream" })
  createReadStream(safePath).pipe(res)
})

const wss = new WebSocketServer({ server, path: "/ws" })

wss.on("connection", (ws) => {
  sockets.set(ws, {})

  ws.on("message", (raw) => {
    try {
      handleMessage(ws, raw)
    } catch (error) {
      sendError(ws, error instanceof Error ? error.message : "Unexpected server error")
    }
  })

  ws.on("close", () => handleClose(ws))
})

const port = Number(process.env.PORT ?? 3000)
server.listen(port, () => {
  console.log(`Sitaratas server listening on port ${port}`)
})
