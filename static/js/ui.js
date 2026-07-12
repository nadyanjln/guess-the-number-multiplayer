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
    appShell: $("#appShell"),
    mainPanel: $("#mainPanel"),
    roomPanel: $("#roomPanel"),
    makePanel: $("#makePanel"),
    joinPanel: $("#joinPanel"),
    message: $("#message"),
    guessInput: $("#guessInput"),
    guessBtn: $("#guessBtn"),
};

const META_BADGE_BASE =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black shadow-lg shadow-slate-200/60 transition-all duration-300 hover:-translate-y-0.5";

const STATUS_BADGE_TONES = {
    [GAME_STATUS.WAITING]: "border-slate-200 bg-slate-50 text-slate-700",
    [GAME_STATUS.STARTING]: "border-orange-100 bg-orange-50 text-orange-700",
    [GAME_STATUS.PLAYING]: "border-blue-100 bg-blue-50 text-blue-700",
    [GAME_STATUS.ROUND_COMPLETE]: "border-green-100 bg-green-50 text-green-700",
    [GAME_STATUS.GAME_OVER]: "border-red-100 bg-red-50 text-red-700",
};

const PANEL_CLASS =
    "overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-5 shadow-soft transition-all duration-300 sm:p-6";

const COUNTDOWN_PANEL_CLASS =
    "overflow-hidden rounded-2xl border border-blue-100 bg-white/95 p-5 shadow-soft transition-all duration-300 sm:p-6";

export function render(snapshot, state, socket, canSubmitGuess) {
    state.snapshot = snapshot;

    if (!snapshot) {
        setShellCentered(true);
        elements.mainPanel.classList.remove("hidden");
        elements.roomPanel.classList.add("hidden");
        renderConnection(socket.connected ? "ONLINE" : "OFFLINE");
        updateTimerDisplay(state);
        renderIcons();
        return;
    }

    syncServerClock(snapshot, state);
    state.pendingCorrect = false;
    setShellCentered(isCenteredRoomState(snapshot));
    elements.mainPanel.classList.add("hidden");
    elements.roomPanel.classList.remove("hidden");
    elements.roomPanel.classList.toggle("flex-1", !isCenteredRoomState(snapshot));
    renderConnection("ONLINE");
    renderRoomHeader(snapshot);
    renderLobbyState(snapshot, state);
    renderGuessArea(snapshot, state, canSubmitGuess);
    renderLeaderboard(snapshot, state);
    renderFinal(snapshot, state);
    updateTimerDisplay(state);
    renderIcons();
}

function setShellCentered(centered) {
    elements.appShell.classList.toggle("justify-center", centered);
    elements.appShell.classList.toggle("justify-start", !centered);
}

function isCenteredRoomState(snapshot) {
    return [GAME_STATUS.WAITING, GAME_STATUS.STARTING].includes(snapshot.status);
}

export function renderGuessArea(snapshot, state, canSubmitGuess) {
    const box = $("#guessBox");
    const controls = $("#guessControls");
    const finishedPanel = $("#finishedPanel");
    const input = elements.guessInput;
    const button = elements.guessBtn;

    if (!snapshot) {
        box.classList.add("hidden");
        toggleHintPlaceholder(false);
        input.disabled = true;
        button.disabled = true;
        setSubmitButton(false);
        renderIcons();
        return;
    }

    const currentPlayer = snapshot.players.find((player) => player.id === state.playerId);
    const isFinished =
        snapshot.status === GAME_STATUS.PLAYING &&
        currentPlayer?.status === PLAYER_STATUS.FINISHED_ROUND;

    box.classList.toggle("hidden", snapshot.status === GAME_STATUS.WAITING);
    finishedPanel.classList.toggle("hidden", !isFinished);
    controls.classList.toggle("hidden", isFinished);
    toggleHintPlaceholder(snapshot.status === GAME_STATUS.PLAYING && !isFinished && elements.message.classList.contains("hidden"));

    if (snapshot.status === GAME_STATUS.PLAYING) {
        $("#roundInfo").textContent = isFinished
            ? "Your score is locked. Waiting for the rest of the room."
            : "Everyone still guessing can submit at the same time.";
        input.disabled = !currentPlayer || currentPlayer.status !== PLAYER_STATUS.PLAYING || state.isSubmitting;
        button.disabled = !canSubmitGuess(true);
        setSubmitButton(state.isSubmitting);
        renderIcons();
        return;
    }

    input.disabled = true;
    button.disabled = true;
    setSubmitButton(false);
    controls.classList.remove("hidden");
    finishedPanel.classList.add("hidden");
    toggleHintPlaceholder(false);

    if (snapshot.status === GAME_STATUS.ROUND_COMPLETE) {
        $("#roundInfo").textContent = `Round complete. Number was ${snapshot.current_target_number}. Next round starts soon.`;
    } else if (snapshot.status === GAME_STATUS.GAME_OVER) {
        $("#roundInfo").textContent = "Game over. Final leaderboard is ready.";
    } else {
        $("#roundInfo").textContent = "Waiting for all players to enter the room.";
    }
    renderIcons();
}

export function renderConnection(label) {
    const online = label === "ONLINE";
    $("#connectionStatus").innerHTML = `
        <span class="h-2.5 w-2.5 rounded-full ${online ? "bg-green-400" : "bg-red-400"}"></span>
        ${label}
    `;
    $("#connectionStatus").className = `inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-black shadow-sm transition-all duration-300 ${
        online
            ? "border-green-100 bg-green-50 text-green-700"
            : "border-red-100 bg-red-50 text-red-700"
    }`;
}

export function showHint(data) {
    const messageText = data.message || "Tebakan terkirim.";
    if (data.correct) {
        showMessage("Correct", "success");
        return;
    }
    if (messageText === "Terlalu besar") {
        showMessage("Too High", "warning");
        return;
    }
    if (messageText === "Terlalu kecil") {
        showMessage("Too Low", "warning");
        return;
    }
    showMessage(messageText, "info");
}

export function showMessage(text, type = "info") {
    const normalizedType = type === true ? "error" : type;
    const icon = messageIcon(normalizedType, text);
    elements.message.className = `mt-5 rounded-2xl border px-5 py-4 text-center text-lg font-black shadow-lg transition-all duration-300 ${
        MESSAGE_STYLES[normalizedType] || MESSAGE_STYLES.info
    }`;
    elements.message.innerHTML = `
        <span class="inline-flex items-center justify-center gap-2">
            <i data-lucide="${icon}" class="h-5 w-5"></i>
            ${escapeHtml(text)}
        </span>
    `;
    elements.message.classList.remove("hidden");
    toggleHintPlaceholder(false);
    renderIcons();
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
            ? "border-green-100 bg-green-50 text-green-700"
            : "border-orange-100 bg-orange-50 text-orange-700";

    $("#roomCode").textContent = snapshot.room_code;
    $("#roundMeta").className = `${META_BADGE_BASE} border-blue-100 bg-blue-50 text-blue-700`;
    $("#roundMeta").innerHTML = badgeContent(
        "rotate-cw",
        `Round ${snapshot.current_round}/${snapshot.total_rounds}`
    );
    $("#playerMeta").className = `${META_BADGE_BASE} ${playerCountTone}`;
    $("#playerMeta").innerHTML = badgeContent(
        "users-round",
        `${snapshot.players.length}/${snapshot.capacity} Players`
    );
    $("#statusMeta").className = `${META_BADGE_BASE} ${
        STATUS_BADGE_TONES[snapshot.status] || STATUS_BADGE_TONES[GAME_STATUS.WAITING]
    }`;
    $("#statusMeta").innerHTML = badgeContent("activity", titleCase(snapshot.status));
}

function renderLobbyState(snapshot, state) {
    const isLobby = [GAME_STATUS.WAITING, GAME_STATUS.STARTING].includes(snapshot.status);
    const waitingHall = $("#waitingHall");
    waitingHall.className = snapshot.status === GAME_STATUS.STARTING ? COUNTDOWN_PANEL_CLASS : PANEL_CLASS;
    waitingHall.classList.toggle("hidden", !isLobby);
    $("#gameBoard").classList.toggle("hidden", isLobby);

    if (!isLobby) return;

    const isStarting = snapshot.status === GAME_STATUS.STARTING;
    $("#waitingIcon").className = isStarting
        ? "mx-auto mb-4 grid h-16 w-16 animate-bounce place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-glow transition-all duration-300"
        : "mx-auto mb-4 grid h-16 w-16 animate-pulse place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-glow transition-all duration-300";
    $("#waitingTitle").textContent = isStarting ? "Game starts in..." : "Waiting for players...";
    $("#waitingSubtitle").textContent = isStarting
        ? "Get ready. Everyone starts at the same time."
        : "Share the room code and get everyone in.";
    $("#waitingPlayerCount").textContent = `${snapshot.players.length}/${snapshot.capacity} Players`;
    $("#countdownDisplay").classList.toggle("hidden", !isStarting);
    $("#waitingPulse").classList.toggle("hidden", isStarting);
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

function renderLeaderboard(snapshot, state) {
    const board = $("#leaderboard");
    const rows = leaderboardRows(snapshot);
    $("#leaderTitle").innerHTML =
        '<i data-lucide="trophy" class="h-5 w-5 text-orange-500"></i>' +
        (snapshot.status === GAME_STATUS.GAME_OVER ? "Final Leaderboard" : "Leaderboard");
    board.innerHTML = "";

    if (!rows.length) {
        board.innerHTML =
            '<div class="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 text-center text-sm font-bold text-slate-400"><i data-lucide="trophy" class="mx-auto mb-2 h-7 w-7 text-orange-400"></i><div class="font-black text-slate-500">No scores yet</div><div class="mt-1 text-xs">Leaderboard appears when the first round starts.</div></div>';
        renderIcons();
        return;
    }

    for (const row of rows) {
        board.insertAdjacentHTML(
            "beforeend",
            leaderboardRowTemplate(row, row.playerId === state.playerId || row.player_id === state.playerId)
        );
    }
    renderIcons();
}

function leaderboardRows(snapshot) {
    const playersById = new Map(snapshot.players.map((player) => [player.id, player]));
    const rankedRows = (snapshot.leaderboard || []).map((row) => {
        const player = playersById.get(row.playerId || row.player_id);
        return {
            ...row,
            ...player,
            rank: row.rank,
            score: row.score ?? player?.total_score ?? player?.score ?? 0,
            guess_count: row.guess_count ?? row.attempts ?? player?.guess_count ?? player?.attempts ?? 0,
            round_duration: row.round_duration ?? row.roundDuration ?? player?.round_duration ?? player?.roundDuration ?? null,
            playerId: row.playerId || row.player_id || player?.id,
            player_id: row.player_id || row.playerId || player?.id,
            name: row.name || row.playerName || player?.name || player?.playerName,
            status: row.status || player?.status || PLAYER_STATUS.WAITING,
            connected: row.connected ?? player?.connected ?? false,
            is_host: player?.is_host ?? player?.isHost ?? false,
        };
    });

    if (rankedRows.length) return rankedRows;

    return [...snapshot.players]
        .sort((first, second) => {
            const scoreDiff = Number(second.total_score || second.score || 0) - Number(first.total_score || first.score || 0);
            if (scoreDiff !== 0) return scoreDiff;
            return String(first.name).localeCompare(String(second.name));
        })
        .map((player, index) => ({
            ...player,
            rank: index + 1,
            score: player.total_score ?? player.score ?? 0,
            guess_count: player.guess_count ?? player.attempts ?? 0,
            round_duration: player.round_duration ?? player.roundDuration ?? null,
            playerId: player.id,
            player_id: player.id,
            is_host: player.is_host ?? player.isHost ?? false,
        }));
}

function renderFinal(snapshot, state) {
    const isHost = snapshot.host_player_id === state.playerId;
    $("#finalPanel").classList.toggle("hidden", snapshot.status !== GAME_STATUS.GAME_OVER);
    $("#playAgainBtn").classList.toggle("hidden", snapshot.status !== GAME_STATUS.GAME_OVER || !isHost);
    if (snapshot.status !== GAME_STATUS.GAME_OVER) return;

    const topRows = (snapshot.leaderboard || []).slice(0, 3);
    $("#finalPanel").innerHTML = `
        <h2 class="flex items-center gap-2 text-lg font-black text-orange-700">
            <i data-lucide="crown" class="h-5 w-5"></i>
            Final Podium
        </h2>
        <div class="mt-3 grid gap-2">
            ${topRows.map(finalPodiumTemplate).join("")}
        </div>
    `;
    renderIcons();
}

function waitingPlayerSlotTemplate() {
    return `
        <div class="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 text-slate-400 transition-all duration-300">
            <div class="grid h-11 w-11 place-items-center rounded-full bg-white">
                <i data-lucide="user-plus" class="h-5 w-5"></i>
            </div>
            <div>
                <div class="font-black">Waiting...</div>
                <div class="text-xs font-bold text-slate-400">Open slot</div>
            </div>
        </div>
    `;
}

function waitingPlayerJoinedTemplate(player) {
    const dotClass = player.connected ? "bg-green-500" : "bg-red-500";
    const hostBadge = player.is_host
        ? '<span class="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-black text-yellow-700 ring-1 ring-yellow-100"><i data-lucide="crown" class="h-3.5 w-3.5"></i>Host</span>'
        : "";
    const readyText = player.connected ? "Connected / Ready" : "Offline";
    return `
        <div class="flex items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/70 p-4 shadow-lg shadow-blue-100/50 transition-all duration-300 hover:-translate-y-0.5">
            <div class="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-black text-white shadow-lg shadow-blue-100">
                ${initials(player.name)}
                <span class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${dotClass}"></span>
            </div>
            <div class="min-w-0 flex-1 text-left">
                <div class="flex flex-wrap items-center gap-2 font-black text-slate-950">
                    <span class="truncate">${escapeHtml(player.name)}</span>
                    ${hostBadge}
                </div>
                <div class="mt-1 text-xs font-bold text-slate-500">${readyText}</div>
            </div>
        </div>
    `;
}

function leaderboardRowTemplate(row, isCurrentPlayer) {
    const currentClass = isCurrentPlayer ? "ring-2 ring-blue-200" : "";
    const finished = row.status === PLAYER_STATUS.FINISHED_ROUND;
    const waiting = row.status === PLAYER_STATUS.WAITING;
    const statusLabel = finished ? "Finished" : waiting ? "Waiting" : "Playing";
    const dotClass = row.connected ? "bg-green-500" : "bg-red-500";
    const onlineClass = row.connected
        ? "bg-green-50 text-green-700 ring-green-100"
        : "bg-red-50 text-red-700 ring-red-100";

    return `
        <div class="rounded-2xl border p-3 shadow-lg shadow-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft ${rankTone(row.rank)} ${currentClass} ${finished ? "animate-[pulse_1s_ease-in-out_1]" : ""}">
            <div class="flex items-center gap-3">
                <div class="grid h-11 w-11 place-items-center rounded-2xl bg-white text-2xl shadow-lg shadow-slate-200/60">${rankMedal(row.rank)}</div>
                <div class="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-black text-white shadow-lg shadow-blue-100">
                    ${initials(row.name)}
                    <span class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${dotClass}"></span>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-1 text-base font-black text-slate-950">
                        <span class="truncate">${escapeHtml(row.name)}</span>
                        ${isCurrentPlayer ? '<span class="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">You</span>' : ""}
                    </div>
                    <div class="mt-1.5 flex flex-wrap gap-1.5">
                        ${row.is_host ? '<span class="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-black text-yellow-700 ring-1 ring-yellow-100"><i data-lucide="crown" class="h-3.5 w-3.5"></i>Host</span>' : ""}
                        <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${onlineClass}">${row.connected ? "Online" : "Offline"}</span>
                        <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${playerStatusTone(row.status)}">${statusLabel}</span>
                    </div>
                    <div class="mt-1.5 text-xs font-bold text-slate-500">${row.guess_count} guesses${row.round_duration != null ? ` | ${formatTimer(row.round_duration)}` : ""}</div>
                </div>
            </div>
            <div class="mt-3 flex items-center justify-between rounded-xl bg-white/70 px-3 py-1.5">
                <span class="flex items-center gap-1 text-xs font-black text-slate-400"><i data-lucide="sparkles" class="h-3.5 w-3.5"></i>Score</span>
                <span class="font-mono text-xl font-black text-slate-950">${row.score} pts</span>
            </div>
        </div>
    `;
}

function finalPodiumTemplate(row) {
    return `
        <div class="flex items-center justify-between rounded-xl bg-white/75 px-3 py-2 shadow-sm">
            <div class="flex min-w-0 items-center gap-2">
                <span class="text-xl">${rankMedal(row.rank)}</span>
                <span class="truncate text-sm font-black text-slate-900">${escapeHtml(row.name)}</span>
            </div>
            <span class="font-mono text-sm font-black text-orange-700">${row.score} pts</span>
        </div>
    `;
}

function playerStatusTone(status) {
    if (status === PLAYER_STATUS.FINISHED_ROUND) {
        return "bg-green-50 text-green-700 ring-green-100";
    }
    if (status === PLAYER_STATUS.WAITING) {
        return "bg-slate-50 text-slate-600 ring-slate-200";
    }
    return "bg-blue-50 text-blue-700 ring-blue-100";
}

function setSubmitButton(isSubmitting) {
    elements.guessBtn.innerHTML = `
        <i data-lucide="${isSubmitting ? "loader-circle" : "send"}" class="h-5 w-5 ${isSubmitting ? "animate-spin" : ""}"></i>
        ${isSubmitting ? "Waiting..." : "Submit Guess"}
    `;
}

function toggleHintPlaceholder(visible) {
    $("#hintPlaceholder")?.classList.toggle("hidden", !visible);
}

function messageIcon(type, text) {
    if (type === "success") return "party-popper";
    if (type === "error") return "triangle-alert";
    if (text === "Too High") return "arrow-up";
    if (text === "Too Low") return "arrow-down";
    return "info";
}

function updateCountdownDisplay(state) {
    const snapshot = state.snapshot;
    const display = $("#countdownDisplay");
    if (!display || !snapshot || snapshot.status !== GAME_STATUS.STARTING || !snapshot.countdownStartedAt) {
        return;
    }

    const serverNow = Date.now() / 1000 - state.serverOffsetSeconds;
    const elapsed = Math.max(0, serverNow - snapshot.countdownStartedAt);
    let label = "GO!";
    if (elapsed < 1) label = "3";
    else if (elapsed < 2) label = "2";
    else if (elapsed < 3) label = "1";

    display.textContent = label;
    display.className = `mx-auto mt-5 w-fit rounded-2xl px-7 py-4 font-mono text-6xl font-black leading-none text-white shadow-glow transition-all duration-300 ease-in-out sm:text-7xl ${
        label === "GO!" ? "scale-110 bg-gradient-to-br from-green-500 to-emerald-700" : "scale-100 bg-gradient-to-br from-blue-600 to-indigo-600"
    }`;
}
