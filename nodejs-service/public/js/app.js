const $ = (s) => document.querySelector(s);
const SYMBOL = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  modulo: "mod",
  power: "^",
  percent: "%",
};
const ONE_NUMBER = ["square_root", "sign_toggle"];
const TAX = ["tax_add", "tax_sub"];
const DEFAULT_TAX = 12;

let cur = ""; // number being typed (or the last result)
let first = null; // first number, waiting for an operator to finish
let op = null; // pending operation
let fresh = false; // true right after a result: the next digit starts a new number

const fmt = (n) => String(parseFloat(Number(n).toFixed(10)));

function expression(o, a, b) {
  if (o === "square_root") return `√${a}`;
  if (o === "sign_toggle") return `−(${a})`;
  if (o === "percent") return `${b}% of ${a}`;
  if (o === "tax_add") return `${a} + ${b}% tax`;
  if (o === "tax_sub") return `${a} − ${b}% tax`;
  return `${a} ${SYMBOL[o] || o} ${b}`;
}

function show(top, main) {
  $("#expr").textContent = top;
  $("#result").textContent = main;
}

function refresh() {
  let top = "";
  if (op && first !== null) {
    top = TAX.includes(op)
      ? `${fmt(first)} ${op === "tax_add" ? "+" : "−"} tax`
      : `${fmt(first)} ${SYMBOL[op]}`;
  }
  show(top, cur || "0");
}

function fail(message) {
  cur = "";
  first = null;
  op = null;
  fresh = false;
  show(message, "Error");
}

// Sends one calculation to the Node gateway (which asks the Python service).
async function calculate(o, a, b) {
  try {
    const res = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ num1: a, num2: b, operation: o }),
    });
    const data = await res.json();
    const py = data.python_result;
    if (!res.ok || !py || py.status !== "success") {
      fail((py && py.message) || data.error || "Something went wrong");
      return false;
    }
    const value = fmt(py.result);
    show(expression(o, fmt(a), fmt(b)), value);
    cur = value;
    first = null;
    op = null;
    fresh = true;
    loadHistory();
    return true;
  } catch (err) {
    fail("Could not reach server");
    return false;
  }
}

function digit(d) {
  if (fresh) {
    cur = "";
    fresh = false;
  }
  if (cur.replace(/[-.]/g, "").length < 12) cur = cur === "0" ? d : cur + d;
  refresh();
}

function dot() {
  if (fresh) {
    cur = "";
    fresh = false;
  }
  if (!cur.includes(".")) cur = (cur || "0") + ".";
  refresh();
}

function back() {
  if (fresh) return;
  cur = cur.slice(0, -1);
  refresh();
}

function clearAll() {
  cur = "";
  first = null;
  op = null;
  fresh = false;
  show("", "0");
}

async function equals() {
  if (op === null || first === null) return;
  let second;
  if (cur === "") {
    if (!TAX.includes(op)) return;
    second = DEFAULT_TAX; // T+ then = uses the default rate
  } else {
    second = parseFloat(cur);
  }
  await calculate(op, first, second);
}

async function pickOperation(o) {
  if (cur === "" && first === null) return;
  if (first !== null && cur !== "") await equals(); // finish the pending calculation first
  if (cur === "") return; // it failed
  first = parseFloat(cur);
  cur = "";
  op = o;
  fresh = false;
  refresh();
}

async function oneNumber(o) {
  if (cur === "") return;
  const keepFirst = first,
    keepOp = op;
  const ok = await calculate(o, parseFloat(cur), 0);
  if (ok && keepOp) {
    first = keepFirst;
    op = keepOp;
    fresh = false;
    refresh();
  }
}

$(".keys").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const { d, o, a } = b.dataset;
  if (d !== undefined) digit(d);
  else if (o) ONE_NUMBER.includes(o) ? oneNumber(o) : pickOperation(o);
  else if (a === "dot") dot();
  else if (a === "back") back();
  else if (a === "clear") clearAll();
  else if (a === "eq") equals();
});

// ---------- History note ----------
async function loadHistory() {
  const list = $("#historyList");
  try {
    const rows = await (await fetch("/api/history")).json();
    list.innerHTML = "";
    if (!Array.isArray(rows) || rows.length === 0) {
      list.innerHTML = '<div class="h-empty">No calculations yet.</div>';
      return;
    }
    rows.slice(0, 20).forEach((row) => {
      const item = document.createElement("div");
      item.className = "h-item";
      const left = document.createElement("div");
      left.className = "h-expr";
      left.textContent = expression(row.operation, row.num1, row.num2);
      const right = document.createElement("div");
      right.className = "h-res";
      right.textContent = "= " + row.result;
      item.append(left, right);
      list.appendChild(item);
    });
  } catch (err) {
    list.innerHTML = '<div class="h-empty">Could not load history.</div>';
  }
}

// ---------- How to use guide ----------
const guide = $("#guide");
const setGuide = (open) => {
  guide.classList.toggle("open", open);
  guide.setAttribute("aria-hidden", String(!open));
};
$("#helpBtn").addEventListener("click", () => setGuide(true));
$("#guideClose").addEventListener("click", () => setGuide(false));
guide.addEventListener("click", (e) => {
  if (e.target === guide) setGuide(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setGuide(false);
});

// ---------- Scale the 1280x832 design to fit the window ----------
function fit() {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 832);
  $("#stage").style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener("resize", fit);
fit();

show("", "0");
loadHistory();
