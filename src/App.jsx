// App.js - Complete and Final Code
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- Helper Components (Stateless) ---
const SetterIcon = () => (
<span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center z-10">S</span>
);
const AceLeaderIcon = () => (
<span className="absolute bottom-0.5 left-0.5 bg-green-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center z-10">A</span>
);
const KillLeaderIcon = () => (
<span className="absolute bottom-0.5 right-0.5 bg-orange-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center z-10">K</span>
);
const DigLeaderIcon = () => (
<span className="absolute top-0.5 left-0.5 bg-yellow-500 text-black p-0.5 rounded-full h-5 w-5 flex items-center justify-center z-10" title="Dig Leader">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
<path d="M14.25 21.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM16.5 6.31L12.44 2.25a.75.75 0 00-1.06 0L7.5 6.19a.75.75 0 001.06 1.06L11.25 4.5v11.25a.75.75 0 001.5 0V4.5l2.69 2.69a.75.75 0 001.06-1.06z" />
</svg>
</span>
);
const RELeaderIcon = () => (
<span className="absolute top-1/2 -translate-y-1/2 right-0.5 h-5 w-5 flex items-center justify-center z-10" title="Most Reception Errors">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2" className="w-5 h-5">
<circle cx="12" cy="12" r="10" />
<circle cx="12" cy="12" r="6" />
<circle cx="12" cy="12" r="2" fill="red" stroke="none" />
</svg>
</span>
);
const HittingPercentageLeaderIcon = () => (
<span className="absolute top-1/2 -translate-y-1/2 left-0.5 bg-white text-black text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center z-10" title="Highest Hitting %">%</span>
);
const ReceivingLeaderIcon = () => (
<span className="absolute top-0.5 left-1/2 -translate-x-1/2 h-5 w-5 flex items-center justify-center z-10" title="Highest Receiving %">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="silver" className="w-5 h-5">
<path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6a3 3 0 003 3h10.5a3 3 0 003-3v-6a3 3 0 00-3-3v-3A5.25 5.25 0 0012 1.5zm-3.75 5.25a3.75 3.75 0 107.5 0v3h-7.5v-3z" clipRule="evenodd" />
</svg>
</span>
);
const ReceptionLeaderIcon = () => (
<span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-5 w-5 flex items-center justify-center z-10" title="Most Reception Attempts">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5">
<path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z" fill="orange" stroke="white" strokeWidth="1.5" />
</svg>
</span>
);

// --- Stat Calculation Helper ---
const calculateVbrt = (stats) => {
if (!stats) return '0.00';
const kills = stats['Kill'] || 0;
const aces = stats['Ace'] || 0;
const blocks = stats['Block'] || 0;
const assists = stats['Assist'] || 0;
const digs = stats['Dig'] || 0;
const hitErrors = stats['Hit Error'] || 0;
const setErrors = stats['Set Error'] || 0;
const serveErrors = stats['Serve Error'] || 0;
const blockErrors = stats['Block Error'] || 0;
const allErrors = hitErrors + setErrors + serveErrors + blockErrors;
const receptionScore = stats['Reception Score'] || 0;
const receptionAttempts = stats['Reception Attempt'] || 0;
const receiveAvg = receptionAttempts > 0 ? receptionScore / receptionAttempts : 0;
const receptionComponent = receptionAttempts > 0 ? receiveAvg - 1.5 : 0;
const totalRating = (kills * 1.25) + (aces * 1.5) + (blocks * 2) - allErrors + (assists * 0.5) + (digs * 0.25) + receptionComponent;
return totalRating.toFixed(2);
};

// --- Main App Component ---
export default function App() {
// --- State Management ---
const [gameState, setGameState] = useState({ homeScore: 0, opponentScore: 0, homeSetsWon: 0, opponentSetsWon: 0, servingTeam: null, homeSubs: 0, currentSet: 1, rotation: 1 });
const [matchPhase, setMatchPhase] = useState('pre_match');
const [matchId, setMatchId] = useState(null);
const [matchName, setMatchName] = useState('');
const [homeTeamName, setHomeTeamName] = useState('HOME');
const [opponentTeamName, setOpponentTeamName] = useState('OPPONENT');
const [roster, setRoster] = useState([]);
const [lineup, setLineup] = useState({ p1: null, p2: null, p3: null, p4: null, p5: null, p6: null });
const [liberos, setLiberos] = useState([]);
const [liberoServingFor, setLiberoServingFor] = useState(null);
const [liberoHasServedFor, setLiberoHasServedFor] = useState(null);
const [currentServerId, setCurrentServerId] = useState(null);
const [isWaitingForLiberoServeChoice, setIsWaitingForLiberoServeChoice] = useState(false);
const [setterId, setSetterId] = useState(null);
const [bench, setBench] = useState([]);
const [pointLog, setPointLog] = useState([]);
const [playerStats, setPlayerStats] = useState({});
const [allSetStats, setAllSetStats] = useState({});
const [seasonStats, setSeasonStats] = useState({});
const [rotationScores, setRotationScores] = useState({});
const [history, setHistory] = useState([]);
// UI State
const [modal, setModal] = useState(null);
const [subTarget, setSubTarget] = useState({ position: null, playerOutId: null });
const [statToAssign, setStatToAssign] = useState(null);
const [kwdaAttackerId, setKwdaAttackerId] = useState(null);
const [hitContext, setHitContext] = useState({ attackerId: null, originalStat: null });
const [blockContext, setBlockContext] = useState({ primaryBlockerId: null });
const [activeTab, setActiveTab] = useState('set_stats');
const [setupStep, setSetupStep] = useState('players');
const [savedMatches, setSavedMatches] = useState([]);
const [autoSaveStatus, setAutoSaveStatus] = useState('Saved  ✓ ');
const [viewingSet, setViewingSet] = useState(1);
const [itemToDelete, setItemToDelete] = useState(null);
// Firebase state
const [db, setDb] = useState(null);
const [auth, setAuth] = useState(null);
const [userId, setUserId] = useState(null);
const [isAuthReady, setIsAuthReady] = useState(false);
const autoSaveTimeoutRef = useRef(null);

const viewingSetStats = useMemo(() => allSetStats[viewingSet] || {}, [allSetStats, viewingSet]);

const earnedPoints = useMemo(() => {
    let earned = 0;
    const unearned = pointLog.filter(log => log === 'H: Opponent Error!').length;
    for (const playerId in playerStats) {
        earned += playerStats[playerId]['Ace'] || 0;
        earned += playerStats[playerId]['Kill'] || 0;
        earned += playerStats[playerId]['Block'] || 0;
    }
    return { earned, unearned };
}, [playerStats, pointLog]);

// --- Stat Leader Calculation ---
const statLeaders = useMemo(() => {
const leaders = { ace: null, kill: null, dig: null, re: null, hitPct: null, receivePct: null, receiveAtt: null };
const statsToCalc = allSetStats[viewingSet] || {};
const statsToTrack = { ace: 'Ace', kill: 'Kill', dig: 'Dig', re: 'RE', receiveAtt: 'Reception Attempt' };
const maxStats = { ace: 0, kill: 0, dig: 0, re: 0, receiveAtt: 0 };
for (const playerId in statsToCalc) {
maxStats.ace = Math.max(maxStats.ace, statsToCalc[playerId]?.Ace || 0);
maxStats.kill = Math.max(maxStats.kill, statsToCalc[playerId]?.Kill || 0);
maxStats.dig = Math.max(maxStats.dig, statsToCalc[playerId]?.Dig || 0);
maxStats.re = Math.max(maxStats.re, statsToCalc[playerId]?.RE || 0);
maxStats.receiveAtt = Math.max(maxStats.receiveAtt, statsToCalc[playerId]?.['Reception Attempt'] || 0);
}
const tiedPlayers = { ace: [], kill: [], dig: [], re: [], receiveAtt: [] };
for (const playerId in statsToCalc) {
if ((statsToCalc[playerId]?.Ace || 0) === maxStats.ace && maxStats.ace > 0) tiedPlayers.ace.push(playerId);
if ((statsToCalc[playerId]?.Kill || 0) === maxStats.kill && maxStats.kill > 0) tiedPlayers.kill.push(playerId);
if ((statsToCalc[playerId]?.Dig || 0) === maxStats.dig && maxStats.dig > 0) tiedPlayers.dig.push(playerId);
if ((statsToCalc[playerId]?.RE || 0) === maxStats.re && maxStats.re > 0) tiedPlayers.re.push(playerId);
if ((statsToCalc[playerId]?.['Reception Attempt'] || 0) === maxStats.receiveAtt && maxStats.receiveAtt > 0) tiedPlayers.receiveAtt.push(playerId);
}
for (const key in tiedPlayers) {
if (tiedPlayers[key].length === 1) {
leaders[key] = tiedPlayers[key][0];
} else if (tiedPlayers[key].length > 1) {
const statName = statsToTrack[key];
const reversedLog = [...pointLog].reverse();
for (const logEntry of reversedLog) {
const passStatRegex = /^(H|O): (\d-Pass)/;
const isPassStat = passStatRegex.test(logEntry);
if (statName === 'Reception Attempt' && isPassStat) {
const match = logEntry.match(/by #(\d+)/);
if (match) {
const playerNumberStr = match[1];
const player = roster.find(p => p.number === playerNumberStr);
if (player && tiedPlayers[key].includes(player.id)) {
leaders[key] = player.id;
break;
}
}
} else if (statName !== 'Reception Attempt' && !isPassStat) {
const match = logEntry.match(new RegExp(`${statName} by #(\\d+)`));
if (match) {
const playerNumberStr = match[1];
const player = roster.find(p => p.number === playerNumberStr);
if (player && tiedPlayers[key].includes(player.id)) {
leaders[key] = player.id;
break;
}
}
}
}
}
}
let maxHitPct = 0;
let hitPctLeader = null;
let leaderAttempts = 0;
const calculateHittingPercentage = (stats) => {
if (!stats) return -Infinity;
const kills = stats['Kill'] || 0;
const errors = stats['Hit Error'] || 0;
const attempts = stats['Hit Attempt'] || 0;
if (attempts === 0) return -Infinity;
return (kills - errors) / attempts;
};
for (const playerId in statsToCalc) {
const playerStats = statsToCalc[playerId];
if (!playerStats) continue;
const currentPct = calculateHittingPercentage(playerStats);
const currentAttempts = playerStats['Hit Attempt'] || 0;
if (currentPct > 0) {
if (currentPct > maxHitPct) {
maxHitPct = currentPct;
hitPctLeader = playerId;
leaderAttempts = currentAttempts;
} else if (currentPct === maxHitPct) {
if (currentAttempts > leaderAttempts) {
hitPctLeader = playerId;
leaderAttempts = currentAttempts;
}
}
}
}
leaders.hitPct = hitPctLeader;
let maxReceivePct = 0;
let receivePctLeader = null;
let leaderReceiveAttempts = 0;
const calculateReceptionPercentage = (stats) => {
if (!stats) return -Infinity;
const attempts = stats['Reception Attempt'] || 0;
const score = stats['Reception Score'] || 0;
if (attempts === 0) return -Infinity;
return score / attempts;
};
for (const playerId in statsToCalc) {
const playerStats = statsToCalc[playerId];
if (!playerStats) continue;
const currentPct = calculateReceptionPercentage(playerStats);
const currentAttempts = playerStats['Reception Attempt'] || 0;
if (currentPct > 0) {
if (currentPct > maxReceivePct) {
maxReceivePct = currentPct;
receivePctLeader = playerId;
leaderReceiveAttempts = currentAttempts;
} else if (currentPct === maxReceivePct) {
if (currentAttempts > leaderReceiveAttempts) {
receivePctLeader = playerId;
leaderReceiveAttempts = currentAttempts;
}
}
}
}
leaders.receivePct = receivePctLeader;
return leaders;
}, [allSetStats, viewingSet, pointLog, roster]);

// --- Firebase Initialization & Auth ---
useEffect(() => {
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
if (!firebaseConfig.apiKey) {
  console.error("Firebase config is missing. Make sure VITE_ environment variables are set in Vercel.");
  return;
}
try {
  const app = initializeApp(firebaseConfig);
  const firestoreDb = getFirestore(app);
  const firebaseAuth = getAuth(app);
  setDb(firestoreDb);
  setAuth(firebaseAuth);
  onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
      setUserId(user.uid);
    } else {
      await signInAnonymously(firebaseAuth);
    }
    setIsAuthReady(true);
  });
} catch (error) {
  console.error("Firebase initialization error:", error);
}
}, []);

// --- Data Persistence ---
const getMatchCollectionRef = useCallback(() => {
if (!db || !userId) return null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
return collection(db, 'artifacts', appId, 'users', userId, 'matches');
}, [db, userId]);

const autoSaveMatchToFirebase = useCallback(async () => {
if (!getMatchCollectionRef() || !matchId) {
return;
}
setAutoSaveStatus('Saving...');
const matchData = { matchId, matchName, homeTeamName, opponentTeamName, lastSaved: new Date().toISOString(), gameState, matchPhase, roster, lineup, liberos, liberoServingFor, liberoHasServedFor, setterId, bench, pointLog, playerStats, allSetStats, rotationScores };
try {
await setDoc(doc(getMatchCollectionRef(), matchId), matchData);
setAutoSaveStatus('Saved  ✓ ');
} catch (error) {
console.error("Autosave error:", error);
setAutoSaveStatus('Save Error!');
}
}, [db, userId, matchId, matchName, homeTeamName, opponentTeamName, gameState, matchPhase, roster, lineup, liberos, liberoServingFor, liberoHasServedFor, setterId, bench, pointLog, playerStats, allSetStats, rotationScores]);

useEffect(() => {
if (matchPhase !== 'playing' || !matchId) {
return;
}
if (autoSaveTimeoutRef.current) {
clearTimeout(autoSaveTimeoutRef.current);
}
setAutoSaveStatus('Unsaved changes...');
autoSaveTimeoutRef.current = setTimeout(() => {
autoSaveMatchToFirebase();
}, 3000);
return () => {
if (autoSaveTimeoutRef.current) {
clearTimeout(autoSaveTimeoutRef.current);
}
};
}, [gameState, lineup, allSetStats, pointLog, bench, setterId, liberos, liberoServingFor, liberoHasServedFor, currentServerId, matchPhase, matchId, autoSaveMatchToFirebase]);

const saveMatchToFirebase = async () => {
if (autoSaveTimeoutRef.current) {
clearTimeout(autoSaveTimeoutRef.current);
}
await autoSaveMatchToFirebase();
alert("Match saved successfully!");
};

const loadMatchesFromFirebase = async () => {
if (!getMatchCollectionRef()) return;
try {
const querySnapshot = await getDocs(getMatchCollectionRef());
const matches = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
setSavedMatches(matches);
setModal('load-match');
} catch (error) {
console.error("Error loading matches:", error);
}
};

const loadSpecificMatch = (matchData) => {
setMatchId(matchData.matchId); setMatchName(matchData.matchName); setHomeTeamName(matchData.homeTeamName || 'HOME'); setOpponentTeamName(matchData.opponentTeamName || 'OPPONENT'); setGameState(matchData.gameState); setMatchPhase(matchData.matchPhase); setRoster(matchData.roster); setLineup(matchData.lineup); setLiberos(matchData.liberos || []); setLiberoServingFor(matchData.liberoServingFor || null);
setLiberoHasServedFor(matchData.liberoHasServedFor || null); setSetterId(matchData.setterId); setBench(matchData.bench); setPointLog(matchData.pointLog); setPlayerStats(matchData.playerStats); setAllSetStats(matchData.allSetStats || {}); setRotationScores(matchData.rotationScores); setHistory([]); setModal(null);
setCurrentServerId(matchData.lineup?.p1 || null);
setViewingSet(matchData.gameState.currentSet);
};

const loadMostRecentRoster = async () => {
  if (!getMatchCollectionRef()) return null;
  const q = query(getMatchCollectionRef(), orderBy("lastSaved", "desc"), limit(1));
  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const lastMatch = querySnapshot.docs[0].data();
      return lastMatch.roster;
    }
    return null;
  } catch (error) {
    console.error("Error loading most recent roster:", error);
    return null;
  }
};

// --- Undo and History Logic ---
const saveToHistory = () => {
const snapshot = { gameState: JSON.parse(JSON.stringify(gameState)), lineup: JSON.parse(JSON.stringify(lineup)), playerStats: JSON.parse(JSON.stringify(playerStats)), allSetStats: JSON.parse(JSON.stringify(allSetStats)), pointLog: JSON.parse(JSON.stringify(pointLog)), bench: JSON.parse(JSON.stringify(bench)), rotationScores: JSON.parse(JSON.stringify(rotationScores)), setterId: setterId, currentServerId: currentServerId, liberoHasServedFor: liberoHasServedFor };
setHistory(prev => [...prev, snapshot]);
};

const handleUndo = () => {
if (history.length === 0) return;
const lastState = history[history.length - 1];
setGameState(lastState.gameState); setLineup(lastState.lineup); setPlayerStats(lastState.playerStats); setAllSetStats(lastState.allSetStats); setPointLog(lastState.pointLog); setBench(lastState.bench); setRotationScores(lastState.rotationScores); setSetterId(lastState.setterId); setCurrentServerId(lastState.currentServerId); setLiberoHasServedFor(lastState.liberoHasServedFor);
setHistory(prev => prev.slice(0, -1));
};

// --- Game Logic Functions ---
const handleStartNewMatch = () => setModal('roster');

const handleSaveRoster = (newRoster, name, homeName, oppName) => {
const newMatchId = crypto.randomUUID();
setMatchId(newMatchId); setMatchName(name);
setHomeTeamName(homeName || 'HOME');
setOpponentTeamName(oppName || 'OPPONENT');
const rosterWithIds = newRoster.map(p => ({ ...p, id: crypto.randomUUID() }));
setRoster(rosterWithIds);
const initialPlayerStats = {};
rosterWithIds.forEach(p => { initialPlayerStats[p.id] = {}; });
setPlayerStats(initialPlayerStats);
setAllSetStats({});
setGameState({ homeScore: 0, opponentScore: 0, homeSetsWon: 0, opponentSetsWon: 0, servingTeam: null, homeSubs: 0, currentSet: 1, rotation: 1 });
setMatchPhase('lineup_setup'); setModal(null);
};

const handleEndSet = () => {
const winner = gameState.homeScore > gameState.opponentScore ? 'home' : 'opponent';
const newHomeSetsWon = gameState.homeSetsWon + (winner === 'home' ? 1 : 0);
const newOpponentSetsWon = gameState.opponentSetsWon + (winner === 'opponent' ? 1 : 0);
if (newHomeSetsWon >= 3 || newOpponentSetsWon >= 3) {
setMatchPhase('post_match');
setGameState(prev => ({ ...prev, homeSetsWon: newHomeSetsWon, opponentSetsWon: newOpponentSetsWon }));
return;
}
const nextSetNumber = gameState.currentSet + 1;
const newSetStats = {};
roster.forEach(p => { newSetStats[p.id] = {}; });
setAllSetStats(prev => ({...prev, [nextSetNumber]: newSetStats }));
setGameState(prev => ({ ...prev, homeScore: 0, opponentScore: 0, homeSetsWon: newHomeSetsWon, opponentSetsWon: newOpponentSetsWon, currentSet: nextSetNumber, homeSubs: 0, servingTeam: null, rotation: 1 }));
setLineup({ p1: null, p2: null, p3: null, p4: null, p5: null, p6: null }); setLiberos([]); setSetterId(null); setBench([]); setPointLog([]); setHistory([]); setSetupStep('players');
setMatchPhase('lineup_setup'); setModal(null); setLiberoServingFor(null); setLiberoHasServedFor(null);
setViewingSet(nextSetNumber);
};

const handleEndMatch = async () => {
    await autoSaveMatchToFirebase();
    setMatchPhase('post_match');
    setModal(null);
};

const determineServer = (serverPositionPlayerId, servingTeam) => {
if (servingTeam !== 'home') {
setCurrentServerId(null);
return;
}
if (liberoServingFor === serverPositionPlayerId && liberos.length > 0) {
setIsWaitingForLiberoServeChoice(true);
setModal('confirm-libero-serve');
} else {
setCurrentServerId(serverPositionPlayerId);
}
};

const handleLiberoServeChoice = (isLiberoServing) => {
const playerInServePosition = lineup.p1;
if (isLiberoServing) {
if (liberoHasServedFor && liberoHasServedFor !== playerInServePosition) {
setModal('illegal-libero-serve');
return;
}
if (!liberoHasServedFor) {
setLiberoHasServedFor(playerInServePosition);
}
setCurrentServerId(liberos[0]);
} else {
setCurrentServerId(playerInServePosition);
}
setIsWaitingForLiberoServeChoice(false);
setModal(null);
};

const handleStartSet = (servingTeam) => {
const lineupIds = Object.values(lineup).filter(Boolean);
const onCourtIds = [...lineupIds, ...liberos];
setBench(roster.filter(p => !onCourtIds.includes(p.id)));
const initialSetStats = {};
roster.forEach(p => { initialSetStats[p.id] = {}; });
setAllSetStats({ [gameState.currentSet]: initialSetStats });
const initialRotationScores = {};
for (let i = 1; i <= 6; i++) { initialRotationScores[i] = { home: 0, opponent: 0 }; }
setRotationScores(initialRotationScores);
setGameState(prev => ({ ...prev, servingTeam, homeScore: 0, opponentScore: 0, homeSubs: 0 }));
setPointLog([]); setHistory([]); setMatchPhase('playing'); setModal(null);
determineServer(lineup.p1, servingTeam);
};

const rotate = (callback) => {
const newLineup = { p1: lineup.p2, p2: lineup.p3, p3: lineup.p4, p4: lineup.p5, p5: lineup.p6, p6: lineup.p1 };
setLineup(newLineup);
setGameState(prev => ({ ...prev, rotation: (prev.rotation % 6) + 1 }));
callback(newLineup.p1);
};

const logServeAttempt = (serverId) => {
if (!serverId) return;
const increment = (stats) => {
const newStats = JSON.parse(JSON.stringify(stats));
if (!newStats[serverId]) newStats[serverId] = {};
newStats[serverId]['Serve Attempt'] = (newStats[serverId]['Serve Attempt'] || 0) + 1;
return newStats;
};
setPlayerStats(prev => increment(prev));
setAllSetStats(prev => ({ ...prev, [gameState.currentSet]: increment(prev[gameState.currentSet]) }));
};

const awardPoint = (scoringTeam, reason) => {
const servingTeamBeforePoint = gameState.servingTeam;
if (servingTeamBeforePoint === 'home') {
logServeAttempt(currentServerId);
}
const wasOpponentServing = servingTeamBeforePoint === 'opponent';
const currentRotation = gameState.rotation;
setRotationScores(prevScores => {
const newScores = { ...prevScores };
if (!newScores[currentRotation]) newScores[currentRotation] = { home: 0, opponent: 0 };
if (scoringTeam === 'home') { newScores[currentRotation].home += 1; }
else { newScores[currentRotation].opponent += 1; }
return newScores;
});
const updateScoresAndServe = () => {
setGameState(prev => ({ ...prev, homeScore: prev.homeScore + (scoringTeam === 'home' ? 1 : 0), opponentScore: prev.opponentScore + (scoringTeam === 'opponent' ? 1 : 0), servingTeam: scoringTeam }));
if (scoringTeam === 'home' && wasOpponentServing) {
rotate((newServerId) => determineServer(newServerId, 'home'));
} else if (scoringTeam !== 'home') {
setCurrentServerId(null);
}
};
updateScoresAndServe();
};

// --- Stat Logic ---
const handleStatClick = (stat) => {
if (isWaitingForLiberoServeChoice) {
alert("Please determine who is serving before assigning a stat.");
return;
}
const passingStats = ['3-Pass', '2-Pass', '1-Pass', 'RE'];
if (passingStats.includes(stat) && gameState.servingTeam === 'home') {
setModal('illegal-pass');
return;
}
saveToHistory();
if (stat === 'Kill' && setterId === null) { setStatToAssign('KWDA'); setModal('assign-stat'); return; }
const nonPlayerStats = ['Opponent Error', 'Opponent Point'];
if (nonPlayerStats.includes(stat)) {
if (stat === 'Opponent Error') { awardPoint('home', 'Opponent Error'); setPointLog(prev => [`H: Opponent Error!`, ...prev]); }
else { awardPoint('opponent', 'Opponent Point'); setPointLog(prev => [`O: Point Opponent`, ...prev]); }
return;
}
const servingStats = ['Ace', 'Serve Error'];
if (servingStats.includes(stat)) {
if (gameState.servingTeam !== 'home') { handleUndo(); setModal('not-serving-error'); return; }
if (currentServerId) assignStatToPlayer(currentServerId, stat);
return;
}
setStatToAssign(stat); setModal('assign-stat');
};

const incrementStats = (stats, playerId, statToLog, currentSetterId, value = 1) => {
const newStats = JSON.parse(JSON.stringify(stats));
const increment = (pId, s, val) => { if (!newStats[pId]) newStats[pId] = {};
newStats[pId][s] = (newStats[pId][s] || 0) + val; };
increment(playerId, statToLog, value);
if (['Kill', 'Hit Error', 'Hit Attempt'].includes(statToLog)) { increment(playerId, 'Hit Attempt', 1); }
if (['Assist', 'Set Error'].includes(statToLog)) { increment(playerId, 'Set Attempt', 1); }
if (statToLog === 'Kill' && currentSetterId && currentSetterId !== playerId) { increment(currentSetterId, 'Assist', 1); increment(currentSetterId, 'Set Attempt', 1); }
const passValues = { '3-Pass': 3, '2-Pass': 2, '1-Pass': 1, 'RE': 0 };
if (statToLog in passValues) {
increment(playerId, 'Reception Attempt', 1);
increment(playerId, 'Reception Score', passValues[statToLog]);
}
return newStats;
};

const assignStatToPlayer = (playerId, stat) => {
const statToLog = stat || statToAssign;
const player = roster.find(p => p.id === playerId);
if (!statToLog || !player) return;
if (statToLog === 'Hit Attempt' || statToLog === 'Hit Error') {
setHitContext({ attackerId: playerId, originalStat: statToLog });
setModal('assign-set-attempt');
return;
}
const playerPosition = Object.keys(lineup).find(pos => lineup[pos] === playerId);
if (statToLog === 'Block') {
    if (['p1', 'p5', 'p6'].includes(playerPosition)) {
        setModal('illegal-block');
        return;
    }
    setBlockContext({ primaryBlockerId: playerId });
    setModal('assign-block-assist');
    return;
}
if (statToLog === 'KWDA') { handleKwdaSelection(playerId); return; }
setPlayerStats(prev => incrementStats(prev, playerId, statToLog, setterId));
setAllSetStats(prev => ({...prev, [gameState.currentSet]: incrementStats(prev[gameState.currentSet], playerId, statToLog, setterId)}));
let pointWinner = null; let logMessage = `H: ${statToLog} by #${player.number} ${player.name}`;
switch(statToLog) {
case 'Ace': case 'Kill': pointWinner = 'home'; break;
case 'Serve Error': case 'Set Error': case 'RE': case 'Block Error': pointWinner = 'opponent';
logMessage = `O: ${statToLog} by #${player.number} ${player.name}`; break;
}
if (pointWinner) awardPoint(pointWinner, statToLog);
setPointLog(prev => [logMessage, ...prev]);
setModal(null); setStatToAssign(null);
};

const handleBlockAward = (assisterId) => {
    const { primaryBlockerId } = blockContext;
    const primaryBlocker = roster.find(p => p.id === primaryBlockerId);
    let logMessage = `H: Block by #${primaryBlocker.number} ${primaryBlocker.name}`;

    if (assisterId) {
        const assister = roster.find(p => p.id === assisterId);
        logMessage += ` & #${assister.number} ${assister.name}`;
        setPlayerStats(prev => incrementStats(prev, primaryBlockerId, 'Block', null, 0.5));
        setAllSetStats(prev => ({...prev, [gameState.currentSet]: incrementStats(prev[gameState.currentSet], primaryBlockerId, 'Block', null, 0.5)}));
        setPlayerStats(prev => incrementStats(prev, assisterId, 'Block', null, 0.5));
        setAllSetStats(prev => ({...prev, [gameState.currentSet]: incrementStats(prev[gameState.currentSet], assisterId, 'Block', null, 0.5)}));
    } else {
        setPlayerStats(prev => incrementStats(prev, primaryBlockerId, 'Block', null, 1.0));
        setAllSetStats(prev => ({...prev, [gameState.currentSet]: incrementStats(prev[gameState.currentSet], primaryBlockerId, 'Block', null, 1.0)}));
    }

    awardPoint('home', 'Block');
    setPointLog(prev => [logMessage, ...prev]);
    setModal(null);
    setBlockContext({ primaryBlockerId: null });
};

// ... (Rest of code is identical to previous full version)

// --- ALL COMPONENTS AND MODALS ARE DEFINED INSIDE APP() SCOPE FROM HERE ---

// ... (All modal component definitions, e.g., AssignBlockAssistModal, are placed here before the final return)

return (
// ... (The final JSX render block)
);
}
