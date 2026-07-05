const KEY = "wallet_goals_v2";
const DEFAULT = {
  wallet:"0x348310aD902f9e5DF0d3958fb7879e3b3F1813Cc",
  balance:0,
  goals:[],
  tx:[],
  theme:"dark",
  sort:"new"
};

let state = load();
let moneyMode = "deposit";

const el = id => document.getElementById(id);

function load(){
  try { return {...DEFAULT, ...JSON.parse(localStorage.getItem(KEY))}; }
  catch { return {...DEFAULT}; }
}
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function id(){ return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)+Date.now(); }
function fmt(n){ return "$" + Number(n || 0).toLocaleString("en-US", {maximumFractionDigits:2}); }
function vib(n=12){ if(navigator.vibrate) navigator.vibrate(n); }
function clean(s){ return String(s||"").replace(/[&<>"']/g, x => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[x])); }

function toast(msg){
  el("toast").textContent = msg;
  el("toast").classList.add("show");
  clearTimeout(window.__toast);
  window.__toast = setTimeout(()=>el("toast").classList.remove("show"), 1450);
}

function totalGoals(){ return state.goals.reduce((a,g)=>a+Number(g.amount||0),0); }
function percent(){
  const total = totalGoals();
  return total ? Math.min(100, Math.round(state.balance / total * 100)) : 0;
}

function render(){
  document.body.classList.toggle("light", state.theme === "light");

  const p = percent();
  const total = totalGoals();
  el("balance").textContent = fmt(state.balance);
  el("wallet").textContent = state.wallet;
  el("ringText").textContent = p + "%";
  el("ringFill").style.strokeDashoffset = 314 - 314 * p / 100;
  el("barFill").style.width = p + "%";
  el("progressMoney").textContent = `${fmt(state.balance)} / ${fmt(total)}`;
  el("progressLeft").textContent = total ? `осталось ${fmt(Math.max(0,total-state.balance))}` : "целей нет";

  renderGoals("homeGoals", sortGoals(state.goals).slice(0,3));
  renderGoals("allGoals", sortGoals(state.goals));
  renderTx();
  renderStats();
}

function sortGoals(list){
  const arr = [...list];
  if(state.sort === "price") return arr.sort((a,b)=>b.amount-a.amount);
  if(state.sort === "close") return arr.sort((a,b)=>Math.abs(a.amount-state.balance)-Math.abs(b.amount-state.balance));
  return arr.sort((a,b)=>b.createdAt-a.createdAt);
}

function renderGoals(idName, goals){
  const box = el(idName);
  if(!goals.length){
    box.innerHTML = `<div class="empty">Добавь первую цель: картинка, сумма и прогресс появятся здесь.</div>`;
    return;
  }

  box.innerHTML = goals.map(g => {
    const p = Math.min(100, Math.round(state.balance / g.amount * 100));
    const left = Math.max(0, g.amount - state.balance);
    return `
      <article class="card glass" data-id="${g.id}">
        <button class="delete-zone" onclick="deleteGoal('${g.id}')">Удалить</button>
        <div class="card-inner">
          ${g.img ? `<img class="pic" src="${g.img}" alt="">` : `<div class="pic-empty">◎</div>`}
          <div class="card-content">
            <div class="card-top">
              <div class="title">${clean(g.title)}</div>
              <div class="price">${fmt(g.amount)}</div>
            </div>
            <div class="mini-bar"><i style="width:${p}%"></i></div>
            <div class="card-meta">
              <span>${p}%</span>
              <span>${left ? `осталось ${fmt(left)}` : "достигнута"}</span>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  attachSwipe();
}

function renderTx(){
  const list = el("txList");
  if(!state.tx.length){
    list.innerHTML = `<div class="empty">Пока операций нет. Пополни баланс или вычти сумму.</div>`;
    return;
  }
  list.innerHTML = [...state.tx].sort((a,b)=>b.createdAt-a.createdAt).map(t => {
    const d = new Date(t.createdAt);
    const plus = t.type === "deposit";
    return `
      <article class="tx ${plus ? "plus":"minus"}">
        <div>
          <strong>${plus ? "+":"−"}${fmt(t.amount)}</strong>
          <small>${d.toLocaleDateString("ru-RU")} · ${d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</small>
          ${t.comment ? `<p>${clean(t.comment)}</p>` : ""}
        </div>
        <button class="text-btn" onclick="deleteTx('${t.id}')">×</button>
      </article>
    `;
  }).join("");
}

function renderStats(){
  const deposits = state.tx.filter(t=>t.type==="deposit");
  const withdraws = state.tx.filter(t=>t.type==="withdraw");
  const income = deposits.reduce((a,t)=>a+t.amount,0);
  const spent = withdraws.reduce((a,t)=>a+t.amount,0);
  const total = totalGoals();
  const left = Math.max(0,total-state.balance);
  const expensive = [...state.goals].sort((a,b)=>b.amount-a.amount)[0];
  const closest = [...state.goals].sort((a,b)=>Math.max(0,a.amount-state.balance)-Math.max(0,b.amount-state.balance))[0];

  const items = [
    ["Общий заработок", fmt(income)],
    ["Всего вывернул обратно", fmt(spent)],
    ["Осталось до целей", fmt(left)],
    ["Среднее пополнение", fmt(deposits.length ? income/deposits.length : 0)],
    ["Самая дорогая цель", expensive ? `${clean(expensive.title)} · ${fmt(expensive.amount)}` : "—"],
    ["Самая близкая цель", closest ? `${clean(closest.title)} · ${fmt(Math.max(0, closest.amount-state.balance))}` : "—"]
  ];

  el("statsGrid").innerHTML = items.map((x,i)=>`
    <div class="stat glass ${i>3 ? "wide":""}">
      <span>${x[0]}</span>
      <b>${x[1]}</b>
    </div>
  `).join("");
}

function openSheet(idName){ el(idName).classList.add("show"); vib(); }
function closeSheet(idName){ el(idName).classList.remove("show"); }

function imageToData(file){
  return new Promise(resolve => {
    if(!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function addGoal(){
  const title = el("goalTitle").value.trim();
  const amount = Number(el("goalAmount").value);
  const file = el("goalPic").files[0];

  if(!title || !amount || amount <= 0) return toast("Заполни название и сумму");

  state.goals.push({
    id:id(),
    title,
    amount,
    img: await imageToData(file),
    createdAt:Date.now()
  });

  el("goalTitle").value = "";
  el("goalAmount").value = "";
  el("goalPic").value = "";
  el("uploadText").textContent = "Выбрать картинку";

  save();
  closeSheet("goalSheet");
  render();
  toast("Цель добавлена");
  vib(25);
}

function deleteGoal(goalId){
  if(!confirm("Удалить цель?")) return;
  state.goals = state.goals.filter(g=>g.id!==goalId);
  save();
  render();
  toast("Цель удалена");
}

function openMoney(type){
  moneyMode = type;
  el("moneyTitle").textContent = type === "deposit" ? "Пополнить баланс" : "Вычесть из баланса";
  el("moneyAmount").value = "";
  el("moneyComment").value = "";
  openSheet("moneySheet");
}

function addMoney(){
  const amount = Number(el("moneyAmount").value);
  const comment = el("moneyComment").value.trim();
  if(!amount || amount <= 0) return toast("Введи сумму");

  if(moneyMode === "withdraw" && amount > state.balance){
    if(!confirm("Сумма больше баланса. Всё равно вычесть?")) return;
  }

  state.balance += moneyMode === "deposit" ? amount : -amount;
  state.tx.push({id:id(), type:moneyMode, amount, comment, createdAt:Date.now()});
  save();
  closeSheet("moneySheet");
  render();
  toast(moneyMode === "deposit" ? "Баланс пополнен" : "Сумма вычтена");
  vib(28);
}

function deleteTx(txId){
  const t = state.tx.find(x=>x.id===txId);
  if(!t) return;
  if(!confirm("Удалить операцию и откатить баланс?")) return;
  state.balance += t.type === "deposit" ? -t.amount : t.amount;
  state.tx = state.tx.filter(x=>x.id!==txId);
  save();
  render();
  toast("Операция удалена");
}

function attachSwipe(){
  document.querySelectorAll(".card").forEach(card => {
    let startX = 0, currentX = 0;
    card.addEventListener("touchstart", e => { startX = e.touches[0].clientX; currentX = startX; }, {passive:true});
    card.addEventListener("touchmove", e => { currentX = e.touches[0].clientX; }, {passive:true});
    card.addEventListener("touchend", () => {
      const diff = currentX - startX;
      document.querySelectorAll(".card").forEach(c => { if(c !== card) c.classList.remove("swiped"); });
      if(diff < -45) card.classList.add("swiped");
      if(diff > 45) card.classList.remove("swiped");
    });
  });
}

function exportData(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "wallet-goals-backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      state = {...DEFAULT, ...data};
      save();
      render();
      toast("Данные импортированы");
    } catch { toast("Ошибка файла"); }
  };
  reader.readAsText(file);
}

function init(){
  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
      document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      el(btn.dataset.target).classList.add("active");
      vib(8);
    };
  });

  el("addGoalA").onclick = () => openSheet("goalSheet");
  el("addGoalB").onclick = () => openSheet("goalSheet");
  el("saveGoal").onclick = addGoal;
  el("goalPic").onchange = () => {
    el("uploadText").textContent = el("goalPic").files[0]?.name || "Выбрать картинку";
  };

  el("deposit").onclick = () => openMoney("deposit");
  el("withdraw").onclick = () => openMoney("withdraw");
  el("quickDeposit").onclick = () => openMoney("deposit");
  el("quickWithdraw").onclick = () => openMoney("withdraw");
  el("saveMoney").onclick = addMoney;

  el("clearHistory").onclick = () => {
    if(!state.tx.length) return;
    if(confirm("Очистить историю? Баланс останется как есть.")){
      state.tx = [];
      save();
      render();
      toast("История очищена");
    }
  };

  el("copyWallet").onclick = async () => {
    try { await navigator.clipboard.writeText(state.wallet); toast("Адрес скопирован"); }
    catch { toast("Скопируй вручную"); }
  };

  el("editWallet").onclick = () => {
    const v = prompt("Адрес кошелька:", state.wallet);
    if(!v) return;
    state.wallet = v.trim();
    save();
    render();
    toast("Адрес изменен");
  };

  el("dark").onclick = () => { state.theme = "dark"; save(); render(); toast("Темная тема"); };
  el("light").onclick = () => { state.theme = "light"; save(); render(); toast("Светлая тема"); };
  el("exportData").onclick = exportData;
  el("importData").onchange = e => importData(e.target.files[0]);
  el("reset").onclick = () => {
    if(confirm("Сбросить приложение полностью?")){
      state = {...DEFAULT, wallet:state.wallet, theme:state.theme};
      save();
      render();
      toast("Сброшено");
    }
  };

  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => closeSheet(b.dataset.close));
  document.querySelectorAll(".sheet").forEach(s => s.onclick = e => { if(e.target === s) closeSheet(s.id); });

  document.querySelectorAll(".sort button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".sort button").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      state.sort = b.dataset.sort;
      save();
      render();
      vib(8);
    };
  });

  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  render();
}

init();
