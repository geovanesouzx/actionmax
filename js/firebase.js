// Importa as funções necessárias dos SDKs do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// A sua configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDf_AyxRX9d2JuVHvk3kScSb7bH8v5Bh-k",
    authDomain: "action-max.firebaseapp.com",
    projectId: "action-max",
    storageBucket: "action-max.appspot.com",
    messagingSenderId: "183609340889",
    appId: "1:183609340889:web:f32fc8e32d95461a1f5fc8"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Exporta as instâncias inicializadas para serem usadas em outros módulos
export { app, auth, db, googleProvider };

// Re-exporta todas as funções de autenticação e Firestore para que outros módulos
// possam importá-las a partir deste ficheiro central, simplificando os imports.
export * from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
export * from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
