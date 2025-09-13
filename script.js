// Módulos da Aplicação
import { onAuthStateChanged } from './js/firebase.js';
import * as authManager from './js/auth.js';
import * as firestoreManager from './js/firestore.js';
import * as state from './js/state.js';
import * as ui from './js/ui.js';
import * as player from './js/player.js';
import * as api from './js/api.js';

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o estado de autenticação
    onAuthStateChanged(authManager.auth, async user => {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.classList.remove('opacity-0');
        loadingScreen.classList.add('flex');

        firestoreManager.detachRealtimeListeners();

        if (user) {
            console.log("Utilizador autenticado:", user.uid);
            await firestoreManager.loadDataAndAttachListeners();
            const profiles = await authManager.loadProfiles(user.uid);
            state.setProfiles(profiles);
            ui.showProfileSelectionView(true);
        } else {
            console.log("Nenhum utilizador autenticado.");
            // Limpa o estado e mostra a vista de login
            state.setCurrentProfileId(null);
            state.setProfiles([]);
            // Esconde todas as vistas principais
            document.querySelectorAll('#app-container > div, header').forEach(el => el.classList.add('hidden'));
            ui.showAuthView('login');
        }
        
        // Esconde o ecrã de carregamento
        loadingScreen.classList.add('opacity-0');
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            loadingScreen.classList.remove('flex');
        }, 500);
    });

    // Anexa os listeners de eventos principais
    attachEventListeners();
});


function attachEventListeners() {
    // Autenticação
    document.getElementById('login-btn').addEventListener('click', authManager.handleLogin);
    document.getElementById('register-btn').addEventListener('click', authManager.handleRegister);
    document.getElementById('google-login-btn').addEventListener('click', authManager.handleGoogleAuth);
    document.getElementById('google-register-btn').addEventListener('click', authManager.handleGoogleAuth);
    document.getElementById('show-register-view-btn').addEventListener('click', () => ui.showAuthView('register'));
    document.getElementById('show-login-view-btn').addEventListener('click', () => ui.showAuthView('login'));
    document.getElementById('logout-btn').addEventListener('click', authManager.handleLogout);

    // Gestão de Perfis
    document.getElementById('manage-profiles-btn').addEventListener('click', () => ui.showProfileSelectionView(false));
    document.getElementById('done-managing-btn').addEventListener('click', () => ui.showProfileSelectionView(true));
    document.getElementById('save-profile-btn').addEventListener('click', authManager.handleSaveProfile);
    document.getElementById('cancel-edit-btn').addEventListener('click', () => ui.showProfileSelectionView(false));
    document.getElementById('delete-profile-btn').addEventListener('click', authManager.handleDeleteProfile);
    
    // Delegação de eventos principal para ações dinâmicas
    document.body.addEventListener('click', (e) => {
        const actionTarget = e.target.closest('[data-action]');
        if (!actionTarget) return;

        const { action, viewName, itemId } = actionTarget.dataset;

        // Lógica de navegação principal
        if (action === 'showView') {
            e.preventDefault();
            // A função de navegação showView seria definida aqui ou num módulo de navegação
            // showView(viewName, { itemId }); 
        } else if (action === 'selectProfile') {
            state.setCurrentProfileId(itemId);
            // Lógica para entrar na app com o perfil selecionado
            console.log(`Perfil ${itemId} selecionado.`);
            document.getElementById('profile-selection-view').classList.add('hidden');
            document.getElementById('home-view').classList.remove('hidden');
            document.getElementById('main-header').classList.remove('hidden');
            // Aqui chamaria a função para renderizar o conteúdo da home
        } else if (action === 'showEditProfileView') {
             ui.showEditProfileView(itemId);
        }
        // ... outras ações podem ser delegadas aqui
    });

    // ... outros listeners globais como 'scroll' e 'popstate'
}
