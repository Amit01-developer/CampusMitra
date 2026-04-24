/**
 * firebase-auth.js — Shared Firebase Google Sign-In
 * Include this as <script type="module" src="firebase-auth.js"></script>
 * AFTER the page's main script (script.js or dashboard.js).
 *
 * Exposes:  window.signInWithGoogle()
 * Requires: window._googleLoginSuccess(data) to be defined by the page script.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBeNeo2wYkSOc8uYU7Q8WfxLL6hGiGucnA",
    authDomain: "campus-share-2f42b.firebaseapp.com",
    projectId: "campus-share-2f42b",
};

let _app, _auth, _provider;

function getFirebase() {
    if (!_app) {
        _app      = initializeApp(firebaseConfig);
        _auth     = getAuth(_app);
        _provider = new GoogleAuthProvider();
    }
    return { auth: _auth, provider: _provider };
}

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:5000/api'
    : 'https://campusmitra-bwi0.onrender.com/api';

window.signInWithGoogle = async function () {
    const { auth, provider } = getFirebase();
    try {
        const result  = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();

        const res  = await fetch(`${API}/auth/google`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id_token: idToken }),
        });
        const data = await res.json();

        if (!res.ok || data.error) {
            if (window.showToast) window.showToast(data.error || 'Google login failed', 'error');
            else alert(data.error || 'Google login failed');
            return;
        }

        // Save token
        localStorage.setItem('cs_token', data.token);

        // Let the page handle the rest
        if (typeof window._googleLoginSuccess === 'function') {
            window._googleLoginSuccess(data);
        } else {
            // Fallback: reload so dashboard picks up the new token
            window.location.reload();
        }
    } catch (err) {
        const msg = err.code === 'auth/popup-closed-by-user'
            ? 'Sign-in popup was closed. Please try again.'
            : err.code === 'auth/popup-blocked'
            ? 'Popup was blocked by your browser. Please allow popups for this site.'
            : 'Google sign-in failed: ' + err.message;

        if (window.showToast) window.showToast(msg, 'error');
        else alert(msg);
    }
};
