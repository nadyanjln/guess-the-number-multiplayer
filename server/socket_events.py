from __future__ import annotations

from flask import request
from flask_socketio import emit, join_room as socket_join_room

from .room_manager import RoomManager


def register_socket_events(socketio, room_manager: RoomManager) -> None:
    def broadcast_room_state(room_code: str, message: str | None = None) -> None:
        with room_manager.lock:
            room = room_manager.rooms.get(room_code)
            if not room:
                return
            state = room_manager.snapshot(room)

        socketio.emit("roomState", {"state": state, "message": message}, to=room_code)

    room_manager.set_state_change_callback(broadcast_room_state)

    @socketio.on("connect")
    def handle_connect():
        emit("socketReady", {"message": "Socket connected."})

    @socketio.on("createRoom")
    def handle_create_room(data):
        try:
            data = data or {}
            room, player = room_manager.create_room(
                capacity=int(data.get("capacity", 2)),
                player_name=data.get("playerName") or "Player A",
                player_id=data.get("playerId") or None,
                socket_id=request.sid,
            )
            socket_join_room(room.code)
            emit(
                "roomCreated",
                {
                    "playerId": player.id,
                    "playerName": player.name,
                    "roomCode": room.code,
                    "state": room_manager.snapshot(room),
                },
            )
            broadcast_room_state(room.code, "Room dibuat.")
        except (TypeError, ValueError) as exc:
            emit("gameError", {"error": str(exc)})

    @socketio.on("joinRoom")
    def handle_join_room(data):
        try:
            data = data or {}
            room, player, reconnected = room_manager.join_room(
                code=data.get("roomCode") or "",
                player_name=data.get("playerName") or "",
                player_id=data.get("playerId") or None,
                socket_id=request.sid,
            )
            socket_join_room(room.code)
            emit(
                "roomJoined",
                {
                    "playerId": player.id,
                    "playerName": player.name,
                    "roomCode": room.code,
                    "state": room_manager.snapshot(room),
                },
            )
            message = (
                f"{player.name} reconnect."
                if reconnected
                else f"{player.name} masuk room."
            )
            broadcast_room_state(room.code, message)
        except ValueError as exc:
            emit("gameError", {"error": str(exc)})

    @socketio.on("reconnectPlayer")
    def handle_reconnect_player(data):
        try:
            data = data or {}
            room, player = room_manager.reconnect_player(
                code=data.get("roomCode") or "",
                player_id=data.get("playerId") or "",
                player_name=data.get("playerName") or None,
                socket_id=request.sid,
            )
            socket_join_room(room.code)
            emit(
                "roomReconnected",
                {
                    "playerId": player.id,
                    "playerName": player.name,
                    "roomCode": room.code,
                    "state": room_manager.snapshot(room),
                },
            )
            broadcast_room_state(room.code, f"{player.name} reconnect.")
        except ValueError as exc:
            emit("reconnectFailed", {"error": str(exc)})

    @socketio.on("submitGuess")
    def handle_submit_guess(data):
        try:
            data = data or {}
            result = room_manager.submit_guess(
                code=data.get("roomCode") or "",
                player_id=data.get("playerId") or "",
                guess=int(data.get("guess")),
            )
            emit(
                "guessResult",
                {
                    "message": result.get("message"),
                    "correct": result.get("correct", False),
                    "score": result.get("score"),
                },
            )
            broadcast_room_state(
                data.get("roomCode") or "",
                result.get("message") if result.get("roundComplete") else None,
            )
        except (TypeError, ValueError) as exc:
            emit("gameError", {"error": str(exc)})

    @socketio.on("playAgain")
    def handle_play_again(data):
        try:
            data = data or {}
            room = room_manager.play_again(
                code=data.get("roomCode") or "",
                player_id=data.get("playerId") or "",
            )
            broadcast_room_state(room.code, "Game dimulai ulang.")
        except ValueError as exc:
            emit("gameError", {"error": str(exc)})

    @socketio.on("disconnectPlayer")
    def handle_disconnect_player(data):
        leave_result = room_manager.leave_player_by_socket(request.sid)
        if not leave_result:
            return

        room_code, player_name, room_exists = leave_result
        if room_exists:
            broadcast_room_state(room_code, f"{player_name} left the room.")

    @socketio.on("disconnect")
    def handle_disconnect():
        room_player = room_manager.disconnect_player_by_socket(request.sid)
        if room_player:
            room, player = room_player
            broadcast_room_state(room.code, f"{player.name} offline.")
