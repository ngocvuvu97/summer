const STORAGE_KEY = "hand-bai-session-v1";
const DEFAULT_PLAYERS = ["Mem1", "Mem2", "Mem3", "Mem4"];
const MAX_SCORE = 999;
const PLAYER_COLUMN_MIN_WIDTH = 76;

let state = loadState();
let activePlayerId = null;
let roundModal = null;

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
    if (!confirm("Clear buổi chơi và đưa danh sách về 4 mem mặc định?")) return;
    if (roundModal) {
        roundModal.remove();
        roundModal = null;
        activePlayerId = null;
    }
    state = createSession();
    saveState();
    render();
    const tableWrap = document.querySelector(".table-wrap");
    if (tableWrap) tableWrap.scrollLeft = 0;
}

document.querySelector("#new-round").addEventListener("click", openRoundModal);
document.querySelector("#add-player").addEventListener("click", addPlayer);
document.querySelector("#clear-session").addEventListener("click", clearSession);

render();
