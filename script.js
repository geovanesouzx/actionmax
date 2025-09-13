// Módulos da Aplicação
import { onAuthStateChanged } from './js/firebase.js';
import * as authManager from './js/auth.js';
import * as firestoreManager from './js/firestore.js';
import * as state from './js/state.js';
import * as ui from './js/ui.js';
import * as player from './js/player.js';
import * as api from './js/api.js';

let hlsInstance = null; // Manter a instância do HLS aqui para ser acessível globalmente

document.addEventListener('DOMContentLoaded', () => {
    player.initPlayerControls(); // Inicializa os controlos do leitor assim que o DOM estiver pronto
    
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
            state.setCurrentProfileId(null);
            state.setProfiles([]);
            document.querySelectorAll('#app-container > div, header, nav').forEach(el => {
                if(!['login-view', 'register-view', 'loading-screen'].includes(el.id)) {
                    el.classList.add('hidden');
                }
            });
            ui.showAuthView('login');
        }
        
        loadingScreen.classList.add('opacity-0');
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            loadingScreen.classList.remove('flex');
        }, 500);
    });

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
    document.getElementById('manage-profiles-btn').addEventListener('click', () => ui.showManageProfilesView());
    document.getElementById('done-managing-btn').addEventListener('click', () => ui.showProfileSelectionView(true));
    document.getElementById('save-profile-btn').addEventListener('click', authManager.handleSaveProfile);
    document.getElementById('cancel-edit-btn').addEventListener('click', () => ui.showManageProfilesView());
    document.getElementById('delete-profile-btn').addEventListener('click', authManager.handleDeleteProfile);
    
    document.getElementById('logo').addEventListener('click', async (e) => { e.preventDefault(); await showView('home'); });

    // Delegação de eventos principal
    document.body.addEventListener('click', handleGlobalClick);
    
    // Listeners Globais
    window.addEventListener('scroll', ui.updateHeaderStyle);
    window.addEventListener('popstate', handlePopState);
}


async function selectProfile(profileId) {
    state.setCurrentProfileId(profileId);
    const profile = state.getCurrentProfile();
    if (!profile) return;

    ui.updateUIAfterProfileSelect(profile);
    firestoreManager.setupNotificationListener();
    ui.checkNotificationPermission();

    // Lida com a navegação inicial após o login
    const hash = window.location.hash.slice(1);
    const [view, param1] = hash.split('/');
    let params = {};
    if(view === 'detail' || view === 'player') params.itemId = param1;
    if(view === 'genre-results') params.genre = param1;
    
    await showView(view || 'home', params, false);
}

async function showView(viewName, params = {}, pushState = true) {
    if (!authManager.auth.currentUser || !state.getCurrentProfile()) {
        authManager.handleLogout();
        return;
    }

    const mainHeader = document.getElementById('main-header');
    const allViews = ['home-view', 'detail-view', 'player-view', 'iframe-player-view', 'series-view', 'movies-view', 'genres-view', 'genre-results-view', 'profile-view', 'search-view', 'pedidos-view', 'coming-soon-view'];
    
    // Lógica para parar o leitor de vídeo ao sair da vista
    if (!document.getElementById('player-view').classList.contains('hidden') && viewName !== 'player') {
         await player.exitPlayerMode();
    }
    
    allViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    if (viewName !== 'detail') {
        window.scrollTo(0, 0);
    }
    
    ui.updateNavLinks(viewName);

    const targetViewId = `${viewName}-view`;
    const targetView = document.getElementById(targetViewId);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('view-transition');
    }
    
    ui.updateHeaderStyle();

    let url = `#${viewName}`;
    if (params.itemId) url += `/${params.itemId}`;
    if (params.genre) url += `/${params.genre}`;

    if (pushState && window.location.hash !== url) {
        history.pushState({ viewName, params }, '', url);
    }

    // Renderiza o conteúdo da vista específica
    switch(viewName) {
        case 'home':
            await ui.renderHomePage();
            break;
        case 'detail':
            await ui.renderDetailPage(params.itemId);
            break;
        case 'player':
            await player.startPlayback(params.itemId, params);
            break;
        case 'movies':
            ui.renderGenericPage('movies-view', 'Filmes', 'movie');
            break;
        case 'series':
            ui.renderGenericPage('series-view', 'Séries', 'series');
            break;
        case 'genres':
            ui.renderGenresPage();
            break;
        case 'genre-results':
            ui.renderGenreResultsPage(params.genre);
            break;
        case 'coming-soon':
            ui.renderComingSoonPage();
            break;
        case 'profile':
            ui.setupProfilePage();
            break;
        case 'search':
            ui.renderSearchPage();
            break;
        case 'pedidos':
            ui.renderPedidosPage();
            break;
    }
}


async function handleGlobalClick(e) {
    const actionTarget = e.target.closest('[data-action]');
    if (!actionTarget) return;

    const { action, viewName, itemId, genre, season, epIndex, tmdbId, mediaType, requestId, id, contentId, linkUrl } = actionTarget.dataset;
    let params = { itemId, genre, season, epIndex };

    // Ações que não devem impedir o comportamento padrão imediatamente
    const nonPreventActions = ['close-trailer-modal', 'handleNotificationClick', 'closeNotifications', 'dismiss-notification', 'toggleCastVisibility', 'showReplyForm', 'add-reply', 'like', 'delete', 'rate', 'show-more-comments', 'removeFromContinueWatching', 'remove-my-request'];
    if (!nonPreventActions.includes(action)) {
        e.preventDefault();
    }

    switch(action) {
        case 'showView':
            await showView(viewName, params);
            break;
        case 'selectProfile':
            await selectProfile(itemId);
            break;
        case 'showEditProfileView':
            ui.showEditProfileView(itemId);
            break;
        case 'editCurrentProfile':
             ui.showEditProfileView(state.currentProfileId);
             break;
        // ... Lógica para outras ações ...
        case 'playContent':
            await player.playContent(itemId);
            break;
        case 'continuePlayback':
            await player.continuePlayback(itemId);
            break;
        case 'toggleMyList':
            await ui.toggleMyList(itemId);
            break;
        case 'showTrailer':
            ui.showTrailer(itemId);
            break;
        case 'close-trailer-modal':
            ui.closeTrailerModal();
            break;
        // ... (e assim por diante para cada ação)
    }
}


async function handlePopState(event) {
    if (!authManager.auth.currentUser) {
        authManager.handleLogout();
        return;
    }
    const state = event.state || { viewName: 'home', params: {} };
    await showView(state.viewName, state.params, false);
}

