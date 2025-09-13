import { auth, db, googleProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signOut, doc, getDoc, setDoc } from './firebase.js';
import * as state from './state.js';
import { showToast, renderProfileSelection, renderManageProfilesList, showAuthView, showProfileSelectionView } from './ui.js';

/**
 * Carrega os perfis de um utilizador a partir do Firestore.
 * @param {string} uid - O ID do utilizador.
 * @returns {Promise<Array>} A lista de perfis.
 */
export async function loadProfiles(uid) {
    if (!uid) return [];
    const profileDocRef = doc(db, 'profiles', uid);
    try {
        const docSnap = await getDoc(profileDocRef);
        return docSnap.exists() ? docSnap.data().profiles || [] : [];
    } catch (error) {
        console.error("Erro ao carregar perfis:", error);
        showToast("Não foi possível carregar os seus perfis.", true);
        return [];
    }
}

/**
 * Salva a lista de perfis atual no Firestore.
 */
export async function saveProfiles() {
    const user = auth.currentUser;
    if (!user || !user.uid) {
        console.error("Tentativa de salvar perfis sem utilizador autenticado.");
        return;
    }
    const profileDocRef = doc(db, 'profiles', user.uid);
    try {
        await setDoc(profileDocRef, { profiles: state.profiles });
    } catch (error) {
        console.error("Erro ao salvar perfis:", error);
        showToast("Ocorreu um erro ao salvar as suas alterações.", true);
    }
}

/**
 * Lida com o processo de login.
 */
export function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, password)
        .catch(error => showToast(`Erro de login: ${error.message}`));
}

/**
 * Lida com o processo de registo.
 */
export function handleRegister() {
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    createUserWithEmailAndPassword(auth, email, password)
        .catch(error => showToast(`Erro de cadastro: ${error.message}`));
}

/**
 * Lida com o login/registo via Google.
 */
export function handleGoogleAuth() {
    signInWithPopup(auth, googleProvider)
        .catch(error => showToast(`Erro com Google: ${error.message}`));
}

/**
 * Lida com o logout do utilizador.
 */
export function handleLogout() {
    state.setLastScrollPosition(0);
    state.setCurrentProfileId(null);
    signOut(auth).catch(error => {
        console.error("Erro ao sair:", error);
        showToast(`Erro: ${error.message}`);
    });
}


/**
 * Salva as alterações a um perfil (novo ou existente).
 */
export async function handleSaveProfile() {
    const nameInput = document.getElementById('profile-name-input');
    const kidToggle = document.getElementById('kid-profile-toggle');
    const name = nameInput.value.trim();

    if (!name || !state.selectedAvatarUrl) {
        showToast("Por favor, insira um nome e selecione um avatar.");
        return;
    }

    let currentProfiles = [...state.profiles];
    if (state.editingProfileId) {
        const profile = currentProfiles.find(p => p.id === state.editingProfileId);
        if(profile) {
            profile.name = name;
            profile.avatar = state.selectedAvatarUrl;
            profile.isKid = kidToggle.checked;
        }
    } else {
        currentProfiles.push({
            id: `p${Date.now()}`,
            name: name,
            avatar: state.selectedAvatarUrl,
            isKid: kidToggle.checked,
            skipTime: 10,
            myList: [],
            watchProgress: {},
            userRatings: {},
            soundEnabled: true,
            pushEnabled: ('Notification' in window) && Notification.permission === 'granted',
            lastViewedSeason: {},
        });
    }
    state.setProfiles(currentProfiles);

    await saveProfiles();
    renderManageProfilesList();
    showProfileSelectionView(false); // Go back to manage view
}

/**
 * Apaga o perfil que está a ser editado.
 */
export async function handleDeleteProfile() {
    if (state.editingProfileId) {
        const updatedProfiles = state.profiles.filter(p => p.id !== state.editingProfileId);
        state.setProfiles(updatedProfiles);
        await saveProfiles();
        renderManageProfilesList();
        showProfileSelectionView(false); // Go back to manage view
    }
}
