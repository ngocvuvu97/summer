const STORAGE_KEY = "hand-bai-session-v1";
const HISTORY_STORAGE_KEY = "hand-bai-history-v1";
const DEFAULT_PLAYERS = ["Mem1", "Mem2", "Mem3", "Mem4"];
const MAX_SCORE = 999;
const PLAYER_COLUMN_MIN_WIDTH = 76;

let state = loadState();
let history = loadHistory();
let activeHistoryId = history[0]?.id ?? null;
let activePlayerId = null;
let roundModal = null;
const historyModal = document.querySelector("#history-modal");

function createSession() {
    return {
        version: 1,
        createdAt: new Date().toISOString(),
        players: DEFAULT_PLAYERS.map((name, index) => ({ id: `player-${index + 1}`, name })),
        rows: [],
        draft: { values: {} }
    };
}

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!saved || saved.version !== 1 || !Array.isArray(saved.players) || !Array.isArray(saved.rows)) return createSession();
        saved.players = saved.players.map((player, index) => {
            const legacyName = `Người chơi ${index + 1}`;
            return player.name === legacyName ? { ...player, name: `Mem${index + 1}` } : player;
        });
        saved.draft = saved.draft && typeof saved.draft === "object" ? saved.draft : { values: {} };
        saved.draft.values = saved.draft.values && typeof saved.draft.values === "object" ? saved.draft.values : {};
        return saved;
    } catch {
        return createSession();
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadHistory() {
    try {
        const saved = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY));
        if (!Array.isArray(saved)) return [];
        return saved.filter(isHistoryRecord);
    } catch {
        return [];
    }
}

function saveHistory() {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function isHistoryRecord(record) {
    return record
        && typeof record === "object"
        && typeof record.id === "string"
        && typeof record.startedAt === "string"
        && typeof record.savedAt === "string"
        && Array.isArray(record.players)
        && Array.isArray(record.rows);
}

function scoreValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function rowTotal(values) {
    return state.players.reduce((total, player) => total + scoreValue(values[player.id]), 0);
}

function rowHasScore(values) {
    return state.players.some((player) => scoreValue(values[player.id]) !== 0);
}

function totals() {
    return state.players.reduce((result, player) => {
        result[player.id] = state.rows.reduce((total, row) => total + scoreValue(row.values[player.id]), 0);
        return result;
    }, {});
}

function displayScore(value) {
    const number = scoreValue(value);
    return number > 0 ? `+${number}` : String(number);
}

function formatSessionDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Không rõ ngày";
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function render() {
    const table = document.querySelector("#score-table");
    const accumulated = totals();
    table.style.setProperty("--players", state.players.length);
    table.style.setProperty("--table-min-width", `${state.players.length * PLAYER_COLUMN_MIN_WIDTH}px`);

    const header = document.createElement("div");
    header.className = "score-row score-header";
    state.players.forEach((player) => {
        const cell = document.createElement("div");
        cell.className = "score-cell";
        cell.append(createPlayerControl(player));
        const total = document.createElement("span");
        total.className = `player-total ${accumulated[player.id] > 0 ? "positive" : accumulated[player.id] < 0 ? "negative" : ""}`;
        total.textContent = displayScore(accumulated[player.id]);
        cell.append(total);
        header.append(cell);
    });
    table.replaceChildren(header, ...state.rows.map((row) => createConfirmedRow(row)));
}

function createPlayerControl(player) {
    const wrapper = document.createElement("div");
    wrapper.className = "player-control";
    const button = document.createElement("button");
    button.className = "name-button";
    button.type = "button";
    button.title = "Sửa tên người chơi";
    button.textContent = player.name;
    button.addEventListener("click", () => startNameEdit(wrapper, player));
    wrapper.append(button);
    return wrapper;
}

function startNameEdit(wrapper, player) {
    const input = document.createElement("input");
    input.className = "name-edit";
    input.value = player.name;
    input.maxLength = 24;
    input.setAttribute("aria-label", `Tên của ${player.name}`);
    wrapper.replaceChildren(input);
    input.focus();
    input.select();
    const finish = () => {
        const name = input.value.trim();
        if (name) player.name = name;
        saveState();
        render();
    };
    input.addEventListener("blur", finish, { once: true });
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") input.blur();
        if (event.key === "Escape") { input.value = player.name; input.blur(); }
    });
}

function createScoreCell(player, values) {
    const cell = document.createElement("div");
    cell.className = "score-cell";
    const score = document.createElement("span");
    const value = scoreValue(values[player.id]);
    score.className = `confirmed-score ${value > 0 ? "positive" : value < 0 ? "negative" : ""}`;
    score.textContent = displayScore(value);
    cell.append(score);
    return cell;
}

function createConfirmedRow(rowData) {
    const row = document.createElement("div");
    row.className = "score-row confirmed";
    state.players.forEach((player) => row.append(createScoreCell(player, rowData.values)));
    return row;
}

function historyTotals(record) {
    return record.players.reduce((result, player) => {
        result[player.id] = record.rows.reduce((total, row) => total + scoreValue(row.values?.[player.id]), 0);
        return result;
    }, {});
}

function createHistoryScoreCell(player, values) {
    const cell = document.createElement("div");
    cell.className = "history-score-cell";
    const value = scoreValue(values?.[player.id]);
    cell.textContent = displayScore(value);
    if (value > 0) cell.classList.add("positive");
    if (value < 0) cell.classList.add("negative");
    return cell;
}

function createHistoryTable(record) {
    const tableWrap = document.createElement("div");
    tableWrap.className = "history-table-wrap";
    const table = document.createElement("div");
    table.className = "history-table";
    table.style.setProperty("--history-players", record.players.length);
    table.style.setProperty("--history-table-min-width", `${record.players.length * PLAYER_COLUMN_MIN_WIDTH}px`);

    const accumulated = historyTotals(record);
    const header = document.createElement("div");
    header.className = "history-row history-header";
    record.players.forEach((player) => {
        const cell = document.createElement("div");
        cell.className = "history-player-cell";
        const name = document.createElement("span");
        name.textContent = player.name;
        const total = document.createElement("strong");
        total.textContent = displayScore(accumulated[player.id]);
        if (accumulated[player.id] > 0) total.classList.add("positive");
        if (accumulated[player.id] < 0) total.classList.add("negative");
        cell.append(name, total);
        header.append(cell);
    });
    table.append(header);
    record.rows.forEach((row) => {
        const historyRow = document.createElement("div");
        historyRow.className = "history-row";
        record.players.forEach((player) => historyRow.append(createHistoryScoreCell(player, row.values)));
        table.append(historyRow);
    });
    tableWrap.append(table);
    return tableWrap;
}

function renderHistory() {
    const select = document.querySelector("#history-select");
    const content = document.querySelector("#history-content");
    const clearButton = document.querySelector("#clear-history");
    const hasHistory = history.length > 0;
    clearButton.disabled = !hasHistory;
    select.disabled = !hasHistory;
    select.replaceChildren();
    content.replaceChildren();

    if (!hasHistory) {
        const option = document.createElement("option");
        option.textContent = "Chưa có buổi chơi đã lưu";
        select.append(option);
        const empty = document.createElement("p");
        empty.className = "history-empty";
        empty.textContent = "Kết thúc buổi hiện tại để lưu lại kết quả ở đây.";
        content.append(empty);
        return;
    }

    if (!history.some((record) => record.id === activeHistoryId)) activeHistoryId = history[0].id;
    history.forEach((record) => {
        const option = document.createElement("option");
        option.value = record.id;
        option.textContent = formatSessionDate(record.startedAt);
        option.selected = record.id === activeHistoryId;
        select.append(option);
    });

    const record = history.find((item) => item.id === activeHistoryId);
    if (!record) return;
    const summary = document.createElement("div");
    summary.className = "history-summary";
    const people = document.createElement("span");
    people.textContent = `${record.players.length} mem`;
    const rounds = document.createElement("span");
    rounds.textContent = `${record.rows.length} ván`;
    summary.append(people, rounds);
    content.append(summary, createHistoryTable(record));
}

function archiveSession() {
    const savedAt = new Date().toISOString();
    history.unshift({
        id: `session-${Date.now()}`,
        startedAt: state.createdAt,
        savedAt,
        players: state.players.map((player) => ({ ...player })),
        rows: state.rows.map((row) => ({
            values: { ...row.values },
            confirmedAt: row.confirmedAt
        }))
    });
    activeHistoryId = history[0].id;
    saveHistory();
}

function modalScoreDisplay(value) {
    return value === "-" ? "−" : displayScore(value || 0);
}

function openRoundModal() {
    if (roundModal) return;
    state.draft = { values: {} };
    saveState();
    activePlayerId = state.players[0]?.id;
    roundModal = document.createElement("div");
    roundModal.className = "modal-backdrop";
    roundModal.addEventListener("click", (event) => {
        if (event.target === roundModal) closeRoundModal();
    });
    document.body.append(roundModal);
    renderRoundModal(true);
}

function renderRoundModal(animate = false) {
    if (!roundModal) return;
    const total = rowTotal(state.draft.values);
    const hasScore = rowHasScore(state.draft.values);
    const canConfirm = total === 0 && hasScore;
    const card = document.createElement("section");
    card.className = `round-modal${animate ? " modal-enter" : ""}`;
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", "Nhập điểm ván mới");

    const heading = document.createElement("h2");
    heading.textContent = "Ván mới";
    card.append(heading);

    const totalLine = document.createElement("div");
    totalLine.className = `modal-total ${canConfirm ? "balanced" : ""}`;
    totalLine.innerHTML = `<span>Tổng ván</span><strong>${displayScore(total)}</strong>`;
    card.append(totalLine);

    const players = document.createElement("div");
    players.className = "modal-players";
    state.players.forEach((player) => {
        const playerButton = document.createElement("button");
        playerButton.type = "button";
        playerButton.className = `modal-player ${player.id === activePlayerId ? "selected" : ""}`;
        const name = document.createElement("span");
        name.textContent = player.name;
        const score = document.createElement("strong");
        score.textContent = modalScoreDisplay(state.draft.values[player.id]);
        playerButton.append(name, score);
        playerButton.addEventListener("click", () => {
            activePlayerId = player.id;
            renderRoundModal();
        });
        players.append(playerButton);
    });
    card.append(players);

    const keypad = document.createElement("div");
    keypad.className = "score-keypad";
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "−", "0", "⌫"].forEach((key) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = key === "−" ? "key-minus" : key === "⌫" ? "key-delete" : "";
        button.textContent = key;
        button.setAttribute("aria-label", key === "−" ? "Đổi dấu âm" : key === "⌫" ? "Xóa số cuối" : `Số ${key}`);
        button.addEventListener("click", () => updateDraftFromKey(key));
        keypad.append(button);
    });
    card.append(keypad);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "cancel-round";
    cancel.textContent = "Hủy";
    cancel.addEventListener("click", closeRoundModal);
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "confirm-round";
    confirm.textContent = "OK";
    confirm.disabled = !canConfirm;
    confirm.addEventListener("click", confirmDraft);
    actions.append(cancel, confirm);
    card.append(actions);
    roundModal.replaceChildren(card);
}

function updateDraftFromKey(key) {
    if (!activePlayerId) return;
    const current = String(state.draft.values[activePlayerId] ?? "");
    let next = current;
    if (key === "−") {
        next = current.startsWith("-") ? current.slice(1) : current === "0" ? "-" : "-" + current.replace(/^\+/, "");
    }
    else if (key === "⌫") next = current.slice(0, -1);
    else {
        const isNegative = current.startsWith("-");
        const digits = current.replace(/\D/g, "");
        next = `${isNegative ? "-" : ""}${digits === "0" ? key : digits + key}`;
    }
    if (Math.abs(scoreValue(next)) > MAX_SCORE) return;
    state.draft.values[activePlayerId] = next;
    renderRoundModal();
}

function closeRoundModal() {
    if (!roundModal) return;
    roundModal.remove();
    roundModal = null;
    activePlayerId = null;
    state.draft = { values: {} };
    saveState();
}

function confirmDraft() {
    const values = Object.fromEntries(state.players.map((player) => [player.id, scoreValue(state.draft.values[player.id])]));
    if (rowTotal(values) !== 0 || !rowHasScore(values)) return;
    state.rows.unshift({ values, confirmedAt: new Date().toISOString() });
    state.draft = { values: {} };
    saveState();
    if (roundModal) {
        roundModal.remove();
        roundModal = null;
        activePlayerId = null;
    }
    render();
}

function addPlayer() {
    const number = state.players.length + 1;
    const player = { id: `player-${Date.now()}`, name: `Mem${number}` };
    state.players.push(player);
    saveState();
    render();
    const tableWrap = document.querySelector(".table-wrap");
    if (tableWrap) tableWrap.scrollLeft = tableWrap.scrollWidth;
    const newName = document.querySelectorAll(".name-button")[state.players.length - 1];
    if (newName) newName.click();
}

function clearSession() {
    if (!confirm("Lưu buổi hiện tại vào lịch sử và bắt đầu buổi mới với 4 mem mặc định?")) return;
    if (roundModal) {
        roundModal.remove();
        roundModal = null;
        activePlayerId = null;
    }
    archiveSession();
    state = createSession();
    saveState();
    render();
    renderHistory();
    const tableWrap = document.querySelector(".table-wrap");
    if (tableWrap) tableWrap.scrollLeft = 0;
}

function clearHistory() {
    if (!history.length || !confirm("Xóa toàn bộ lịch sử buổi chơi?")) return;
    history = [];
    activeHistoryId = null;
    saveHistory();
    renderHistory();
}

function openHistoryModal() {
    historyModal.hidden = false;
    renderHistory();
}

function closeHistoryModal() {
    historyModal.hidden = true;
}

document.querySelector("#new-round").addEventListener("click", openRoundModal);
document.querySelector("#add-player").addEventListener("click", addPlayer);
document.querySelector("#clear-session").addEventListener("click", clearSession);
document.querySelector("#open-history").addEventListener("click", openHistoryModal);
document.querySelector("#close-history").addEventListener("click", closeHistoryModal);
historyModal.addEventListener("click", (event) => {
    if (event.target === historyModal) closeHistoryModal();
});
document.querySelector("#history-select").addEventListener("change", (event) => {
    activeHistoryId = event.target.value;
    renderHistory();
});
document.querySelector("#clear-history").addEventListener("click", clearHistory);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !historyModal.hidden) closeHistoryModal();
});

render();
renderHistory();
