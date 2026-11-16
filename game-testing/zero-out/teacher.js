import {db,ref,get,set,update,onValue,runTransaction,animalCatalog,makeCode,pointValue,formatScore,formatTime,winners,escapeHtml} from "./game-core.js";
const $=id=>document.getElementById(id);
let game=null,gameId=null,unsub=null,timerHandle=null,assignMode=null,selectedTeamIds=new Set(),selectionValue=null,pendingTimerSeconds=null,promptWrite=null;
function shuffled(items){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
$("teamCount").onchange=()=>{$("teamCount").value=Math.max(1,Math.min(26,Number($("teamCount").value)||4));};
function setStatus(s){$("status").textContent=s;}
async function createGame(){
 $("create").disabled=true;
 try{
  const count=Math.max(1,Math.min(26,animalCatalog.length,Number($("teamCount").value)||4));
  let code=null;
  for(let i=0;i<25;i++){const candidate=makeCode();const exists=await get(ref(db,"games/"+candidate));if(!exists.exists()){code=candidate;break;}}
  if(!code)throw Error("Could not generate a unique game code.");
  gameId=code;const animals=shuffled(animalCatalog).slice(0,count);
  const teams=animals.map((a,i)=>({id:"team-"+(i+1),letter:String.fromCharCode(65+i),name:a.name,emoji:a.emoji,score:0,position:i,connection:null}));
  const initial={schemaVersion:2,mode:$("mode").value,teamLimit:count,status:"lobby",started:false,finished:false,createdAt:Date.now(),currentValue:pointValue(),lastValue:null,lastTeamId:null,pendingPrompts:{},directMode:false,teams,individuals:{},participants:{},teamReservations:{},assignment:{strategy:null,joinSequence:0},timerSeconds:pendingTimerSeconds,timerRunning:false};
  await set(ref(db,"games/"+code),initial);
  $("setup").classList.add("hidden");$("lobby").classList.remove("hidden");$("gameCode").textContent=code;$("lobbyCode").textContent=code;
  listen();setStatus("Teams created. Students can select a team or choose NEW TEAM? before you begin.");
 }catch(e){console.error(e);setStatus("Could not create game: "+e.message);$("create").disabled=false;}
}
$("create").onclick=()=>createGame();
function listen(){if(unsub)unsub();unsub=onValue(ref(db,"games/"+gameId),s=>{game=s.val();if(!game)return;render();});}
$("openBoard").onclick=()=>window.open("index.html?code="+encodeURIComponent(gameId),"_blank","noopener");
function pendingMap(g){const map={...(g?.pendingPrompts||{})};if(g?.pendingPrompt?.teamId&&!map[g.pendingPrompt.teamId])map[g.pendingPrompt.teamId]=g.pendingPrompt;return map;}
function render(){if(!game)return;const pending=pendingMap(game);const pendingCount=Object.keys(pending).length;const participants=game.participants||{},reservations=game.teamReservations||{},online=Object.values(participants).filter(p=>Date.now()-Number(p.lastSeen||0)<20000).length;$("connections").innerHTML=game.teams.map(t=>{const r=reservations[t.id];return '<div class="team-card"><div class="emoji">'+t.emoji+'</div><strong>'+escapeHtml(t.name)+'</strong><p class="muted">'+(r?(r.locked?"Locked in":"Selected"):"Available")+'</p></div>';}).join("");if(game.status==="lobby"){$("lobby").classList.remove("hidden");$("controls").classList.add("hidden");$("start").disabled=!game.teams.length;$("start").textContent="BEGIN GAME ("+online+" SCREENS)";}else{$("lobby").classList.add("hidden");$("controls").classList.remove("hidden");} $("valueButton").textContent=game.currentValue==null?"—":formatScore(game.currentValue);$("assignMode").classList.toggle("active",assignMode==="assign");$("reassign").classList.toggle("active",assignMode==="reassign");$("assignMode").textContent=assignMode==="assign"?"CANCEL ASSIGNMENT":"ASSIGN TO TEAM";$("reassign").textContent=assignMode==="reassign"?"CANCEL REASSIGNMENT":"REASSIGN LAST VALUE";$("directHint").textContent=assignMode?(assignMode==="assign"?"Click a team once to select it. Click the same team again to confirm.":"Click a destination team once. Click that same team again to confirm the reassignment."):"Choose a team to send a value, or use ASSIGN TO TEAM for direct points. "+pendingCount+" value(s) waiting for team choices."; $("teacherTeams").innerHTML=game.teams.map(t=>{const holding=pending[t.id];return '<div class="teacher-team-wrap">'+(holding?'<div class="holding-value">HOLDING '+formatScore(holding.value)+'</div>':"")+'<button class="team-button '+(selectedTeamIds.has(t.id)?"confirm-team":"")+'" data-id="'+t.id+'"><span class="left"><span class="emoji">'+t.emoji+'</span>'+escapeHtml(t.name)+(t.connection?.connected?" ●":"")+'</span><strong class="score">'+formatScore(t.score)+'</strong>'+(selectedTeamIds.has(t.id)?'<span class="team-confirm-overlay">CONFIRM '+formatScore(selectionValue)+' POINTS?</span>':"")+'</button></div>';}).join("");$("teacherTeams").querySelectorAll("button").forEach(b=>{b.classList.toggle("assign-ready",!!assignMode);b.classList.toggle("assign-selected",selectedTeamIds.has(b.dataset.id));b.onclick=()=>teamClicked(b.dataset.id);});$("timer").textContent=game.timerSeconds==null?"No timer":formatTime(game.timerSeconds);$("timer").classList.toggle("warning",game.timerSeconds!=null&&game.timerSeconds<=60);if(game.timerRunning&&timerHandle===null)startTimerLoop();$("timerPanel").classList.toggle("hidden",game.status==="finished");$("timerButtons").classList.toggle("hidden",game.status!=="active");$("setTimer").textContent=game.status==="active"?"START TIMER":"SET TIMER";$("teacherGameActions").classList.toggle("hidden",game.status!=="active"&&game.status!=="finished");$("finish").classList.toggle("hidden",game.status==="finished");if(game.status==="finished")showWinner();}
$("start").onclick=async()=>{
 if(!game||game.status!=="lobby")return;
 const button=$("start");button.disabled=true;button.textContent="ASSIGNING TEAMS…";
 const now=Date.now();let shortage=null;
 try{
  const result=await runTransaction(ref(db,"games/"+gameId),g=>{
   if(!g||g.status!=="lobby"||!Array.isArray(g.teams)||!g.teams.length)return;
   g.participants=g.participants||{};g.teamReservations=g.teamReservations||{};
   const limit=Math.max(1,Math.min(26,Number(g.teamLimit)||g.teams.length));
   const online=Object.entries(g.participants).filter(([,p])=>now-Number(p.lastSeen||0)<20000);
   const onlineIds=new Set(online.map(([id])=>id));
   Object.keys(g.teamReservations).forEach(id=>{const r=g.teamReservations[id];if(!onlineIds.has(r.clientId))delete g.teamReservations[id];});
   const locked=[];
   online.forEach(([id,p])=>{
    const reservation=p.teamId&&g.teamReservations[p.teamId];
    if(p.locked&&reservation?.clientId===id&&reservation.locked){
     const team=g.teams.find(team=>team.id===p.teamId);if(team&&!locked.some(x=>x.id===team.id))locked.push(team);
    }else{
     if(p.teamId&&g.teamReservations[p.teamId]?.clientId===id)delete g.teamReservations[p.teamId];
     p.teamId=null;p.locked=false;
    }
   });
   if(locked.length>limit){shortage={reason:"locked",locked:locked.length,limit};return;}
   const assignedIds=new Set(locked.map(team=>team.id));
   const needing=online.filter(([id,p])=>!(p.locked&&p.teamId&&assignedIds.has(p.teamId)));
   const available=g.teams.filter(team=>!assignedIds.has(team.id));
   const slots=limit-locked.length;
   if(needing.length>slots||needing.length>available.length){shortage={reason:"capacity",screens:needing.length,teams:Math.min(slots,available.length),limit};return;}
   for(let i=available.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[available[i],available[j]]=[available[j],available[i]];}
   needing.forEach(([id,p],i)=>{
    const team=available[i];assignedIds.add(team.id);p.teamId=team.id;p.locked=true;p.selectedAt=now;
    g.teamReservations[team.id]={clientId:id,selectedAt:now,locked:true,priority:Math.random()};
   });
   g.teams=g.teams.filter(team=>assignedIds.has(team.id));
   g.teams.forEach((team,i)=>{team.position=i;});
   g.status="active";g.started=true;g.currentValue=pointValue();g.timerRunning=g.timerSeconds!=null&&g.timerSeconds>0;return g;
  });
  if(!result.committed){
   if(shortage?.reason==="locked")setStatus(shortage.locked+" teams are locked, but the game limit is "+shortage.limit+". Increase the team count or change selections before starting.");
   else if(shortage?.reason==="capacity")setStatus(shortage.screens+" student screens need teams, but only "+shortage.teams+" unused team slot(s) remain within the "+shortage.limit+"-team limit. Increase the team count or have fewer screens join.");
   else setStatus("Could not begin the game. Refresh and try again.");
   return;
  }
  game=result.snapshot.val();render();$("lobby").classList.add("hidden");
 }catch(error){setStatus("Could not begin game: "+(error?.message||String(error)));}
 finally{if(game?.status==="lobby")render();}
};
function clearSelection(){assignMode=null;selectedTeamIds.clear();selectionValue=null;render();}
$("assignMode").onclick=()=>{if(assignMode==="assign"){clearSelection();return;}assignMode="assign";selectedTeamIds.clear();selectionValue=game.currentValue;render();};
$("reassign").onclick=()=>{if(assignMode==="reassign"){clearSelection();return;}if(!game?.lastAward||!game.lastTeamId){setStatus("There is no previous award to reassign.");return;}assignMode="reassign";selectedTeamIds.clear();selectionValue=game.lastValue;render();};
document.addEventListener("click",event=>{const actionButton=event.target.closest("button");if(assignMode&&!actionButton)clearSelection();if(!actionButton||!["finish","newRound","newGame"].includes(actionButton.id))resetConfirmButtons();});
async function teamClicked(teamId){
 if(!game||game.status!=="active")return;
 if(assignMode){if(selectedTeamIds.has(teamId)){if(assignMode==="assign")await applyDirectAssignment();else await applyReassignment();return;}selectedTeamIds.clear();selectedTeamIds.add(teamId);render();return;}
 const current=pendingMap(game)[teamId];
 if(current){
   const chosenTeam=game.teams.find(t=>t.id===teamId);
   const result=await runTransaction(ref(db,"games/"+gameId),g=>{
     if(!g||g.status!=="active")return;
     const map=pendingMap(g),prompt=map[teamId];if(!prompt||prompt.id!==current.id)return;
     const target=g.teams.find(t=>t.id===teamId);if(!target)return;
     target.score=(Number(target.score)||0)+Number(prompt.value);
     g.lastValue=prompt.value;g.lastTeamId=target.id;
     g.lastAward={value:prompt.value,teamId:target.id,source:"teacher-direct-pending",at:Date.now()};
     delete map[teamId];g.pendingPrompts=map;delete g.pendingPrompt;return g;
   });
   setStatus(result.committed?"Assigned "+formatScore(current.value)+" to "+(chosenTeam?.name||"that team")+".":"That team's pending value changed; no points were assigned.");
   return;
 }
 const prompt={id:globalThis.crypto?.randomUUID?.()||("prompt-"+Date.now()+"-"+Math.random().toString(36).slice(2)),teamId,value:game.currentValue,createdAt:Date.now()};
 const nextValue=pointValue();
 const result=await runTransaction(ref(db,"games/"+gameId),g=>{
   if(!g||g.status!=="active"||!Array.isArray(g.teams)||!g.teams.some(x=>x.id===teamId))return;
   const map=pendingMap(g);if(map[teamId])return;
   map[teamId]=prompt;g.pendingPrompts=map;delete g.pendingPrompt;
   g.lastPromptTeamId=teamId;g.currentValue=nextValue;return g;
 });
 if(result.committed){game=result.snapshot.val();render();setStatus("Prompt sent to "+(game.teams.find(t=>t.id===teamId)?.name||"team")+".");}
 else setStatus("Could not send a prompt. That team may already have a value waiting.");
}
async function award(value,teamId,source,expectedPromptId=null){const result=await runTransaction(ref(db,"games/"+gameId),g=>{if(!g||g.status!=="active"||!Array.isArray(g.teams))return;if(expectedPromptId&&g.pendingPrompt?.id!==expectedPromptId)return;const i=g.teams.findIndex(t=>t.id===teamId);if(i<0)return;g.teams[i].score=(Number(g.teams[i].score)||0)+Number(value);g.lastValue=value;g.lastTeamId=teamId;g.lastAward={value,teamId,source,at:Date.now()};return g;});if(!result.committed)setStatus("That point award could not be completed. Refresh and try again.");}
async function applyDirectAssignment(){const ids=[...selectedTeamIds],value=selectionValue;if(!ids.length||!game)return;const result=await runTransaction(ref(db,"games/"+gameId),g=>{if(!g||g.status!=="active"||!Array.isArray(g.teams))return;for(const id of ids){const t=g.teams.find(x=>x.id===id);if(!t)return;t.score=(Number(t.score)||0)+Number(value);}const lastId=ids[ids.length-1];g.lastValue=value;g.lastTeamId=lastId;g.lastAward={value,teamId:lastId,teamIds:ids,source:"teacher-direct",at:Date.now()};g.currentValue=pointValue();return g;});const names=ids.map(id=>game.teams.find(t=>t.id===id)?.name).filter(Boolean);clearSelection();setStatus(result.committed?"Assigned "+formatScore(value)+" to "+names.join(", ")+".":"The assignment could not be completed.");}
async function applyReassignment(){const destination=[...selectedTeamIds][0];const result=await runTransaction(ref(db,"games/"+gameId),g=>{if(!g||!g.lastAward||!Array.isArray(g.teams))return;const previousIds=g.lastAward.teamIds?.length?g.lastAward.teamIds:[g.lastTeamId];const previous=previousIds.map(id=>g.teams.find(t=>t.id===id)).filter(Boolean);const target=g.teams.find(t=>t.id===destination);if(!target||!previous.length)return;previous.forEach(t=>t.score=(Number(t.score)||0)-Number(g.lastValue));target.score=(Number(target.score)||0)+Number(g.lastValue);g.lastTeamId=destination;g.lastAward={...g.lastAward,teamId:destination,teamIds:[destination],reassignedAt:Date.now()};return g;});const name=game.teams.find(t=>t.id===destination)?.name;clearSelection();setStatus(result.committed?"Last value reassigned to "+name+".":"The last value could not be reassigned.");}
$("newValue").onclick=async()=>{if(!game||game.status!=="active")return;await update(ref(db,"games/"+gameId),{currentValue:pointValue()});setStatus(Object.keys(pendingMap(game)).length?"Next value changed. All pending team values are unchanged.":"Next point value changed.");};
$("setTimer").onclick=async()=>{const n=(Number($("minutes").value)||0)*60+(Number($("seconds").value)||0);if(n<=0){setStatus("Enter a timer duration greater than zero.");return;}if(!gameId){pendingTimerSeconds=n;$("timer").textContent=formatTime(n);setStatus("Timer saved. It will start when the game begins.");return;}if(game?.status!=="active"){pendingTimerSeconds=n;await update(ref(db,"games/"+gameId),{timerSeconds:n,timerRunning:false});setStatus("Timer saved. It will start when the game begins.");return;}await update(ref(db,"games/"+gameId),{timerSeconds:n,timerRunning:true});startTimerLoop();setStatus("Timer started.");};
$("stopTimer").onclick=async()=>{if(timerHandle)clearInterval(timerHandle);timerHandle=null;if(gameId)await update(ref(db,"games/"+gameId),{timerRunning:false});setStatus("Timer stopped.");};
function startTimerLoop(){if(timerHandle)clearInterval(timerHandle);timerHandle=setInterval(async()=>{if(!game||!game.timerRunning||game.timerSeconds==null)return;if(game.timerSeconds<=1){clearInterval(timerHandle);timerHandle=null;await finish();return;}await update(ref(db,"games/"+gameId),{timerSeconds:game.timerSeconds-1});},1000);}
async function finish(){if(!gameId)return;if(timerHandle)clearInterval(timerHandle);timerHandle=null;await update(ref(db,"games/"+gameId),{status:"finished",started:false,finished:true,timerRunning:false,timerSeconds:null,pendingPrompts:{},pendingPrompt:null});}
function resetConfirmButtons(except=null){["finish","newRound","newGame"].forEach(id=>{const b=$(id);if(!b||b===except)return;b.dataset.confirm="";b.textContent=b.dataset.baseLabel||b.textContent.replace(/^CONFIRM\\?$/,"");b.classList.remove("confirm-ready");});}
function confirmButton(button,label,action){button.dataset.baseLabel=label;resetConfirmButtons(button);if(button.dataset.confirm==="yes"){button.dataset.confirm="";button.textContent=label;button.classList.remove("confirm-ready");action();return;}button.dataset.confirm="yes";button.textContent="CONFIRM?";button.classList.add("confirm-ready");}
$("finish").onclick=()=>confirmButton($("finish"),"END GAME",finish);
$("newRound").onclick=()=>confirmButton($("newRound"),"NEW ROUND",async()=>{if(!game)return;await update(ref(db,"games/"+gameId),{status:"active",started:true,finished:false,teams:game.teams.map(t=>({...t,score:0})),currentValue:pointValue(),lastValue:null,lastTeamId:null,lastAward:null,pendingPrompts:{},pendingPrompt:null,timerSeconds:null,timerRunning:false});$("winner").classList.add("hidden");$("controls").classList.remove("hidden");$("timerPanel").classList.remove("hidden");$("teacherGameActions").classList.remove("hidden");});
$("newGame").onclick=()=>confirmButton($("newGame"),"NEW GAME",()=>{if(unsub)unsub();if(timerHandle)clearInterval(timerHandle);timerHandle=null;assignMode=null;selectedTeamIds.clear();selectionValue=null;$("timer").textContent="No timer";$("minutes").value="";$("seconds").value="";pendingTimerSeconds=null;$("timerPanel").classList.remove("hidden");$("timerButtons").classList.add("hidden");$("teacherGameActions").classList.add("hidden");game=null;gameId=null;$("teamCount").value=4;$("setup").classList.remove("hidden");$("lobby").classList.add("hidden");$("controls").classList.add("hidden");$("winner").classList.add("hidden");$("gameCode").textContent="—";$("create").disabled=false;setStatus("Ready to create another game.");});
function showWinner(){const w=winners(game.teams);$("lobby").classList.add("hidden");$("controls").classList.add("hidden");$("winner").classList.remove("hidden");$("winnerContent").innerHTML='<div class="team-grid">'+game.teams.slice().sort((a,b)=>Math.abs(a.score)-Math.abs(b.score)).map(t=>'<div class="team-card '+(w.some(x=>x.id===t.id)?"winner-team":"")+'"><div class="emoji">'+t.emoji+'</div><div class="name">'+escapeHtml(t.name)+'</div><div class="score">'+formatScore(t.score)+'</div>'+(w.some(x=>x.id===t.id)?'<strong>WINNER</strong>':'')+'</div>').join("")+'</div>';}
