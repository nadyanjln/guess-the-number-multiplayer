from __future__ import annotations

import threading
import time
from typing import TYPE_CHECKING

from .constants import (
    MAX_GUESS,
    MIN_GUESS,
    NEXT_ROUND_DELAY_SECONDS,
    START_COUNTDOWN_SECONDS,
)
from .enums import GameStatus, PlayerStatus, RoundStatus
from .models import Room
from .services import RoundManager, ScoreManager

if TYPE_CHECKING:
    from .room_manager import RoomManager


class GameManager:
    def __init__(self, room_manager: "RoomManager"):
        self.room_manager = room_manager

    def maybe_start_game(self, room: Room) -> None:
        if room.game_status != GameStatus.WAITING:
            return
        if len(room.players) != room.capacity:
            return

        self.start_countdown(room)

    def start_countdown(self, room: Room) -> None:
        now = time.time()
        room.game_status = GameStatus.STARTING
        room.round_status = RoundStatus.WAITING
        room.current_round_index = 0
        room.target_numbers = []
        room.target_number = None
        room.winner_player_id = None
        room.round_started_at = None
        room.round_completed_at = None
        room.countdown_started_at = now
        room.countdown_ends_at = now + START_COUNTDOWN_SECONDS

        for player in room.players.values():
            player.status = PlayerStatus.WAITING
            player.attempts = 0
            player.round_duration = None
            player.round_score = 0.0
            player.last_hint = None

        self._schedule_game_start(room.code)

    def begin_game_after_countdown(self, room_code: str) -> None:
        with self.room_manager.lock:
            room = self.room_manager.rooms.get(room_code)
            if not room or room.game_status != GameStatus.STARTING:
                return

            if len(room.players) != room.capacity:
                room.game_status = GameStatus.WAITING
                room.countdown_started_at = None
                room.countdown_ends_at = None
                message = "Waiting for other players..."
            else:
                RoundManager.prepare_round(room)
                message = "Game started."

        self.room_manager.notify_state_changed(room_code, message)

    def submit_guess(self, room: Room, player_id: str, guess: int) -> dict:
        self._validate_guess(room, player_id, guess)

        player = room.players[player_id]
        player.attempts += 1

        if guess != room.target_number:
            player.last_hint = "Terlalu kecil" if guess < room.target_number else "Terlalu besar"
            return {
                "message": player.last_hint,
                "correct": False,
                "roundComplete": False,
                "state": self.room_manager.snapshot(room),
            }

        earned_score = self._finish_player_round(room, player_id)
        round_complete = self._all_players_finished(room)
        message = f"{player.name} benar dan terkunci untuk ronde ini."

        if round_complete:
            self._complete_round(room)
            message = f"Semua pemain selesai. Angka ronde ini {room.target_number}."

        return {
            "message": message,
            "correct": True,
            "roundComplete": round_complete,
            "score": earned_score,
            "state": self.room_manager.snapshot(room),
        }

    def advance_after_round(self, room_code: str) -> None:
        message = "Ronde baru dimulai."
        with self.room_manager.lock:
            room = self.room_manager.rooms.get(room_code)
            if not room or room.game_status != GameStatus.ROUND_COMPLETE:
                return

            if room.current_round_index + 1 >= room.max_rounds:
                room.game_status = GameStatus.GAME_OVER
                room.round_status = RoundStatus.COMPLETE
                message = "Game selesai. Final leaderboard tersedia."
            else:
                room.current_round_index += 1
                RoundManager.prepare_round(room)

        self.room_manager.notify_state_changed(room_code, message)

    def restart_room(self, room: Room) -> None:
        for player in room.players.values():
            player.score = 0.0

        self.start_countdown(room)

    def _validate_guess(self, room: Room, player_id: str, guess: int) -> None:
        if room.game_status != GameStatus.PLAYING or room.round_status != RoundStatus.PLAYING:
            raise ValueError("Ronde belum aktif.")
        if guess < MIN_GUESS or guess > MAX_GUESS:
            raise ValueError("Tebakan harus berada di rentang 1 sampai 100.")
        if player_id not in room.players:
            raise ValueError("Pemain tidak ditemukan di room ini.")

        player = room.players[player_id]
        if player.status == PlayerStatus.FINISHED_ROUND:
            raise ValueError("Pemain ini sudah menyelesaikan ronde.")
        if player.status != PlayerStatus.PLAYING:
            raise ValueError("Pemain belum aktif di ronde ini.")

    def _finish_player_round(self, room: Room, player_id: str) -> float:
        player = room.players[player_id]
        duration = time.time() - (room.round_started_at or time.time())
        earned_score = ScoreManager.calculate(player.attempts, duration)

        player.score += earned_score
        player.round_score = earned_score
        player.round_duration = duration
        player.status = PlayerStatus.FINISHED_ROUND
        player.last_hint = "Benar"

        if room.winner_player_id is None:
            room.winner_player_id = player.id

        return earned_score

    def _complete_round(self, room: Room) -> None:
        room.game_status = GameStatus.ROUND_COMPLETE
        room.round_status = RoundStatus.COMPLETE
        room.round_completed_at = time.time()
        self._schedule_next_step(room.code)

    def _all_players_finished(self, room: Room) -> bool:
        return (
            len(room.players) == room.capacity
            and all(player.status == PlayerStatus.FINISHED_ROUND for player in room.players.values())
        )

    def _schedule_next_step(self, room_code: str) -> None:
        timer = threading.Timer(NEXT_ROUND_DELAY_SECONDS, self.advance_after_round, args=[room_code])
        timer.daemon = True
        timer.start()

    def _schedule_game_start(self, room_code: str) -> None:
        timer = threading.Timer(
            START_COUNTDOWN_SECONDS,
            self.begin_game_after_countdown,
            args=[room_code],
        )
        timer.daemon = True
        timer.start()
