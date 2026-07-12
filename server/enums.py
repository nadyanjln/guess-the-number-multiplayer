from enum import Enum


class GameStatus(str, Enum):
    WAITING = "WAITING"
    STARTING = "STARTING"
    PLAYING = "PLAYING"
    ROUND_COMPLETE = "ROUND_COMPLETE"
    GAME_OVER = "GAME_OVER"


class RoundStatus(str, Enum):
    WAITING = "WAITING"
    PLAYING = "PLAYING"
    COMPLETE = "COMPLETE"


class PlayerStatus(str, Enum):
    WAITING = "WAITING"
    PLAYING = "PLAYING"
    FINISHED_ROUND = "FINISHED_ROUND"
