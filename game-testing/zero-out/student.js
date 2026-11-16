import {db,ref,get,update,onValue,runTransaction,animalCatalog,formatScore,winners,escapeHtml} from "./game-core.js";
const $=id=>document.getElementById(id);
let code="",teamId="",clientId="",game=null,unsub=null,selectedRecipientId=null,selectionBusy=false;
let heartbeatHandle=null,countdownHandle=null,countdownToken="",countdownDeadline=0,teamScreenOpen=false,lastConflictAt=0;
function saved(){try{return JSON.parse(localStorage.getItem("zeroOutTeam")||"null");}catch{return null;}}
function makeClientId(){return globalThis.crypto?.randomUUID?.()||("screen-"+Date.now()+"-"+Math.random().toString(36).slice(2));}
function saveClient(){localStorage.setItem("zeroOutTeam",JSON.stringify({code,teamId:teamId||null,clientId}));}
$("joinButton").onclick=join;$("codeInput").onkeydown=e=>{if(e.key==="Enter")join();};
async function join(){
 code=$("codeInput").value.trim().toUpperCase();$("joinStatus").textContent="Connecting…";
 if(!/^[A-Z0-9]{6}$/.test(code)){$("joinStatus").textContent="Enter the six-character code.";return;}
 try{
  const snap=await get(ref(db,"games/"+code));if(!snap.exists()){$("joinStatus").textContent="Game not found. Check the code.";return;}
  game=snap.val();const prev=saved();clientId=prev?.code===code&&prev.clientId?prev.clientId:makeClientId();
  const prior=game.participants?.[clientId];
  if(game.status!=="lobby"&&prior?.teamId){teamId=prior.teamId;saveClient();$("join").classList.add("hidden");finishClaim(teamId,clientId);return;}
  if(game.status!=="lobby"){$("joinStatus").textContent="This game has already started.";return;}
  // Register this screen at its own participant path. A transaction on the
  // whole game can abort immediately when this browser has no local cache yet.
  const participantRef=ref(db,"games/"+code+"/participants/"+clientId);
  const priorParticipant=game.participants?.[clientId]||{joinedAt:Date.now(),teamId:null,locked:false};
  const result=await runTransaction(participantRef,current=>{
   if(current&&typeof current==="object")return {...priorParticipant,...current,lastSeen:Date.now()};
   return {...priorParticipant,lastSeen:Date.now()};
  });
  if(!result.committed)throw new Error("Could not register this student screen. Check the game code and Firebase connection.");
  const latest=await get(ref(db,"games/"+code));
  if(!latest.exists())throw new Error("The game no longer exists.");
  game=latest.val();
  if(game.status!=="lobby"){
   const assigned=game.participants?.[clientId]?.teamId;
   if(assigned){teamId=assigned;saveClient();$("join").classList.add("hidden");finishClaim(teamId,clientId);return;}
   throw new Error("The teacher started the game before this screen joined. Ask the teacher to start a new game.");
  }
  game.teamReservations=game.teamReservations||{};
  teamId=game.participants?.[clientId]?.teamId||"";saveClient();
  $("join").classList.add("hidden");$("claim").classList.remove("hidden");
  if(unsub)unsub();
  unsub=onValue(ref(db,"games/"+code),s=>{
   game=s.val();if(!game)return;
   const p=game.participants?.[clientId];
   if(p?.conflictAt&&p.conflictAt!==lastConflictAt){lastConflictAt=p.conflictAt;$("claimStatus").textContent="Two students selected the same team at nearly the same time. The other student won the random tie-break; please choose another team.";}
   if(game.status==="active"&&p?.teamId){if(!teamScreenOpen||teamId!==p.teamId){teamId=p.teamId;saveClient();finishClaim(teamId,clientId);}return;}
   if(game.status==="finished"){if(teamId)connect();return;}
   if(p?.teamId&&game.teamReservations?.[p.teamId]?.clientId!==clientId){teamId="";saveClient();stopCountdown();$("claimStatus").textContent="Another student won that team in a simultaneous selection. Please choose a different team.";}
   else teamId=p?.teamId||"";
   renderChoices();syncCountdown(p);
  },e=>{$("claimStatus").textContent="Connection error: "+(e?.message||"check your connection");});
  heartbeatHandle=setInterval(()=>{if(code&&clientId&&game?.status==="lobby")update(ref(db,"games/"+code+"/participants/"+clientId),{lastSeen:Date.now()}).catch(()=>{});},5000);
  renderChoices();syncCountdown(game.participants?.[clientId]);
 }catch(e){$("joinStatus").textContent="Could not join: "+(e?.message||String(e));}
}
function stopCountdown(){if(countdownHandle)clearInterval(countdownHandle);countdownHandle=null;countdownToken="";countdownDeadline=0;}
function syncCountdown(p){
 if(!p?.teamId||p.locked){stopCountdown();$("lockInButton").disabled=true;$("selectionCountdown").textContent=p?.locked?"LOCKED IN":"Choose a team";return;}
 const token=p.teamId+":"+p.selectedAt;if(countdownToken===token)return;
 stopCountdown();countdownToken=token;countdownDeadline=Number(p.selectedAt||Date.now())+5000;$("lockInButton").disabled=false;
 countdownHandle=setInterval(()=>{
  const left=Math.max(0,countdownDeadline-Date.now());$("selectionCountdown").textContent="Auto-locking in "+(left/1000).toFixed(1)+" seconds";
  if(left<=0){stopCountdown();lockSelection(p.teamId,Number(p.selectedAt));}
 },100);
}
function renderChoices(){
 if(!game||game.status!=="lobby")return;
 const p=game.participants?.[clientId]||{},reservations=game.teamReservations||{};$("teamChoices").innerHTML="";
 game.teams.forEach(t=>{
  const reservation=reservations[t.id],mine=reservation?.clientId===clientId,locked=!!p.locked;
  const button=document.createElement("button");button.type="button";button.className="choice team-choice";
  if(mine)button.classList.add("my-choice");if(reservation&&!mine)button.classList.add("reserved-choice");if(locked&&!mine)button.classList.add("dimmed-choice");
  button.disabled=locked||!!(reservation&&!mine);
  button.innerHTML='<span class="choice-animal">'+t.emoji+'</span><span class="choice-name">'+escapeHtml(t.name)+'</span><span class="choice-state">'+(mine?(locked?"LOCKED IN":"YOUR SELECTION"):reservation?"TAKEN":"AVAILABLE")+'</span>';
  button.onclick=()=>selectTeam(t.id);$("teamChoices").append(button);
 });
 const selected=game.teams.find(t=>t.id===p.teamId);
 $("selectionSummary").textContent=selected?(selected.emoji+" "+selected.name+(p.locked?" · LOCKED IN":" · SELECTED")):"No team selected yet.";
 $("lockInButton").disabled=!p.teamId||!!p.locked;$("lockInButton").textContent=p.locked?"LOCKED IN":"LOCK IN";
 const spinsUsed=Math.min(2,Math.max(0,Number(p.randomTeamSpins)||0)),spinsLeft=2-spinsUsed;
 $("randomTeamRemaining").textContent="("+spinsLeft+"/2 remaining)";
 $("randomTeamButton").disabled=!!p.locked||selectionBusy||wheelAnimating||spinsLeft<=0||game.teams.length>=26||game.teams.length>=animalCatalog.length;
 $("randomTeamStatus").textContent=game.teams.length>=26?"The game has reached the 26-team limit.":p.locked?"Your selection is locked.":spinsLeft<=0?"You've used both new-team spins.":"Create a new animal team and select it.";
}
async function selectTeam(id){
 if(selectionBusy||game?.status!=="lobby")return;
 const priority=Math.random(),now=Date.now();selectionBusy=true;
 try{
  const result=await runTransaction(ref(db,"games/"+code),g=>{
   if(!g||g.status!=="lobby"||!g.participants?.[clientId]||!Array.isArray(g.teams))return;
   const p=g.participants[clientId];if(p.locked||!g.teams.some(t=>t.id===id))return;
   g.teamReservations=g.teamReservations||{};const current=g.teamReservations[id];
   if(current&&current.clientId!==clientId){
    const near=Math.abs(now-Number(current.selectedAt||0))<=700;
    if(current.locked||!near||priority>=Number(current.priority??1))return;
    const displaced=g.participants[current.clientId];if(displaced){displaced.teamId=null;displaced.locked=false;displaced.conflictAt=now;}
   }
   if(p.teamId&&p.teamId!==id&&g.teamReservations[p.teamId]?.clientId===clientId)delete g.teamReservations[p.teamId];
   p.teamId=id;p.locked=false;p.selectedAt=now;p.lastSeen=now;
   g.teamReservations[id]={clientId,selectedAt:now,locked:false,priority};return g;
  });
  if(!result.committed){$("claimStatus").textContent="That team is already selected by another student. Choose a different team.";return;}
  game=result.snapshot.val();teamId=id;saveClient();renderChoices();syncCountdown(game.participants[clientId]);
 }catch(e){$("claimStatus").textContent="Selection failed: "+(e?.message||String(e));}
 finally{selectionBusy=false;renderChoices();}
}
async function lockSelection(id=game?.participants?.[clientId]?.teamId,selectedAt=game?.participants?.[clientId]?.selectedAt){
 if(!id||!clientId||game?.status!=="lobby")return;stopCountdown();countdownToken=id+":"+selectedAt;
 let limitReached=false;
 try{
  const result=await runTransaction(ref(db,"games/"+code),g=>{
   if(!g||g.status!=="lobby")return;const p=g.participants?.[clientId],r=g.teamReservations?.[id];
   if(!p||p.teamId!==id||p.locked||r?.clientId!==clientId||Number(p.selectedAt)!==Number(selectedAt))return;
   const limit=Math.max(1,Math.min(26,Number(g.teamLimit)||g.teams?.length||1));
   const lockedCount=Object.entries(g.teamReservations||{}).filter(([teamId,reservation])=>reservation.locked&&g.participants?.[reservation.clientId]?.teamId===teamId).length;
   if(lockedCount>=limit){limitReached=true;return;}
   p.locked=true;r.locked=true;p.lastSeen=Date.now();return g;
  });
  if(result.committed){game=result.snapshot.val();renderChoices();$("selectionCountdown").textContent="LOCKED IN";}
  else{countdownToken="";if(limitReached){$("claimStatus").textContent="The teacher's team limit has been reached. You can keep changing your selection, but it cannot be locked in.";$("selectionCountdown").textContent="Team limit reached";}else syncCountdown(game?.participants?.[clientId]);}
 }catch(e){countdownToken="";$("claimStatus").textContent="Could not lock selection: "+(e?.message||String(e));}
}
$("lockInButton").onclick=()=>lockSelection();
async function animateRandomTeamWheel(finalTeam){
 const wheel=$("randomTeamWheel");wheel.classList.add("spinning");
 const pool=animalCatalog.slice();let index=0,start=performance.now();
 return new Promise(resolve=>{
  const tick=()=>{
   const elapsed=performance.now()-start;
   if(elapsed>=2500){wheel.innerHTML='<span class="random-team-wheel-content">'+finalTeam.emoji+' '+escapeHtml(finalTeam.name)+'</span>';wheel.classList.remove("spinning");resolve();return;}
   const animal=pool[index++%pool.length],delay=45+270*Math.pow(elapsed/2500,2);
   wheel.innerHTML='<span class="random-team-wheel-content">'+animal.emoji+' '+escapeHtml(animal.name)+'</span>';
   setTimeout(tick,Math.min(delay,2500-elapsed));
  };
  tick();
 });
}
async function spinForRandomTeam(){
 if(selectionBusy||wheelAnimating||game?.status!=="lobby"||game.participants?.[clientId]?.locked||(Number(game.participants?.[clientId]?.randomTeamSpins)||0)>=2)return;
 selectionBusy=true;$("randomTeamButton").disabled=true;$("randomTeamStatus").textContent="Choosing a new animal…";
 try{
  let created=null,latest=game;
  for(let attempt=0;attempt<animalCatalog.length;attempt++){
   const available=animalCatalog.filter(a=>!latest.teams.some(t=>t.name===a.name));
   if(!available.length||latest.teams.length>=26)break;
   const candidate=available[Math.floor(Math.random()*available.length)],id="team-"+clientId.replace(/[^a-z0-9]/gi,"").slice(-12)+"-"+Date.now().toString(36);
   const now=Date.now(),priority=Math.random();
   const result=await runTransaction(ref(db,"games/"+code),g=>{
    if(!g||g.status!=="lobby"||!g.participants?.[clientId]||g.participants[clientId].locked||(Number(g.participants[clientId].randomTeamSpins)||0)>=2||!Array.isArray(g.teams)||g.teams.length>=26||g.teams.some(t=>t.name===candidate.name))return;
    g.teamReservations=g.teamReservations||{};const p=g.participants[clientId];
    if(p.teamId&&g.teamReservations[p.teamId]?.clientId===clientId)delete g.teamReservations[p.teamId];
    const letter="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find(ch=>!g.teams.some((t,i)=>t.letter===ch||(!t.letter&&String.fromCharCode(65+i)===ch)));
    if(!letter)return;
    const team={id,letter,name:candidate.name,emoji:candidate.emoji,score:0,position:g.teams.length,connection:null};
    g.teams.push(team);p.teamId=id;p.locked=false;p.selectedAt=now;p.lastSeen=now;p.randomTeamSpins=(Number(p.randomTeamSpins)||0)+1;
    g.teamReservations[id]={clientId,selectedAt:now,locked:false,priority};return g;
   });
   if(result.committed){latest=result.snapshot.val();created=latest.teams.find(t=>t.id===id);break;}
   const fresh=await get(ref(db,"games/"+code));if(!fresh.exists())throw new Error("Game not found.");latest=fresh.val();
  }
  if(!created)throw new Error("No unused animal team is available.");
  game=latest;teamId=created.id;saveClient();$("randomTeamWheel").textContent=created.emoji+" "+created.name;
  $("randomTeamStatus").textContent="Selected "+created.name+".";renderChoices();syncCountdown(game.participants[clientId]);
 }catch(e){$("randomTeamStatus").textContent=e?.message||String(e);}
 finally{selectionBusy=false;renderChoices();}
}
$("randomTeamButton").onclick=spinForRandomTeam;
function finishClaim(id,newClientId){
 teamId=id;clientId=newClientId;saveClient();teamScreenOpen=true;stopCountdown();
 if(heartbeatHandle)clearInterval(heartbeatHandle);heartbeatHandle=null;
 $("claim").classList.add("hidden");$("teamScreen").classList.remove("hidden");
 if(unsub)unsub();connect();
}
function connect(){
 if(unsub)unsub();
 unsub=onValue(ref(db,"games/"+code),s=>{game=s.val();if(!game)return;const t=game.teams.find(x=>x.id===teamId);if(!t){$("waiting").textContent="Your team is no longer in this game. Rejoin with the game code.";return;}render(t);},error=>{$("waiting").textContent="Live connection lost: "+(error?.message||"check your connection");});
}
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
