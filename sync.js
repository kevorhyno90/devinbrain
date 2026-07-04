import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// TODO: Replace this with your actual Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

let app, auth, db, currentUser = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase not configured correctly yet.");
}

const Sync = (() => {

  function initAuthListener() {
    if (!auth) return;
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      const landing = document.getElementById('landing-page');
      const appShell = document.getElementById('app');
      
      if (user) {
        // Logged in
        if (landing) landing.style.display = 'none';
        if (appShell) appShell.style.display = 'flex';
        // Initialize real-time listeners for this user's data
        startSyncListeners(user.uid);
      } else {
        // Logged out
        if (landing) landing.style.display = 'flex';
        if (appShell) appShell.style.display = 'none';
      }
    });
  }

  function login() {
    if (!auth) {
      alert("Please add your Firebase config to sync.js first!");
      return;
    }
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => {
      console.error("Login failed", error);
      alert("Login failed: " + error.message);
    });
  }

  function logout() {
    if (auth) signOut(auth);
  }

  // Very basic mock structure for syncing data to Firestore
  async function pushPlanToCloud(plan) {
    if (!currentUser || !db) return;
    try {
      await setDoc(doc(db, \`users/\${currentUser.uid}/plans\`, plan.id), plan);
    } catch (e) {
      console.error("Failed to push plan to cloud", e);
    }
  }

  function startSyncListeners(uid) {
    if (!db) return;
    // Example: listen to cloud changes and update local DB
    // onSnapshot(collection(db, \`users/\${uid}/plans\`), (snapshot) => {
    //   snapshot.docChanges().forEach((change) => {
    //     if (change.type === "added" || change.type === "modified") {
    //       DB.savePlan(change.doc.data()); // Overwrites local with cloud
    //     }
    //   });
    //   if (window.App && window.App.renderAll) window.App.renderAll();
    // });
  }

  return { initAuthListener, login, logout, pushPlanToCloud };
})();

window.Sync = Sync;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Sync.initAuthListener();
});
