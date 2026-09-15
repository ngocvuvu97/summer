const STORAGE_KEY = "hand-bai-session-v1";
const DEFAULT_PLAYERS = ["Mem1", "Mem2", "Mem3", "Mem4"];
const MAX_SCORE = 999;

let state = loadState();

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

function formatDate(value) {
    return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
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
    const addCell = document.createElement("div");
    addCell.className = "score-cell";
    const addButton = document.createElement("button");
    addButton.className = "add-player";
    addButton.type = "button";
    addButton.title = "Thêm người chơi";
    addButton.setAttribute("aria-label", "Thêm người chơi");
    addButton.textContent = "+";
    addButton.addEventListener("click", addPlayer);
    addCell.append(addButton);
    header.append(addCell);
    table.replaceChildren(header, createDraftRow(), ...state.rows.map((row) => createConfirmedRow(row)));
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

function createDraftRow() {
    const total = rowTotal(state.draft.values);
    const row = document.createElement("div");
    row.className = `score-row draft ${total !== 0 ? "unbalanced" : ""}`;
    state.players.forEach((player) => row.append(createScoreCell(player, state.draft.values, false)));
    const confirmCell = document.createElement("div");
    confirmCell.className = "score-cell confirm-cell";
    const confirm = document.createElement("button");
    confirm.className = "confirm-button";
    confirm.type = "button";
    confirm.textContent = "OK";
    confirm.disabled = total !== 0 || !rowHasScore(state.draft.values);
    confirm.title = confirm.disabled ? "Cần một ván có tổng bằng 0" : "Xác nhận ván";
    confirm.addEventListener("click", confirmDraft);
    confirmCell.append(confirm);
    row.append(confirmCell);
    return row;
}

function createScoreCell(player, values, locked) {
    const cell = document.createElement("div");
    cell.className = "score-cell";
    const input = document.createElement("input");
    input.className = "score-input";
    // `inputmode="numeric"` hides the minus key on many mobile keyboards.
    // A text field keeps that key available; input below limits its contents to
    // the same signed-integer range as before.
    input.type = "text";
    input.inputMode = "text";
    input.pattern = "-?[0-9]*";
    input.autocomplete = "off";
    input.value = values[player.id] ?? "";
    input.placeholder = "0";
    input.disabled = locked;
    input.setAttribute("aria-label", `Điểm của ${player.name}`);
    if (!locked) {
        input.addEventListener("input", () => {
            const rawValue = input.value.replace(/[−–—]/g, "-");
            const hasMinus = rawValue.startsWith("-");
            const digits = rawValue.replace(/\D/g, "");
            const normalized = hasMinus ? `-${digits}` : digits;
            const value = normalized === "" || normalized === "-"
                ? normalized
                : String(Math.max(-MAX_SCORE, Math.min(MAX_SCORE, Number(normalized))));
            if (input.value !== value) input.value = value;
            state.draft.values[player.id] = value;
            saveState();
            updateDraftStatus();
        });
    }
    cell.append(input);
    return cell;
}

function updateDraftStatus() {
    const row = document.querySelector(".draft");
    if (!row) return;
    const total = rowTotal(state.draft.values);
    row.classList.toggle("unbalanced", total !== 0);
    const confirm = row.querySelector(".confirm-button");
    confirm.disabled = total !== 0 || !rowHasScore(state.draft.values);
    confirm.title = confirm.disabled ? "Cần một ván có tổng bằng 0" : "Xác nhận ván";
}

function createConfirmedRow(rowData) {
    const row = document.createElement("div");
    row.className = "score-row confirmed";
    state.players.forEach((player) => row.append(createScoreCell(player, rowData.values, true)));
    const action = document.createElement("div");
    action.className = "score-cell confirm-cell";
    const label = document.createElement("span");
    label.className = "confirm-button";
    label.textContent = "OK";
    label.setAttribute("aria-label", "Ván đã xác nhận");
    action.append(label);
    row.append(action);
    return row;
}

function confirmDraft() {
    const values = Object.fromEntries(state.players.map((player) => [player.id, scoreValue(state.draft.values[player.id])]));
    if (rowTotal(values) !== 0 || !rowHasScore(values)) return;
    state.rows.unshift({ values, confirmedAt: new Date().toISOString() });
    state.draft = { values: {} };
    saveState();
    render();
}

function addPlayer() {
    const number = state.players.length + 1;
    const player = { id: `player-${Date.now()}`, name: `Mem${number}` };
    state.players.push(player);
    saveState();
    render();
    const newName = document.querySelectorAll(".name-button")[state.players.length - 1];
    if (newName) newName.click();
}

document.querySelector("#new-session").addEventListener("click", () => {
    if (!confirm("Xóa buổi chơi hiện tại và bắt đầu lại?")) return;
    state = createSession();
    saveState();
    render();
});

render();
