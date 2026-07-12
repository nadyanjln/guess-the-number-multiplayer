from __future__ import annotations

import time
from collections import OrderedDict
from dataclasses import dataclass, field

from .constants import TOTAL_ROUNDS
from .enums import GameStatus, PlayerStatus, RoundStatus


@dataclass
class Player:
    id: str
    name: str
    is_host: bool = False
    score: float = 0.0
    status: PlayerStatus = PlayerStatus.WAITING
    attempts: int = 0
    connected: bool = True
    socket_id: str | None = None
    round_duration: float | None = None
    round_score: float = 0.0
    last_hint: str | None = None

    def snapshot(self) -> dict:
        round_duration = (
            round(self.round_duration, 1) if self.round_duration is not None else None
        )
        return {
            "playerId": self.id,
            "playerName": self.name,
            "score": round(self.score, 1),
            "attempts": self.attempts,
            "status": self.status.value,
            "connected": self.connected,
            "isHost": self.is_host,
            "roundScore": round(self.round_score, 1),
            "roundDuration": round_duration,
            "lastHint": self.last_hint,
            "id": self.id,
            "name": self.name,
            "total_score": round(self.score, 1),
            "guess_count": self.attempts,
            "is_host": self.is_host,
            "round_score": round(self.round_score, 1),
            "round_duration": round_duration,
            "last_hint": self.last_hint,
        }


@dataclass
class Room:
    code: str
    capacity: int
    host_player_id: str
    players: "OrderedDict[str, Player]" = field(default_factory=OrderedDict)
    game_status: GameStatus = GameStatus.WAITING
    round_status: RoundStatus = RoundStatus.WAITING
    current_round_index: int = 0
    max_rounds: int = TOTAL_ROUNDS
    target_numbers: list[int] = field(default_factory=list)
    target_number: int | None = None
    winner_player_id: str | None = None
    created_at: float = field(default_factory=time.time)
    round_started_at: float | None = None
    round_completed_at: float | None = None
    countdown_started_at: float | None = None
    countdown_ends_at: float | None = None

    @property
    def current_round(self) -> int:
        if self.game_status in {GameStatus.WAITING, GameStatus.STARTING}:
            return 0
        return self.current_round_index + 1
