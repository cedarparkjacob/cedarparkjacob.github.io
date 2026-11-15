import {db,ref,get,onValue,runTransaction,formatScore,winners,escapeHtml} from "./game-core.js";
const $=id=>document.getElementById(id);let code="",teamId="",clientId="",game=null,unsub=null,selectedRecipientId=null;
function saved(){try{return JSON.parse(localStorage.getItem("zeroOutTeam")||"null");}catch{return null;}}
$("joinButton").onclick=join;$("codeInput").onkeydown=e=>{if(e.key==="Enter")join();};
async function join(){code=$("codeInput").value.trim().toUpperCase();$("joinStatus").textContent="Connecting…";if(!/^[A-Z0-9]{6}$/.test(code)){$("joinStatus").textContent="Enter the six-character code.";return;}const snap=await get(ref(db,"games/"+code));if(!snap.exists()){$("joinStatus").textContent="Game not found. Check the code.";return;}game=snap.val();$("join").classList.add("hidden");const prev=saved();if(prev?.code===code&&game.teams.some(t=>t.id===prev.teamId)){teamId=prev.teamId;clientId=prev.clientId;connect();}else choices();}
function choices(){
  $("claim").classList.remove("hidden");
  $("claimStatus").textContent="Choose a team. Click one of the buttons above.";
  $("teamChoices").innerHTML="";
  game.teams.forEach(t=>{
    const busy=!!t.connection?.connected;
    const button=document.createElement("button");
    button.type="button";
    button.className="choice";
    button.textContent=t.emoji+" "+t.name+(busy?" · IN USE":" · SELECT");
    button.disabled=busy;
    button.addEventListener("click",()=>claim(t.id));
    $("teamChoices").append(button);
  });
}
async function claim(id){
  const status=$("claimStatus");
  const buttons=[...$("teamChoices").querySelectorAll("button")];
  buttons.forEach(b=>b.disabled=true);
  status.textContent="Click received. Connecting to "+(game.teams.find(t=>t.id===id)?.name||"team")+"…";
  try{
    const index=game.teams.findIndex(t=>t.id===id);
    if(index<0)throw new Error("That team is not in this game.");
    clientId=globalThis.crypto?.randomUUID?.()||("client-"+Date.now()+"-"+Math.random().toString(36).slice(2));
    const connectionRef=ref(db,"games/"+code+"/teams/"+index+"/connection");
    const result=await runTransaction(connectionRef,current=>{
      if(current?.connected)return;
      return {connected:true,clientId,joinedAt:Date.now()};
    });
    if(!result.committed){
      status.textContent="That team is already connected. Choose another team.";
      const latest=await get(ref(db,"games/"+code));
      if(latest.exists()){game=latest.val();choices();}
      return;
    }
    teamId=id;
    localStorage.setItem("zeroOutTeam",JSON.stringify({code,teamId,clientId}));
    status.textContent="Connected. Loading team screen…";
    $("claim").classList.add("hidden");
    connect();
  }catch(error){
    console.error("Zero Out team selection failed:",error);
    status.textContent="Connection failed: "+(error?.message||String(error));
    buttons.forEach(b=>b.disabled=false);
  }
}
function connect(){if(unsub)unsub();unsub=onValue(ref(db,"games/"+code),s=>{game=s.val();if(!game)return;const t=game.teams.find(x=>x.id===teamId);if(!t)return;if(t.connection?.clientId&&t.connection.clientId!==clientId){$("waiting").textContent="This team is connected on another computer.";return;}render(t);});}
function card(t,button=false){const cls="team-card "+(t.id===teamId?"own-team ":"")+(t.id===selectedRecipientId?"selected-team":"");const inner='<div class="emoji">'+t.emoji+'</div><div class="name">'+escapeHtml(t.name)+'</div><div class="score">'+formatScore(t.score)+'</div>';return button?'<button type="button" class="'+cls+' recipient-team" data-id="'+escapeHtml(t.id)+'">'+inner+'</button>':'<div class="'+cls+'" data-id="'+escapeHtml(t.id)+'">'+inner+'</div>';}
function render(t){
  $("teamScreen").classList.remove("hidden");
  $("teamEmoji").textContent=t.emoji;$("teamName").textContent=t.name;$("teamScore").textContent=formatScore(t.score);
  if(game.status==="finished"||game.finished===true){
    $("studentHeader").classList.add("hidden");$("teamScreen").classList.add("hidden");$("finished").classList.remove("hidden");const w=winners(game.teams);
    $("finishedScores").innerHTML=game.teams.slice().sort((a,b)=>Math.abs(a.score)-Math.abs(b.score)).map(x=>{const win=w.some(y=>y.id===x.id);return '<div class="team-card '+(win?"winner-team":"")+'"><div class="emoji">'+x.emoji+'</div><div class="name">'+escapeHtml(x.name)+'</div><div class="score">'+formatScore(x.score)+'</div>'+(win?'<strong>WINNER</strong>':'')+'</div>';}).join("");return;
  }
  $("studentHeader").classList.remove("hidden");$("finished").classList.add("hidden");const p=game.pendingPrompt,isActive=game.status==="active"||game.started===true,active=isActive&&p?.teamId===teamId;
  $("waiting").textContent=game.status==="lobby"?"Connected. Waiting for the teacher to start.":active?"Choose which team receives these points.":isActive?"Your team is ready. Watch for the next value.":"Waiting for the teacher…";$("waitingVisual").classList.toggle("hidden",active);
  $("liveTeams").innerHTML=game.teams.map(x=>card(x,active)).join("");
  if(active){$("waitingVisual").classList.add("hidden");$("prompt").classList.remove("hidden");$("promptValue").textContent=formatScore(p.value);$("recipientChoices").innerHTML="";$("liveTeams").querySelectorAll("button[data-id]").forEach(b=>b.onclick=()=>award(p,b.dataset.id));}
  else{$("prompt").classList.add("hidden");$("recipientChoices").innerHTML="";}
}
async function award(p,targetId){
  $("liveTeams").querySelectorAll("button").forEach(b=>b.disabled=true);selectedRecipientId=targetId;
  const result=await runTransaction(ref(db,"games/"+code),g=>{if(!g||g.status!=="active"||g.pendingPrompt?.id!==p.id||g.pendingPrompt?.teamId!==teamId)return;const i=g.teams.findIndex(t=>t.id===targetId);if(i<0)return;g.teams[i].score=(Number(g.teams[i].score)||0)+Number(p.value);g.lastValue=p.value;g.lastTeamId=targetId;g.lastAward={value:p.value,teamId:targetId,source:"team-choice",at:Date.now()};g.pendingPrompt=null;let v=0;while(!v)v=Math.floor(Math.random()*201)-100;g.currentValue=v;return g;});
  if(!result.committed){selectedRecipientId=null;$("waiting").textContent="That prompt has already been handled. Waiting for the next one.";return;}
  const mine=game.teams.find(x=>x.id===teamId);if(mine){$("liveTeams").innerHTML=game.teams.map(x=>card(x)).join("");const selected=$("liveTeams").querySelector('[data-id="'+CSS.escape(targetId)+'"]');if(selected)selected.classList.add("selected-team");}
  setTimeout(()=>{selectedRecipientId=null;const current=game?.teams?.find(x=>x.id===teamId);if(current&&game.status==="active")$("liveTeams").innerHTML=game.teams.map(x=>card(x)).join("");},800);
}
