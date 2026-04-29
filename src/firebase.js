// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBqp3ZY0wT7xn7pLWSyGGOoa83BYd2h6g0",
  authDomain: "card-d03bb.firebaseapp.com",
  databaseURL: "https://card-d03bb-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "card-d03bb",
  storageBucket: "card-d03bb.firebasestorage.app",
  messagingSenderId: "929632721753",
  appId: "1:929632721753:web:59d208df3d144cec85ca48",
  measurementId: "G-P1NSLWDE3R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
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
