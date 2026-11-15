/* =========================================================
ZERO OUT
First working version + timer
========================================================= */

/* =========================================================
ANIMAL DATABASE - work damnit
========================================================= */

let teamDrafts = [];

function randomAnimal(exclude = []) {
  const available = animalCatalog.filter(animal => !exclude.includes(animal.name));
  if (!available.length) throw new Error("There are not enough available animals for that many teams.");
  return available[Math.floor(Math.random() * available.length)];
}

function renderTeamAssignments() {
  const requested = Number(teamCountInput.value);
  const count = Math.max(1, Math.min(animalCatalog.length,
    Number.isFinite(requested) && requested ? Math.floor(requested) : 4));
  teamCountInput.value = count;
  const previous = teamDrafts.slice();
  teamDrafts = Array.from({ length: count }, (_, index) => {
    const name = previous[index];
    return name && animalCatalog.some(animal => animal.name === name) ? name : null;
  });

  // Fill unassigned teams randomly, retaining unique manually chosen animals.
  for (let index = 0; index < teamDrafts.length; index++) {
    if (!teamDrafts[index]) teamDrafts[index] = randomAnimal(teamDrafts.filter(Boolean)).name;
  }

  teamAssignments.innerHTML = "";
  teamDrafts.forEach((value, index) => {
    const row = document.createElement("div");
    row.className = "team-assignment-row";
    const label = document.createElement("label");
    label.textContent = "Team " + (index + 1);
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Animal for team " + (index + 1));
    animalCatalog.forEach(animal => {
      const option = document.createElement("option");
      option.value = animal.name;
      option.textContent = animal.emoji + " " + animal.name;
      select.appendChild(option);
    });
    select.value = value;
    select.addEventListener("change", () => {
      const chosen = select.value;
      if (teamDrafts.some((name, i) => i !== index && name === chosen)) {
        select.value = teamDrafts[index];
        return;
      }
      teamDrafts[index] = chosen;
      renderTeamAssignments();
    });
    const randomButton = document.createElement("button");
    randomButton.type = "button";
    randomButton.textContent = "Random";
    randomButton.addEventListener("click", () => {
      teamDrafts[index] = randomAnimal(teamDrafts.filter((name, i) => i !== index)).name;
      renderTeamAssignments();
    });
    row.append(label, select, randomButton);
    teamAssignments.appendChild(row);
  });
  selectedCount.textContent = String(count);
  updateCreateButton();
}

function updateCreateButton() {
  const complete = teamDrafts.length > 0 &&
    teamDrafts.every(name => animalCatalog.some(animal => animal.name === name)) &&
    new Set(teamDrafts).size === teamDrafts.length;
  if (typeof createGameButton !== "undefined" && createGameButton) createGameButton.disabled = !complete;
  if (typeof startGameButton !== "undefined" && startGameButton) startGameButton.disabled = !complete;
}

function buildTeams() {
  const timestamp = Date.now();
  return teamDrafts.map((name, index) => {
    const animal = animalCatalog.find(item => item.name === name);
    if (!animal) throw new Error("Choose a valid animal for every team.");
    return { id: "team-" + (index + 1) + "-" + timestamp,
      name: animal.name, emoji: animal.emoji, score: 0, position: index };
  });
}

function randomizeAllTeams() {
  const shuffled = [...animalCatalog];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  teamDrafts = shuffled.slice(0, teamDrafts.length).map(animal => animal.name);
  renderTeamAssignments();
}

teamCountInput.addEventListener("change", renderTeamAssignments);
randomizeTeamsButton.addEventListener("click", randomizeAllTeams);

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

async function updateVersionCounter() {
  const element = document.getElementById("versionCounter");
  if (!element) return;
  try {
    let page = 1;
    let total = 0;
    while (true) {
      const response = await fetch(
        "https://api.github.com/repos/cedarparkjacob/cedarparkjacob.github.io/commits?path=game-testing/zero-out&per_page=100&page=" + page,
        { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" }
      );
      if (!response.ok) throw new Error("GitHub returned HTTP " + response.status);
      const commits = await response.json();
      if (!Array.isArray(commits)) throw new Error("Unexpected GitHub response");
      total += commits.length;
      if (commits.length < 100) break;
      page++;
    }
    element.textContent = "Version " + total;
  } catch (error) {
    console.error("Could not load Zero Out version:", error);
    element.textContent = "Version unavailable";
  }
}
updateVersionCounter();