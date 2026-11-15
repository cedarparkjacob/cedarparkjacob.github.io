import {db,ref,onValue,formatScore,formatTime,winners,escapeHtml} from "./game-core.js";
const $=id=>document.getElementById(id);
let code="",stopListening=null;
function watchCode(next){
 const normalized=String(next||"").trim().toUpperCase();
 if(!/^[A-Z0-9]{6}$/.test(normalized)){ $("state").textContent="Enter a valid six-character game code."; return false; }
 if(stopListening)stopListening();
 code=normalized;sessionStorage.setItem("zeroOutGameCode",code);
 const url=new URL(location.href);url.searchParams.set("code",code);history.replaceState(null,"",url);
 $("codeEdit").textContent=code;$("state").textContent="Connecting to game…";
 stopListening=onValue(ref(db,"games/"+code),s=>{const g=s.val();if(g)render(g);else $("state").textContent="Game not found.";},e=>{$("state").textContent="Connection error: "+(e?.message||"check your connection");});
 return true;
}
function editCode(){
 const button=$("codeEdit");if(button.querySelector("input"))return;
 const input=document.createElement("input");input.type="text";input.maxLength=6;input.autocomplete="off";input.spellcheck=false;input.value=code;input.setAttribute("aria-label","Game code");
 input.style.cssText="width:7ch;text-transform:uppercase;font:inherit;text-align:center";
 button.textContent="";button.append(input);input.focus();input.select();
 let finished=false;
 const commit=()=>{if(finished)return;finished=true;const value=input.value.trim().toUpperCase();button.textContent=code||"—";if(value!==code)watchCode(value);};
 input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();commit();}if(e.key==="Escape"){finished=true;button.textContent=code||"—";}});
 input.addEventListener("blur",commit);
}
$("codeEdit").addEventListener("click",editCode);
const params=new URLSearchParams(location.search);
watchCode(params.get("code")||sessionStorage.getItem("zeroOutGameCode")||"");
function render(g){
 if(g.status==="finished"){$("liveScreen").classList.add("hidden");$("final").classList.remove("hidden");const w=winners(g.teams);$("winnerNames").textContent=w.length?"Winner"+(w.length>1?"s":"")+": "+w.map(t=>t.emoji+" "+t.name).join(" · "):"";$("finalTeams").innerHTML=g.teams.slice().sort((a,b)=>Math.abs(a.score)-Math.abs(b.score)).map(t=>{const win=w.some(x=>x.id===t.id);return '<div class="team-card '+(win?"winner-team":"")+'"><div class="emoji">'+t.emoji+'</div><div class="name">'+escapeHtml(t.name)+'</div><div class="score">'+formatScore(t.score)+'</div>'+(win?'<strong>WINNER</strong>':'')+'</div>';}).join("");return;}
 $("final").classList.add("hidden");$("liveScreen").classList.remove("hidden");$("state").textContent=g.status==="lobby"?"Waiting for the teacher to start…":"Game in progress";const showTimer=g.status==="active"&&g.timerSeconds!=null;$("timer").textContent=showTimer?formatTime(g.timerSeconds):"";$("timer").classList.toggle("hidden",!showTimer);$("teams").innerHTML=(g.teams||[]).map(t=>'<div class="team-card"><div class="emoji">'+t.emoji+'</div><div class="name">'+escapeHtml(t.name)+'</div><div class="score">'+formatScore(t.score)+'</div></div>').join("");
}