import { GAME_STATUS, MESSAGE_STYLES, PLAYER_STATUS } from "./constants.js";
import {
    $,
    badgeContent,
    escapeHtml,
    formatTimer,
    initials,
    rankMedal,
    rankTone,
    renderIcons,
    titleCase,
} from "./utils.js";

export const elements = {
    mainPanel: $("#mainPanel"),
    roomPanel: $("#roomPanel"),
    makePanel: $("#makePanel"),
    joinPanel: $("#joinPanel"),
    message: $("#message"),
    guessInput: $("#guessInput"),
    guessBtn: $("#guessBtn"),
};

const META_BADGE_BASE =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-black shadow-sm transition-all duration-300";

const STATUS_BADGE_TONES = {
    [GAME_STATUS.WAITING]: "border-slate-200 bg-slate-50 text-slate-700",
    [GAME_STATUS.STARTING]: "border-orange-100 bg-orange-50/80 text-orange-700",
    [GAME_STATUS.PLAYING]: "border-blue-100 bg-blue-50/80 text-blue-700",
    [GAME_STATUS.ROUND_COMPLETE]: "border-green-100 bg-green-50/80 text-green-700",
    [GAME_STATUS.GAME_OVER]: "border-red-100 bg-red-50/80 text-red-700",
};

export function render(snapshot, state, socket, canSubmitGuess) {
    state.snapshot = snapshot;

    if (!snapshot) {
        elements.mainPanel.classList.remove("hidden");
        elements.roomPanel.classList.add("hidden");
        renderConnection(socket.connected ? "ONLINE" : "OFFLINE");
        updateTimerDisplay(state);
        renderIcons();
        return;
    }

    syncServerClock(snapshot, state);
    state.pendingCorrect = false;
    elements.mainPanel.classList.add("hidden");
    elements.roomPanel.classList.remove("hidden");
    renderConnection("ONLINE");
    renderRoomHeader(snapshot);
    renderLobbyState(snapshot, state);
    renderPlayers(snapshot);
    renderGuessArea(snapshot, state, canSubmitGuess);
    renderLeaderboard(snapshot);
    renderFinal(snapshot, state);
    updateTimerDisplay(state);
    renderIcons();
}

export function renderGuessArea(snapshot, state, canSubmitGuess) {
    const box = $("#guessBox");
    const controls = $("#guessControls");
    const finishedPanel = $("#finishedPanel");
    const input = elements.guessInput;
    const button = elements.guessBtn;

    if (!snapshot) {
        box.classList.add("hidden");
        input.disabled = true;
        button.disabled = true;
        button.textContent = "Submit Guess";
        return;
    }

    const currentPlayer = snapshot.players.find((player) => player.id === state.playerId);
    const isFinished =
        snapshot.status === GAME_STATUS.PLAYING &&
        currentPlayer?.status === PLAYER_STATUS.FINISHED_ROUND;

    box.classList.toggle("hidden", snapshot.status === GAME_STATUS.WAITING);
    finishedPanel.classList.toggle("hidden", !isFinished);
    controls.classList.toggle("hidden", isFinished);

    if (snapshot.status === GAME_STATUS.PLAYING) {
        $("#roundInfo").textContent = isFinished
            ? "Your score is locked. Waiting for the rest of the room."
            : "Everyone still guessing can submit at the same time.";
        input.disabled = !currentPlayer || currentPlayer.status !== PLAYER_STATUS.PLAYING || state.isSubmitting;
        button.disabled = !canSubmitGuess(true);
        button.textContent = state.isSubmitting ? "Waiting..." : "Submit Guess";
        return;
    }

    input.disabled = true;
    button.disabled = true;
    button.textContent = "Submit Guess";
    controls.classList.remove("hidden");
    finishedPanel.classList.add("hidden");

    if (snapshot.status === GAME_STATUS.ROUND_COMPLETE) {
        $("#roundInfo").textContent = `Round complete. Number was ${snapshot.current_target_number}. Next round starts soon.`;
    } else if (snapshot.status === GAME_STATUS.GAME_OVER) {
        $("#roundInfo").textContent = "Game over. Final leaderboard is ready.";
    } else {
        $("#roundInfo").textContent = "Waiting for all players to enter the room.";
    }
}

export function renderConnection(label) {
    const online = label === "ONLINE";
    $("#connectionStatus").innerHTML = `
        <span class="h-2.5 w-2.5 rounded-full ${online ? "bg-green-500" : "bg-red-500"}"></span>
        ${label}
    `;
    $("#connectionStatus").className = `inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition-all duration-300 ${
        online
            ? "border-green-100 bg-green-50 text-green-700"
            : "border-red-100 bg-red-50 text-red-700"
    }`;
}

export function showHint(data) {
    const messageText = data.message || "Tebakan terkirim.";
    if (data.correct) {
        showMessage("Correct \uD83C\uDF89", "success");
        return;
    }
    if (messageText === "Terlalu besar") {
        showMessage("Too High \u2B06\uFE0F", "warning");
        return;
    }
    if (messageText === "Terlalu kecil") {
        showMessage("Too Low \u2B07\uFE0F", "warning");
        return;
    }
    showMessage(messageText, "info");
}

export function showMessage(text, type = "info") {
    const normalizedType = type === true ? "error" : type;
    elements.message.className = `mt-5 rounded-3xl border px-5 py-4 text-center text-lg font-black transition-all duration-300 ${
        MESSAGE_STYLES[normalizedType] || MESSAGE_STYLES.info
    }`;
    elements.message.textContent = text;
    elements.message.classList.remove("hidden");
}

export function updateTimerDisplay(state) {
    const timer = $("#roundTimer");
    const snapshot = state.snapshot;
    updateCountdownDisplay(state);
    if (!timer || !snapshot || !snapshot.roundStartedAt || snapshot.status === GAME_STATUS.WAITING) {
        if (timer) timer.textContent = "00:00";
        return;
    }

    let elapsed = Number(snapshot.roundElapsedSeconds || 0);
    if (snapshot.status === GAME_STATUS.PLAYING) {
        const serverNow = Date.now() / 1000 - state.serverOffsetSeconds;
        elapsed = Math.max(0, serverNow - snapshot.roundStartedAt);
    }
    timer.textContent = formatTimer(elapsed);
}

function syncServerClock(snapshot, state) {
    if (typeof snapshot.serverTime === "number") {
        state.serverOffsetSeconds = Date.now() / 1000 - snapshot.serverTime;
    }
}

function renderRoomHeader(snapshot) {
    const playerCountTone =
        snapshot.players.length >= snapshot.capacity
            ? "border-green-100 bg-green-50/80 text-green-700"
            : "border-orange-100 bg-orange-50/80 text-orange-700";

    $("#roomCode").textContent = snapshot.room_code;
    $("#roundMeta").className = `${META_BADGE_BASE} border-blue-100 bg-blue-50/80 text-blue-700`;
    $("#roundMeta").innerHTML = badgeContent(
        "rotate-cw",
        `Round ${snapshot.current_round}/${snapshot.total_rounds}`
    );
    $("#playerMeta").className = `${META_BADGE_BASE} ${playerCountTone}`;
    $("#playerMeta").innerHTML = badgeContent(
        "users-round",
        `Players ${snapshot.players.length}/${snapshot.capacity}`
    );
    $("#statusMeta").className = `${META_BADGE_BASE} ${
        STATUS_BADGE_TONES[snapshot.status] || STATUS_BADGE_TONES[GAME_STATUS.WAITING]
    }`;
    $("#statusMeta").innerHTML = badgeContent("activity", titleCase(snapshot.status));
}

function renderLobbyState(snapshot, state) {
    const isLobby = [GAME_STATUS.WAITING, GAME_STATUS.STARTING].includes(snapshot.status);
    $("#waitingHall").classList.toggle("hidden", !isLobby);
    $("#gameBoard").classList.toggle("hidden", isLobby);

    if (!isLobby) return;

    const isStarting = snapshot.status === GAME_STATUS.STARTING;
    $("#waitingTitle").textContent = isStarting ? "Game starts in..." : "Waiting for players...";
    $("#waitingSubtitle").textContent = isStarting
        ? "Get ready. Everyone starts at the same time."
        : "Share the room code and get everyone in.";
    $("#waitingPlayerCount").textContent = `${snapshot.players.length}/${snapshot.capacity} Players`;
    $("#countdownDisplay").classList.toggle("hidden", !isStarting);
    renderWaitingPlayers(snapshot);
    updateCountdownDisplay(state);
}

function renderWaitingPlayers(snapshot) {
    const list = $("#waitingPlayersList");
    list.innerHTML = "";
    const players = [...snapshot.players];

    for (let index = 0; index < snapshot.capacity; index += 1) {
        const player = players[index];
        list.insertAdjacentHTML(
            "beforeend",
            player ? waitingPlayerJoinedTemplate(player) : waitingPlayerSlotTemplate()
        );
    }
    renderIcons();
}

function renderPlayers(snapshot) {
    const list = $("#playersList");
    list.innerHTML = "";
    const players = [...snapshot.players];

    for (let index = 0; index < snapshot.capacity; index += 1) {
        const player = players[index];
        if (!player) {
            list.insertAdjacentHTML("beforeend", waitingPlayerTemplate());
            continue;
        }
        list.insertAdjacentHTML("beforeend", playerTemplate(player));
    }
    renderIcons();
}

function renderLeaderboard(snapshot) {
    const board = $("#leaderboard");
    const rows = snapshot.leaderboard || [];
    $("#leaderTitle").innerHTML =
        '<i data-lucide="trophy" class="h-5 w-5 text-orange-500"></i>' +
        (snapshot.status === GAME_STATUS.GAME_OVER ? "Final Leaderboard" : "Leaderboard");
    board.innerHTML = "";

    if (!rows.length) {
        board.innerHTML =
            '<p class="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400">Leaderboard appears when the game starts.</p>';
        renderIcons();
        return;
    }

    for (const row of rows) {
        board.insertAdjacentHTML("beforeend", leaderboardRowTemplate(row));
    }
    renderIcons();
}

function renderFinal(snapshot, state) {
    const isHost = snapshot.host_player_id === state.playerId;
    $("#finalPanel").classList.toggle("hidden", snapshot.status !== GAME_STATUS.GAME_OVER);
    $("#playAgainBtn").classList.toggle("hidden", snapshot.status !== GAME_STATUS.GAME_OVER || !isHost);
}

function waitingPlayerTemplate() {
    return `
        <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-400 transition-all duration-300">
            Waiting...
        </div>
    `;
}

function waitingPlayerSlotTemplate() {
    return `
        <div class="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-slate-400">
            <div class="grid h-11 w-11 place-items-center rounded-full bg-white text-lg font-black">○</div>
            <div class="font-black">Waiting...</div>
        </div>
    `;
}

function waitingPlayerJoinedTemplate(player) {
    const dot = player.connected ? "🟢" : "🔴";
    const hostBadge = player.is_host
        ? '<span class="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-black text-yellow-700 ring-1 ring-yellow-100">Host</span>'
        : "";
    const readyText = player.connected ? "Connected / Ready" : "Offline";
    return `
        <div class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300">
            <div class="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-sm font-black text-white">${initials(player.name)}</div>
            <div class="min-w-0 flex-1 text-left">
                <div class="flex flex-wrap items-center gap-2 font-black text-slate-950">
                    <span>${dot}</span>
                    <span class="truncate">${escapeHtml(player.name)}</span>
                    ${player.is_host ? "<span>👑</span>" : ""}
                    ${hostBadge}
                </div>
                <div class="mt-1 text-xs font-bold text-slate-500">${readyText}</div>
            </div>
        </div>
    `;
}

function playerTemplate(player) {
    const finished = player.status === PLAYER_STATUS.FINISHED_ROUND;
    const statusLabel = finished ? "Finished" : "Guessing...";
    const dotClass = player.connected ? "bg-green-500" : "bg-red-500";
    const statusClass = finished
        ? "bg-green-50 text-green-700 ring-green-100"
        : "bg-blue-50 text-blue-700 ring-blue-100";

    return `
        <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${finished ? "ring-2 ring-green-100" : ""}">
            <div class="flex items-center gap-3">
                <div class="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-100">
                    ${initials(player.name)}
                    <span class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${dotClass}"></span>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1 truncate text-base font-black text-slate-950">
                        ${escapeHtml(player.name)}
                        ${player.is_host ? '<span title="Host">\uD83D\uDC51</span>' : ""}
                    </div>
                    <div class="mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${statusClass}">${statusLabel}</div>
                </div>
            </div>
            <div class="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span class="flex items-center gap-1 text-xs font-black uppercase tracking-wide text-slate-400"><i data-lucide="star" class="h-3.5 w-3.5"></i>Score</span>
                <span class="font-mono text-lg font-black text-slate-900">${player.total_score} pts</span>
            </div>
        </div>
    `;
}

function leaderboardRowTemplate(row) {
    return `
        <div class="rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${rankTone(row.rank)}">
            <div class="flex items-center gap-3">
                <div class="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm">${rankMedal(row.rank)}</div>
                <div class="min-w-0 flex-1">
                    <div class="truncate text-base font-black text-slate-950">${escapeHtml(row.name)}</div>
                    <div class="mt-1 text-xs font-bold text-slate-500">${row.guess_count} guesses${row.round_duration !== null ? ` | ${formatTimer(row.round_duration)}` : ""}</div>
                </div>
            </div>
            <div class="mt-3 flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                <span class="flex items-center gap-1 text-xs font-black uppercase tracking-wide text-slate-400"><i data-lucide="sparkles" class="h-3.5 w-3.5"></i>Score</span>
                <span class="font-mono text-xl font-black text-slate-950">${row.score} pts</span>
            </div>
        </div>
    `;
}

function updateCountdownDisplay(state) {
    const snapshot = state.snapshot;
    const display = $("#countdownDisplay");
    if (!display || !snapshot || snapshot.status !== GAME_STATUS.STARTING || !snapshot.countdownStartedAt) {
        return;
    }

    const serverNow = Date.now() / 1000 - state.serverOffsetSeconds;
    const elapsed = Math.max(0, serverNow - snapshot.countdownStartedAt);
    if (elapsed < 1) {
        display.textContent = "3";
    } else if (elapsed < 2) {
        display.textContent = "2";
    } else if (elapsed < 3) {
        display.textContent = "1";
    } else {
        display.textContent = "GO!";
    }
}
