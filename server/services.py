from __future__ import annotations

import random
import time

from .constants import MAX_GUESS, MIN_GUESS
from .enums import GameStatus, PlayerStatus, RoundStatus
from .models import Room


class ScoreManager:
    @staticmethod
    def calculate(attempts: int, duration_seconds: float) -> float:
        score = 100 - (attempts * 5) - (duration_seconds * 0.5)
        return max(0.0, round(score, 1))


class LeaderboardManager:
    @staticmethod
    def build(room: Room) -> list[dict]:
        rows = sorted(
            room.players.values(),
            key=lambda player: (-player.score, player.attempts, player.name),
        )
        return [
            {
                "rank": index + 1,
                "playerId": player.id,
                "playerName": player.name,
                "score": round(player.score, 1),
                "attempts": player.attempts,
                "status": player.status.value,
                "connected": player.connected,
                "roundScore": round(player.round_score, 1),
                "roundDuration": round(player.round_duration, 1)
                if player.round_duration is not None
                else None,
                "player_id": player.id,
                "name": player.name,
                "guess_count": player.attempts,
                "round_score": round(player.round_score, 1),
                "round_duration": round(player.round_duration, 1)
                if player.round_duration is not None
                else None,
            }
            for index, player in enumerate(rows)
        ]


class RoundManager:
    @staticmethod
    def generate_target(existing_targets: list[int]) -> int:
        available_numbers = [
            number
            for number in range(MIN_GUESS, MAX_GUESS + 1)
            if number not in existing_targets
        ]
        return random.choice(available_numbers)

    @staticmethod
    def prepare_round(room: Room) -> None:
        room.game_status = GameStatus.PLAYING
        room.round_status = RoundStatus.PLAYING
        room.target_number = RoundManager.generate_target(room.target_numbers)
        room.target_numbers.append(room.target_number)
        room.winner_player_id = None
        room.round_started_at = time.time()
        room.round_completed_at = None
        room.countdown_started_at = None
        room.countdown_ends_at = None

        for player in room.players.values():
            player.status = PlayerStatus.PLAYING
            player.attempts = 0
            player.round_duration = None
            player.round_score = 0.0
            player.last_hint = None
