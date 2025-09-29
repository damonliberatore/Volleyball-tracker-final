// App.js - Batch 1 of 2 (Definitive Fix)
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

const calculateSeasonStats = async () => {
    if (!getMatchCollectionRef()) return;
    try {
        const querySnapshot = await getDocs(getMatchCollectionRef());
        const allMatches = querySnapshot.docs.map(doc => doc.data());
        const compiledData = {};

        allMatches.forEach(match => {
            if (!match.roster || !match.playerStats) return;

            match.roster.forEach(player => {
                const key = player.number;
                if (!compiledData[key]) {
                    compiledData[key] = {
                        name: player.name,
                        number: player.number,
                        stats: {}
                    };
                }

                const matchPlayerStats = match.playerStats[player.id];
                if (matchPlayerStats) {
                    for (const stat in matchPlayerStats) {
                        compiledData[key].stats[stat] = (compiledData[key].stats[stat] || 0) + matchPlayerStats[stat];
                    }
                }
            });
        });
        
        setSeasonStats(compiledData);

    } catch (error) {
        console.error("Error calculating season stats:", error);
    }
};

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

const promptDeleteMatch = (matchId) => {
    setItemToDelete({id: matchId, type: 'match'});
    setModal('confirm-delete');
};

const handleDeleteMatch = async () => {
    if (!itemToDelete || itemToDelete.type !== 'match') return;
    try {
        await deleteDoc(doc(getMatchCollectionRef(), itemToDelete.id));
        setSavedMatches(prev => prev.filter(match => match.id !== itemToDelete.id));
        setItemToDelete(null);
        setModal(null);
    } catch (error) {
        console.error("Error deleting match:", error);
        alert("Could not delete match.");
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
    setAllSetStats(prev => ({ ...prev, [gameState.currentSet]: initialSetStats }));
    const initialRotationScores = {};
    for (let i = 1; i <= 6; i++) { initialRotationScores[i] = { home: 0, opponent: 0 }; }
    setRotationScores(initialRotationScores);
    setGameState(prev => ({ ...prev, servingTeam, homeScore: 0, opponentScore: 0, homeSubs: 0 }));
    setPointLog([]);
    setHistory([]);
    setMatchPhase('playing');
    setModal(null);
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

const handleKwdaSelection = (attackerId) => {
const player = roster.find(p => p.id === attackerId); if (!player) return;
const updateKwdaStats = (stats) => { const newStats = JSON.parse(JSON.stringify(stats));
const increment = (pId, s) => { if (!newStats[pId]) newStats[pId] = {}; newStats[pId][s] = (newStats[pId][s] || 0) + 1; };
increment(attackerId, 'Kill'); increment(attackerId, 'Hit Attempt'); return newStats; };
setPlayerStats(prev => updateKwdaStats(prev));
setAllSetStats(prev => ({...prev, [gameState.currentSet]: updateKwdaStats(prev[gameState.currentSet])}));
awardPoint('home', 'KWDA'); setPointLog(prev => [`H: Kill by #${player.number} ${player.name}`, ...prev]);
setKwdaAttackerId(attackerId);
setModal('assign-kwda-assist');
};

const assignKwdaAssist = (assistPlayerId) => {
if (!assistPlayerId) {
setModal(null); setStatToAssign(null); setKwdaAttackerId(null);
return;
}
const player = roster.find(p => p.id === assistPlayerId); if (!player) return;
const updateAssistStats = (stats) => { const newStats = JSON.parse(JSON.stringify(stats));
const increment = (pId, s) => { if (!newStats[pId]) newStats[pId] = {}; newStats[pId][s] = (newStats[pId][s] || 0) + 1; };
increment(assistPlayerId, 'Assist'); increment(assistPlayerId, 'Set Attempt'); return newStats; };
setPlayerStats(prev => updateAssistStats(prev));
setAllSetStats(prev => ({...prev, [gameState.currentSet]: updateAssistStats(prev[gameState.currentSet])}));
setPointLog(prev => [`H: Assist by #${player.number} ${player.name}`, ...prev]); setModal(null); setStatToAssign(null); setKwdaAttackerId(null);
};

const assignSetAttempt = (setterId) => {
const { attackerId, originalStat } = hitContext;
const attacker = roster.find(p => p.id === attackerId);
if (!attacker) return;
const updateStats = (stats) => {
let newStats = JSON.parse(JSON.stringify(stats));
const increment = (pId, s) => { if (!newStats[pId]) { newStats[pId] = {};
} newStats[pId][s] = (newStats[pId][s] || 0) + 1; };
increment(attackerId, originalStat);
increment(attackerId, 'Hit Attempt');
if (setterId) {
increment(setterId, 'Set Attempt');
}
return newStats;
};
setPlayerStats(prev => updateStats(prev));
setAllSetStats(prev => ({...prev, [gameState.currentSet]: updateStats(prev[gameState.currentSet])}));
let logMessage = originalStat === 'Hit Error' ? `O: Hit Error by #${attacker.number} ${attacker.name}` : `H: Hit Attempt by #${attacker.number} ${attacker.name}`;
if (setterId) {
const setter = roster.find(p => p.id === setterId);
if(setter) {
setPointLog(prev => [logMessage, `H: Set by #${setter.number} ${setter.name}`, ...prev]);
}
} else {
setPointLog(prev => [logMessage, ...prev]);
}
if (originalStat === 'Hit Error') {
awardPoint('opponent', 'Hit Error');
}
setModal(null);
setStatToAssign(null);
setHitContext({ attackerId: null, originalStat: null });
};

// --- Sub Logic ---
const handleSubClick = (position, playerOutId) => {
if (!playerOutId) return;
setSubTarget({ position, playerOutId });
setModal('substitute');
};

const executeSubstitution = (playerInId) => {
  saveToHistory();
  const { position, playerOutId } = subTarget;
  setLineup(prev => ({ ...prev, [position]: playerInId }));
  setBench(prev => [...prev.filter(p => p.id !== playerInId), roster.find(p => p.id === playerOutId)]);
  setGameState(prev => ({ ...prev, homeSubs: prev.homeSubs + 1 }));
  setModal(null);
};

// --- Lineup Setup Logic ---
const handleCourtClickForLineup = (position) => {
if (setupStep === 'players') {
if (!lineup[position]) { setSubTarget({ position, playerOutId: null }); setModal('lineup-player-select'); }
else { const lineupIsFullBeforeRemoval = Object.values(lineup).every(p => p !== null); if (lineupIsFullBeforeRemoval) { setSetupStep('players');
} setLineup(prev => ({ ...prev, [position]: null })); }
} else if (setupStep === 'setter') {
const playerId = lineup[position]; if (playerId) { setSetterId(playerId); setModal('select-server'); }
}
};

const handlePlayerSelectForLineup = (playerId) => {
const { position } = subTarget; const newLineup = {...lineup, [position]: playerId}; setLineup(newLineup);
const lineupIsFull = Object.values(newLineup).every(p => p !== null); if (lineupIsFull) { setSetupStep('libero'); }
setModal(null);
};

const handleSetLiberoServe = (playerId) => {
  setLiberoServingFor(playerId);
  setModal(null);
};
    // App.js - Final and Complete Version
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

const calculateSeasonStats = async () => {
    if (!getMatchCollectionRef()) return;
    try {
        const querySnapshot = await getDocs(getMatchCollectionRef());
        const allMatches = querySnapshot.docs.map(doc => doc.data());
        const compiledData = {};

        allMatches.forEach(match => {
            if (!match.roster || !match.playerStats) return;

            match.roster.forEach(player => {
                const key = player.number;
                if (!compiledData[key]) {
                    compiledData[key] = {
                        name: player.name,
                        number: player.number,
                        stats: {}
                    };
                }

                const matchPlayerStats = match.playerStats[player.id];
                if (matchPlayerStats) {
                    for (const stat in matchPlayerStats) {
                        compiledData[key].stats[stat] = (compiledData[key].stats[stat] || 0) + matchPlayerStats[stat];
                    }
                }
            });
        });
        
        setSeasonStats(compiledData);

    } catch (error) {
        console.error("Error calculating season stats:", error);
    }
};

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

const promptDeleteMatch = (matchId) => {
    setItemToDelete({id: matchId, type: 'match'});
    setModal('confirm-delete-match');
};

const handleDeleteMatch = async () => {
    if (!itemToDelete || itemToDelete.type !== 'match') return;
    try {
        await deleteDoc(doc(getMatchCollectionRef(), itemToDelete.id));
        setSavedMatches(prev => prev.filter(match => match.id !== itemToDelete.id));
        setItemToDelete(null);
        setModal(null);
    } catch (error) {
        console.error("Error deleting match:", error);
        alert("Could not delete match.");
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
    setAllSetStats(prev => ({ ...prev, [gameState.currentSet]: initialSetStats }));
    const initialRotationScores = {};
    for (let i = 1; i <= 6; i++) { initialRotationScores[i] = { home: 0, opponent: 0 }; }
    setRotationScores(initialRotationScores);
    setGameState(prev => ({ ...prev, servingTeam, homeScore: 0, opponentScore: 0, homeSubs: 0 }));
    setPointLog([]);
    setHistory([]);
    setMatchPhase('playing');
    setModal(null);
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

const handleKwdaSelection = (attackerId) => {
const player = roster.find(p => p.id === attackerId); if (!player) return;
const updateKwdaStats = (stats) => { const newStats = JSON.parse(JSON.stringify(stats));
const increment = (pId, s) => { if (!newStats[pId]) newStats[pId] = {}; newStats[pId][s] = (newStats[pId][s] || 0) + 1; };
increment(attackerId, 'Kill'); increment(attackerId, 'Hit Attempt'); return newStats; };
setPlayerStats(prev => updateKwdaStats(prev));
setAllSetStats(prev => ({...prev, [gameState.currentSet]: updateKwdaStats(prev[gameState.currentSet])}));
awardPoint('home', 'KWDA'); setPointLog(prev => [`H: Kill by #${player.number} ${player.name}`, ...prev]);
setKwdaAttackerId(attackerId);
setModal('assign-kwda-assist');
};

const assignKwdaAssist = (assistPlayerId) => {
if (!assistPlayerId) {
setModal(null); setStatToAssign(null); setKwdaAttackerId(null);
return;
}
const player = roster.find(p => p.id === assistPlayerId); if (!player) return;
const updateAssistStats = (stats) => { const newStats = JSON.parse(JSON.stringify(stats));
const increment = (pId, s) => { if (!newStats[pId]) newStats[pId] = {}; newStats[pId][s] = (newStats[pId][s] || 0) + 1; };
increment(assistPlayerId, 'Assist'); increment(assistPlayerId, 'Set Attempt'); return newStats; };
setPlayerStats(prev => updateAssistStats(prev));
setAllSetStats(prev => ({...prev, [gameState.currentSet]: updateAssistStats(prev[gameState.currentSet])}));
setPointLog(prev => [`H: Assist by #${player.number} ${player.name}`, ...prev]); setModal(null); setStatToAssign(null); setKwdaAttackerId(null);
};

const assignSetAttempt = (setterId) => {
const { attackerId, originalStat } = hitContext;
const attacker = roster.find(p => p.id === attackerId);
if (!attacker) return;
const updateStats = (stats) => {
let newStats = JSON.parse(JSON.stringify(stats));
const increment = (pId, s) => { if (!newStats[pId]) { newStats[pId] = {};
} newStats[pId][s] = (newStats[pId][s] || 0) + 1; };
increment(attackerId, originalStat);
increment(attackerId, 'Hit Attempt');
if (setterId) {
increment(setterId, 'Set Attempt');
}
return newStats;
};
setPlayerStats(prev => updateStats(prev));
setAllSetStats(prev => ({...prev, [gameState.currentSet]: updateStats(prev[gameState.currentSet])}));
let logMessage = originalStat === 'Hit Error' ? `O: Hit Error by #${attacker.number} ${attacker.name}` : `H: Hit Attempt by #${attacker.number} ${attacker.name}`;
if (setterId) {
const setter = roster.find(p => p.id === setterId);
if(setter) {
setPointLog(prev => [logMessage, `H: Set by #${setter.number} ${setter.name}`, ...prev]);
}
} else {
setPointLog(prev => [logMessage, ...prev]);
}
if (originalStat === 'Hit Error') {
awardPoint('opponent', 'Hit Error');
}
setModal(null);
setStatToAssign(null);
setHitContext({ attackerId: null, originalStat: null });
};

// --- Sub Logic ---
const handleSubClick = (position, playerOutId) => {
if (!playerOutId) return;
setSubTarget({ position, playerOutId });
setModal('substitute');
};

const executeSubstitution = (playerInId) => {
  saveToHistory();
  const { position, playerOutId } = subTarget;
  setLineup(prev => ({ ...prev, [position]: playerInId }));
  setBench(prev => [...prev.filter(p => p.id !== playerInId), roster.find(p => p.id === playerOutId)]);
  setGameState(prev => ({ ...prev, homeSubs: prev.homeSubs + 1 }));
  setModal(null);
};

// --- Lineup Setup Logic ---
const handleCourtClickForLineup = (position) => {
if (setupStep === 'players') {
if (!lineup[position]) { setSubTarget({ position, playerOutId: null }); setModal('lineup-player-select'); }
else { const lineupIsFullBeforeRemoval = Object.values(lineup).every(p => p !== null); if (lineupIsFullBeforeRemoval) { setSetupStep('players');
} setLineup(prev => ({ ...prev, [position]: null })); }
} else if (setupStep === 'setter') {
const playerId = lineup[position]; if (playerId) { setSetterId(playerId); setModal('select-server'); }
}
};

const handlePlayerSelectForLineup = (playerId) => {
const { position } = subTarget; const newLineup = {...lineup, [position]: playerId}; setLineup(newLineup);
const lineupIsFull = Object.values(newLineup).every(p => p !== null); if (lineupIsFull) { setSetupStep('libero'); }
setModal(null);
};

const handleSetLiberoServe = (playerId) => {
  setLiberoServingFor(playerId);
  setModal(null);
};
// App.js - Batch 4 of 4

const LineupSetup = () => {
    const [tempLiberos, setTempLiberos] = useState(new Set());
    const lineupPlayerIds = Object.values(lineup).filter(Boolean);
    const availableForLibero = roster.filter(p => !lineupPlayerIds.includes(p.id));
    const setupInstructions = { players: `Set ${gameState.currentSet}: Click a court position to set your lineup. Click a player to remove them.`, libero: `Set ${gameState.currentSet}: Select up to two Liberos from the available players.`, libero_serve: `Set ${gameState.currentSet}: Who will the Libero serve for? (Optional)`, setter: `Set ${gameState.currentSet}: Click a player on the court to designate them as the Setter.` };
    const handleToggleLibero = (playerId) => { const newSelection = new Set(tempLiberos); if (newSelection.has(playerId)) { newSelection.delete(playerId);
    } else { if (newSelection.size < 2) { newSelection.add(playerId); } } setTempLiberos(newSelection); };
    const confirmLiberos = () => { setLiberos(Array.from(tempLiberos)); if (Array.from(tempLiberos).length > 0) { setSetupStep('libero_serve'); } else { setSetupStep('setter'); } };
    return (
    <div>
    <div className="p-4 text-center bg-gray-800 rounded-lg mb-4"><h2 className="text-xl font-bold text-cyan-400">{setupInstructions[setupStep]}</h2></div>
    <h2 className="text-xl font-bold text-center mb-2 text-cyan-400">Set Initial Lineup</h2>
    <div className="grid grid-cols-3 gap-2 mb-2">{renderCourt(true)}</div>
    {setupStep === 'setter' && ( <div className="text-center mt-4"> <button onClick={() => { setSetterId(null); setModal('select-server'); }} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg" > Continue Without a Designated Setter </button> </div> )}
    {setupStep === 'libero_serve' && (
    <>
    <h2 className="text-xl font-bold text-center mb-2 text-cyan-400">Select Player for Libero to Serve For</h2>
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
    {lineupPlayerIds.map(pId => roster.find(p => p.id === pId)).map(p => (
    <PlayerCard key={p.id} player={p} onClick={() => { setLiberoServingFor(p.id); setSetupStep('setter'); }} />
    ))}
    </div>
    <div className="text-center mt-4">
    <button onClick={() => { setLiberoServingFor(null); setSetupStep('setter'); }} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg"> Libero Will Not Serve </button>
    </div>
    </>
    )}
    {setupStep === 'libero' && (
    <>
    <h2 className="text-xl font-bold text-center mb-2 text-cyan-400">Available Players for Libero</h2>
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
    {availableForLibero.map(p => ( <PlayerCard key={p.id} player={p} onClick={() => handleToggleLibero(p.id)} isSelected={tempLiberos.has(p.id)} /> ))}
    </div>
    <div className="text-center mt-4"> <button onClick={confirmLiberos} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded-lg"> Confirm Liberos & Continue </button> </div>
    </>
    )}
    </div>
    );
};

const RosterModal = () => {
    const [localRoster, setLocalRoster] = useState([{ number: '', name: '' }]);
    const [localMatchName, setLocalMatchName] = useState('');
    const [localHomeTeam, setLocalHomeTeam] = useState('');
    const [localOpponentTeam, setLocalOpponentTeam] = useState('');
    const addPlayer = () => setLocalRoster([...localRoster, { number: '', name: '' }]);
    const updatePlayer = (index, field, value) => {
        if (field === 'number' && value && parseInt(value, 10) < 0) return;
        const newRoster = [...localRoster];
        newRoster[index][field] = value;
        setLocalRoster(newRoster);
    };
    const handleLoadRoster = async () => {
        const roster = await loadMostRecentRoster();
        if (roster && roster.length > 0) {
        const rosterToLoad = roster.map(({ name, number }) => ({ name, number }));
        setLocalRoster(rosterToLoad);
        } else {
        alert("No previous roster found.");
        }
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        const filtered = localRoster.filter(p => p.number && p.name);
        if (filtered.length < 6) {
        alert("Please enter at least 6 players.");
        return;
        }
        handleSaveRoster(filtered, localMatchName, localHomeTeam, localOpponentTeam);
    };
    return (
        <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4 mb-4">
            <input type="text" placeholder="Home Team Name" value={localHomeTeam} onChange={(e) => setLocalHomeTeam(e.target.value)} className="bg-gray-700 p-2 rounded w-full" required />
            <input type="text" placeholder="Opponent Team Name" value={localOpponentTeam} onChange={(e) => setLocalOpponentTeam(e.target.value)} className="bg-gray-700 p-2 rounded w-full" required />
        </div>
        <input type="text" placeholder="Match Name (e.g., vs. Rival High)" value={localMatchName} onChange={(e) => setLocalMatchName(e.target.value)} className="bg-gray-700 p-2 rounded w-full mb-4" />
        <button type="button" onClick={handleLoadRoster} className="mb-4 w-full bg-blue-600 hover:bg-blue-500 p-2 rounded">Load Previous Roster</button>
        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {localRoster.map((p, i) => (
            <div key={i} className="flex items-center space-x-2">
                <input type="number" placeholder="#" value={p.number} min="0" onChange={(e) => updatePlayer(i, 'number', e.target.value)} className="bg-gray-700 p-2 rounded w-20 text-center" required />
                <input type="text" placeholder="Player Name" value={p.name} onChange={(e) => updatePlayer(i, 'name', e.target.value)} className="bg-gray-700 p-2 rounded w-full" required />
            </div>
            ))}
        </div>
        <button type="button" onClick={addPlayer} className="mt-4 w-full bg-gray-600 hover:bg-gray-500 p-2 rounded">Add Player</button>
        <button type="submit" className="mt-2 w-full bg-cyan-600 hover:bg-cyan-500 p-2 rounded font-bold">Save & Start Match</button>
        </form>
    );
};

const LoadMatchModal = () => (
    <div>
        {savedMatches.length === 0 ? <p>No saved matches found.</p> : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
                {savedMatches.sort((a, b) => new Date(b.lastSaved) - new Date(a.lastSaved)).map(match => (
                    <div key={match.id} className="flex items-center space-x-2">
                        <button onClick={() => loadSpecificMatch(match)} className="flex-grow text-left bg-gray-700 hover:bg-gray-600 p-3 rounded">
                            <span className="font-bold">{match.homeTeamName} vs {match.opponentTeamName}</span>
                            <span className="text-sm text-gray-400 block">{match.matchName || 'Untitled Match'}</span>
                            <span className="text-sm text-gray-400 block">Last saved: {new Date(match.lastSaved).toLocaleString()}</span>
                        </button>
                        <button onClick={() => promptDeleteMatch(match.id)} className="p-3 bg-red-800 hover:bg-red-700 rounded h-full">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.023 2.5.067V3.75a1.25 1.25 0 10-2.5 0V4z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const LineupPlayerSelectModal = () => { const lineupPlayerIds = Object.values(lineup).filter(Boolean); const availablePlayers = roster.filter(p => !lineupPlayerIds.includes(p.id));
    return (<div><p className="mb-4">Select a player for position <span className="font-bold text-cyan-400">{subTarget.position?.toUpperCase()}</span></p><div className="space-y-2 max-h-80 overflow-y-auto">{availablePlayers.map(player => (<button key={player.id} onClick={() => handlePlayerSelectForLineup(player.id)} className="w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded">#{player.number} {player.name}</button>))}</div></div>);
};

const SelectServerModal = () => (<div><p className="mb-4 font-bold">Who is serving first?</p><div className="flex justify-around"><button onClick={() => handleStartSet('home')} className="bg-cyan-600 hover:bg-cyan-500 p-3 rounded-lg w-32 font-bold">Home</button><button onClick={() => handleStartSet('opponent')} className="bg-red-600 hover:bg-red-500 p-3 rounded-lg w-32 font-bold">Opponent</button></div></div>);

const SubstituteModal = () => (<div><p className="mb-4">Select a player from the bench to substitute in.</p><div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">{bench.map(player => (<button key={player.id} onClick={() => executeSubstitution(player.id)} className="w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded">#{player.number} {player.name}</button>))}</div></div>);

const AssignStatModal = () => {
    const courtOrder = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const sortedOnCourtPlayers = courtOrder
        .map(pos => lineup[pos])
        .filter(Boolean)
        .map(playerId => roster.find(p => p.id === playerId));
    
    const liberoPlayers = liberos
        .map(liberoId => roster.find(p => p.id === liberoId))
        .filter(Boolean);

    const onCourtPlayers = [...sortedOnCourtPlayers, ...liberoPlayers];

    return (
        <div>
            <p className="mb-4">Assign <span className="font-bold text-cyan-400">{statToAssign}</span> to:</p>
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                {onCourtPlayers.map(player => (
                    <button 
                        key={player.id} 
                        onClick={() => assignStatToPlayer(player.id)} 
                        className="w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded"
                    >
                        #{player.number} {player.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

const AssignKwdaAssistModal = () => { const onCourtIds = [...Object.values(lineup), ...liberos].filter(Boolean);
    const onCourtPlayers = roster.filter(p => onCourtIds.includes(p.id) && p.id !== kwdaAttackerId);
    return (<div><p className="mb-4">Assign <span className="font-bold text-cyan-400">Assist</span> for Kill to:</p><div className="space-y-2 max-h-80 overflow-y-auto">{onCourtPlayers.map(player => (<button key={player.id} onClick={() => assignKwdaAssist(player.id)} className="relative w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded">#{player.number} {player.name} {player.id === setterId && <SetterIcon />}</button>))} <button onClick={() => assignKwdaAssist(null)} className="mt-2 w-full text-center bg-gray-600 hover:bg-gray-500 p-2 rounded">No Assist</button> </div></div>);
};

const SelectNewSetterModal = () => { const onCourtIds = [...Object.values(lineup), ...liberos].filter(Boolean);
    const onCourtPlayers = roster.filter(p => onCourtIds.includes(p.id) && p.id !== setterId); const handleSelect = (playerId) => { saveToHistory(); setSetterId(playerId); setModal(null); };
    return ( <div> <p className="mb-4">Select the new designated setter from the players on the court.</p> <div className="space-y-2 max-h-80 overflow-y-auto"> {onCourtPlayers.map(player => ( <button key={player.id} onClick={() => handleSelect(player.id)} className="w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded"> #{player.number} {player.name} </button> ))} </div> </div> );
};

const AssignSetAttemptModal = () => { const onCourtIds = [...Object.values(lineup), ...liberos].filter(Boolean);
    const onCourtPlayers = roster.filter(p => onCourtIds.includes(p.id) && p.id !== hitContext.attackerId);
    return ( <div> <p className="mb-4">Assign <span className="font-bold text-cyan-400">Set Attempt</span> for {hitContext.originalStat} to:</p> <div className="space-y-2 max-h-80 overflow-y-auto"> {onCourtPlayers.map(player => ( <button key={player.id} onClick={() => assignSetAttempt(player.id)} className="relative w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded"> #{player.number} {player.name} {player.id === setterId && <SetterIcon />} </button> ))} <button onClick={() => assignSetAttempt(null)} className="mt-2 w-full text-center bg-gray-600 hover:bg-gray-500 p-2 rounded">No Set</button> </div> </div> );
};

const SetLiberoServeModal = () => {
    const onCourtPlayers = Object.values(lineup).filter(Boolean).map(pId => roster.find(p => p.id === pId));
    return (
        <div>
        <p className="mb-4">Select the player who the libero will serve for in the rotation.</p>
        <div className="space-y-2 max-h-80 overflow-y-auto">
            {onCourtPlayers.map(player => (
            <button key={player.id} onClick={() => handleSetLiberoServe(player.id)} className="w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded">
                #{player.number} {player.name}
            </button>
            ))}
            <button onClick={() => handleSetLiberoServe(null)} className="mt-2 w-full text-center bg-gray-600 hover:bg-gray-500 p-2 rounded">None / Clear</button>
        </div>
        </div>
    );
};

const AssignBlockAssistModal = () => {
    const { primaryBlockerId } = blockContext;
    const frontRowPositions = ['p2', 'p3', 'p4'];
    const potentialAssisters = frontRowPositions
        .map(pos => lineup[pos])
        .filter(playerId => playerId && playerId !== primaryBlockerId)
        .map(playerId => roster.find(p => p.id === playerId));

    return (
        <div>
            <p className="mb-4">Did another player assist with the block?</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
                <button onClick={() => handleBlockAward(null)} className="w-full text-left bg-cyan-600 hover:bg-cyan-500 p-3 rounded font-bold">
                    Solo Block
                </button>
                {potentialAssisters.map(player => (
                    <button key={player.id} onClick={() => handleBlockAward(player.id)} className="w-full text-left bg-gray-700 hover:bg-gray-600 p-3 rounded">
                        #{player.number} {player.name}
                    </button>
                ))}
            </div>
        </div>
    );
};


// --- Main Render ---
return (
<div className="bg-gray-900 min-h-screen text-white font-sans p-4">
<div className="container mx-auto max-w-6xl">
{matchPhase === 'pre_match' && ( <div className="flex flex-col items-center justify-center h-screen"> <h1 className="text-4xl font-bold mb-4 text-cyan-400">Volleyball Stat Tracker</h1> <div className="space-y-4"> <button onClick={handleStartNewMatch} className="w-64 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg text-xl">Start New Match</button> <button onClick={loadMatchesFromFirebase} disabled={!isAuthReady} className="w-64 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg text-xl disabled:bg-gray-700 disabled:cursor-not-allowed">Load Match</button> </div> </div> )}
{matchPhase === 'post_match' && ( <div className="text-center p-8"> <h1 className="text-4xl font-bold text-cyan-400 mb-4">Match Over</h1> <Scoreboard earnedPoints={earnedPoints} /> <TabbedDisplay /> <button onClick={() => setMatchPhase('pre_match')} className="mt-8 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg text-xl">Return to Main Menu</button> </div> )}
{matchPhase === 'lineup_setup' && <LineupSetup />}
{matchPhase === 'playing' && (
<>
<Scoreboard earnedPoints={earnedPoints} />
<div className="flex justify-end items-center space-x-2 mb-1 flex-wrap">
<span className="text-xs text-gray-400 italic">{autoSaveStatus}</span>
<button onClick={() => setModal('set-libero-serve')} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-lg">Set Libero Serve</button>
<button onClick={() => setModal('change-setter-confirm')} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg">Change Setter</button>
<button onClick={() => setModal('end-set-confirm')} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">End Set</button>
<button onClick={() => setModal('confirm-end-match')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">End Match</button>
</div>
<h2 className="text-lg font-bold text-center mb-1 text-cyan-400">Net</h2>
<div
  className="p-2 rounded-lg mb-2"
  style={{
    backgroundImage: "url('https://www.transparenttextures.com/patterns/wood-grain.png')",
    backgroundColor: '#8c5a2b'
  }}
>
  <div className="grid grid-cols-3 gap-2">{renderCourt(false)}</div>
</div>
<StatPanel handleUndo={handleUndo} history={history} />
<IconLegend />
<div className="mt-4 bg-gray-800 p-2 rounded-lg">
<h2 className="text-lg font-bold text-center md:text-left mb-2 text-cyan-400">Bench</h2>
<div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2"> {bench.map(p => ( <div key={p.id} className="bg-gray-900 p-1 rounded text-center text-xs h-16 flex flex-col justify-center"> <div>#{p.number}</div> <div className="truncate">{p.name}</div> </div> ))} </div>
</div>
<TabbedDisplay />
</>
)}
<Modal title="Enter Roster & Match Info" isOpen={modal === 'roster'} onClose={() => setModal(null)}><RosterModal /></Modal>
<Modal title="Load Match" isOpen={modal === 'load-match'} onClose={() => setModal(null)}><LoadMatchModal /></Modal>
<Modal title="Select Player" isOpen={modal === 'lineup-player-select'} onClose={() => setModal(null)}><LineupPlayerSelectModal /></Modal>
<Modal title="Select First Server" isOpen={modal === 'select-server'} onClose={() => setModal(null)}><SelectServerModal /></Modal>
<Modal title="Substitute Player" isOpen={modal === 'substitute'} onClose={() => setModal(null)}><SubstituteModal /></Modal>
<Modal title="Assign Stat" isOpen={modal === 'assign-stat'} onClose={() => setModal(null)}><AssignStatModal /></Modal>
<Modal title="Assign Assist for Kill" isOpen={modal === 'assign-kwda-assist'} onClose={() => setModal(null)}><AssignKwdaAssistModal /></Modal>
<Modal title="Assign Set Attempt" isOpen={modal === 'assign-set-attempt'} onClose={() => setModal(null)}><AssignSetAttemptModal /></Modal>
<Modal title="Select New Setter" isOpen={modal === 'select-new-setter'} onClose={() => setModal(null)}><SelectNewSetterModal /></Modal>
<Modal title="Set Libero to Serve For" isOpen={modal === 'set-libero-serve'} onClose={() => setModal(null)}><SetLiberoServeModal /></Modal>
<Modal title="Assign Block Assist" isOpen={modal === 'assign-block-assist'} onClose={() => setModal(null)}><AssignBlockAssistModal /></Modal>
<Modal title="Is the Libero Serving?" isOpen={modal === 'confirm-libero-serve'} onClose={() => {}}>
<p className="mb-4">The designated player is in the serving position. Should the libero serve for them?</p>
<div className="flex justify-around"> <button onClick={() => handleLiberoServeChoice(true)} className="bg-green-600 hover:bg-green-500 p-3 rounded-lg w-32 font-bold">Yes</button> <button onClick={() => handleLiberoServeChoice(false)} className="bg-red-600 hover:bg-red-500 p-3 rounded-lg w-32 font-bold">No</button> </div>
</Modal>
<Modal title="Error" isOpen={modal === 'not-serving-error'} onClose={() => setModal(null)}> <p>Cannot assign a serving stat when your team is not serving.</p> </Modal>
<Modal title="Error" isOpen={modal === 'illegal-pass'} onClose={() => setModal(null)}> <p>Cannot assign a passing stat when your team is serving.</p> </Modal>
<Modal title="Illegal Action" isOpen={modal === 'illegal-block'} onClose={() => setModal(null)}> <p>Back row players can't get a block stat - this is Illegal.</p> </Modal>
<Modal title="Illegal Libero Serve" isOpen={modal === 'illegal-libero-serve'} onClose={() => setModal(null)}> <p>This is an illegal serve. The libero has already served for a different player in this set.</p> </Modal>
<Modal title="Confirm End Set" isOpen={modal === 'end-set-confirm'} onClose={() => setModal(null)}> <p className="mb-4">Are you sure you want to end the current set? The scores will be recorded and you will proceed to the next set's lineup.</p> <div className="flex justify-end space-x-4"> <button onClick={() => setModal(null)} className="bg-gray-600 hover:bg-gray-500 p-2 px-4 rounded">Cancel</button> <button onClick={handleEndSet} className="bg-red-600 hover:bg-red-500 p-2 px-4 rounded">End Set</button> </div> </Modal>
<Modal title="Confirm Setter Change" isOpen={modal === 'change-setter-confirm'} onClose={() => setModal(null)}> <p className="mb-4">Are you sure you want to change the designated setter mid-set? This action can be undone.</p> <div className="flex justify-end space-x-4"> <button onClick={() => setModal(null)} className="bg-gray-600 hover:bg-gray-500 p-2 px-4 rounded">Cancel</button> <button onClick={() => setModal('select-new-setter')} className="bg-yellow-600 hover:bg-yellow-500 p-2 px-4 rounded">Change Setter</button> </div> </Modal>
<Modal title="Confirm End Match" isOpen={modal === 'confirm-end-match'} onClose={() => setModal(null)}>
    <p className="mb-4">Are you sure you want to end the match now? The current stats will be saved.</p>
    <div className="flex justify-end space-x-4">
        <button onClick={() => setModal(null)} className="bg-gray-600 hover:bg-gray-500 p-2 px-4 rounded">Cancel</button>
        <button onClick={handleEndMatch} className="bg-red-600 hover:bg-red-500 p-2 px-4 rounded">End Match</button>
    </div>
</Modal>
<Modal title="Confirm Deletion" isOpen={modal === 'confirm-delete-match'} onClose={() => setModal(null)}>
    <p className="mb-4">Are you sure you want to permanently delete this match and all of its stats?</p>
    <div className="flex justify-end space-x-4">
        <button onClick={() => setModal(null)} className="bg-gray-600 hover:bg-gray-500 p-2 px-4 rounded">Cancel</button>
        <button onClick={handleDeleteMatch} className="bg-red-600 hover:bg-red-500 p-2 px-4 rounded">Delete Match</button>
    </div>
</Modal>
</div>
</div>
);
}