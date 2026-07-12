from flask import Flask, render_template

try:
    from flask_socketio import SocketIO
except ModuleNotFoundError:
    SocketIO = None

from server import RoomManager


app = Flask(__name__)
app.secret_key = "rahasia-tebakan"

room_manager = RoomManager()
socketio = (
    SocketIO(app, cors_allowed_origins="*", async_mode="threading")
    if SocketIO is not None
    else None
)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/reset")
def reset():
    return render_template("index.html")


if socketio is not None:
    from server.socket_events import register_socket_events

    register_socket_events(socketio, room_manager)


if __name__ == "__main__":
    if socketio is None:
        raise SystemExit(
            "Flask-SocketIO belum terinstall. Jalankan: pip install -r requirements.txt"
        )

    socketio.run(
        app,
        host="127.0.0.1",
        port=5000,
        debug=True,
        use_reloader=False,
        allow_unsafe_werkzeug=True,
    )
