export const $ = (selector) => document.querySelector(selector);

export function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function formatTimer(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
    const seconds = String(safeSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

export function initials(name) {
    return (
        String(name || "?")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || "")
            .join("") || "?"
    );
}

export function titleCase(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function rankMedal(rank) {
    if (rank === 1) return "\uD83E\uDD47";
    if (rank === 2) return "\uD83E\uDD48";
    if (rank === 3) return "\uD83E\uDD49";
    return rank;
}

export function rankTone(rank) {
    if (rank === 1) return "border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-100";
    if (rank === 2) return "border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100";
    if (rank === 3) return "border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100";
    return "border-slate-100 bg-white";
}

export function renderIcons() {
    if (window.lucide) window.lucide.createIcons();
}

export function badgeContent(icon, text) {
    return `<span class="inline-flex items-center gap-2"><i data-lucide="${icon}" class="h-4 w-4"></i>${escapeHtml(text)}</span>`;
}
