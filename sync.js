import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAwIghmYSfOYBMJzfYGGrkD5cj9EcMSWgE",
  authDomain: "devinbrain-a7f15.firebaseapp.com",
  projectId: "devinbrain-a7f15",
  storageBucket: "devinbrain-a7f15.firebasestorage.app",
  messagingSenderId: "338934237416",
  appId: "1:338934237416:web:81b5d51b44c8b8c94da15d"
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
      await setDoc(doc(db, `users/${currentUser.uid}/plans`, plan.id), plan);
    } catch (e) {
      console.error("Failed to push plan to cloud", e);
    }
  }

  function startSyncListeners(uid) {
    if (!db) return;
    
    // Listen to Plans
    onSnapshot(collection(db, `users/${uid}/plans`), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added" || change.type === "modified") {
          await DB.savePlan(change.doc.data(), true); // true = skip cloud push
        }
        if (change.type === "removed") {
          await DB.deletePlan(change.doc.data().id, true);
        }
      });
      // Refresh UI if functions are available
      if (window.App) {
        if (window.App.state) window.App.state.plans = await DB.getAllPlans();
        window.App.renderAll && window.App.renderAll();
      }
    });

    // Listen to Inbox Notes
    onSnapshot(collection(db, `users/${uid}/notes`), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added" || change.type === "modified") {
          await DB.saveNote(change.doc.data(), true);
        }
        if (change.type === "removed") {
          await DB.deleteNote(change.doc.data().id, true);
        }
      });
      if (window.App) {
        if (window.App.state) window.App.state.inbox = await DB.getAllNotes();
        window.App.renderAll && window.App.renderAll();
      }
    });
  }

  async function pushNoteToCloud(note) {
    if (!currentUser || !db) return;
    try {
      await setDoc(doc(db, `users/${currentUser.uid}/notes`, note.id), note);
    } catch (e) { console.error("Cloud sync failed", e); }
  }

  async function deletePlanFromCloud(id) {
    if (!currentUser || !db) return;
    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/plans`, id));
    } catch (e) { console.error("Cloud delete failed", e); }
  }

  async function deleteNoteFromCloud(id) {
    if (!currentUser || !db) return;
    try {
      await deleteDoc(doc(db, `users/${currentUser.uid}/notes`, id));
    } catch (e) { console.error("Cloud delete failed", e); }
  }

  return { initAuthListener, login, logout, pushPlanToCloud, pushNoteToCloud, deletePlanFromCloud, deleteNoteFromCloud };
})();

window.Sync = Sync;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Sync.initAuthListener();
});
