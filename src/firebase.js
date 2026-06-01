// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  onValue, 
  child 
} from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Convertit tout en format compatible Firebase (arrays → objects)
const cleanForFirebase = (obj) => {
  if (obj === undefined || obj === null) return null;
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return null;
    const result = {};
    obj.forEach((item, index) => {
      result[index.toString()] = cleanForFirebase(item);
    });
    return result;
  }
  
  if (typeof obj === 'object') {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
      const value = cleanForFirebase(obj[key]);
      if (value !== null) {
        cleaned[key] = value;
      }
    });
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  
  return obj;
};

// Restaure les arrays depuis Firebase (objects → arrays)
const objectToArray = (obj, expectedLength = null) => {
  if (!obj) return expectedLength ? new Array(expectedLength).fill(null) : [];
  if (Array.isArray(obj)) return obj;
  
  const keys = Object.keys(obj);
  if (keys.length === 0) return expectedLength ? new Array(expectedLength).fill(null) : [];
  
  // Trouver l'index maximum
  const maxIndex = Math.max(...keys.map(k => parseInt(k)).filter(n => !isNaN(n)));
  const length = expectedLength || maxIndex + 1;
  
  const arr = new Array(length).fill(null);
  keys.forEach(k => {
    const idx = parseInt(k);
    if (!isNaN(idx)) {
      arr[idx] = obj[k];
    }
  });
  return arr;
};

// Restaure complètement un game state
const restoreGameState = (data) => {
  if (!data) return null;
  
  return {
    player1Hand: objectToArray(data.player1Hand) || [],
    player2Hand: data.player2Hand ? objectToArray(data.player2Hand) : null,
    board: objectToArray(data.board, 25),
    currentPlayer: data.currentPlayer || 1,
    actionsUsed: data.actionsUsed || { place: false, moveCount: 0, attack: false },
    movedCards: data.movedCards ? objectToArray(data.movedCards) : [],
    damagedValues: data.damagedValues || {},
    message: data.message || '',
    gameOver: data.gameOver || false,
    winner: data.winner || null,
    createdAt: data.createdAt,
    lastUpdate: data.lastUpdate
  };
};

export const createGame = async (code, gameState) => {
  const cleaned = cleanForFirebase(gameState);
  await set(ref(db, 'games/' + code), cleaned);
};

export const joinGame = async (code) => {
  const snapshot = await get(child(ref(db), 'games/' + code));
  if (!snapshot.exists()) return null;
  return restoreGameState(snapshot.val());
};

export const updateGame = async (code, gameState) => {
  const cleaned = cleanForFirebase(gameState);
  await set(ref(db, 'games/' + code), cleaned);
};

export const subscribeToGame = (code, callback) => {
  const gameRef = ref(db, 'games/' + code);
  return onValue(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      const restored = restoreGameState(snapshot.val());
      callback(restored);
    }
  });
};
