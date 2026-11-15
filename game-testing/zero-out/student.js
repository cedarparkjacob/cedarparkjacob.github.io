import {db,ref,get,onValue,runTransaction,formatScore,winners,escapeHtml} from "./game-core.js";
const $=id=>document.getElementById(id);let code="",teamId="",clientId="",game=null,unsub=null;
function saved(){try{return JSON.parse(localStorage.getItem("zeroOutTeam")||"null");}catch{return null;}}
$("joinButton").onclick=join;$("codeInput").onkeydown=e=>{if(e.key==="Enter")join();};
async function join(){code=$("codeInput").value.trim().toUpperCase();$("joinStatus").textContent="Connecting…";if(!/^[A-Z0-9]{6}$/.test(code)){$("joinStatus").textContent="Enter the six-character code.";return;}const snap=await get(ref(db,"games/"+code));if(!snap.exists()){$("joinStatus").textContent="Game not found. Check the code.";return;}game=snap.val();$("join").classList.add("hidden");const prev=saved();if(prev?.code===code&&game.teams.some(t=>t.id===prev.teamId)){teamId=prev.teamId;clientId=prev.clientId;connect();}else choices();}
function choices(){
  $("claim").classList.remove("hidden");
  $("claimStatus").textContent="Tap an available team to connect this computer.";
  $("teamChoices").innerHTML=game.teams.map(t=>{
    const busy=!!t.connection?.connected;
    return '<button type="button" class="choice" data-id="'+escapeHtml(t.id)+'" '+(busy?'disabled':'')+'>'+t.emoji+' '+escapeHtml(t.name)+(busy?" · IN USE":" · SELECT")+'</button>';
  }).join("");
  $("teamChoices").onclick=event=>{
    const button=event.target.closest("button[data-id]");
    if(!button||button.disabled)return;
    claim(button.dataset.id);
  };
}
async function claim(id){
  const status=$("claimStatus");
  const buttons=[...$("teamChoices").querySelectorAll("button")];
  buttons.forEach(b=>b.disabled=true);
  status.textContent="Connecting to that team…";
  try{
    clientId=(globalThis.crypto?.randomUUID?.()||("client-"+Date.now()+"-"+Math.random().toString(36).slice(2)));
    const result=await runTransaction(ref(db,"games/"+code),g=>{
      if(!g||g.status!=="lobby"||!Array.isArray(g.teams))return;
      const t=g.teams.find(x=>x.id===id);
      if(!t||t.connection?.connected)return;
      t.connection={connected:true,clientId,joinedAt:Date.now()};
      return g;
    });
    if(!result.committed){
      const latest=await get(ref(db,"games/"+code));
      game=latest.val();
      if(!game)throw new Error("The game record could not be read.");
      const current=game.teams?.find(t=>t.id===id);
      status.textContent=game.status!=="lobby"
        ?"The game is no longer in the lobby. Ask the teacher to create a new game."
        :current?.connection?.connected
          ?"That team is already marked as connected. Choose another available team."
          :"Firebase did not accept the team connection. Check the database write rules.";
      choices();
      return;
    }
    teamId=id;
    localStorage.setItem("zeroOutTeam",JSON.stringify({code,teamId,clientId}));
    $("claim").classList.add("hidden");
    connect();
  }catch(error){
    console.error("Zero Out team selection failed:",error);
    status.textContent="Team selection failed: "+(error?.message||String(error));
    buttons.forEach(b=>b.disabled=false);
  }
}
function connect(){if(unsub)unsub();unsub=onValue(ref(db,"games/"+code),s=>{game=s.val();if(!game)return;const t=game.teams.find(x=>x.id===teamId);if(!t)return;if(t.connection?.clientId!==clientId){$("waiting").textContent="This team is connected on another computer.";return;}render(t);});}
function render(t){$("teamScreen").classList.remove("hidden");$("teamEmoji").textContent=t.emoji;$("teamName").textContent=t.name;$("teamScore").textContent=formatScore(t.score);$("waiting").textContent=game.status==="lobby"?"Connected. Waiting for the teacher to start.":game.status==="active"?"Waiting for your team's next prompt.":"Game finished.";const p=game.pendingPrompt;if(game.status==="active"&&p?.teamId===teamId){$("prompt").classList.remove("hidden");$("promptValue").textContent=formatScore(p.value);$("recipientChoices").innerHTML=game.teams.map(x=>'<button class="choice" data-id="'+x.id+'">'+x.emoji+' '+escapeHtml(x.name)+'</button>').join("");$("recipientChoices").querySelectorAll("button").forEach(b=>b.onclick=()=>award(p,b.dataset.id));}else $("prompt").classList.add("hidden");if(game.status==="finished"){$("teamScreen").classList.add("hidden");$("finished").classList.remove("hidden");const w=winners(game.teams);$("finishedScores").innerHTML=game.teams.slice().sort((a,b)=>Math.abs(a.score)-Math.abs(b.score)).map(x=>'<div class="team-card"><div class="emoji">'+x.emoji+'</div><div class="name">'+escapeHtml(x.name)+'</div><div class="score">'+formatScore(x.score)+'</div>'+(w.some(y=>y.id===x.id)?'<strong>WINNER</strong>':'')+'</div>').join("");}}
async function award(p,targetId){const result=await runTransaction(ref(db,"games/"+code),g=>{if(!g||g.status!=="active"||!g.pendingPrompt||g.pendingPrompt.id!==p.id||g.pendingPrompt.teamId!==teamId)return;const i=g.teams.findIndex(t=>t.id===targetId);if(i<0)return;g.teams[i].score=(Number(g.teams[i].score)||0)+Number(p.value);g.lastValue=p.value;g.lastTeamId=targetId;g.lastAward={value:p.value,teamId:targetId,source:"team-choice",at:Date.now()};g.pendingPrompt=null;let v=0;while(!v)v=Math.floor(Math.random()*201)-100;g.currentValue=v;return g;});if(!result.committed)$("waiting").textContent="That prompt has already been handled. Waiting for the next one.";}
