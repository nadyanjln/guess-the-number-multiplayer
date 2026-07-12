import { DEFAULT_PLAYER_NAME, GAME_STATUS, PLAYER_STATUS } from "./constants.js";
import { clearIdentity, persistIdentity, state } from "./state.js";
import {
    elements,
    render,
    renderConnection,
    renderGuessArea,
    showHint,
    showMessage,
    updateTimerDisplay,
} from "./ui.js";
import { $, renderIcons } from "./utils.js";

if (typeof io === "undefined") {
    throw new Error("Socket.IO client gagal dimuat. Pastikan browser bisa mengakses CDN Socket.IO.");
}

const socket = io();

bindUiEvents();
bindSocketEvents();
setInterval(() => updateTimerDisplay(state), 1000);
renderIcons();

function bindUiEvents() {
    $("#showJoinBtn").addEventListener("click", () => toggleStartPanel("join"));
    $("#showMakeBtn").addEventListener("click", () => toggleStartPanel("make"));
    $("#joinBtn").addEventListener("click", joinRoom);
    $("#backBtn").addEventListener("click", backToMain);
    $("#copyRoomBtn").addEventListener("click", copyRoomCode);
    $("#playAgainBtn").addEventListener("click", playAgain);

    elements.guessBtn.addEventListener("click", submitGuess);
    elements.guessInput.addEventListener("input", () => {
        renderGuessArea(state.snapshot, state, canSubmitGuess);
    });
    elements.guessInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (canSubmitGuess()) submitGuess();
    });

    document.querySelectorAll("[data-capacity]").forEach((button) => {
        button.addEventListener("click", () => createRoom(Number(button.dataset.capacity)));
    });
}

function bindSocketEvents() {
    socket.on("connect", () => {
        renderConnection("ONLINE");
        reconnectIfPossible();
    });
    socket.on("disconnect", () => renderConnection("OFFLINE"));

    socket.on("roomCreated", enterRoom);
    socket.on("roomJoined", enterRoom);
    socket.on("roomReconnected", enterRoom);

    socket.on("roomState", (data) => {
        if (data.message) showMessage(data.message);
        render(data.state, state, socket, canSubmitGuess);
    });

    socket.on("guessResult", (data) => {
        state.isSubmitting = false;
        state.pendingCorrect = Boolean(data.correct);
        elements.guessInput.value = "";
        showHint(data);
        renderGuessArea(state.snapshot, state, canSubmitGuess);
        focusGuessInputIfAllowed();
    });

    socket.on("gameError", (data) => {
        state.isSubmitting = false;
        showMessage(data.error || "Request gagal.", "error");
        renderGuessArea(state.snapshot, state, canSubmitGuess);
        focusGuessInputIfAllowed();
    });

    socket.on("reconnectFailed", (data) => {
        clearIdentity();
        render(null, state, socket, canSubmitGuess);
        showMessage(data.error || "Reconnect gagal. Silakan join ulang.", "error");
    });
}

function toggleStartPanel(panel) {
    elements.joinPanel.classList.toggle("hidden", panel !== "join");
    elements.makePanel.classList.toggle("hidden", panel !== "make");
    renderIcons();
}

function createRoom(capacity) {
    socket.emit("createRoom", {
        capacity,
        playerId: state.playerId || null,
        playerName: playerName(DEFAULT_PLAYER_NAME),
    });
}

function joinRoom() {
    const code = $("#roomCodeInput").value.trim().toUpperCase();
    if (!code) {
        showMessage("Room code wajib diisi.", "error");
        return;
    }

    socket.emit("joinRoom", {
        roomCode: code,
        playerId: state.playerId || null,
        playerName: playerName(""),
    });
}

function enterRoom(data) {
    persistIdentity({
        playerId: data.playerId,
        playerName: data.playerName,
        roomCode: data.roomCode,
    });
    render(data.state, state, socket, canSubmitGuess);
}

function submitGuess() {
    if (!canSubmitGuess()) {
        if (!elements.guessInput.value.trim()) return;
        showMessage("Masukkan angka valid 1 sampai 100.", "error");
        return;
    }

    state.isSubmitting = true;
    renderGuessArea(state.snapshot, state, canSubmitGuess);
    socket.emit("submitGuess", {
        roomCode: state.roomCode,
        playerId: state.playerId,
        guess: Number(elements.guessInput.value),
    });
}

function playAgain() {
    socket.emit("playAgain", {
        roomCode: state.roomCode,
        playerId: state.playerId,
    });
}

async function copyRoomCode() {
    const code = (state.snapshot?.room_code || state.roomCode || $("#roomCode").textContent).trim();
    if (!code || code === "------") {
        showMessage("Room code belum tersedia.", "error");
        return;
    }

    try {
        await writeClipboard(code);
        showMessage("Room code copied.", "success");
    } catch {
        showMessage("Gagal copy room code.", "error");
    }
}

function backToMain() {
    if (state.roomCode && state.playerId) {
        socket.emit("disconnectPlayer", {
            roomCode: state.roomCode,
            playerId: state.playerId,
        });
    }
    clearIdentity();
    elements.message.classList.add("hidden");
    render(null, state, socket, canSubmitGuess);
}

function reconnectIfPossible() {
    if (!state.roomCode || !state.playerId) return;

    socket.emit("reconnectPlayer", {
        playerId: state.playerId,
        playerName: state.playerName,
        roomCode: state.roomCode,
    });
}

function canSubmitGuess(validateValue = true) {
    const snapshot = state.snapshot;
    const currentPlayer = snapshot?.players.find((player) => player.id === state.playerId);
    const value = Number(elements.guessInput.value);
    const validValue =
        !validateValue ||
        (elements.guessInput.value.trim() !== "" &&
            Number.isFinite(value) &&
            value >= 1 &&
            value <= 100);

    return Boolean(
        snapshot &&
            snapshot.status === GAME_STATUS.PLAYING &&
            currentPlayer &&
            currentPlayer.status === PLAYER_STATUS.PLAYING &&
            !state.isSubmitting &&
            !state.pendingCorrect &&
            validValue
    );
}

function focusGuessInputIfAllowed() {
    window.setTimeout(() => {
        if (canSubmitGuess(false)) elements.guessInput.focus();
    }, 0);
}

function playerName(fallback) {
    return $("#playerName").value.trim() || fallback;
}

async function writeClipboard(value) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.className = "fixed -left-[9999px] top-0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard copy failed.");
}
