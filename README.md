# Guess The Number Multiplayer

## Project Overview

**Guess The Number Multiplayer** adalah game tebak angka casual berbasis room. Pemain masuk ke room yang sama, menunggu room penuh di Waiting Hall, lalu menebak angka target yang sama secara real-time pada setiap ronde.

Tujuan proyek ini adalah mengubah game Guess the Number dari single-player menjadi multiplayer game yang sinkron, responsif, dan mudah dikembangkan.

## Features

| Feature | Description |
| --- | --- |
| Multiplayer Room | Pemain bermain di room yang dibuat oleh host. |
| Create & Join Room | Host membuat room, pemain lain join menggunakan room code. |
| Waiting Hall | Game belum dimulai sampai jumlah pemain memenuhi kapasitas room. |
| Synced Countdown | Countdown `3, 2, 1, GO!` dikontrol server sebelum game dimulai. |
| Real-time Gameplay | State game disinkronkan melalui Socket.IO. |
| Random Number 1-100 | Server membuat angka target acak untuk setiap ronde. |
| Hint | Hint tebakan bersifat personal: Too High, Too Low, atau Correct. |
| Multiple Rounds | Game berjalan selama 5 ronde. |
| Timer | Timer ronde dimulai saat ronde aktif dan berhenti saat semua pemain selesai. |
| Score System | Skor dihitung server berdasarkan jumlah tebakan dan waktu penyelesaian ronde. |
| Leaderboard | Ranking diperbarui real-time, menampilkan semua pemain, skor, koneksi, host, dan status ronde. |
| Player Status | Status pemain ditampilkan langsung di leaderboard: `WAITING`, `PLAYING`, `FINISHED_ROUND`. |
| Auto Reconnect | Browser refresh dapat reconnect memakai identitas pemain di `localStorage`. |
| Responsive UI | UI Tailwind responsif untuk desktop, tablet, dan mobile. |

## Tech Stack

| Technology | Purpose |
| --- | --- |
| Python | Bahasa utama backend. |
| Flask | Web framework dan template rendering. |
| Flask-SocketIO | Komunikasi real-time antara server dan client. |
| Socket.IO Client | Event handling real-time di browser. |
| Tailwind CSS | Styling UI modern dan responsif. |
| Lucide Icons | Icon set untuk UI. |
| In-memory Store | Penyimpanan state room sementara di memory server. |

## Implementation Plan

1. Backend menjadi sumber utama state room, player, ronde, skor, dan leaderboard.
2. Client membuat atau join room melalui Socket.IO, lalu menyimpan identitas minimal di `localStorage`.
3. Server mengirim snapshot room terbaru setiap ada perubahan state penting.
4. Waiting Hall menampilkan slot pemain sampai kapasitas room terpenuhi.
5. Saat room penuh, server menjalankan countdown sinkron dan memulai ronde.
6. Selama ronde aktif, setiap tebakan divalidasi server dan hint hanya dikirim ke pemain terkait.
7. Skor dihitung server ketika pemain berhasil menebak angka benar.
8. Leaderboard menggabungkan ranking, skor, host badge, koneksi, dan status setiap pemain.
9. Setelah semua ronde selesai, final leaderboard dan podium ditampilkan dari snapshot server.

## Project Structure

```text
tugas_akhir/
|-- app.py                  # Flask app entrypoint
|-- game.py                 # Compatibility exports untuk import lama
|-- requirements.txt        # Python dependencies
|-- README.md
|-- LICENSE
|-- server/
|   |-- __init__.py
|   |-- constants.py        # Konstanta game
|   |-- enums.py            # Enum status game, round, dan player
|   |-- models.py           # Dataclass Room dan Player
|   |-- services.py         # Score, leaderboard, dan round helpers
|   |-- game_manager.py     # Game flow, scoring, countdown, round transition
|   |-- room_manager.py     # Room registry, reconnect, snapshots
|   `-- socket_events.py    # Socket.IO event handlers
|-- static/
|   `-- js/
|       |-- constants.js    # Client constants
|       |-- state.js        # Client-side identity/session state
|       |-- utils.js        # UI helpers
|       |-- ui.js           # Rendering functions
|       `-- main.js         # DOM events dan Socket.IO client wiring
`-- templates/
    `-- index.html          # Tailwind HTML shell
```

## Installation

### Clone Project

```bash
git clone <repository-url>
cd tugas_akhir
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Run Server

```bash
python app.py
```

Server berjalan di:

```text
http://127.0.0.1:5000/
```

### Run Client

Client disajikan langsung oleh Flask. Buka browser ke:

```text
http://127.0.0.1:5000/
```

Untuk simulasi multiplayer, buka URL yang sama di beberapa browser atau tab.

## How to Play

1. Masukkan nama pemain.
2. Host memilih **Make a Room** dan menentukan kapasitas pemain.
3. Server membuat room code.
4. Pemain lain memilih **Join Game** dan memasukkan room code.
5. Semua pemain masuk ke **Waiting Hall**.
6. Waiting Hall menampilkan room code, daftar pemain, status koneksi, host badge, dan jumlah pemain.
7. Game tidak dimulai sampai jumlah pemain sesuai kapasitas room.
8. Saat room penuh, server mengubah status room menjadi `STARTING`.
9. Semua client melihat countdown sinkron: `3`, `2`, `1`, `GO!`.
10. Setelah countdown selesai, server membuat angka target ronde pertama dan status berubah menjadi `PLAYING`.
11. Semua pemain menebak angka target yang sama pada ronde yang sama.
12. Jika tebakan salah, pemain mendapat hint personal.
13. Jika tebakan benar, pemain berstatus `FINISHED_ROUND`, skor ronde langsung dikunci, dan pemain menunggu pemain lain.
14. Ronde berikutnya dimulai setelah semua pemain menyelesaikan ronde berjalan.
15. Leaderboard selalu menampilkan semua pemain beserta skor, status koneksi, host badge, dan status ronde.
16. Setelah seluruh ronde selesai, game menampilkan final leaderboard.

## Game States

| Room Status | Meaning |
| --- | --- |
| `WAITING` | Room sudah dibuat, pemain menunggu kapasitas room terpenuhi. |
| `STARTING` | Room penuh dan countdown server sedang berjalan. |
| `PLAYING` | Ronde aktif, pemain yang belum finished boleh menebak. |
| `ROUND_COMPLETE` | Semua pemain sudah menyelesaikan ronde berjalan. |
| `GAME_OVER` | Semua ronde selesai dan final leaderboard ditampilkan. |

| Player Status | Meaning |
| --- | --- |
| `WAITING` | Pemain berada di Waiting Hall sebelum game dimulai. |
| `PLAYING` | Pemain masih boleh menebak pada ronde aktif. |
| `FINISHED_ROUND` | Pemain sudah benar pada ronde ini dan tidak boleh menebak lagi. |

## Architecture

Server adalah **single source of truth** untuk seluruh state permainan.

Setiap room menyimpan state di memory server, termasuk:

- room code
- game status
- countdown time
- current round
- max rounds
- target number
- players
- score
- attempts
- player status
- timer
- leaderboard lengkap dengan status pemain
- winner

Browser hanya menyimpan identitas minimal di `localStorage`:

- `playerId`
- `playerName`
- `roomCode`

Browser tidak menyimpan score, target number, leaderboard, status ronde, status game, atau data pemain lain.

Sinkronisasi dilakukan menggunakan Socket.IO:

- Client mengirim event `createRoom`, `joinRoom`, `reconnectPlayer`, `submitGuess`, `playAgain`, dan `disconnectPlayer`.
- Server memvalidasi request, memperbarui in-memory room state, lalu mengirim snapshot terbaru melalui event `roomState`.
- Hint tebakan dikirim hanya ke pemain yang menebak melalui event `guessResult`.
- Countdown dikontrol server melalui state `STARTING`, `countdownStartedAt`, dan `countdownEndsAt`.
- Angka target hanya dibuat server saat game benar-benar masuk status `PLAYING` atau saat ronde berikutnya dimulai.

### Reconnect Behavior

Saat browser refresh:

1. Client membaca `playerId`, `playerName`, dan `roomCode` dari `localStorage`.
2. Client mengirim event `reconnectPlayer`.
3. Server mencari player di room.
4. Jika ditemukan, server menandai `connected = true`.
5. Server mengirim state room terbaru ke client.

Saat socket disconnect, player tidak langsung dihapus dari game yang sedang berjalan. Server menandai player sebagai offline agar player bisa reconnect.

Jika server di-restart, semua room aktif akan hilang karena state hanya disimpan di memory.
