/* =========================================================
ZERO OUT
First working version + timer
========================================================= */

/* =========================================================
ANIMAL DATABASE - work damnit
========================================================= */

const animals = {
  A: [
    { name: "Alligator", emoji: "🐊" },
    { name: "Ant", emoji: "🐜" },
    { name: "Armadillo", emoji: "🦔" }
  ],
  B: [
    { name: "Badger", emoji: "🦡" },
    { name: "Bat", emoji: "🦇" },
    { name: "Bear", emoji: "🐻" },
    { name: "Beaver", emoji: "🦫" },
    { name: "Bee", emoji: "🐝" },
    { name: "Beetle", emoji: "🪲" },
    { name: "Bird", emoji: "🐦" },
    { name: "Bison", emoji: "🦬" },
    { name: "Blowfish", emoji: "🐡" },
    { name: "Boar", emoji: "🐗" },
    { name: "Butterfly", emoji: "🦋" }
  ],
  C: [
    { name: "Camel", emoji: "🐪" },
    { name: "Cat", emoji: "🐈" },
    { name: "Caterpillar", emoji: "🐛" },
    { name: "Chipmunk", emoji: "🐿️" },
    { name: "Chicken", emoji: "🐔" },
    { name: "Cow", emoji: "🐄" },
    { name: "Crab", emoji: "🦀" },
    { name: "Crocodile", emoji: "🐊" }
  ],
  D: [
    { name: "Deer", emoji: "🦌" },
    { name: "Dodo", emoji: "🦤" },
    { name: "Dog", emoji: "🐕" },
    { name: "Dolphin", emoji: "🐬" },
    { name: "Donkey", emoji: "🫏" },
    { name: "Dove", emoji: "🕊️" },
    { name: "Duck", emoji: "🦆" }
  ],
  E: [
    { name: "Eagle", emoji: "🦅" },
    { name: "Elephant", emoji: "🐘" }
  ],
  F: [
    { name: "Fish", emoji: "🐟" },
    { name: "Flamingo", emoji: "🦩" },
    { name: "Fly", emoji: "🪰" },
    { name: "Fox", emoji: "🦊" },
    { name: "Frog", emoji: "🐸" }
  ],
  G: [
    { name: "Giraffe", emoji: "🦒" },
    { name: "Goat", emoji: "🐐" },
    { name: "Gorilla", emoji: "🦍" },
    { name: "Goose", emoji: "🪿" }
  ],
  H: [
    { name: "Hamster", emoji: "🐹" },
    { name: "Hare", emoji: "🐇" },
    { name: "Hedgehog", emoji: "🦔" },
    { name: "Hippopotamus", emoji: "🦛" },
    { name: "Horse", emoji: "🐎" }
  ],
  J: [
    { name: "Jellyfish", emoji: "🪼" }
  ],
  K: [
    { name: "Kangaroo", emoji: "🦘" },
    { name: "Koala", emoji: "🐨" }
  ],
  L: [
    { name: "Leopard", emoji: "🐆" },
    { name: "Lion", emoji: "🦁" },
    { name: "Lizard", emoji: "🦎" },
    { name: "Llama", emoji: "🦙" },
    { name: "Lobster", emoji: "🦞" }
  ],
  M: [
    { name: "Mammoth", emoji: "🦣" },
    { name: "Monkey", emoji: "🐒" },
    { name: "Mosquito", emoji: "🦟" },
    { name: "Mouse", emoji: "🐁" }
  ],
  O: [
    { name: "Octopus", emoji: "🐙" },
    { name: "Orangutan", emoji: "🦧" },
    { name: "Orca", emoji: "🫍" },
    { name: "Ostrich", emoji: "🦤" },
    { name: "Otter", emoji: "🦦" },
    { name: "Oyster", emoji: "🦪" }
  ],
  P: [
    { name: "Panda", emoji: "🐼" },
    { name: "Parrot", emoji: "🦜" },
    { name: "Peacock", emoji: "🦚" },
    { name: "Penguin", emoji: "🐧" },
    { name: "Pig", emoji: "🐖" },
    { name: "Polar Bear", emoji: "🐻‍❄️" },
    { name: "Poodle", emoji: "🐩" }
  ],
  R: [
    { name: "Rabbit", emoji: "🐇" },
    { name: "Raccoon", emoji: "🦝" },
    { name: "Ram", emoji: "🐏" },
    { name: "Rat", emoji: "🐀" },
    { name: "Rhinoceros", emoji: "🦏" }
  ],
  S: [
    { name: "Scorpion", emoji: "🦂" },
    { name: "Seal", emoji: "🦭" },
    { name: "Shark", emoji: "🦈" },
    { name: "Sheep", emoji: "🐑" },
    { name: "Shrimp", emoji: "🦐" },
    { name: "Skunk", emoji: "🦨" },
    { name: "Sloth", emoji: "🦥" },
    { name: "Snail", emoji: "🐌" },
    { name: "Snake", emoji: "🐍" },
    { name: "Spider", emoji: "🕷️" },
    { name: "Squid", emoji: "🦑" },
    { name: "Swan", emoji: "🦢" }
  ],
  T: [
    { name: "Tiger", emoji: "🐅" },
    { name: "T-Rex", emoji: "🦖" },
    { name: "Tropical Fish", emoji: "🐠" },
    { name: "Turtle", emoji: "🐢" },
    { name: "Turkey", emoji: "🦃" }
  ],
  W: [
    { name: "Whale", emoji: "🐋" },
    { name: "Worm", emoji: "🪱" },
    { name: "Water Buffalo", emoji: "🐃" },
    { name: "Wolf", emoji: "🐺" }
  ],
  Z: [
    { name: "Zebra", emoji: "🦓" }
  ]
};

/* =========================================================
GAME STATE
========================================================= */

let game = {

started: false,

currentValue: null,

lastValue: null,

lastTeamId: null,

teams: [],

timerSeconds: null,

timerRunning: false

};

let timerInterval = null;

// =========================================================
// FIREBASE
// =========================================================

import {
  ref,
  set,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const db = window.firebaseDB;

let firebaseGameId = null;

let gameListener = null;

async function saveGameToFirebase() {

  if (!firebaseGameId) {
    console.error("No Firebase game ID.");
    return;
  }

  if (!db) {
    console.error("Firebase database is not available.");
    return;
  }

  const gameData = {
    started: game.started,
    currentValue: game.currentValue,
    lastValue: game.lastValue,
    lastTeamId: game.lastTeamId,
    teams: game.teams,
    timerSeconds: game.timerSeconds,
    timerRunning: game.timerRunning
  };

  console.log(
    "Saving to Firebase:",
    firebaseGameId,
    gameData
  );

  await set(
    ref(db, "games/" + firebaseGameId),
    gameData
  );

  console.log(
    "Firebase save complete."
  );
}




/* =========================================================
DOM ELEMENTS
========================================================= */

const gameCodeScreen =
document.getElementById("gameCodeScreen");

const gameCodeInput =
document.getElementById("gameCodeInput");

const joinGameButton =
document.getElementById("joinGameButton");

const gameCodeError =
document.getElementById("gameCodeError");

const teamCountInput=document.getElementById("teamCount");const teamAssignments=document.getElementById("teamAssignments");const randomizeTeamsButton=document.getElementById("randomizeTeams");

const selectedCountElement =
document.getElementById("selectedCount");

const selectedLettersElement = document.getElementById("selectedLetters");
const selectedCount = selectedCountElement;

const startGameButton =
document.getElementById("startGame");

const setupSection =
document.getElementById("setupSection");

const gameControls =
document.getElementById("gameControls");

const teamsElement =
document.getElementById("teams");

const currentValueElement =
document.getElementById("currentValue");

const teacherCurrentValueElement =
document.getElementById("teacherCurrentValue");

const teamButtonsElement =
document.getElementById("teamButtons");

const controlPanel =
document.getElementById("controlPanel");

const controlsToggle =
document.getElementById("controlsToggle");

const closeControls =
document.getElementById("closeControls");

const newValueButton =
document.getElementById("newValue");

const reassignButton =
document.getElementById("reassignButton");

const editScoresButton =
document.getElementById("editScoresButton");

const resetGameButton =
document.getElementById("resetGameButton");

const editModal =
document.getElementById("editModal");

const scoreEditors =
document.getElementById("scoreEditors");

const saveScoresButton =
document.getElementById("saveScores");

const cancelScoreEdit =
document.getElementById("cancelScoreEdit");

const closeEditModal =
document.getElementById("closeEditModal");

const winnerScreen =
document.getElementById("winnerScreen");

const winnerAnimal =
document.getElementById("winnerAnimal");

const winnerName =
document.getElementById("winnerName");

const winnerScore =
document.getElementById("winnerScore");

const closeWinner =
document.getElementById("closeWinner");


/* =========================================================
STUDENT GAME CODE CONNECTION
========================================================= */

joinGameButton.addEventListener(
  "click",
  joinGame
);


gameCodeInput.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {
      joinGame();
    }

  }
);


async function joinGame() {

  const code =
    gameCodeInput.value
      .trim()
      .toUpperCase();


  gameCodeError.textContent = "";


  /*
    Basic code validation.
  */

  if (!/^[A-Z0-9]{6}$/.test(code)) {

    gameCodeError.textContent =
      "Enter the 6-character game code.";

    return;

  }


  joinGameButton.disabled = true;

  joinGameButton.textContent =
    "CONNECTING...";


  try {

    const gameRef =
      ref(
        db,
        "games/" + code
      );


    /*
      Check whether the game exists.
    */

    const snapshot =
      await get(gameRef);


    if (!snapshot.exists()) {

      gameCodeError.textContent =
        "Game not found. Check the code and try again.";

      joinGameButton.disabled = false;

      joinGameButton.textContent =
        "JOIN GAME";

      return;

    }


    /*
      Remember the game code.
    */

    firebaseGameId =
      code;


    /*
      Hide the code screen.
    */

    gameCodeScreen.classList.add(
      "hidden"
    );


    /*
      Listen for all future changes.
    */

    if (gameListener) {
      gameListener();
    }


gameListener =
  onValue(
    gameRef,
    snapshot => {

      const firebaseGame =
        snapshot.val();

      if (!firebaseGame) {
        return;
      }

      /*
        Remember whether the game was
        previously running.
      */

      const wasStarted =
        game.started;

      /*
        Update local game state.
      */

      game =
        firebaseGame;

      /*
        Render the scoreboard.
      */

      renderEverything();

      /*
        If the teacher just ended the game,
        show the winner screen.
      */

      if (
        wasStarted === true &&
        game.started === false
      ) {
        showWinner();
      }

    }
  );


  } catch (error) {

    console.error(
      "Failed to join game:",
      error
    );

    gameCodeError.textContent =
      "Could not connect to the game.";

  }


  joinGameButton.disabled = false;

  joinGameButton.textContent =
    "JOIN GAME";

}


/* TIMER ELEMENTS */

const gameTimerElement =
document.getElementById("gameTimer");

const teacherTimerElement =
document.getElementById("teacherTimer");

const setupTimerMinutes =
document.getElementById("setupTimerMinutes");

const setupTimerSeconds =
document.getElementById("setupTimerSeconds");

const gameTimerMinutes =
document.getElementById("gameTimerMinutes");

const gameTimerSeconds =
document.getElementById("gameTimerSeconds");

const setTimerButton =
document.getElementById("setTimerButton");

const stopTimerButton =
document.getElementById("stopTimerButton");

const finishGameButton =
document.getElementById("finishGameButton");

/* =========================================================
TEAM SELECTION
========================================================= */

const animalCatalog=Object.values(animals).flat()
  .filter(a=>!["Alligator","Armadillo","Caterpillar","Hare","Ostrich"].includes(a.name))
  .concat([
    {name:"Bactrian Camel",emoji:"🐫"},{name:"Baby Chick",emoji:"🐣"},
    {name:"Front-Facing Baby Chick",emoji:"🐥"},{name:"Owl",emoji:"🦉"},
    {name:"Cockroach",emoji:"🪳"},{name:"Bug",emoji:"🐛"},
    {name:"Coral",emoji:"🪸"},{name:"Orca",emoji:"🫍"}
  ])
  .filter((a,i,list)=>list.findIndex(x=>x.emoji===a.emoji)===i);
let teamDrafts=[];
function randomAnimal(exclude=[]){const p=animalCatalog.filter(a=>!exclude.includes(a.name));return p[Math.floor(Math.random()*p.length)];}
function renderTeamAssignments(){const n=Math.max(1,Math.min(animalCatalog.length,Number(teamCountInput.value)||1));teamCountInput.value=n;teamDrafts=Array.from({length:n},(_,i)=>teamDrafts[i]||null);teamAssignments.innerHTML="";teamDrafts.forEach((v,i)=>{const row=document.createElement("div");row.className="team-assignment-row";const label=document.createElement("label");label.textContent="Team "+(i+1);const sel=document.createElement("select");const rand=document.createElement("option");rand.value="";rand.textContent="🎲 Random";sel.appendChild(rand);animalCatalog.forEach(a=>{const o=document.createElement("option");o.value=a.name;o.textContent=a.emoji+" "+a.name;sel.appendChild(o);});sel.value=v||"";sel.addEventListener("change",()=>{teamDrafts[i]=sel.value||null;refreshTeamChoices();});const btn=document.createElement("button");btn.type="button";btn.textContent="Random";btn.addEventListener("click",()=>{teamDrafts[i]=randomAnimal(teamDrafts.filter((x,j)=>j!==i&&x)).name;renderTeamAssignments();});row.append(label,sel,btn);teamAssignments.appendChild(row);});selectedCount.textContent=n;refreshTeamChoices();}
function refreshTeamChoices(){[...teamAssignments.querySelectorAll("select")].forEach((s,i)=>{[...s.options].forEach(o=>{if(o.value)o.disabled=teamDrafts.some((v,j)=>j!==i&&v===o.value);});s.value=teamDrafts[i]||"";});updateCreateButton();}
function updateCreateButton(){const c=teamDrafts.filter(Boolean);const ok=teamDrafts.length>0&&c.length===new Set(c).size;if(typeof createGameButton!=="undefined"&&createGameButton)createGameButton.disabled=!ok;if(typeof startGameButton!=="undefined"&&startGameButton)startGameButton.disabled=!ok;}
function buildTeams(){
 const used=[];
 const reserved=teamDrafts.filter(Boolean);
 return teamDrafts.map((v,i)=>{
  const a=v?animalCatalog.find(x=>x.name===v):randomAnimal([...used,...reserved]);
  if(!a||used.includes(a.name))throw Error("Each team must have a different animal.");
  used.push(a.name);
  return{id:"team-"+(i+1)+"-"+Date.now(),name:a.name,emoji:a.emoji,score:0,position:i};
 });
}
function randomizeAllTeams(){const shuffled=[...animalCatalog].sort(()=>Math.random()-.5);teamDrafts=teamDrafts.map((_,i)=>shuffled[i].name);renderTeamAssignments();}
teamCountInput.addEventListener("change",renderTeamAssignments);randomizeTeamsButton.addEventListener("click",randomizeAllTeams);renderTeamAssignments();
/* =========================================================
START GAME
========================================================= */

startGameButton.addEventListener(
"click",
startGame
);

async function startGame() {

if (!teamDrafts.length) return;

stopGameTimer();

game.started = true;

game.currentValue = null;

game.lastValue = null;

game.lastTeamId = null;

game.teams =
buildTeams();

firebaseGameId =
  Math.random().toString(36).substring(2, 8).toUpperCase();

await set(
  ref(db, "games/" + firebaseGameId),
  {
    started: true,
    currentValue: null,
    teams: game.teams
  }
);
  

setupSection.classList.add("hidden");

gameControls.classList.remove("hidden");

renderEverything();

/*
Generate the first value immediately.
*/

generateNewValue();

/*
Start optional setup timer.
*/

const setupMinutes =
Number(setupTimerMinutes.value) || 0;

const setupSeconds =
Number(setupTimerSeconds.value) || 0;

const totalSeconds =
setupMinutes * 60 +
setupSeconds;

if (totalSeconds > 0) {


game.timerSeconds =
  totalSeconds;

startGameTimer();


} else {


game.timerSeconds = null;

updateTimerDisplay();


}
}

/* =========================================================
RANDOM POINT VALUE
========================================================= */

function generatePointValue() {

let value = 0;

while (value === 0) {


value =
  Math.floor(
    Math.random() * 201
  ) - 100;


}

return value;
}

newValueButton.addEventListener(
"click",
generateNewValue
);

function generateNewValue() {

if (!game.started) {
return;
}

game.currentValue =
generatePointValue();

/*
A manually generated value starts
a new assignment cycle.
*/

game.lastValue = null;

game.lastTeamId = null;

reassignButton.disabled = true;

renderValue();
}

/* =========================================================
AWARD POINTS
========================================================= */

async function awardPoints(teamId) {

  if (
    !game.started ||
    game.currentValue === null
  ) {
    return;
  }

  const team =
    game.teams.find(
      t => t.id === teamId
    );

  if (!team) {
    return;
  }

  /*
  Save transaction for reassignment.
  */

  game.lastValue =
    game.currentValue;

  game.lastTeamId =
    team.id;

  /*
  Apply points.
  */

  team.score +=
    game.currentValue;

  /*
  Immediately create the next value.
  */

  game.currentValue =
    generatePointValue();

  reassignButton.disabled = false;

  /*
  Save the NEW state to Firebase.
  */

  try {

    await saveGameToFirebase();

    console.log(
      "Game saved to Firebase:",
      game
    );

  } catch (error) {

    console.error(
      "Firebase save failed:",
      error
    );

  }

  renderEverything();

  highlightTeam(team.id);
}

/* =========================================================
REASSIGN LAST VALUE
========================================================= */

reassignButton.addEventListener(
"click",
beginReassign
);

function beginReassign() {

if (
game.lastValue === null ||
game.lastTeamId === null
) {
return;
}

const value =
game.lastValue;

teamButtonsElement.innerHTML = "";

game.teams.forEach(team => {


const button =
  document.createElement("button");

button.className =
  "team-select-button";

button.innerHTML = `
  <span>
    ${team.emoji}
    ${team.name}
  </span>

  <span class="button-score">
    ${formatScore(team.score)}
  </span>
`;

button.addEventListener(
  "click",
  () => reassignValue(team.id)
);

if (
  team.id === game.lastTeamId
) {

  button.disabled = true;

  button.style.opacity = "0.35";
}

teamButtonsElement.appendChild(button);


});

}

function reassignValue(newTeamId) {

const oldTeam =
game.teams.find(
team =>
team.id === game.lastTeamId
);

const newTeam =
game.teams.find(
team =>
team.id === newTeamId
);

if (!oldTeam || !newTeam) {
return;
}

oldTeam.score -=
game.lastValue;

newTeam.score +=
game.lastValue;

game.lastTeamId =
newTeam.id;

renderEverything();

highlightTeam(newTeam.id);
}

/* =========================================================
RENDER SCOREBOARD
========================================================= */

function renderScoreboard() {

teamsElement.innerHTML = "";

game.teams.forEach(team => {


const card =
  document.createElement("div");

card.className =
  "team-card";

card.dataset.teamId =
  team.id;

card.innerHTML = `

  <div class="team-animal">
    ${team.emoji}
  </div>

  <div class="team-name">
    ${team.name}
  </div>

  <div class="team-score">
    ${formatScore(team.score)}
  </div>

`;

teamsElement.appendChild(card);


});

const count =
game.teams.length;

let columns = 2;

if (count === 1) {
columns = 1;
}

else if (count <= 4) {
columns = 2;
}

else if (count <= 9) {
columns = 3;
}

else {
columns = 4;
}

teamsElement.style.gridTemplateColumns =
`repeat(${columns}, 1fr)`;
}

/* =========================================================
RENDER TEACHER TEAM BUTTONS
========================================================= */

function renderTeamButtons() {

teamButtonsElement.innerHTML = "";

game.teams.forEach(team => {


const button =
  document.createElement("button");

button.className =
  "team-select-button";

button.innerHTML = `

  <span>
    ${team.emoji}
    ${team.name}
  </span>

  <span class="button-score">
    ${formatScore(team.score)}
  </span>

`;

button.addEventListener(
  "click",
  () => awardPoints(team.id)
);

teamButtonsElement.appendChild(button);


});
}

/* =========================================================
RENDER VALUE
========================================================= */

function renderValue() {

const value =
game.currentValue;

const display =
value === null
? "—"
: formatScore(value);

currentValueElement.textContent =
display;

teacherCurrentValueElement.textContent =
display;
}

/* =========================================================
RENDER EVERYTHING
========================================================= */

function renderEverything() {

renderScoreboard();

renderTeamButtons();

renderValue();

updateTimerDisplay();
}

/* =========================================================
SCORE FORMATTING
========================================================= */

function formatScore(value) {

if (value > 0) {
return `+${value}`;
}

return String(value);
}

/* =========================================================
HIGHLIGHT TEAM
========================================================= */

function highlightTeam(teamId) {

const card =
document.querySelector(
`.team-card[data-team-id="${teamId}"]`
);

if (!card) {
return;
}

card.classList.add("highlight");

setTimeout(() => {


card.classList.remove("highlight");


}, 700);
}

/* =========================================================
CONTROL PANEL
========================================================= */

controlsToggle.addEventListener(
"click",
() => {
controlPanel.classList.add("open");
}
);

closeControls.addEventListener(
"click",
() => {
controlPanel.classList.remove("open");
}
);

/* =========================================================
TIMER
========================================================= */

function formatTime(totalSeconds) {

if (
totalSeconds === null ||
totalSeconds === undefined
) {
return "00:00";
}

const minutes =
Math.floor(totalSeconds / 60);

const seconds =
totalSeconds % 60;

return (
String(minutes).padStart(2, "0") +
":" +
String(seconds).padStart(2, "0")
);
}

function updateTimerDisplay() {

  if (
    game.timerSeconds === null ||
    game.timerSeconds === undefined
  ) {

    gameTimerElement.classList.add("hidden");

    teacherTimerElement.textContent = "";

    teacherTimerElement.classList.remove("warning");

    return;
  }

  gameTimerElement.classList.remove("hidden");

  gameTimerElement.textContent =
    formatTime(game.timerSeconds);

  teacherTimerElement.textContent =
    formatTime(game.timerSeconds);

  /*
  Warning animation during final minute.
  */

  if (game.timerSeconds <= 60) {

    gameTimerElement.classList.add("warning");

    teacherTimerElement.classList.add("warning");

  } else {

    gameTimerElement.classList.remove("warning");

    teacherTimerElement.classList.remove("warning");

  }
}

function startGameTimer() {

stopGameTimer();

if (
!game.timerSeconds ||
game.timerSeconds <= 0
) {
return;
}

game.timerRunning = true;

stopTimerButton.disabled = false;

updateTimerDisplay();

timerInterval =
setInterval(() => {


  if (!game.started) {
    stopGameTimer();
    return;
  }

  game.timerSeconds--;

  updateTimerDisplay();

  if (game.timerSeconds <= 0) {

    game.timerSeconds = 0;

    updateTimerDisplay();

    stopGameTimer();

    finishGame();

  }

}, 1000);


}

function stopGameTimer() {

if (timerInterval !== null) {


clearInterval(timerInterval);

timerInterval = null;


}

game.timerRunning = false;

if (stopTimerButton) {
stopTimerButton.disabled = true;
}
}

/*
Set/start timer during the game.
*/

setTimerButton.addEventListener(
"click",
setGameTimer
);

function setGameTimer() {

const minutes =
Number(gameTimerMinutes.value) || 0;

const seconds =
Number(gameTimerSeconds.value) || 0;

if (
minutes === 0 &&
seconds === 0
) {
return;
}

const totalSeconds =
minutes * 60 +
seconds;

game.timerSeconds =
totalSeconds;

startGameTimer();
}

/*
Stop timer during the game.
*/

stopTimerButton.addEventListener(
"click",
stopGameTimer
);

/* =========================================================
FINISH GAME
========================================================= */

finishGameButton.addEventListener(
"click",
finishGame
);

async function finishGame() {

if (
!game.started ||
game.teams.length === 0
) {
return;
}

stopGameTimer();

game.started = false;

await saveGameToFirebase();

showWinner();
}

/* =========================================================
EDIT SCORES
========================================================= */

editScoresButton.addEventListener(
"click",
openScoreEditor
);

function openScoreEditor() {

scoreEditors.innerHTML = "";

game.teams.forEach(team => {


const editor =
  document.createElement("div");

editor.className =
  "score-editor";

editor.innerHTML = `

  <label>
    ${team.name}
  </label>

  <div class="score-editor-row">

    <div class="score-editor-animal">
      ${team.emoji}
    </div>

    <input
      type="number"
      data-team-id="${team.id}"
      value="${team.score}"
    >

  </div>

`;

scoreEditors.appendChild(editor);


});

editModal.classList.remove("hidden");
}

saveScoresButton.addEventListener(
"click",
saveEditedScores
);

function saveEditedScores() {

const inputs =
scoreEditors.querySelectorAll("input");

inputs.forEach(input => {


const team =
  game.teams.find(
    t =>
      t.id === input.dataset.teamId
  );

if (!team) {
  return;
}

const value =
  Number(input.value);

if (Number.isFinite(value)) {

  team.score = value;

}


});

closeScoreEditor();

renderEverything();
}

function closeScoreEditor() {

editModal.classList.add("hidden");
}

closeEditModal.addEventListener(
"click",
closeScoreEditor
);

cancelScoreEdit.addEventListener(
"click",
closeScoreEditor
);

/* =========================================================
NEW GAME
========================================================= */

resetGameButton.addEventListener(
"click",
resetGame
);

function resetGame() {

const confirmed =
confirm(
"Start a new game? The current game will be lost."
);

if (!confirmed) {
return;
}

stopGameTimer();

game = {


started: false,

currentValue: null,

lastValue: null,

lastTeamId: null,

teams: [],

timerSeconds: null,

timerRunning: false


};

teamDrafts=[];renderTeamAssignments();

teamsElement.innerHTML = "";

renderValue();

updateTimerDisplay();
}

/* =========================================================
WINNER
========================================================= */

function determineWinners() {

  if (game.teams.length === 0) {
    return [];
  }

  const winningScore =
    Math.min(
      ...game.teams.map(
        team => Math.abs(team.score)
      )
    );

  return game.teams.filter(
    team =>
      Math.abs(team.score) === winningScore
  );
}

function showWinner() {

  const winners =
    determineWinners();

  if (winners.length === 0) {
    return;
  }

  /*
  Display all tied winners.
  */

  winnerAnimal.textContent =
    winners.map(
      winner => winner.emoji
    ).join(" ");

  winnerName.textContent =
    winners.map(
      winner => winner.name
    ).join(" & ");

  winnerScore.textContent =
    formatScore(winners[0].score);

  winnerScreen.classList.remove(
    "hidden"
  );
}

closeWinner.addEventListener(
"click",
() => {


winnerScreen.classList.add(
  "hidden"
);


}
);

/* =========================================================
INITIALIZATION
========================================================= */

renderTeamAssignments();

renderValue();

updateTimerDisplay();

async function updateVersionCounter(){const el=document.getElementById("versionCounter");if(!el)return;try{const r=await fetch("https://api.github.com/repos/cedarparkjacob/cedarparkjacob.github.io/commits?path=game-testing/zero-out&per_page=1",{headers:{Accept:"application/vnd.github+json"},cache:"no-store"});if(!r.ok)throw Error();const h=r.headers.get("Link")||"",m=h.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);el.textContent="Version "+(m?Number(m[1]):(await r.json()).length);}catch(e){el.textContent="Version unavailable";}}
updateVersionCounter();