from __future__ import annotations

import random
import string
import threading
import time
import uuid

from .constants import VALID_ROOM_CAPACITIES
from .enums import GameStatus, PlayerStatus
from .game_manager import GameManager
from .models import Player, Room
from .services import LeaderboardManager


class RoomManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.lock = threading.RLock()
        self.game = GameManager(self)
        self.state_change_callback = None

    def set_state_change_callback(self, callback) -> None:
        self.state_change_callback = callback

    def notify_state_changed(self, room_code: str, message: str | None = None) -> None:
        if self.state_change_callback:
            self.state_change_callback(room_code, message)

    def create_room(
        self,
        capacity: int,
        player_name: str,
        player_id: str | None = None,
        socket_id: str | None = None,
    ) -> tuple[Room, Player]:
        if capacity not in VALID_ROOM_CAPACITIES:
            raise ValueError("Jumlah pemain harus 2 sampai 5.")

        with self.lock:
            host = Player(
                id=player_id or self._new_player_id(),
                name=player_name or "Player A",
                is_host=True,
                connected=True,
                socket_id=socket_id,
            )
            room = Room(
                code=self._generate_room_code(),
                capacity=capacity,
                host_player_id=host.id,
            )
            room.players[host.id] = host
            self.rooms[room.code] = room
            return room, host

    def join_room(
        self,
        code: str,
        player_name: str,
        player_id: str | None = None,
        socket_id: str | None = None,
    ) -> tuple[Room, Player, bool]:
        with self.lock:
            room = self._get_room_or_error(code)
            normalized_player_id = (player_id or "").strip()

            if normalized_player_id and normalized_player_id in room.players:
                player = room.players[normalized_player_id]
                self._mark_connected(player, player_name, socket_id)
                return room, player, True

            if room.game_status != GameStatus.WAITING:
                raise ValueError("Game di room ini sudah dimulai.")
            if len(room.players) >= room.capacity:
                raise ValueError("Room sudah penuh.")

            player = Player(
                id=normalized_player_id or self._new_player_id(),
                name=player_name or self._next_default_name(room),
                connected=True,
                socket_id=socket_id,
            )
            room.players[player.id] = player
            self.game.maybe_start_game(room)
            return room, player, False

    def reconnect_player(
        self,
        code: str,
        player_id: str,
        player_name: str | None = None,
        socket_id: str | None = None,
    ) -> tuple[Room, Player]:
        with self.lock:
            room = self._get_room_or_error(code)
            player = room.players.get(player_id)
            if not player:
                raise ValueError("Player tidak ditemukan di room ini.")

            self._mark_connected(player, player_name, socket_id)
            return room, player

    def disconnect_player_by_socket(self, socket_id: str) -> tuple[Room, Player] | None:
        with self.lock:
            for room in self.rooms.values():
                for player in room.players.values():
                    if player.socket_id == socket_id:
                        player.connected = False
                        player.socket_id = None
                        return room, player
        return None

    def leave_player_by_socket(self, socket_id: str) -> tuple[str, str, bool] | None:
        with self.lock:
            for room in list(self.rooms.values()):
                for player_id, player in list(room.players.items()):
                    if player.socket_id != socket_id:
                        continue

                    if room.game_status not in {GameStatus.WAITING, GameStatus.STARTING}:
                        player.connected = False
                        player.socket_id = None
                        return room.code, player.name, True

                    room.players.pop(player_id)
                    self._replace_host_if_needed(room, player_id)
                    self._cancel_countdown_if_needed(room)

                    if not room.players:
                        self.rooms.pop(room.code, None)
                        return room.code, player.name, False

                    return room.code, player.name, True
        return None

    def submit_guess(self, code: str, player_id: str, guess: int) -> dict:
        with self.lock:
            room = self._get_room_or_error(code)
            return self.game.submit_guess(room, player_id, guess)

    def play_again(self, code: str, player_id: str) -> Room:
        with self.lock:
            room = self._get_room_or_error(code)
            if room.game_status != GameStatus.GAME_OVER:
                raise ValueError("Game belum selesai.")
            if room.host_player_id != player_id:
                raise ValueError("Hanya host yang dapat memulai ulang.")

            self.game.restart_room(room)
            return room

    def snapshot(self, room: Room) -> dict:
        players = [player.snapshot() for player in room.players.values()]
        leaderboard = LeaderboardManager.build(room)
        scores = {player.id: round(player.score, 1) for player in room.players.values()}
        finished_players = [
            player.id
            for player in room.players.values()
            if player.status == PlayerStatus.FINISHED_ROUND
        ]
        pending_players = [
            player.id
            for player in room.players.values()
            if player.status != PlayerStatus.FINISHED_ROUND
        ]
        server_time = time.time()
        timer_end = room.round_completed_at or server_time
        round_elapsed_seconds = (
            max(0.0, timer_end - room.round_started_at)
            if room.round_started_at is not None
            else 0.0
        )
        countdown_remaining_seconds = (
            max(0.0, room.countdown_ends_at - server_time)
            if room.countdown_ends_at is not None
            else 0.0
        )

        return {
            "roomCode": room.code,
            "gameStatus": room.game_status.value,
            "currentRound": room.current_round,
            "maxRounds": room.max_rounds,
            "targetNumber": room.target_number,
            "currentTurn": None,
            "currentTurnName": None,
            "players": players,
            "scores": scores,
            "roundStatus": room.round_status.value,
            "winner": room.winner_player_id,
            "createdAt": room.created_at,
            "serverTime": server_time,
            "roundStartedAt": room.round_started_at,
            "roundCompletedAt": room.round_completed_at,
            "roundElapsedSeconds": round(round_elapsed_seconds, 1),
            "countdownStartedAt": room.countdown_started_at,
            "countdownEndsAt": room.countdown_ends_at,
            "countdownRemainingSeconds": round(countdown_remaining_seconds, 1),
            "finishedPlayers": finished_players,
            "pendingPlayers": pending_players,
            "capacity": room.capacity,
            "hostPlayerId": room.host_player_id,
            "leaderboard": leaderboard,
            "remainingPlayers": max(room.capacity - len(room.players), 0),
            "room_code": room.code,
            "status": room.game_status.value,
            "current_round": room.current_round,
            "total_rounds": room.max_rounds,
            "current_target_number": room.target_number,
            "current_turn_player_id": None,
            "current_turn_player_name": None,
            "host_player_id": room.host_player_id,
            "round_status": room.round_status.value,
            "round_winner_id": room.winner_player_id,
            "server_time": server_time,
            "round_started_at": room.round_started_at,
            "round_completed_at": room.round_completed_at,
            "round_elapsed_seconds": round(round_elapsed_seconds, 1),
            "countdown_started_at": room.countdown_started_at,
            "countdown_ends_at": room.countdown_ends_at,
            "countdown_remaining_seconds": round(countdown_remaining_seconds, 1),
        }

    def _generate_room_code(self) -> str:
        alphabet = string.ascii_uppercase + string.digits
        while True:
            code = "".join(random.choices(alphabet, k=6))
            if code not in self.rooms:
                return code

    def _get_room_or_error(self, code: str) -> Room:
        normalized_code = (code or "").strip().upper()
        room = self.rooms.get(normalized_code)
        if not room:
            raise ValueError("Room tidak ditemukan.")
        return room

    def _mark_connected(
        self, player: Player, player_name: str | None, socket_id: str | None
    ) -> None:
        player.connected = True
        player.socket_id = socket_id
        if player_name:
            player.name = player_name

    def _replace_host_if_needed(self, room: Room, removed_player_id: str) -> None:
        if removed_player_id != room.host_player_id or not room.players:
            return

        next_host = next(iter(room.players.values()))
        next_host.is_host = True
        room.host_player_id = next_host.id

    def _cancel_countdown_if_needed(self, room: Room) -> None:
        if room.game_status != GameStatus.STARTING or len(room.players) == room.capacity:
            return

        room.game_status = GameStatus.WAITING
        room.countdown_started_at = None
        room.countdown_ends_at = None

    def _new_player_id(self) -> str:
        return uuid.uuid4().hex

    def _next_default_name(self, room: Room) -> str:
        label = chr(ord("A") + len(room.players))
        return f"Player {label}"
