import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, update, remove } from 'firebase/database';

const firebaseConfig = {
  // Remplacez par VOS clés Firebase
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJECT.firebaseapp.com",
  databaseURL: "https://VOTRE_PROJECT-default-rtdb.firebaseio.com",
  projectId: "VOTRE_PROJECT",
  storageBucket: "VOTRE_PROJECT.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export const createGame = async (code, gameState) => {
  await set(ref(db, 'games/' + code), gameState);
};

export const joinGame = async (code) => {
  const snapshot = await get(ref(db, 'games/' + code));
  return snapshot.exists() ? snapshot.val() : null;
};

export const updateGame = async (code, gameState) => {
  await update(ref(db, 'games/' + code), gameState);
};

export const subscribeToGame = (code, callback) => {
  const gameRef = ref(db, 'games/' + code);
  return onValue(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    }
  });
};
