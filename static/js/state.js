import { STORAGE_KEYS } from "./constants.js";

export const state = {
    roomCode: localStorage.getItem(STORAGE_KEYS.roomCode) || "",
    playerId: localStorage.getItem(STORAGE_KEYS.playerId) || "",
    playerName: localStorage.getItem(STORAGE_KEYS.playerName) || "",
    snapshot: null,
    isSubmitting: false,
    pendingCorrect: false,
    serverOffsetSeconds: 0,
};

export function persistIdentity({ playerId, playerName, roomCode }) {
    state.playerId = playerId;
    state.playerName = playerName;
    state.roomCode = roomCode;
    localStorage.setItem(STORAGE_KEYS.playerId, playerId);
    localStorage.setItem(STORAGE_KEYS.playerName, playerName);
    localStorage.setItem(STORAGE_KEYS.roomCode, roomCode);
}

export function clearIdentity() {
    state.roomCode = "";
    state.playerId = "";
    state.playerName = "";
    state.snapshot = null;
    state.isSubmitting = false;
    state.pendingCorrect = false;
    localStorage.removeItem(STORAGE_KEYS.roomCode);
    localStorage.removeItem(STORAGE_KEYS.playerId);
    localStorage.removeItem(STORAGE_KEYS.playerName);
}

localStorage.removeItem(STORAGE_KEYS.legacyLastEventId);
