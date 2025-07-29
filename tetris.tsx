"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Pause, Play, RotateCcw, ArrowDown, ArrowLeft, ArrowRight, Square, Gamepad2 } from "lucide-react"

// Enhanced Tetris piece definitions with better colors
const TETROMINOES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    color: "#00f5ff",
    shadowColor: "#00d4e6",
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "#ffed4e",
    shadowColor: "#e6d445",
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#a855f7",
    shadowColor: "#9333ea",
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: "#22c55e",
    shadowColor: "#16a34a",
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: "#ef4444",
    shadowColor: "#dc2626",
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#3b82f6",
    shadowColor: "#2563eb",
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    color: "#f97316",
    shadowColor: "#ea580c",
  },
}

const BOARD_WIDTH = 10
const BOARD_HEIGHT = 20
const EMPTY_BOARD = Array(BOARD_HEIGHT)
  .fill(null)
  .map(() => Array(BOARD_WIDTH).fill(0))

type TetrominoType = keyof typeof TETROMINOES
type Board = number[][]
type Position = { x: number; y: number }

interface Piece {
  shape: number[][]
  color: string
  shadowColor: string
  position: Position
  type: TetrominoType
}

interface GameState {
  board: Board
  currentPiece: Piece | null
  heldPiece: TetrominoType | null
  canHold: boolean
  nextPieces: TetrominoType[]
  score: number
  level: number
  lines: number
  combo: number
  gameOver: boolean
  isPlaying: boolean
  isPaused: boolean
  lockDelay: number
  clearingLines: number[]
}

// 7-bag randomization system for better piece distribution
const createBag = (): TetrominoType[] => {
  const types = Object.keys(TETROMINOES) as TetrominoType[]
  const bag = [...types]

  // Fisher-Yates shuffle
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }

  return bag
}

const createPiece = (type: TetrominoType): Piece => {
  return {
    shape: TETROMINOES[type].shape,
    color: TETROMINOES[type].color,
    shadowColor: TETROMINOES[type].shadowColor,
    position: { x: Math.floor(BOARD_WIDTH / 2) - Math.floor(TETROMINOES[type].shape[0].length / 2), y: 0 },
    type,
  }
}

const rotatePiece = (piece: Piece): Piece => {
  const rotated = piece.shape[0].map((_, index) => piece.shape.map((row) => row[index]).reverse())
  return { ...piece, shape: rotated }
}

const isValidMove = (board: Board, piece: Piece, newPosition: Position): boolean => {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const newX = newPosition.x + x
        const newY = newPosition.y + y

        if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
          return false
        }

        if (newY >= 0 && board[newY][newX]) {
          return false
        }
      }
    }
  }
  return true
}

const getGhostPosition = (board: Board, piece: Piece): Position => {
  let ghostY = piece.position.y

  while (isValidMove(board, piece, { x: piece.position.x, y: ghostY + 1 })) {
    ghostY++
  }

  return { x: piece.position.x, y: ghostY }
}

const placePiece = (board: Board, piece: Piece): Board => {
  const newBoard = board.map((row) => [...row])

  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const boardY = piece.position.y + y
        const boardX = piece.position.x + x
        if (boardY >= 0) {
          newBoard[boardY][boardX] = 1
        }
      }
    }
  }

  return newBoard
}

const findFullLines = (board: Board): number[] => {
  const fullLines: number[] = []

  for (let y = 0; y < BOARD_HEIGHT; y++) {
    if (board[y].every((cell) => cell !== 0)) {
      fullLines.push(y)
    }
  }

  return fullLines
}

const clearLines = (board: Board, linesToClear: number[]): Board => {
  const newBoard = board.filter((_, index) => !linesToClear.includes(index))

  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(0))
  }

  return newBoard
}

const getScore = (linesCleared: number, level: number, combo: number, isSoftDrop = false): number => {
  const baseScores = [0, 100, 300, 500, 800]
  let score = baseScores[linesCleared] * (level + 1)

  // Combo bonus
  if (combo > 0) {
    score += 50 * combo * (level + 1)
  }

  // Soft drop bonus
  if (isSoftDrop) {
    score += 1
  }

  return score
}

export default function Tetris() {
  const [gameState, setGameState] = useState<GameState>({
    board: EMPTY_BOARD,
    currentPiece: null,
    heldPiece: null,
    canHold: true,
    nextPieces: [...createBag(), ...createBag()],
    score: 0,
    level: 0,
    lines: 0,
    combo: 0,
    gameOver: false,
    isPlaying: false,
    isPaused: false,
    lockDelay: 0,
    clearingLines: [],
  })

  const gameLoopRef = useRef<NodeJS.Timeout>()
  const lockDelayRef = useRef<NodeJS.Timeout>()
  const dropTimeRef = useRef(1000)
  const bagIndexRef = useRef(0)

  const getNextPiece = useCallback((): TetrominoType => {
    const piece = gameState.nextPieces[bagIndexRef.current]
    bagIndexRef.current++

    // Refill bag when running low
    if (bagIndexRef.current >= 7) {
      setGameState((prev) => ({
        ...prev,
        nextPieces: [...prev.nextPieces.slice(7), ...createBag()],
      }))
      bagIndexRef.current = 0
    }

    return piece
  }, [gameState.nextPieces])

  const spawnPiece = useCallback(() => {
    const pieceType = getNextPiece()
    const piece = createPiece(pieceType)

    if (!isValidMove(gameState.board, piece, piece.position)) {
      setGameState((prev) => ({ ...prev, gameOver: true, isPlaying: false }))
      return
    }

    setGameState((prev) => ({ ...prev, currentPiece: piece, canHold: true, lockDelay: 0 }))
  }, [gameState.board, getNextPiece])

  const holdPiece = useCallback(() => {
    if (!gameState.currentPiece || !gameState.canHold || gameState.gameOver || gameState.isPaused) return

    setGameState((prev) => {
      if (prev.heldPiece) {
        // Swap current piece with held piece
        const newPiece = createPiece(prev.heldPiece)
        return {
          ...prev,
          currentPiece: newPiece,
          heldPiece: prev.currentPiece!.type,
          canHold: false,
          lockDelay: 0,
        }
      } else {
        // Hold current piece and spawn new one
        const pieceType = getNextPiece()
        const newPiece = createPiece(pieceType)
        return {
          ...prev,
          currentPiece: newPiece,
          heldPiece: prev.currentPiece!.type,
          canHold: false,
          lockDelay: 0,
        }
      }
    })
  }, [gameState.currentPiece, gameState.canHold, gameState.gameOver, gameState.isPaused, getNextPiece])

  const movePiece = useCallback(
    (dx: number, dy: number, isSoftDrop = false) => {
      if (!gameState.currentPiece || gameState.gameOver || gameState.isPaused) return false

      const newPosition = { x: gameState.currentPiece.position.x + dx, y: gameState.currentPiece.position.y + dy }

      if (isValidMove(gameState.board, gameState.currentPiece, newPosition)) {
        setGameState((prev) => ({
          ...prev,
          currentPiece: { ...prev.currentPiece!, position: newPosition },
          lockDelay: dy > 0 ? prev.lockDelay + 1 : 0,
          score: isSoftDrop ? prev.score + 1 : prev.score,
        }))
        return true
      }
      return false
    },
    [gameState.currentPiece, gameState.board, gameState.gameOver, gameState.isPaused],
  )

  const rotatePieceHandler = useCallback(() => {
    if (!gameState.currentPiece || gameState.gameOver || gameState.isPaused) return

    const rotated = rotatePiece(gameState.currentPiece)

    // Try basic rotation first
    if (isValidMove(gameState.board, rotated, gameState.currentPiece.position)) {
      setGameState((prev) => ({
        ...prev,
        currentPiece: rotated,
        lockDelay: 0,
      }))
      return
    }

    // Try wall kicks (simplified)
    const kicks = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 },
    ]

    for (const kick of kicks) {
      const kickPosition = {
        x: gameState.currentPiece.position.x + kick.x,
        y: gameState.currentPiece.position.y + kick.y,
      }

      if (isValidMove(gameState.board, rotated, kickPosition)) {
        setGameState((prev) => ({
          ...prev,
          currentPiece: { ...rotated, position: kickPosition },
          lockDelay: 0,
        }))
        return
      }
    }
  }, [gameState.currentPiece, gameState.board, gameState.gameOver, gameState.isPaused])

  const lockPiece = useCallback(() => {
    if (!gameState.currentPiece) return

    const newBoard = placePiece(gameState.board, gameState.currentPiece)
    const fullLines = findFullLines(newBoard)

    if (fullLines.length > 0) {
      // Start line clearing animation
      setGameState((prev) => ({
        ...prev,
        board: newBoard,
        currentPiece: null,
        clearingLines: fullLines,
      }))

      // Clear lines after animation
      setTimeout(() => {
        const clearedBoard = clearLines(newBoard, fullLines)
        const linesCleared = fullLines.length
        const newLines = gameState.lines + linesCleared
        const newLevel = Math.floor(newLines / 10)
        const newCombo = gameState.combo + 1
        const scoreIncrease = getScore(linesCleared, gameState.level, newCombo)

        setGameState((prev) => ({
          ...prev,
          board: clearedBoard,
          lines: newLines,
          level: newLevel,
          combo: newCombo,
          score: prev.score + scoreIncrease,
          clearingLines: [],
        }))

        // Increase speed with level
        dropTimeRef.current = Math.max(50, 1000 - newLevel * 50)
      }, 500)
    } else {
      setGameState((prev) => ({
        ...prev,
        board: newBoard,
        currentPiece: null,
        combo: 0,
      }))
    }
  }, [gameState.currentPiece, gameState.board, gameState.lines, gameState.level, gameState.combo])

  const dropPiece = useCallback(() => {
    if (!gameState.currentPiece || gameState.gameOver || gameState.isPaused) return

    if (!movePiece(0, 1)) {
      // Start lock delay if piece can't move down
      if (gameState.lockDelay < 10) {
        if (lockDelayRef.current) clearTimeout(lockDelayRef.current)
        lockDelayRef.current = setTimeout(() => {
          lockPiece()
        }, 500)
      } else {
        lockPiece()
      }
    }
  }, [gameState.currentPiece, gameState.gameOver, gameState.isPaused, gameState.lockDelay, movePiece, lockPiece])

  const hardDrop = useCallback(() => {
    if (!gameState.currentPiece || gameState.gameOver || gameState.isPaused) return

    const ghostPos = getGhostPosition(gameState.board, gameState.currentPiece)
    const dropDistance = ghostPos.y - gameState.currentPiece.position.y

    setGameState((prev) => ({
      ...prev,
      currentPiece: { ...prev.currentPiece!, position: ghostPos },
      score: prev.score + dropDistance * 2,
    }))

    setTimeout(() => lockPiece(), 50)
  }, [gameState.currentPiece, gameState.board, gameState.gameOver, gameState.isPaused, lockPiece])

  // Game loop
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isPaused && !gameState.gameOver) {
      gameLoopRef.current = setInterval(() => {
        dropPiece()
      }, dropTimeRef.current)
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState.isPlaying, gameState.isPaused, gameState.gameOver, dropPiece])

  // Spawn new piece when current piece is null
  useEffect(() => {
    if (gameState.isPlaying && !gameState.currentPiece && !gameState.gameOver && gameState.clearingLines.length === 0) {
      const timer = setTimeout(() => spawnPiece(), 100)
      return () => clearTimeout(timer)
    }
  }, [gameState.currentPiece, gameState.isPlaying, gameState.gameOver, gameState.clearingLines.length, spawnPiece])

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameState.isPlaying || gameState.gameOver) return

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          movePiece(-1, 0)
          break
        case "ArrowRight":
          e.preventDefault()
          movePiece(1, 0)
          break
        case "ArrowDown":
          e.preventDefault()
          movePiece(0, 1, true)
          break
        case "ArrowUp":
          e.preventDefault()
          rotatePieceHandler()
          break
        case " ":
          e.preventDefault()
          hardDrop()
          break
        case "c":
        case "C":
          e.preventDefault()
          holdPiece()
          break
        case "p":
        case "P":
          e.preventDefault()
          setGameState((prev) => ({ ...prev, isPaused: !prev.isPaused }))
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameState.isPlaying, gameState.gameOver, movePiece, rotatePieceHandler, hardDrop, holdPiece])

  const startGame = () => {
    bagIndexRef.current = 0
    setGameState({
      board: EMPTY_BOARD,
      currentPiece: null,
      heldPiece: null,
      canHold: true,
      nextPieces: [...createBag(), ...createBag()],
      score: 0,
      level: 0,
      lines: 0,
      combo: 0,
      gameOver: false,
      isPlaying: true,
      isPaused: false,
      lockDelay: 0,
      clearingLines: [],
    })
    dropTimeRef.current = 1000
  }

  const pauseGame = () => {
    setGameState((prev) => ({ ...prev, isPaused: !prev.isPaused }))
  }

  // Render the game board with current piece and ghost piece
  const renderBoard = () => {
    const displayBoard = gameState.board.map((row) => [...row])

    // Add ghost piece
    if (gameState.currentPiece) {
      const ghostPos = getGhostPosition(gameState.board, gameState.currentPiece)

      for (let y = 0; y < gameState.currentPiece.shape.length; y++) {
        for (let x = 0; x < gameState.currentPiece.shape[y].length; x++) {
          if (gameState.currentPiece.shape[y][x]) {
            const boardY = ghostPos.y + y
            const boardX = ghostPos.x + x
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              if (displayBoard[boardY][boardX] === 0) {
                displayBoard[boardY][boardX] = 3 // Ghost piece
              }
            }
          }
        }
      }

      // Add current piece
      for (let y = 0; y < gameState.currentPiece.shape.length; y++) {
        for (let x = 0; x < gameState.currentPiece.shape[y].length; x++) {
          if (gameState.currentPiece.shape[y][x]) {
            const boardY = gameState.currentPiece.position.y + y
            const boardX = gameState.currentPiece.position.x + x
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = 2 // Current piece
            }
          }
        }
      }
    }

    return displayBoard
  }

  const renderPiecePreview = (pieceType: TetrominoType, size: "sm" | "md" = "md") => {
    const pieceShape = TETROMINOES[pieceType].shape
    const pieceColor = TETROMINOES[pieceType].color
    const cellSize = size === "sm" ? "w-2 h-2" : "w-3 h-3"

    return (
      <div className="grid gap-0.5">
        {pieceShape.map((row, y) => (
          <div key={y} className="flex gap-0.5">
            {row.map((cell, x) => (
              <div
                key={x}
                className={`${cellSize} rounded-sm transition-all duration-200`}
                style={{
                  backgroundColor: cell ? pieceColor : "transparent",
                  boxShadow: cell ? `0 0 6px ${pieceColor}40` : "none",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  const getCellStyle = (cell: number, rowIndex: number) => {
    const isClearing = gameState.clearingLines.includes(rowIndex)

    if (cell === 0) {
      return {
        backgroundColor: "rgba(15, 23, 42, 0.8)",
        border: "1px solid rgba(51, 65, 85, 0.3)",
      }
    }

    if (cell === 1) {
      return {
        backgroundColor: isClearing ? "#fbbf24" : "#64748b",
        border: "1px solid rgba(148, 163, 184, 0.5)",
        boxShadow: isClearing ? "0 0 12px #fbbf24" : "inset 0 1px 0 rgba(255,255,255,0.1)",
      }
    }

    if (cell === 2 && gameState.currentPiece) {
      return {
        backgroundColor: gameState.currentPiece.color,
        border: `1px solid ${gameState.currentPiece.shadowColor}`,
        boxShadow: `0 0 8px ${gameState.currentPiece.color}40, inset 0 1px 0 rgba(255,255,255,0.2)`,
      }
    }

    if (cell === 3 && gameState.currentPiece) {
      return {
        backgroundColor: "transparent",
        border: `2px dashed ${gameState.currentPiece.color}60`,
        borderRadius: "2px",
      }
    }

    return {}
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-md border-b border-gray-700/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                TETRIS
              </h1>
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Score:</span>
                  <span className="font-mono font-bold text-cyan-400">{gameState.score.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Level:</span>
                  <span className="font-mono font-bold text-purple-400">{gameState.level}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Lines:</span>
                  <span className="font-mono font-bold text-green-400">{gameState.lines}</span>
                </div>
                {gameState.combo > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Combo:</span>
                    <span className="font-mono font-bold text-yellow-400 animate-pulse">{gameState.combo}x</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!gameState.isPlaying ? (
                <Button
                  onClick={startGame}
                  size="sm"
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
                >
                  <Play className="w-4 h-4 mr-1" />
                  {gameState.gameOver ? "Restart" : "Start"}
                </Button>
              ) : (
                <Button
                  onClick={pauseGame}
                  size="sm"
                  variant="outline"
                  className="bg-gray-800/50 border-gray-600 hover:bg-gray-700/50"
                >
                  {gameState.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Stats */}
      <div className="sm:hidden bg-black/10 backdrop-blur-sm border-b border-gray-700/30">
        <div className="container mx-auto px-4 py-2">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Score:</span>
              <span className="font-mono font-bold text-cyan-400">{gameState.score.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Level:</span>
              <span className="font-mono font-bold text-purple-400">{gameState.level}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Lines:</span>
              <span className="font-mono font-bold text-green-400">{gameState.lines}</span>
            </div>
            {gameState.combo > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Combo:</span>
                <span className="font-mono font-bold text-yellow-400 animate-pulse">{gameState.combo}x</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start justify-center">
          {/* Side Panels - Desktop */}
          <div className="hidden lg:flex flex-col gap-4 w-32">
            {/* Hold */}
            <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
              <CardContent className="p-3">
                <div className="text-xs font-medium text-gray-300 mb-2">HOLD</div>
                <div className="bg-gray-800/30 rounded p-2 min-h-[60px] flex items-center justify-center">
                  {gameState.heldPiece ? (
                    renderPiecePreview(gameState.heldPiece, "sm")
                  ) : (
                    <Square className="w-6 h-6 text-gray-600" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Controls */}
            <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
              <CardContent className="p-3">
                <div className="text-xs font-medium text-gray-300 mb-2">CONTROLS</div>
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>Move</span>
                    <span className="font-mono">← →</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Drop</span>
                    <span className="font-mono">↓</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rotate</span>
                    <span className="font-mono">↑</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hard</span>
                    <span className="font-mono">Space</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hold</span>
                    <span className="font-mono">C</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Game Board */}
          <div className="flex-1 max-w-md mx-auto">
            <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm relative overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                <div
                  className="grid gap-0.5 bg-slate-900/80 p-2 sm:p-3 rounded-lg border border-gray-700/50 relative mx-auto"
                  style={{
                    gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
                    maxWidth: "320px",
                  }}
                >
                  {renderBoard().map((row, y) =>
                    row.map((cell, x) => (
                      <div
                        key={`${y}-${x}`}
                        className={`w-6 h-6 sm:w-7 sm:h-7 transition-all duration-200 ${
                          gameState.clearingLines.includes(y) ? "animate-pulse" : ""
                        }`}
                        style={getCellStyle(cell, y)}
                      />
                    )),
                  )}

                  {/* Game Over Overlay */}
                  {gameState.gameOver && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                      <div className="text-center space-y-4">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                          Game Over
                        </h2>
                        <p className="text-gray-300">Score: {gameState.score.toLocaleString()}</p>
                        <Button
                          onClick={startGame}
                          className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
                        >
                          Play Again
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Pause Overlay */}
                  {gameState.isPaused && !gameState.gameOver && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                      <div className="text-center space-y-4">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                          Paused
                        </h2>
                        <p className="text-gray-300">Press P to resume</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Side Panels - Desktop Right */}
          <div className="hidden lg:flex flex-col gap-4 w-32">
            {/* Next */}
            <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
              <CardContent className="p-3">
                <div className="text-xs font-medium text-gray-300 mb-2">NEXT</div>
                <div className="space-y-2">
                  {gameState.nextPieces.slice(bagIndexRef.current, bagIndexRef.current + 3).map((pieceType, index) => (
                    <div
                      key={index}
                      className={`bg-gray-800/30 rounded p-2 min-h-[50px] flex items-center justify-center ${
                        index === 0 ? "" : "opacity-60 scale-90"
                      }`}
                    >
                      {renderPiecePreview(pieceType, "sm")}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Side Panels */}
          <div className="lg:hidden w-full">
            <div className="flex gap-4 justify-center">
              {/* Hold - Mobile */}
              <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm flex-1 max-w-[120px]">
                <CardContent className="p-3">
                  <div className="text-xs font-medium text-gray-300 mb-2 text-center">HOLD</div>
                  <div className="bg-gray-800/30 rounded p-2 min-h-[60px] flex items-center justify-center">
                    {gameState.heldPiece ? (
                      renderPiecePreview(gameState.heldPiece, "sm")
                    ) : (
                      <Square className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Next - Mobile */}
              <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm flex-1 max-w-[120px]">
                <CardContent className="p-3">
                  <div className="text-xs font-medium text-gray-300 mb-2 text-center">NEXT</div>
                  <div className="bg-gray-800/30 rounded p-2 min-h-[60px] flex items-center justify-center">
                    {gameState.nextPieces[bagIndexRef.current] &&
                      renderPiecePreview(gameState.nextPieces[bagIndexRef.current], "sm")}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Mobile Controls */}
        <div className="lg:hidden mt-4">
          <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Gamepad2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-300">Touch Controls</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 h-12"
                  onTouchStart={(e) => {
                    e.preventDefault()
                    movePiece(-1, 0)
                  }}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 h-12"
                  onTouchStart={(e) => {
                    e.preventDefault()
                    movePiece(0, 1, true)
                  }}
                >
                  <ArrowDown className="w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 h-12"
                  onTouchStart={(e) => {
                    e.preventDefault()
                    movePiece(1, 0)
                  }}
                >
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 h-12"
                  onTouchStart={(e) => {
                    e.preventDefault()
                    rotatePieceHandler()
                  }}
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800/50 border-gray-600 hover:bg-gray-700/50"
                  onTouchStart={(e) => {
                    e.preventDefault()
                    hardDrop()
                  }}
                >
                  Hard Drop
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 disabled:opacity-30"
                  disabled={!gameState.canHold || !gameState.currentPiece}
                  onTouchStart={(e) => {
                    e.preventDefault()
                    holdPiece()
                  }}
                >
                  Hold
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 pb-4 text-center">
          <p className="text-sm text-gray-400">Made by Marco Soto 🎲</p>
        </div>
      </div>
    </div>
  )
}
