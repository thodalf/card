// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  onValue, 
  update, 
  remove,
  child 
} from 'firebase/database';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getDatabase(app);

// Convertit les undefined en null et nettoie les données
const cleanForFirebase = (obj) => {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    // Pour les arrays, on les transforme en objet avec index comme clés
    // Cela force Firebase à conserver la structure
    const arrObj = {};
    obj.forEach((item, index) => {
      arrObj[index] = cleanForFirebase(item);
    });
    return arrObj;
  }
  if (typeof obj === 'object') {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
      const value = cleanForFirebase(obj[key]);
      cleaned[key] = value;
    });
    return cleaned;
  }
  return obj;
};

// Restaure les arrays depuis Firebase
const restoreFromFirebase = (obj, expectedArrayLength = null) => {
  if (obj === null || obj === undefined) return null;
  
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const keys = Object.keys(obj);
    
    // Détecte si c'est un array (clés numériques)
    const isArray = keys.length > 0 && keys.every(k => /^\d+$/.test(k));
    
    if (isArray) {
      const maxIndex = Math.max(...keys.map(k => parseInt(k)));
      const length = expectedArrayLength || maxIndex + 1;
      const arr = new Array(length).fill(null);
      keys.forEach(k => {
        arr[parseInt(k)] = restoreFromFirebase(obj[k]);
      });
      return arr;
    }
    
    // Sinon c'est un objet normal
    const restored = {};
    Object.keys(obj).forEach(key => {
      restored[key] = restoreFromFirebase(obj[key]);
    });
    return restored;
  }
  
  return obj;
};

// Restaure spécifiquement la structure du jeu
const restoreGameState = (data) => {
  if (!data) return null;
  
  return {
    ...data,
    board: restoreBoard(data.board),
    player1Hand: restoreHand(data.player1Hand),
    player2Hand: restoreHand(data.player2Hand),
    movedCards: restoreMovedCards(data.movedCards),
    damagedValues: data.damagedValues || {},
    actionsUsed: data.actionsUsed || { place: false, moveCount: 0, attack: false },
    currentPlayer: data.currentPlayer || 1,
    message: data.message || '',
    gameOver: data.gameOver || false,
    winner: data.winner || null
  };
};

const restoreBoard = (board) => {
  const result = new Array(25).fill(null);
  if (!board) return result;
  
  if (Array.isArray(board)) {
    return board.map(cell => cell || null);
  }
  
  // Si c'est un objet, convertir
  Object.keys(board).forEach(key => {
    const idx = parseInt(key);
    if (!isNaN(idx) && idx < 25) {
      result[idx] = board[key] || null;
    }
  });
  return result;
};

const restoreHand = (hand) => {
  if (!hand) return [];
  if (Array.isArray(hand)) return hand.filter(c => c);
  
  // Si c'est un objet, convertir en array
  return Object.values(hand).filter(c => c);
};

const restoreMovedCards = (movedCards) => {
  if (!movedCards) return [];
  if (Array.isArray(movedCards)) return movedCards;
  return Object.values(movedCards);
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
      callback(restoreGameState(snapshot.val()));
    }
  });
};
