// App.js - Final Version with Advanced Stat Features (Corrected)
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- Helper Components ---
const SetterIcon = () => (
<span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center z-10">S</span>
);

// --- Stat Leader Icons ---
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

const PlayerCard = ({ player, isSetter, onClick, isTarget, isSelected, statLeaders = {}, playerSetStats }) => {
let nameColorClass = 'text-white';
if (player && playerSetStats) {
const vbrt = parseFloat(calculateVbrt(playerSetStats));
if (vbrt >= 2.0) {
nameColorClass = 'text-green-400';
} else if (vbrt < -2.0) {
nameColorClass = 'text-red-400';
} else if (vbrt < -1.0) {
nameColorClass = 'text-yellow-400';
}
}
return (
<div
onClick={onClick}
className={`relative bg-gray-700 text-white p-2 rounded-lg shadow-md text-center cursor-pointer hover:bg-gray-600 transition-colors duration-200 h-20 flex flex-col justify-center ${isTarget ?
'ring-2 ring-cyan-400' : ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
>
{player ? (
<>
{statLeaders.dig === player.id && <DigLeaderIcon />}
{isSetter && <SetterIcon />}
{statLeaders.re === player.id && <RELeaderIcon />}
{statLeaders.hitPct === player.id && <HittingPercentageLeaderIcon />}
{statLeaders.receivePct === player.id && <ReceivingLeaderIcon />}
<span className={`text-4xl font-bold ${nameColorClass}`}>#{player.number}</span>
<span className={`text-lg truncate font-bold ${nameColorClass}`}>{player.name}</span>
{statLeaders.ace === player.id && <AceLeaderIcon />}
{statLeaders.kill === player.id && <KillLeaderIcon />}
{statLeaders.receiveAtt === player.id && <ReceptionLeaderIcon />}
</>
) : (
<span className="text-gray-400">Empty</span>
)}
</div>
);
};

const Modal = ({ title, children, isOpen, onClose }) => {
if (!isOpen) return null;
return (
<div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
<div className="bg-gray-800 text-white rounded-lg shadow-2xl p-6 w-full max-w-md md:max-w-lg mx-4">
<div className="flex justify-between items-center mb-4">
<h2 className="text-2xl font-bold text-cyan-400">{title}</h2>
<button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
</div>
<div>{children}</div>
</div>
</div>
);
};

// --- Stat Calculation Helpers ---
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
const totalRating =
(kills * 1.25) +
(aces * 1.5) +
(blocks * 2) -
allErrors +
(assists * 0.5) +
(digs * 0.25) +
receptionComponent;
return totalRating.toFixed(2);
};

// --- Main App Component ---
export default function App() {
// --- State Management ---
const [gameState, setGameState] = useState({
homeScore: 0,
opponentScore: 0,
homeSetsWon: 0,
opponentSetsWon: 0,
servingTeam: null,
homeSubs: 0,
currentSet: 1,
rotation: 1,
});
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

// ... (Rest of the code remains the same until the Modal definitions at the end)

// --- Modal Content Components ---

// ... (RosterModal, LoadMatchModal, etc. remain the same)

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

// ... (Other modals like SetLiberoServeModal remain the same)

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
</div>
</div>
);
}
