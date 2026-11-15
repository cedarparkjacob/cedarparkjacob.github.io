import {db,ref,get,onValue,runTransaction,animalCatalog,formatScore,winners,escapeHtml} from "./game-core.js";
const $=id=>document.getElementById(id);let code="",teamId="",clientId="",game=null,unsub=null,selectedRecipientId=null,spinHandle=null,spunTeamId=null;
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
    button.textContent=t.emoji+" "+t.name+(busy?" · IN USE":(t.id===spunTeamId?" · NEW · SELECT":" · SELECT"));
    button.disabled=busy;
    button.addEventListener("click",()=>claim(t.id));
    $("teamChoices").append(button);
  });
  $("randomTeamButton").disabled=game.status!=="lobby"||game.teams.length>=26||game.teams.length>=animalCatalog.length;
  $("randomTeamStatus").textContent=game.teams.length>=26?"The game has reached the 26-team limit.":game.teams.length>=animalCatalog.length?"Every available animal is already in use.":spunTeamId?"A new team was added. Select it above to claim it.":"Spin to add a new animal team, then select it above.";
}
function secureRandomIndex(length){if(length<=1)return 0;const values=new Uint32Array(1);if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(values);else values[0]=Math.floor(Math.random()*4294967296);return values[0]%length;}
async function spinForRandomTeam(){
 const button=$("randomTeamButton"),status=$("randomTeamStatus"),wheel=$("randomTeamWheel");if(button.disabled||game?.status!=="lobby")return;
 button.disabled=true;status.textContent="Spinning for a new team…";wheel.classList.add("spinning");
 try{
  const snap=await get(ref(db,"games/"+code));if(!snap.exists())throw new Error("The game no longer exists.");
  let latest=snap.val();game=latest;if(latest.teams.length>=26)throw new Error("The game has reached the 26-team limit.");
  let available=animalCatalog.filter(a=>!latest.teams.some(t=>t.name===a.name));if(!available.length)throw new Error("All available animal teams are already in use.");
  spinHandle=setInterval(()=>{const options=animalCatalog.filter(a=>!game.teams.some(t=>t.name===a.name));if(options.length){const a=options[secureRandomIndex(options.length)];wheel.textContent=a.emoji+" "+a.name;}},85);
  await new Promise(resolve=>setTimeout(resolve,1750));clearInterval(spinHandle);spinHandle=null;
  let created=null;
  for(let attempt=0;attempt<animalCatalog.length;attempt++){
   available=animalCatalog.filter(a=>!latest.teams.some(t=>t.name===a.name));if(!available.length||latest.teams.length>=26)break;
   const candidate=available[secureRandomIndex(available.length)],slug=candidate.name.toLowerCase().replace(/[^a-z0-9]+/g,"-");
   const team={id:"random-"+slug+"-"+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)),letter:"",name:candidate.name,emoji:candidate.emoji,score:0,position:latest.teams.length,connection:null};
   const result=await runTransaction(ref(db,"games/"+code),g=>{if(!g||g.status!=="lobby"||!Array.isArray(g.teams)||g.teams.length>=26||g.teams.some(t=>t.name===candidate.name))return;const usedLetters=new Set(g.teams.map((t,i)=>t.letter||String.fromCharCode(65+i)));const letter="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find(ch=>!usedLetters.has(ch));if(!letter)return;team.letter=letter;team.position=g.teams.length;g.teams.push(team);return g;});
   if(result.committed){latest=result.snapshot.val();created=latest.teams.find(t=>t.id===team.id);break;}
   const fresh=await get(ref(db,"games/"+code));if(!fresh.exists())break;latest=fresh.val();
  }
  if(!created)throw new Error("A new team could not be added. Try spinning again.");
  game=latest;spunTeamId=created.id;wheel.textContent=created.emoji+" "+created.name;wheel.classList.remove("spinning");
  choices();status.textContent="New team added. Select "+created.name+" above to claim it.";
 }catch(error){if(spinHandle){clearInterval(spinHandle);spinHandle=null;}wheel.classList.remove("spinning");status.textContent=error?.message||String(error);button.disabled=false;const fresh=await get(ref(db,"games/"+code));if(fresh.exists()){game=fresh.val();choices();}}
}
onclick=spinForRandomTeam;
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
    teamId=id;spunTeamId=null;
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
function connect(){if(unsub)unsub();unsub=onValue(ref(db,"games/"+code),s=>{game=s.val();if(!game)return;const t=game.teams.find(x=>x.id===teamId);if(!t){$("waiting").textContent="Your team is no longer in this game. Rejoin with the game code.";return;}if(t.connection?.clientId&&t.connection.clientId!==clientId){$("waiting").textContent="This team is connected on another computer.";return;}render(t);},error=>{$("waiting").textContent="Live connection lost: "+(error?.message||"check your connection");});}
function card(t,button=false){const cls="team-card "+(t.id===teamId?"own-team ":"")+(t.id===selectedRecipientId?"selected-team":"");const inner='<div class="emoji">'+t.emoji+'</div><div class="name">'+escapeHtml(t.name)+'</div><div class="score">'+formatScore(t.score)+'</div>';return button?'<button type="button" class="'+cls+' recipient-team" data-id="'+escapeHtml(t.id)+'">'+inner+'</button>':'<div class="'+cls+'" data-id="'+escapeHtml(t.id)+'">'+inner+'</div>';}
function render(t){
  $("teamScreen").classList.remove("hidden");
  if(game.status==="finished"||game.finished===true){
    $("studentHeader").classList.add("hidden");$("teamScreen").classList.add("hidden");$("finished").classList.remove("hidden");const w=winners(game.teams);
    $("finishedScores").innerHTML=game.teams.slice().sort((a,b)=>Math.abs(a.score)-Math.abs(b.score)).map(x=>{const win=w.some(y=>y.id===x.id);return '<div class="team-card '+(win?"winner-team":"")+'"><div class="emoji">'+x.emoji+'</div><div class="name">'+escapeHtml(x.name)+'</div><div class="score">'+formatScore(x.score)+'</div>'+(win?'<strong>WINNER</strong>':'')+'</div>';}).join("");return;
  }
  $("studentHeader").classList.remove("hidden");$("finished").classList.add("hidden");const p=(game.pendingPrompts||{})[teamId]||(game.pendingPrompt?.teamId===teamId?game.pendingPrompt:null),isActive=game.status==="active"||game.started===true,active=isActive&&!!p;
  $("waiting").textContent=game.status==="lobby"?"Connected. Waiting for the teacher to start.":active?"Choose which team receives these points.":isActive?"Your team is ready. Watch for the next value.":"Waiting for the teacher…";$("waitingVisual").classList.toggle("hidden",game.status!=="lobby");
  const studentTimer=$("studentTimer");const showStudentTimer=game.timerRunning===true&&Number(game.timerSeconds)>=0&&Number(game.timerSeconds)<60;studentTimer.classList.toggle("hidden",!showStudentTimer);studentTimer.textContent=showStudentTimer?"TIME REMAINING · "+String(Math.floor(game.timerSeconds/60)).padStart(2,"0")+":"+String(game.timerSeconds%60).padStart(2,"0"):"";studentTimer.classList.toggle("warning",showStudentTimer);
  $("liveTeams").innerHTML=game.teams.map(x=>card(x,active)).join("");
  if(active){$("prompt").classList.remove("hidden");$("promptValue").textContent=formatScore(p.value);$("recipientChoices").innerHTML="";$("liveTeams").querySelectorAll("button[data-id]").forEach(b=>b.onclick=()=>award(p,b.dataset.id));}
  else{$("prompt").classList.add("hidden");$("recipientChoices").innerHTML="";}
}
async function award(p,targetId){
  $("liveTeams").querySelectorAll("button").forEach(b=>b.disabled=true);selectedRecipientId=targetId;
  const result=await runTransaction(ref(db,"games/"+code),g=>{if(!g||g.status!=="active")return;const map={...(g.pendingPrompts||{})};const pending=map[teamId]||(g.pendingPrompt?.teamId===teamId?g.pendingPrompt:null);if(pending?.id!==p.id)return;const i=g.teams.findIndex(t=>t.id===targetId);if(i<0)return;g.teams[i].score=(Number(g.teams[i].score)||0)+Number(p.value);g.lastValue=p.value;g.lastTeamId=targetId;g.lastAward={value:p.value,teamId:targetId,source:"team-choice",at:Date.now()};delete map[teamId];g.pendingPrompts=map;delete g.pendingPrompt;return g;});
  if(!result.committed){selectedRecipientId=null;$("waiting").textContent="That prompt has already been handled. Waiting for the next one.";return;}
  const mine=game.teams.find(x=>x.id===teamId);if(mine){$("liveTeams").innerHTML=game.teams.map(x=>card(x)).join("");const selected=$("liveTeams").querySelector('[data-id="'+CSS.escape(targetId)+'"]');if(selected)selected.classList.add("selected-team");}
  setTimeout(()=>{selectedRecipientId=null;const current=game?.teams?.find(x=>x.id===teamId);if(current&&game.status==="active")$("liveTeams").innerHTML=game.teams.map(x=>card(x)).join("");},800);
}
