import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getDatabase, ref, get, onValue, set, update, runTransaction } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyASer01FF8K3-oqf4QJDG7iMNiykyY549g",
  authDomain: "zero-out-cedar-park.firebaseapp.com",
  databaseURL: "https://zero-out-cedar-park-default-rtdb.firebaseio.com",
  projectId: "zero-out-cedar-park",
  storageBucket: "zero-out-cedar-park.firebasestorage.app",
  messagingSenderId: "786796988391",
  appId: "1:786796988391:web:582f42b8b63184a6719f42",
  measurementId: "G-28RLDXFREW"
};
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, get, onValue, set, update, runTransaction };

export const animalCatalog = [
  {name:"Ant",emoji:"🐜"},{name:"Bat",emoji:"🦇"},{name:"Bear",emoji:"🐻"},{name:"Bee",emoji:"🐝"},{name:"Bird",emoji:"🐦"},{name:"Blowfish",emoji:"🐡"},{name:"Boar",emoji:"🐗"},{name:"Butterfly",emoji:"🦋"},{name:"Camel",emoji:"🐪"},{name:"Cat",emoji:"🐈"},{name:"Chicken",emoji:"🐔"},{name:"Cow",emoji:"🐄"},{name:"Crab",emoji:"🦀"},{name:"Crocodile",emoji:"🐊"},{name:"Deer",emoji:"🦌"},{name:"Dog",emoji:"🐕"},{name:"Dolphin",emoji:"🐬"},{name:"Dove",emoji:"🕊️"},{name:"Duck",emoji:"🦆"},{name:"Eagle",emoji:"🦅"},{name:"Elephant",emoji:"🐘"},{name:"Fish",emoji:"🐟"},{name:"Fox",emoji:"🦊"},{name:"Frog",emoji:"🐸"},{name:"Giraffe",emoji:"🦒"},{name:"Goat",emoji:"🐐"},{name:"Gorilla",emoji:"🦍"},{name:"Hamster",emoji:"🐹"},{name:"Horse",emoji:"🐎"},{name:"Leopard",emoji:"🐆"},{name:"Lion",emoji:"🦁"},{name:"Lizard",emoji:"🦎"},{name:"Monkey",emoji:"🐒"},{name:"Mouse",emoji:"🐁"},{name:"Octopus",emoji:"🐙"},{name:"Panda",emoji:"🐼"},{name:"Penguin",emoji:"🐧"},{name:"Pig",emoji:"🐖"},{name:"Poodle",emoji:"🐩"},{name:"Rabbit",emoji:"🐇"},{name:"Ram",emoji:"🐏"},{name:"Rat",emoji:"🐀"},{name:"Rhinoceros",emoji:"🦏"},{name:"Scorpion",emoji:"🦂"},{name:"Shark",emoji:"🦈"},{name:"Sheep",emoji:"🐑"},{name:"Shrimp",emoji:"🦐"},{name:"Snail",emoji:"🐌"},{name:"Snake",emoji:"🐍"},{name:"Spider",emoji:"🕷️"},{name:"Squid",emoji:"🦑"},{name:"Tiger",emoji:"🐅"},{name:"T-Rex",emoji:"🦖"},{name:"Tropical Fish",emoji:"🐠"},{name:"Turtle",emoji:"🐢"},{name:"Turkey",emoji:"🦃"},{name:"Whale",emoji:"🐋"},{name:"Wolf",emoji:"🐺"},{name:"Zebra",emoji:"🦓"}
];
export const makeCode = () => Array.from({length:6},()=> "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*32)]).join("");
export const pointValue = () => { let n=0; while(!n) n=Math.floor(Math.random()*201)-100; return n; };
export const formatScore = n => n > 0 ? "+"+n : String(n ?? 0);
export const formatTime = n => String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
export const winners = teams => { if(!teams?.length)return []; const min=Math.min(...teams.map(t=>Math.abs(Number(t.score)||0))); return teams.filter(t=>Math.abs(Number(t.score)||0)===min); };
export const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
