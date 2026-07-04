import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, set, onChildAdded, onChildChanged, onChildRemoved, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAwIghmYSfOYBMJzfYGGrkD5cj9EcMSWgE",
  authDomain: "devinbrain-a7f15.firebaseapp.com",
  projectId: "devinbrain-a7f15",
  storageBucket: "devinbrain-a7f15.firebasestorage.app",
  messagingSenderId: "338934237416",
  appId: "1:338934237416:web:81b5d51b44c8b8c94da15d",
  databaseURL: "https://devinbrain-a7f15-default-rtdb.firebaseio.com"
};

let app, auth, db, currentUser = null;
let listenersInitialized = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
} catch (e) {
  console.warn("Firebase not configured correctly yet.");
}

const Sync = (() => {

  function initAuthListener() {
    if (!auth) return;
    
    getRedirectResult(auth).catch(error => {
      console.error("Redirect login error:", error);
      alert("Login Error: " + error.message);
    });

    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      const landing = document.getElementById('landing-page');
      const appShell = document.getElementById('app');
      
      if (user) {
        if (landing) landing.style.display = 'none';
        if (appShell) appShell.style.display = 'flex';
        
        if (!listenersInitialized) {
          startSyncListeners(user.uid);
          listenersInitialized = true;
        }
      } else {
        if (landing) landing.style.display = 'flex';
        if (appShell) appShell.style.display = 'none';
        listenersInitialized = false;
      }
    });
  }

  function login() {
    if (!auth) {
      alert("Firebase configuration is invalid or missing.");
      return;
    }
    const provider = new GoogleAuthProvider();
    signInWithRedirect(auth, provider).catch(error => {
      console.error("Login failed", error);
      alert("Login failed: " + error.message);
    });
  }

  function logout() {
    if (auth) signOut(auth);
  }

  // --- PLANS ---
  async function pushPlanToCloud(plan) {
    if (!currentUser || !db) return;
    try {
      await set(ref(db, `users/${currentUser.uid}/plans/${plan.id}`), plan);
    } catch (e) { console.error("Cloud plan sync failed", e); }
  }

  async function deletePlanFromCloud(id) {
    if (!currentUser || !db) return;
    try {
      await remove(ref(db, `users/${currentUser.uid}/plans/${id}`));
    } catch (e) { console.error("Cloud plan delete failed", e); }
  }

  // --- NOTES (INBOX) ---
  async function pushNoteToCloud(note) {
    if (!currentUser || !db) return;
    try {
      await set(ref(db, `users/${currentUser.uid}/notes/${note.id}`), note);
    } catch (e) { console.error("Cloud note sync failed", e); }
  }

  async function deleteNoteFromCloud(id) {
    if (!currentUser || !db) return;
    try {
      await remove(ref(db, `users/${currentUser.uid}/notes/${id}`));
    } catch (e) { console.error("Cloud note delete failed", e); }
  }

  // --- LISTENERS ---
  function startSyncListeners(uid) {
    if (!db) return;
    
    // Listen to Plans
    const plansRef = ref(db, `users/${uid}/plans`);
    onChildAdded(plansRef, async (snapshot) => {
      await DB.savePlan(snapshot.val(), true);
      refreshAppUI();
    });
    onChildChanged(plansRef, async (snapshot) => {
      await DB.savePlan(snapshot.val(), true);
      refreshAppUI();
    });
    onChildRemoved(plansRef, async (snapshot) => {
      await DB.deletePlan(snapshot.key, true);
      refreshAppUI();
    });

    // Listen to Inbox Notes
    const notesRef = ref(db, `users/${uid}/notes`);
    onChildAdded(notesRef, async (snapshot) => {
      await DB.saveNote(snapshot.val(), true);
      refreshAppUI();
    });
    onChildChanged(notesRef, async (snapshot) => {
      await DB.saveNote(snapshot.val(), true);
      refreshAppUI();
    });
    onChildRemoved(notesRef, async (snapshot) => {
      await DB.deleteNote(snapshot.key, true);
      refreshAppUI();
    });
  }

  async function refreshAppUI() {
    if (window.App && window.App.state) {
      window.App.state.plans = await DB.getAllPlans();
      window.App.state.inbox = await DB.getAllNotes();
      if (window.App.renderAll) window.App.renderAll();
    }
  }

  return { initAuthListener, login, logout, pushPlanToCloud, pushNoteToCloud, deletePlanFromCloud, deleteNoteFromCloud };
})();

window.Sync = Sync;

document.addEventListener('DOMContentLoaded', () => {
  Sync.initAuthListener();
});
