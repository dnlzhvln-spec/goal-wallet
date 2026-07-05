const KEY="goal_wallet_final_v1";
const DEFAULT={wallet:"0x348310aD902f9e5DF0d3958fb7879e3b3F1813Cc",balance:0,goals:[],tx:[],theme:"dark",sort:"new"};
let state=load(), moneyMode="deposit", editingGoalId=null, openedGoalId=null;

const $=id=>document.getElementById(id);
function load(){try{return {...DEFAULT,...JSON.parse(localStorage.getItem(KEY))}}catch{return {...DEFAULT}}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function uid(){return crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now()}
function money(n){return "$"+Number(n||0).toLocaleString("en-US",{maximumFractionDigits:2})}
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function vib(n=10){if(navigator.vibrate)navigator.vibrate(n)}
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");clearTimeout(window.__t);window.__t=setTimeout(()=>$("toast").classList.remove("show"),1400)}
function total(){return state.goals.reduce((s,g)=>s+Number(g.amount||0),0)}
function pctFor(amount){return amount?Math.min(100,Math.round(state.balance/amount*100)):0}
function overall(){const t=total();return t?Math.min(100,Math.round(state.balance/t*100)):0}
function imgData(file){return new Promise(res=>{if(!file)return res(null);const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file)})}

function render(){
  document.body.classList.toggle("light",state.theme==="light");
  const p=overall(), t=total();
  $("wallet").textContent=state.wallet;
  $("balance").textContent=money(state.balance);
  $("ringText").textContent=p+"%";
  $("ringFill").style.strokeDashoffset=314-314*p/100;
  $("progressFill").style.width=p+"%";
  $("progressMoney").textContent=`${money(state.balance)} / ${money(t)}`;
  $("progressLeft").textContent=t?`осталось ${money(Math.max(0,t-state.balance))}`:"целей нет";
  renderGoals("homeGoals",sortedGoals().slice(0,3));
  renderGoals("allGoals",sortedGoals());
  renderTx(); renderStats();
}

function sortedGoals(){
  const a=[...state.goals];
  if(state.sort==="price")return a.sort((x,y)=>y.amount-x.amount);
  if(state.sort==="close")return a.sort((x,y)=>Math.max(0,x.amount-state.balance)-Math.max(0,y.amount-state.balance));
  return a.sort((x,y)=>y.createdAt-x.createdAt);
}

function renderGoals(id, goals){
  const box=$(id);
  if(!goals.length){box.innerHTML=`<div class="empty">Целей пока нет. Нажми + и добавь первую.</div>`;return}
  box.innerHTML=goals.map(g=>{
    const p=pctFor(g.amount), left=Math.max(0,g.amount-state.balance);
    return `<article class="goal-card glass" data-open="${g.id}">
      ${g.img?`<img class="goal-img" src="${g.img}" alt="">`:`<div class="goal-empty">◎</div>`}
      <div class="goal-main">
        <div class="goal-top"><div class="goal-name">${esc(g.title)}</div><div class="goal-price">${money(g.amount)}</div></div>
        <div class="mini-bar"><i style="width:${p}%"></i></div>
        <div class="goal-meta"><span>${p}%</span><span>${left?`осталось ${money(left)}`:"достигнута"}</span></div>
      </div>
      <button class="more" data-more="${g.id}">•••</button>
    </article>`
  }).join("");
  box.querySelectorAll("[data-open]").forEach(card=>card.onclick=e=>{if(e.target.closest("[data-more]"))return;openGoalDetail(card.dataset.open)});
  box.querySelectorAll("[data-more]").forEach(btn=>btn.onclick=e=>{e.stopPropagation();openGoalDetail(btn.dataset.more)});
}

function renderTx(){
  const list=$("txList");
  if(!state.tx.length){list.innerHTML=`<div class="empty">История пустая.</div>`;return}
  list.innerHTML=[...state.tx].sort((a,b)=>b.createdAt-a.createdAt).map(t=>{
    const d=new Date(t.createdAt);
    return `<article class="tx ${t.type}">
      <div><strong>${t.type==="deposit"?"+":"−"}${money(t.amount)}</strong>
      <small>${d.toLocaleDateString("ru-RU")} · ${d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</small>
      ${t.comment?`<p>${esc(t.comment)}</p>`:""}</div>
      <button class="text-btn" onclick="deleteTx('${t.id}')">×</button>
    </article>`
  }).join("");
}

function renderStats(){
  const dep=state.tx.filter(t=>t.type==="deposit"), out=state.tx.filter(t=>t.type==="withdraw");
  const income=dep.reduce((s,t)=>s+t.amount,0), spent=out.reduce((s,t)=>s+t.amount,0);
  const expensive=[...state.goals].sort((a,b)=>b.amount-a.amount)[0];
  const closest=[...state.goals].sort((a,b)=>Math.max(0,a.amount-state.balance)-Math.max(0,b.amount-state.balance))[0];
  const items=[
    ["Общий заработок",money(income)],["Всего вывернул обратно",money(spent)],["Осталось до целей",money(Math.max(0,total()-state.balance))],["Среднее пополнение",money(dep.length?income/dep.length:0)],
    ["Самая дорогая цель",expensive?`${esc(expensive.title)} · ${money(expensive.amount)}`:"—"],["Самая близкая цель",closest?`${esc(closest.title)} · ${money(Math.max(0,closest.amount-state.balance))}`:"—"]
  ];
  $("statsGrid").innerHTML=items.map((x,i)=>`<div class="stat glass ${i>3?"wide":""}"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
}

function openSheet(id){$(id).classList.add("show");vib()}
function closeSheet(id){$(id).classList.remove("show")}
function resetGoalForm(){editingGoalId=null;$("goalSheetTitle").textContent="Добавить цель";$("goalTitle").value="";$("goalAmount").value="";$("goalNote").value="";$("goalImage").value="";$("uploadText").textContent="Выбрать картинку"}
function openAddGoal(){resetGoalForm();openSheet("goalSheet")}

async function saveGoal(){
  const title=$("goalTitle").value.trim(), amount=Number($("goalAmount").value), note=$("goalNote").value.trim(), file=$("goalImage").files[0];
  if(!title||!amount||amount<=0)return toast("Заполни название и сумму");
  const img=await imgData(file);
  if(editingGoalId){
    const g=state.goals.find(x=>x.id===editingGoalId);
    if(g){g.title=title;g.amount=amount;g.note=note;if(img)g.img=img;g.updatedAt=Date.now()}
    toast("Цель обновлена");
  }else{
    state.goals.push({id:uid(),title,amount,note,img:img||"",createdAt:Date.now()});
    toast("Цель добавлена");
  }
  save();closeSheet("goalSheet");render();vib(25);
  if(openedGoalId) openGoalDetail(openedGoalId);
}

function openGoalDetail(id){
  const g=state.goals.find(x=>x.id===id); if(!g)return;
  openedGoalId=id;
  const p=pctFor(g.amount), left=Math.max(0,g.amount-state.balance);
  $("detailHero").style.backgroundImage=g.img?`url("${g.img}")`:"";
  $("detailTitle").textContent=g.title;$("detailPrice").textContent=money(g.amount);
  $("detailProgress").style.width=p+"%";$("detailPercent").textContent=p+"% накоплено";$("detailLeft").textContent=left?`осталось ${money(left)}`:"цель достигнута";
  $("detailNote").textContent=g.note||"Комментарий не указан";
  $("detailDate").textContent=new Date(g.createdAt).toLocaleDateString("ru-RU");
  $("detailStatus").textContent=left?"В процессе":"Достигнута";
  openSheet("goalDetail");
}

function editOpenedGoal(){
  const g=state.goals.find(x=>x.id===openedGoalId); if(!g)return;
  editingGoalId=g.id;$("goalSheetTitle").textContent="Редактировать цель";$("goalTitle").value=g.title;$("goalAmount").value=g.amount;$("goalNote").value=g.note||"";$("goalImage").value="";$("uploadText").textContent=g.img?"Картинка уже выбрана":"Выбрать картинку";closeSheet("goalDetail");openSheet("goalSheet");
}

function deleteOpenedGoal(){
  if(!openedGoalId)return;
  if(!confirm("Удалить цель?"))return;
  state.goals=state.goals.filter(g=>g.id!==openedGoalId);
  openedGoalId=null;save();closeSheet("goalDetail");render();toast("Цель удалена");
}

function openMoney(type){moneyMode=type;$("moneyTitle").textContent=type==="deposit"?"Пополнить баланс":"Вычесть из баланса";$("moneyAmount").value="";$("moneyComment").value="";openSheet("moneySheet")}
function saveMoney(){
  const amount=Number($("moneyAmount").value), comment=$("moneyComment").value.trim();
  if(!amount||amount<=0)return toast("Введи сумму");
  if(moneyMode==="withdraw"&&amount>state.balance&&!confirm("Сумма больше баланса. Всё равно вычесть?"))return;
  state.balance+=moneyMode==="deposit"?amount:-amount;
  state.tx.push({id:uid(),type:moneyMode,amount,comment,createdAt:Date.now()});
  save();closeSheet("moneySheet");render();toast(moneyMode==="deposit"?"Баланс пополнен":"Сумма вычтена");vib(25);
}
function deleteTx(id){
  const t=state.tx.find(x=>x.id===id); if(!t)return;
  if(!confirm("Удалить операцию и откатить баланс?"))return;
  state.balance+=t.type==="deposit"?-t.amount:t.amount;state.tx=state.tx.filter(x=>x.id!==id);save();render();toast("Операция удалена");
}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="goal-wallet-backup.json";a.click();URL.revokeObjectURL(a.href)}
function importData(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{state={...DEFAULT,...JSON.parse(r.result)};save();render();toast("Импортировано")}catch{toast("Ошибка файла")}};r.readAsText(file)}

function init(){
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.screen).classList.add("active");vib(8)});
  $("addGoalHome").onclick=openAddGoal;$("addGoalGoals").onclick=openAddGoal;$("saveGoal").onclick=saveGoal;$("goalImage").onchange=()=>$("uploadText").textContent=$("goalImage").files[0]?.name||"Выбрать картинку";
  $("depositHome").onclick=() => openMoney("deposit");$("withdrawHome").onclick=() => openMoney("withdraw");$("depositMoney").onclick=() => openMoney("deposit");$("withdrawMoney").onclick=() => openMoney("withdraw");$("saveMoney").onclick=saveMoney;
  $("editGoalBtn").onclick=editOpenedGoal;$("deleteGoalBtn").onclick=deleteOpenedGoal;
  $("copyWallet").onclick=async()=>{try{await navigator.clipboard.writeText(state.wallet);toast("Адрес скопирован")}catch{toast("Скопируй вручную")}};
  $("editWallet").onclick=()=>{const v=prompt("Адрес кошелька:",state.wallet);if(v){state.wallet=v.trim();save();render();toast("Адрес изменен")}};
  $("themeDark").onclick=()=>{state.theme="dark";save();render();toast("Темная тема")};$("themeLight").onclick=()=>{state.theme="light";save();render();toast("Светлая тема")};
  $("clearTx").onclick=()=>{if(state.tx.length&&confirm("Очистить историю? Баланс останется как есть.")){state.tx=[];save();render();toast("История очищена")}};
  $("resetAll").onclick=()=>{if(confirm("Сбросить всё приложение?")){state={...DEFAULT};save();render();toast("Сброшено")}};
  $("exportData").onclick=exportData;$("importData").onchange=e=>importData(e.target.files[0]);
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeSheet(b.dataset.close));
  document.querySelectorAll(".sheet").forEach(s=>s.onclick=e=>{if(e.target===s)closeSheet(s.id)});
  document.querySelectorAll(".segmented button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".segmented button").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.sort=b.dataset.sort;save();render()});
  if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
  render();
}
init();