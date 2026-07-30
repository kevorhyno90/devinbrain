let app, auth, db, currentUser = null;
let listenersInitialized = false;
let initializeApp, getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut;
let getDatabase, ref, set, onChildAdded, onChildChanged, onChildRemoved, remove;

const firebaseConfig = {
  apiKey: "AIzaSyAwIghmYSfOYBMJzfYGGrkD5cj9EcMSWgE",
  authDomain: "devinbrain-a7f15.firebaseapp.com",
  projectId: "devinbrain-a7f15",
  storageBucket: "devinbrain-a7f15.firebasestorage.app",
  messagingSenderId: "338934237416",
  appId: "1:338934237416:web:81b5d51b44c8b8c94da15d",
  databaseURL: "https://devinbrain-a7f15-default-rtdb.firebaseio.com"
};

async function initFirebase() {
  if (app) return true;
  try {
    const appModule = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js");
    initializeApp = appModule.initializeApp;
    
    const authModule = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js");
    getAuth = authModule.getAuth;
    signInWithRedirect = authModule.signInWithRedirect;
    getRedirectResult = authModule.getRedirectResult;
    GoogleAuthProvider = authModule.GoogleAuthProvider;
    onAuthStateChanged = authModule.onAuthStateChanged;
    signOut = authModule.signOut;
    
    const dbModule = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js");
    getDatabase = dbModule.getDatabase;
    ref = dbModule.ref;
    set = dbModule.set;
    onChildAdded = dbModule.onChildAdded;
    onChildChanged = dbModule.onChildChanged;
    onChildRemoved = dbModule.onChildRemoved;
    remove = dbModule.remove;

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    return true;
  } catch (e) {
    console.warn("Firebase not configured correctly yet or offline.", e);
    return false;
  }
}

const Sync = (() => {

  async function initAuthListener() {
    const loaded = await initFirebase();
    if (!loaded || !auth) {
      // Offline fallback: allow access to local app
      const landing = document.getElementById('landing-page');
      const appShell = document.getElementById('app');
      if (landing) landing.style.display = 'none';
      if (appShell) appShell.style.display = 'flex';
      return;
    }
    
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

  async function login() {
    await initFirebase();
    if (!auth) {
      alert("Firebase configuration is invalid or missing (Offline).");
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

  let refreshTimeout = null;
  async function refreshAppUI() {
    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(async () => {
      if (window.App && window.App.state) {
        window.App.state.plans = await DB.getAllPlans();
        window.App.state.inbox = await DB.getAllNotes();
        if (window.App.renderAll) window.App.renderAll();
      }
    }, 100);
  }

  return { initAuthListener, login, logout, pushPlanToCloud, pushNoteToCloud, deletePlanFromCloud, deleteNoteFromCloud };
})();

window.Sync = Sync;

document.addEventListener('DOMContentLoaded', () => {
  Sync.initAuthListener();
});
