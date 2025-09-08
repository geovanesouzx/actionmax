// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    getDocs,
    getDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    updateDoc,
    arrayUnion,
    writeBatch,
    setDoc,
    addDoc,
    serverTimestamp,
    runTransaction,
    where
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDf_AyxRX9d2JuVHvk3kScSb7bH8v5Bh-k",
  authDomain: "action-max.firebaseapp.com",
  projectId: "action-max",
  storageBucket: "action-max.appspot.com",
  messagingSenderId: "183609340889",
  appId: "1:183609340889:web:f32fc8e32d95461a1f5fc8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore
const googleProvider = new GoogleAuthProvider();

// TMDB API Configuration
const TMDB_API_KEY = '5954890d9e9b723ff3032f2ec429fec3'; // Chave da API TMDB
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMG_URL = 'https://image.tmdb.org/t/p/w500';


document.addEventListener('DOMContentLoaded', () => {
    // Style for synopsis truncation
    const style = document.createElement('style');
    style.textContent = `
        .synopsis-text {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            overflow: hidden;
            transition: -webkit-line-clamp 0.3s ease-in-out;
        }
        .synopsis-truncated {
            -webkit-line-clamp: 3; /* Truncate to 3 lines */
        }
    `;
    document.head.appendChild(style);

    // Data will be loaded from Firestore
    let catalog = [];
    let carousels = [];
    let itemDetails = {};
    let avatarsFromFirestore = []; // Will hold avatars from Firestore
    
    // Notification Sound
    const notificationSound = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_2747e1b9b6.mp3');

    
    // --- App State ---
    let profiles = [];
    let currentProfileId = null;
    let editingProfileId = null;
    let selectedAvatarUrl = null;
    let isPlayerModeActive = false;
    let commentsToShow = 5;
    let tmdbSearchTimeout = null;
    let lastVolume = 1;

    let currentPlayingItemId = null;
    let currentEpisodeData = null;
    let nextEpisodeData = null;
    let nextEpisodeInterval = null;
    let progressSaveInterval = null;
    let notificationShakeInterval = null;
    let lastUnreadCount = -1; // -1 indicates the first run

    let unsubscribeContent = null;
    let unsubscribeCarousels = null;
    let unsubscribeNotifications = null;
    let unsubscribeComments = null; // Listener for comments
    let unsubscribePedidos = null; // Listener para pedidos

    const allViews = ['home-view', 'detail-view', 'player-view', 'iframe-player-view', 'series-view', 'movies-view', 'genres-view', 'genre-results-view', 'profile-view', 'search-view', 'pedidos-view', 'profile-selection-view', 'manage-profiles-view', 'edit-profile-view', 'login-view', 'register-view'];
    const mainHeader = document.getElementById('main-header');
    const videoPlayer = document.getElementById('video-player');
    const iframePlayer = document.getElementById('iframe-player');
    const errorDisplay = document.getElementById('player-error-display');
    const notificationsPanel = document.getElementById('notifications-panel');
    const notificationsList = document.getElementById('notifications-list');
    let hlsInstance;

    // --- Firestore Data Fetching ---
    function detachRealtimeListeners() {
        if (unsubscribeContent) unsubscribeContent();
        if (unsubscribeCarousels) unsubscribeCarousels();
        if (unsubscribeNotifications) unsubscribeNotifications();
        if (unsubscribeComments) unsubscribeComments();
        if (unsubscribePedidos) unsubscribePedidos();
        if (notificationShakeInterval) {
            clearInterval(notificationShakeInterval);
            notificationShakeInterval = null;
            document.getElementById('notification-btn')?.classList.remove('has-notifications', 'shaking');
        }
    }
    
    async function loadDataAndAttachListeners() {
        // 1. Initial Fetch to prevent race conditions on page load
        try {
            console.log("Carregando dados iniciais...");
            const contentSnapshot = await getDocs(collection(db, 'content'));
            const catalogData = [];
            const itemDetailsData = {};
            contentSnapshot.forEach(doc => {
                const data = { id: doc.id, ...doc.data() };
                catalogData.push({ id: data.id, title: data.title, type: data.type, poster: data.poster, tmdbId: data.tmdbId });
                itemDetailsData[data.id] = data;
            });
            catalog = catalogData;
            itemDetails = itemDetailsData;
        
            const carouselsQuery = query(collection(db, 'carousels'), orderBy('order'));
            const carouselsSnapshot = await getDocs(carouselsQuery);
            const carouselsData = [];
            carouselsSnapshot.forEach(doc => {
                carouselsData.push({ id: doc.id, ...doc.data() });
            });
            carousels = carouselsData;

            // Fetch Avatars
            const categoriesQuery = query(collection(db, 'avatar_categories'), orderBy('title'));
            const categoriesSnapshot = await getDocs(categoriesQuery);
            const categoriesData = [];
            for (const categoryDoc of categoriesSnapshot.docs) {
                const category = {
                    id: categoryDoc.id,
                    category: categoryDoc.data().title,
                    urls: []
                };
                const avatarsSnapshot = await getDocs(collection(db, `avatar_categories/${category.id}/avatars`));
                avatarsSnapshot.forEach(avatarDoc => {
                    category.urls.push(avatarDoc.data().url);
                });
                if (category.urls.length > 0) {
                    categoriesData.push(category);
                }
            }
            avatarsFromFirestore = categoriesData;

            console.log("Dados iniciais carregados.");
        } catch (error) {
            console.error("Erro ao carregar dados iniciais:", error);
            showToast("Falha ao carregar o catálogo.");
            return Promise.reject(error); // Stop execution if initial load fails
        }
    
        // 2. Attach Listeners for subsequent real-time updates
        detachRealtimeListeners(); // Ensure no old listeners are running
    
        const contentQuery = collection(db, 'content');
        unsubscribeContent = onSnapshot(contentQuery, (snapshot) => {
            console.log("Dados de conteúdo atualizados em tempo real.");
            snapshot.docChanges().forEach((change) => {
                const data = { id: change.doc.id, ...change.doc.data() };
                const index = catalog.findIndex(item => item.id === data.id);
                
                if (change.type === "added" || change.type === "modified") {
                    const catalogItem = { id: data.id, title: data.title, type: data.type, poster: data.poster, tmdbId: data.tmdbId };
                    if (index > -1) {
                        catalog[index] = catalogItem;
                    } else {
                        catalog.push(catalogItem);
                    }
                    itemDetails[data.id] = data;
                }
                if (change.type === "removed") {
                    if (index > -1) {
                       catalog.splice(index, 1);
                    }
                    delete itemDetails[change.doc.id];
                }
            });

            refreshUI(); 
        }, (error) => console.error("Erro no listener de conteúdo:", error));
    
        const carouselsQuery = query(collection(db, 'carousels'), orderBy('order'));
        unsubscribeCarousels = onSnapshot(carouselsQuery, (snapshot) => {
            console.log("Dados de carrosséis atualizados em tempo real.");
            const carouselsData = [];
            snapshot.forEach(doc => {
                carouselsData.push({ id: doc.id, ...doc.data() });
            });
            carousels = carouselsData;
            refreshUI();
        }, (error) => console.error("Erro no listener de carrosséis:", error));
    }

    function refreshUI() {
        // Only refresh if a profile is selected and the user is not watching something
        if (!currentProfileId || isPlayerModeActive || document.fullscreenElement) {
            return;
        }

        const viewEl = allViews.map(id => document.getElementById(id)).find(el => el && !el.classList.contains('hidden'));
        if (!viewEl) return;
        
        const currentViewId = viewEl.id;

        console.log(`Atualizando UI para a view: ${currentViewId}`);

        // Re-render only list-based views to avoid being disruptive.
        switch (currentViewId) {
            case 'home-view':
                renderHeroSection();
                renderCarousels();
                break;
            case 'movies-view':
                renderGenericPage('movies-view', 'Filmes', 'movie');
                break;
            case 'series-view':
                renderGenericPage('series-view', 'Séries', 'series');
                break;
            case 'genres-view':
                renderGenresPage();
                break;
            case 'pedidos-view':
                // O onSnapshot já cuida disso
                break;
            case 'profile-view':
                // Refresh mylist if that's the active section
                if (document.querySelector('#profile-section-mylist:not(.hidden)')) {
                    renderMyListPage();
                }
                break;
             case 'detail-view':
                  const currentItemId = document.querySelector('.comment-container')?.dataset.itemId;
                  if(currentItemId) {
                       renderStarRating(currentItemId);
                  }
                  break;
        }
    }

    // --- NOTIFICATION LOGIC ---
    function formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return `${Math.floor(interval)}a atrás`;
        interval = seconds / 2592000;
        if (interval > 1) return `${Math.floor(interval)}m atrás`;
        interval = seconds / 86400;
        if (interval > 1) return `${Math.floor(interval)}d atrás`;
        interval = seconds / 3600;
        if (interval > 1) return `${Math.floor(interval)}h atrás`;
        interval = seconds / 60;
        if (interval > 1) return `${Math.floor(interval)}min atrás`;
        return 'agora mesmo';
    }

    function processAndRenderNotifications(snapshot) {
        const profile = getCurrentProfile();
        if (!profile) return;

        const notifications = [];
        snapshot.forEach(doc => notifications.push({ id: doc.id, ...doc.data() }));

        notificationsList.innerHTML = '';
        let unreadCount = 0;
        const notificationBtn = document.getElementById('notification-btn');

        if (notifications.length === 0) {
            notificationsList.innerHTML = '<p class="text-gray-500 text-center p-4">Nenhuma notificação por enquanto.</p>';
        } else {
            notifications.forEach(notif => {
                const isRead = notif.readBy && notif.readBy.includes(profile.id);
                if (!isRead) unreadCount++;

                const item = document.createElement('div');
                item.className = `notification-item relative bg-gray-800/50 hover:bg-gray-700/50 p-3 rounded-lg cursor-pointer pl-8 ${!isRead ? 'unread' : ''}`;
                item.dataset.action = 'handleNotificationClick';
                item.dataset.id = notif.id;
                if (notif.contentId) item.dataset.contentId = notif.contentId;
                if (notif.linkUrl) item.dataset.linkUrl = notif.linkUrl;

                item.innerHTML = `
                    <button data-action="dismiss-notification" data-id="${notif.id}" class="notification-dismiss-btn" aria-label="Dispensar">&times;</button>
                    <h4 class="font-bold">${notif.title}</h4>
                    <p class="text-sm text-gray-300">${notif.message}</p>
                    <p class="text-xs text-gray-500 mt-1">${formatTimeAgo(notif.timestamp)}</p>
                `;
                notificationsList.appendChild(item);
            });
        }
        
        // --- Trigger Sound and Push Notification ---
        const previousUnreadCount = lastUnreadCount;
        lastUnreadCount = unreadCount;

        if (previousUnreadCount !== -1 && unreadCount > previousUnreadCount) {
            const newNotification = notifications[0]; // Latest is always first
            
            // 1. Play Sound
            if (profile.soundEnabled) {
                notificationSound.play().catch(error => {
                    console.warn("A reprodução do som de notificação foi bloqueada pelo navegador.", error);
                });
            }

            // 2. Show Push Notification
            if (profile.pushEnabled && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(newNotification.title, {
                    body: newNotification.message,
                    icon: 'https://placehold.co/192x192/4f46e5/ffffff?text=A' // Placeholder icon
                });
            }
        }


        // Clear previous state
        clearInterval(notificationShakeInterval);
        notificationShakeInterval = null;
        notificationBtn.classList.remove('has-notifications', 'shaking');

        if (unreadCount > 0) {
            notificationBtn.classList.add('has-notifications');
            // Start shaking interval
            notificationShakeInterval = setInterval(() => {
                notificationBtn.classList.add('shaking');
                setTimeout(() => {
                    notificationBtn.classList.remove('shaking');
                }, 500); // Duration of the animation
            }, 5000); // Every 5 seconds
        }
    }

    function setupNotificationListener() {
        if (unsubscribeNotifications) unsubscribeNotifications();
        lastUnreadCount = -1; // Reset for the new profile session
        const notificationsQuery = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'));
        unsubscribeNotifications = onSnapshot(notificationsQuery, processAndRenderNotifications, (error) => {
            console.error("Erro no listener de notificações:", error);
        });
    }

    async function markNotificationsAsRead() {
        const profile = getCurrentProfile();
        if (!profile) return;

        const unreadItems = notificationsList.querySelectorAll('.notification-item.unread');
        if (unreadItems.length === 0) return;

        try {
            const batch = writeBatch(db);
            unreadItems.forEach(item => {
                const docRef = doc(db, 'notifications', item.dataset.id);
                batch.update(docRef, {
                    readBy: arrayUnion(profile.id)
                });
            });
            await batch.commit();

             // Instant UI feedback
            const notificationBtn = document.getElementById('notification-btn');
            if (notificationBtn) {
                notificationBtn.classList.remove('has-notifications', 'shaking');
            }
            if (notificationShakeInterval) {
                clearInterval(notificationShakeInterval);
                notificationShakeInterval = null;
            }
        } catch (error) {
            console.error("Erro ao marcar notificações como lidas:", error);
        }
    }
    
    // --- Player Mode Functions ---
    async function enterPlayerMode() {
        const playerContainerEl = document.getElementById('player-container');
        if (!playerContainerEl || document.fullscreenElement) return;
        try {
            await playerContainerEl.requestFullscreen();
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape').catch(err => {});
            }
            isPlayerModeActive = true;
        } catch (err) {
            console.warn("Modo tela cheia/paisagem não suportado ou negado pelo utilizador.", err);
        }
    }

    async function exitPlayerMode() {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        } catch (err) {
            console.warn("Erro ao sair do modo tela cheia/paisagem.", err);
        } finally {
            isPlayerModeActive = false;
        }
    }
    
    // --- Profile Management Functions (Firestore) ---

    async function loadProfiles(uid) {
        if (!uid) return [];
        const profileDocRef = doc(db, 'profiles', uid);
        try {
            const docSnap = await getDoc(profileDocRef);
            if (docSnap.exists()) {
                return docSnap.data().profiles || [];
            } else {
                return [];
            }
        } catch (error) {
            console.error("Erro ao carregar perfis do Firestore:", error);
            showToast("Não foi possível carregar seus perfis.", true);
            return [];
        }
    }

    async function saveProfiles() {
        const user = auth.currentUser;
        if (!user || !user.uid) {
            console.error("Tentativa de salvar perfis sem utilizador autenticado.");
            return;
        }
        const profileDocRef = doc(db, 'profiles', user.uid);
        try {
            await setDoc(profileDocRef, { profiles: profiles });
        } catch (error) {
            console.error("Erro ao salvar perfis no Firestore:", error);
            showToast("Ocorreu um erro ao salvar suas alterações.", true);
        }
    }


    function getCurrentProfile() {
        if (!currentProfileId) return null;
        return profiles.find(p => p.id === currentProfileId);
    }

    async function selectProfile(profileId) {
        currentProfileId = profileId;
        const profile = getCurrentProfile();
        if (!profile) return;

        document.getElementById('header-avatar').src = profile.avatar;
        document.getElementById('profile-avatar-img').src = profile.avatar;
        document.getElementById('profile-name').textContent = profile.name;

        showProfileSelectionView(false);
        mainHeader.classList.remove('hidden');

        // Setup notification listener for the selected profile
        setupNotificationListener();

        // Ask for permission on profile selection if not already set
        if ('Notification' in window && Notification.permission === "default") {
              const modal = document.getElementById('permission-modal');
              modal.classList.remove('hidden');
              setTimeout(() => {
                  modal.classList.add('show');
              }, 10);
        }
        
        // Unlock audio context by playing a muted sound on first user interaction
        notificationSound.muted = true;
        notificationSound.play().catch(e => {}); // This might fail silently, but it's okay.
        setTimeout(() => {
            notificationSound.muted = false; // Unmute for actual notifications
        }, 100);

        const hash = window.location.hash.slice(1);
        const [view, param1] = hash.split('/');
        let params = {};
        if(view === 'detail' || view === 'player') params.itemId = param1;
        if(view === 'genre-results') params.genre = param1;
        
        await showView(view || 'home', params, false);
    }

    function handleLogout() {
        lastUnreadCount = -1; // Reset on logout
        signOut(auth).catch(error => {
            console.error("Erro ao sair:", error);
            showToast(`Erro: ${error.message}`);
        });
    }

    function renderProfileSelection() {
        const container = document.getElementById('profiles-list-container');
        container.innerHTML = profiles.map(profile => `
            <div class="text-center group cursor-pointer" data-action="selectProfile" data-item-id="${profile.id}">
                <img src="${profile.avatar}" alt="${profile.name}" class="w-24 h-24 md:w-36 md:h-36 rounded-md object-cover transition-transform duration-200 group-hover:scale-105 border-4 border-transparent group-hover:border-gray-300">
                <p class="mt-2 text-gray-400 font-medium group-hover:text-white">${profile.name}</p>
            </div>
        `).join('');
    }

    function renderManageProfilesList() {
        const container = document.getElementById('manage-profiles-list-container');
        let profilesHTML = profiles.map(profile => `
            <div class="relative text-center group cursor-pointer" data-action="showEditProfileView" data-item-id="${profile.id}">
                <img src="${profile.avatar}" alt="${profile.name}" class="w-24 h-24 md:w-36 md:h-36 rounded-md object-cover">
                 <div class="absolute inset-0 bg-black/60 rounded-md flex items-center justify-center">
                      <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z"></path></svg>
                 </div>
                <p class="mt-2 text-gray-400 font-medium">${profile.name}</p>
            </div>
        `).join('');

        if (profiles.length < 5) {
            profilesHTML += `
            <div class="text-center group cursor-pointer" data-action="showEditProfileView">
                <div class="w-24 h-24 md:w-36 md:h-36 rounded-md bg-gray-800 flex items-center justify-center border-4 border-transparent group-hover:border-gray-500 transition">
                       <svg class="w-12 h-12 text-gray-500 group-hover:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </div>
                <p class="mt-2 text-gray-400 font-medium">Adicionar Perfil</p>
            </div>`;
        }
        container.innerHTML = profilesHTML;
    }

    function showEditProfileView(profileId = null) {
        editingProfileId = profileId;
        const titleEl = document.getElementById('edit-profile-title');
        const nameInput = document.getElementById('profile-name-input');
        const deleteBtn = document.getElementById('delete-profile-btn');
        const kidToggle = document.getElementById('kid-profile-toggle');
        
        selectedAvatarUrl = null;
        nameInput.value = '';
        kidToggle.checked = false;
        
        if (profileId) {
            const profile = profiles.find(p => p.id === profileId);
            titleEl.textContent = 'Editar Perfil';
            nameInput.value = profile.name;
            selectedAvatarUrl = profile.avatar;
            kidToggle.checked = profile.isKid || false;
            deleteBtn.classList.remove('hidden');
        } else {
            titleEl.textContent = 'Adicionar Perfil';
            deleteBtn.classList.add('hidden');
        }
        
        renderAvatarGridForEdit(selectedAvatarUrl);
        
        document.getElementById('manage-profiles-view').classList.add('hidden');
        document.getElementById('edit-profile-view').classList.add('flex');
        document.getElementById('edit-profile-view').classList.remove('hidden');
    }

    async function handleSaveProfile() {
        const nameInput = document.getElementById('profile-name-input');
        const kidToggle = document.getElementById('kid-profile-toggle');
        const name = nameInput.value.trim();

        if (!name || !selectedAvatarUrl) {
            showToast("Por favor, insira um nome e selecione um avatar.");
            return;
        }

        if (editingProfileId) {
            const profile = profiles.find(p => p.id === editingProfileId);
            profile.name = name;
            profile.avatar = selectedAvatarUrl;
            profile.isKid = kidToggle.checked;
        } else {
            profiles.push({
                id: `p${Date.now()}`,
                name: name,
                avatar: selectedAvatarUrl,
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

        await saveProfiles();
        showManageProfilesView();
    }

    async function handleDeleteProfile() {
         if (editingProfileId) {
             profiles = profiles.filter(p => p.id !== editingProfileId);
             await saveProfiles();
             showManageProfilesView();
        }
    }

    function renderAvatarGridForEdit(currentAvatar) {
        const avatarContainer = document.getElementById('edit-avatar-grid-container');
        avatarContainer.innerHTML = '';
        avatarsFromFirestore.forEach(cat => {
            const categoryHTML = `
                <h3 class="text-xl font-bold text-white mb-4">${cat.category}</h3>
                <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                    ${cat.urls.map(url => `
                        <div class="avatar-option aspect-square rounded-lg overflow-hidden cursor-pointer transform hover:scale-105 transition-transform ring-offset-2 ring-offset-black ${url === currentAvatar ? 'selected' : ''}" data-url="${url}">
                            <img src="${url}" class="w-full h-full object-cover" loading="lazy">
                        </div>
                    `).join('')}
                </div>`;
            avatarContainer.innerHTML += categoryHTML;
        });

         document.querySelectorAll('.avatar-option').forEach(el => {
            el.addEventListener('click', (e) => {
                document.querySelectorAll('.avatar-option').forEach(innerEl => innerEl.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                selectedAvatarUrl = e.currentTarget.dataset.url;
            });
        });
    }

    // --- View Navigation & Content Filtering ---
    function getFilteredCatalog() {
        const profile = getCurrentProfile();
        if (profile && profile.isKid) {
            const allowedRatings = ['Livre', '10+', 'L', '10'];
            return catalog.filter(item => {
                const details = itemDetails[item.id];
                return details && allowedRatings.includes(details.rating);
            });
        }
        return catalog;
    }
    
    function showProfileSelectionView(show = true) {
        const view = document.getElementById('profile-selection-view');
        const manageView = document.getElementById('manage-profiles-view');
        if (show) {
            renderProfileSelection();
            view.classList.remove('hidden');
            view.classList.add('flex');
            manageView.classList.remove('flex');
            manageView.classList.add('hidden');
        } else {
            view.classList.add('hidden');
            view.classList.remove('flex');
        }
    }

    function showManageProfilesView() {
        renderManageProfilesList();
        document.getElementById('profile-selection-view').classList.add('hidden');
        document.getElementById('edit-profile-view').classList.add('hidden');
        document.getElementById('edit-profile-view').classList.remove('flex');
        document.getElementById('manage-profiles-view').classList.remove('hidden');
        document.getElementById('manage-profiles-view').classList.add('flex');
    }

    async function showView(viewName, params = {}, pushState = true) {
        if (unsubscribeComments) {
            unsubscribeComments(); // Stop listening to old comments when changing view
            unsubscribeComments = null;
        }
        commentsToShow = 5; // Reset comment limit when changing view

        if (!auth.currentUser || !currentProfileId) {
            handleLogout(); 
            return;
        }
        
        const isTransitioningPlayer = !document.getElementById('player-view').classList.contains('hidden') && viewName === 'player';

        if (!isTransitioningPlayer) {
             if (isPlayerModeActive || document.fullscreenElement) {
                await exitPlayerMode();
            }
            // Only stop playback completely if we are not transitioning episodes
            clearInterval(progressSaveInterval);
            if (hlsInstance) {
                hlsInstance.destroy();
                hlsInstance = null;
            }
            videoPlayer.src = ''; 
            iframePlayer.src = '';
        }

        hideNextEpisodeOverlay();
        
        // Reset player-specific UI only if we are NOT just changing episodes
        if (!isTransitioningPlayer) {
            document.getElementById('progress-bar').style.width = '0%';
            document.getElementById('current-time').textContent = '00:00';
            document.getElementById('duration').textContent = '00:00';
            errorDisplay.classList.add('hidden');
        }

        currentPlayingItemId = null;
        currentEpisodeData = null;
        
        allViews.forEach(id => {
            const el = document.getElementById(id);
            if(el && !['profile-selection-view', 'manage-profiles-view', 'edit-profile-view', 'login-view', 'register-view'].includes(id)) {
                 if (isTransitioningPlayer && id === 'player-view') {
                    // Do nothing, leave it visible for the new content
                } else {
                    el.classList.add('hidden');
                }
            }
        });

        window.scrollTo(0, 0);

        const appContainer = document.getElementById('app-container');
        appContainer.classList.add('pb-24', 'md:pb-0');
        
        document.querySelectorAll('#main-nav .nav-link, #mobile-nav .mobile-nav-link').forEach(link => {
            const isMainNavLink = link.classList.contains('nav-link');
            const isActive = link.dataset.viewName === viewName;

            link.classList.toggle('active', isActive);
            if (isMainNavLink) {
                link.classList.toggle('text-white', isActive);
                link.classList.toggle('text-gray-400', !isActive);
            }
        });
        

        const itemId = (typeof params === 'object') ? params.itemId : params;
        let targetViewId = `${viewName}-view`;
        if (viewName === 'player' && itemId) {
            const item = itemDetails[itemId];
            targetViewId = (item && item.playerType === 'iframe') ? 'iframe-player-view' : 'player-view';
        }

        const targetView = document.getElementById(targetViewId);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('view-transition');
        }
        
        mainHeader.style.position = (viewName === 'home') ? 'fixed' : 'absolute';
        
        if (viewName === 'home') {
            if (window.scrollY <= 50) {
                mainHeader.classList.remove('bg-black/80', 'backdrop-blur-sm');
            } else {
                mainHeader.classList.add('bg-black/80', 'backdrop-blur-sm');
            }
        } else {
            mainHeader.classList.add('bg-black/80', 'backdrop-blur-sm');
        }


        const genre = (typeof params === 'object') ? params.genre : null;
        let url = `#${viewName}`;
        if (itemId) url += `/${itemId}`;
        if (genre) url += `/${genre}`;

        if (pushState && window.location.hash !== url) {
            history.pushState({ viewName, params }, '', url);
        }
        
        if (viewName === 'home') {
            await renderHeroSection();
            renderCarousels();
        } else if (viewName === 'detail' && itemId) {
            await renderDetailPage(itemId);
        } else if (viewName === 'player' && itemId) {
            mainHeader.style.position = 'absolute';
            currentPlayingItemId = itemId;
            const item = itemDetails[itemId];
            
            let contentUrl;
            if (item.type === 'series') {
                const seasonKey = params.season || '1';
                const epIndex = params.epIndex || 0;
                const episode = item.seasons[seasonKey].episodes[epIndex];
                contentUrl = episode.url;
                currentEpisodeData = { ...episode, seasonKey, epIndex: Number(epIndex) };
            } else {
                contentUrl = item.url; // Use item.url for movies
            }
            
            if (contentUrl) {
                item.playerType === 'iframe' ? iframePlayer.src = contentUrl : initPlayer(contentUrl, itemId);
            }
        } else if (viewName === 'movies') {
            renderGenericPage('movies-view', 'Filmes', 'movie');
        } else if (viewName === 'series') {
            renderGenericPage('series-view', 'Séries', 'series');
        } else if (viewName === 'genres') {
            renderGenresPage();
        } else if (viewName === 'genre-results' && genre) {
            renderGenreResultsPage(genre);
        } else if (viewName === 'profile') {
            setupProfilePage();
        } else if (viewName === 'search') {
            renderSearchPage();
        } else if (viewName === 'pedidos') {
            renderPedidosPage();
        }
    }
    
    // --- Core App Logic & Player ---
    // Helper to generate a unique key for each episode's progress
    function getEpisodeProgressKey(itemId, seasonKey, epIndex) {
        return `${itemId}_s${seasonKey}_e${epIndex}`;
    }

    function getRatingColorClass(rating) {
        if (!rating) return '';
        const r = rating.toString().toLowerCase().replace('+', '');
        if (r === 'l' || r === 'livre') return 'rating-l';
        if (r.includes('10')) return 'rating-10';
        if (r.includes('12')) return 'rating-12';
        if (r.includes('14')) return 'rating-14';
        if (r.includes('16')) return 'rating-16';
        if (r.includes('18')) return 'rating-18';
        return 'bg-gray-600'; // Default
    }

    async function renderHeroSection() {
        const heroContainer = document.getElementById('hero-content-container');
        const heroBackdrop = document.getElementById('hero-backdrop');
        if (!heroContainer || !heroBackdrop) return;

        let heroItem = Object.values(itemDetails).find(item => item.isHero) || catalog[0];
        
        if (!heroItem) {
            heroContainer.innerHTML = `<p class="text-lg">Nenhum conteúdo em destaque encontrado.</p>`;
            return;
        }
        
        const heroDetails = itemDetails[heroItem.id];
        if(!heroDetails) return;

        heroBackdrop.src = heroDetails.backdrop;
        heroBackdrop.alt = `${heroDetails.title} background`;

        const ratingClass = getRatingColorClass(heroDetails.rating);

        heroContainer.innerHTML = `
            <h2 class="text-3xl md:text-6xl font-bold drop-shadow-lg cursor-pointer hover:text-gray-300 transition-colors" data-action="showView" data-view-name="detail" data-item-id="${heroDetails.id}">${heroDetails.title}</h2>
            <div class="flex items-center justify-center md:justify-start space-x-4 my-3 md:my-4 text-xs md:text-sm">
                <span class="font-semibold">${heroDetails.year}</span>
                <span class="rating-badge ${ratingClass}">${heroDetails.rating}</span>
                <span>${heroDetails.duration}</span>
                 <span class="bg-indigo-500 text-white font-bold px-2 py-0.5 rounded text-xs">HD</span>
            </div>
            <p class="text-sm md:text-base text-gray-300 drop-shadow-md mb-5 md:mb-6 max-w-2xl mx-auto md:mx-0">${heroDetails.synopsis}</p>
            <div class="flex items-center justify-center md:justify-start space-x-4">
                <button data-action="playContent" data-item-id="${heroDetails.id}" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 md:py-3 md:px-8 rounded-lg flex items-center space-x-2 transition text-sm md:text-base">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 md:w-6 md:h-6"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" /></svg>
                    <span>Assistir Agora</span>
                </button>
                <button id="hero-mylist-button" data-action="toggleMyList" data-item-id="${heroDetails.id}" class="bg-gray-700/50 backdrop-blur-sm hover:bg-gray-600/60 text-white font-bold py-2 px-4 md:py-3 md:px-8 rounded-lg flex items-center space-x-2 transition text-sm md:text-base"></button>
            </div>
        `;
        
        updateMyListButton(heroDetails.id, 'hero-mylist-button');
    }

    function initPlayer(url, itemId) {
        const profile = getCurrentProfile();
        let progress = null;

        if (currentEpisodeData) { // It's a series episode
            const { seasonKey, epIndex } = currentEpisodeData;
            const episodeKey = getEpisodeProgressKey(itemId, seasonKey, epIndex);
            progress = profile.watchProgress[episodeKey];
        } else { // It's a movie
            progress = profile.watchProgress[itemId];
        }
        
        videoPlayer.currentTime = 0; // Reset first
        if (progress) {
            videoPlayer.currentTime = progress.currentTime;
        }
        
        if (progressSaveInterval) clearInterval(progressSaveInterval);
        progressSaveInterval = setInterval(saveProgress, 5000);

        let finalUrl = url;
        try {
            const urlObject = new URL(url);
            if (urlObject.hostname.includes('api.anivideo.net') && urlObject.pathname.includes('videohls.php')) {
                const videoSrc = urlObject.searchParams.get('d');
                if (videoSrc) finalUrl = videoSrc;
            }
        } catch (e) { /* Ignora URLs inválidas */ }
        
        const isMobile = window.innerWidth < 768;
        if (isMobile && !document.fullscreenElement) {
            videoPlayer.addEventListener('play', enterPlayerMode, { once: true });
        }

        if (finalUrl.includes('.m3u8')) {
            if (Hls.isSupported()) {
                if (hlsInstance) hlsInstance.destroy();
                const hlsConfig = { startLevel: -1, capLevelToPlayerSize: true, maxBufferSize: 120, maxBufferLength: 30 };
                hlsInstance = new Hls(hlsConfig);
                hlsInstance.loadSource(finalUrl);
                hlsInstance.attachMedia(videoPlayer);
                hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play().catch(e => console.error("Erro de autoplay:", e)));
                hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        console.error('Erro fatal no HLS:', data);
                        showPlayerError(`Não foi possível carregar este vídeo (HLS Error: ${data.type})`);
                    }
                });
            } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                videoPlayer.src = finalUrl;
                videoPlayer.addEventListener('loadedmetadata', () => videoPlayer.play());
            } else {
                showPlayerError("Streaming HLS não é suportado neste navegador.");
            }
        } else {
            videoPlayer.src = finalUrl;
            videoPlayer.play().catch(e => console.error("Erro de autoplay:", e));
        }
        showControlsAndResetTimer();
        updateEpisodeNavButtons();
    }

    function showPlayerError(message) {
        errorDisplay.querySelector('p').textContent = message;
        errorDisplay.classList.remove('hidden');
    }

    function createCarousel(category, items) {
        const profile = getCurrentProfile();
        if (!profile) return '';
        
        const itemsHTML = items.map(item => {
            const progress = item.progressData || (item.type === 'movie' ? profile.watchProgress[item.id] : null);
            let progressPercent = 0;
            if (progress) {
                progressPercent = (progress.currentTime / progress.duration) * 100;
            }
            const action = category.title === 'Continuar a Assistir' ? 'continuePlayback' : 'showView';
            return `
            <div class="flex-shrink-0 w-40 md:w-48 group cursor-pointer" data-action="${action}" data-view-name="detail" data-item-id="${item.id}">
                <div class="relative rounded-lg overflow-hidden aspect-[2/3] bg-gray-800 transition-all duration-300 group-hover:ring-2 group-hover:ring-indigo-500">
                    <img src="${item.poster}" alt="${item.title}" class="poster-img w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div class="absolute bottom-0 left-0 p-3 w-full opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        <h3 class="font-bold text-white truncate">${item.title}</h3>
                    </div>
                    ${progressPercent > 5 && progressPercent < 95 ? `<div class="absolute bottom-0 left-0 h-1 bg-indigo-500" style="width: ${progressPercent}%"></div>` : ''}
                </div>
            </div>`
        }).join('');
        return `<div><h2 class="text-xl md:text-2xl font-bold mb-4">${category.title}</h2><div class="flex space-x-4 overflow-x-auto custom-scrollbar p-4 -mx-4">${itemsHTML}</div></div>`;
    }
    
    function renderItemsGrid(items, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = items.map(item => `
            <div class="group cursor-pointer" data-action="showView" data-view-name="detail" data-item-id="${item.id}">
                <div class="relative rounded-lg overflow-hidden aspect-[2/3] bg-gray-800 transition-all duration-300 group-hover:ring-2 group-hover:ring-indigo-500">
                    <img src="${item.poster}" alt="${item.title}" class="poster-img w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div class="absolute bottom-0 left-0 p-3 w-full opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        <h3 class="font-bold text-white truncate">${item.title}</h3>
                    </div>
                </div>
            </div>`).join('');
    }

    function renderCarousels() {
        let carouselsHTML = '';
        const profile = getCurrentProfile();
        if (!profile) return;
        const filteredCatalogForProfile = getFilteredCatalog();
        
        // 1. Continue Watching Carousel
        const continueWatchingItems = Object.values(profile.watchProgress || {})
            .filter(progress => progress.duration > 0 && (progress.currentTime / progress.duration) < 0.95)
            .sort((a, b) => b.lastUpdated - a.lastUpdated)
            .map(progress => {
                const itemId = progress.isSeries ? progress.itemId : Object.keys(profile.watchProgress).find(key => profile.watchProgress[key] === progress);
                const catalogItem = filteredCatalogForProfile.find(item => item.id === itemId);
                if (!catalogItem) return null;
                return { ...catalogItem, progressData: progress };
            })
            .filter(Boolean);
            
        const uniqueContinueWatching = continueWatchingItems.reduce((acc, current) => {
            if (!acc.find(item => item.id === current.id)) {
                acc.push(current);
            }
            return acc;
        }, []);

        if (uniqueContinueWatching.length > 0) {
            carouselsHTML += createCarousel({ title: 'Continuar a Assistir' }, uniqueContinueWatching);
        }

        // 2. Dynamic Carousels from Firestore
        const dynamicCarouselsHTML = carousels.map(carouselConfig => {
            const items = filteredCatalogForProfile.filter(catalogItem => {
                const details = itemDetails[catalogItem.id];
                return details && Array.isArray(details.carousel_ids) && details.carousel_ids.includes(carouselConfig.id);
            });
    
            if (items.length === 0) return '';
            return createCarousel({ title: carouselConfig.title }, items);
        }).join('');
        
        carouselsHTML += dynamicCarouselsHTML;
        document.getElementById('carousels-container').innerHTML = carouselsHTML;
    }
    
    function renderGenericPage(viewId, title, type) {
        const container = document.getElementById(viewId);
        const filteredCatalogForProfile = getFilteredCatalog();
        const filteredItems = filteredCatalogForProfile.filter(item => item.type === type);
        container.innerHTML = `<h2 class="text-3xl font-bold mb-8">${title}</h2><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" id="${type}-grid-container"></div>`;
        renderItemsGrid(filteredItems, `${type}-grid-container`);
    }

    async function renderDetailPage(itemId) {
        const item = itemDetails[itemId];
        const detailView = document.getElementById('detail-view');
        if (!item) { await showView('home'); return; }

        let bottomContent = '';
        if (item.type === 'series' && item.seasons) {
            const seasons = Object.keys(item.seasons);
            const seasonTabs = seasons.map(s => `<button class="season-tab border-b-2 border-transparent text-gray-400 py-2 px-4 transition" data-season="${s}" data-item-id="${itemId}">${item.seasons[s].title}</button>`).join('');
            bottomContent = `<div class="mt-8"><div class="border-b border-gray-700">${seasonTabs}</div><div id="episodes-list" class="mt-4"></div></div>`;
        }

        let castSectionHTML = '';
        let castToggleButtonHTML = '';
        if (item.cast && item.cast.length > 0) {
            const isNewFormat = typeof item.cast[0] === 'object';

            if (isNewFormat) {
                castToggleButtonHTML = `<button data-action="toggleCastVisibility" class="mt-2 text-indigo-400 font-semibold hover:text-indigo-300">Ver Elenco</button>`;
                castSectionHTML = `
                    <div id="cast-container" class="mt-10 pt-8 border-t border-gray-800 hidden">
                        <h3 class="text-2xl font-bold mb-4">Elenco Principal</h3>
                        <div class="flex space-x-4 overflow-x-auto custom-scrollbar p-4 -mx-4">
                            ${item.cast.map(actor => `
                                <div class="flex-shrink-0 w-24 text-center">
                                    <img src="${actor.photo || 'https://placehold.co/185x185/1f2937/ffffff?text=N/A'}" alt="${actor.name}" class="w-24 h-24 object-cover rounded-full mb-2 shadow-md mx-auto">
                                    <p class="font-bold text-sm text-white truncate">${actor.name}</p>
                                    <p class="text-xs text-gray-400 truncate">${actor.character}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else {
                castSectionHTML = `<div class="mt-4"><p><span class="font-semibold text-gray-400">Elenco:</span> ${item.cast.join(', ')}</p></div>`;
            }
        }
        
        const synopsis_limit = 250;
        let synopsisHTML = `<p class="mb-6 max-w-3xl mx-auto md:mx-0">${item.synopsis || ''}</p>`;
        if (item.synopsis && item.synopsis.length > synopsis_limit) {
            synopsisHTML = `
                <div class="mb-6">
                    <p id="synopsis-text" class="max-w-3xl mx-auto md:mx-0 synopsis-text synopsis-truncated">${item.synopsis}</p>
                    <button id="synopsis-toggle-btn" class="text-indigo-400 font-semibold hover:text-indigo-300 mt-2">Ver mais</button>
                </div>
            `;
        }

        const commentsSectionHTML = `
            <div class="mt-10 pt-8 border-t border-gray-800" data-item-id="${itemId}">
                <h3 class="text-2xl font-bold mb-4">Comentários</h3>
                <div class="mb-6">
                    <textarea id="comment-input" class="w-full p-3 bg-gray-800/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" rows="3" placeholder="Adicione um comentário..."></textarea>
                    <button data-action="add-comment" class="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition">Comentar</button>
                </div>
                <div class="space-y-4" id="comments-list-container"></div>
                <div id="comments-footer" class="mt-6 text-center"></div>
            </div>
        `;

        const ratingClass = getRatingColorClass(item.rating);

        detailView.innerHTML = `
            <div id="detail-background" style="background-image: url('${item.backdrop}');">
                <div class="absolute inset-0 bg-black/50 backdrop-blur-xl"></div>
                <div class="absolute inset-0 detail-backdrop-gradient"></div>
            </div>
            <div id="detail-scroll-container" class="custom-scrollbar">
                <div class="relative z-10 container mx-auto px-4 md:px-10 pt-24 pb-12">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
                         <div class="md:col-span-1 flex justify-center"><img src="${catalog.find(c => c.id == itemId)?.poster || 'https://placehold.co/400x600/a0aec0/000000?text=' + item.title.split(' ')[0]}" alt="${item.title}" class="rounded-lg shadow-2xl w-48 md:w-full md:max-w-xs mx-auto"></div>
                        <div class="md:col-span-3 text-white text-center md:text-left">
                            <h2 class="text-4xl md:text-6xl font-bold">${item.title}</h2>
                            <div class="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 my-4 text-sm text-gray-300">
                                <span>${item.year}</span> 
                                <span class="rating-badge ${ratingClass}">${item.rating}</span> 
                                <span>${item.duration}</span>
                            </div>
                            ${synopsisHTML}
                            <div class="mb-6">
                                <p><span class="font-semibold text-gray-400">Gêneros:</span> ${(item.genres || []).join(', ')}</p>
                                ${castToggleButtonHTML}
                            </div>
                            <div class="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                <button data-action="playContent" data-item-id="${itemId}" class="bg-white text-gray-900 font-bold py-3 px-8 rounded-lg flex items-center gap-2 hover:bg-gray-300 transition">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" /></svg>
                                    Assistir
                                </button>
                                ${item.trailer_url ? `<button data-action="showTrailer" data-item-id="${itemId}" class="bg-gray-700/50 backdrop-blur-sm hover:bg-gray-600/60 text-white font-bold py-3 px-8 rounded-lg">Ver Trailer</button>` : ''}
                                <button id="detail-mylist-button" data-action="toggleMyList" data-item-id="${itemId}" class="bg-gray-700/50 backdrop-blur-sm hover:bg-gray-600/60 text-white font-bold py-3 px-5 rounded-lg flex items-center space-x-2 transition"></button>
                            </div>
                            <div class="mt-6">
                                <h4 class="font-semibold text-lg mb-2">A sua classificação</h4>
                                <div id="star-rating-container" class="flex items-center justify-center md:justify-start space-x-1 text-3xl text-gray-600 cursor-pointer star-rating" data-item-id="${itemId}"></div>
                                <p class="text-sm text-gray-400 mt-2">Classificação Média: <span id="average-rating" class="font-bold"></span></p>
                            </div>
                        </div>
                    </div>
                    ${castSectionHTML}
                    ${bottomContent}
                    ${commentsSectionHTML}
                </div>
            </div>`;
        
        const synopsisToggleBtn = document.getElementById('synopsis-toggle-btn');
        if (synopsisToggleBtn) {
            synopsisToggleBtn.addEventListener('click', () => {
                const synopsisText = document.getElementById('synopsis-text');
                synopsisText.classList.toggle('synopsis-truncated');
                synopsisToggleBtn.textContent = synopsisText.classList.contains('synopsis-truncated') ? 'Ver mais' : 'Ver menos';
            });
        }


        renderStarRating(itemId);
        if (item.type === 'series' && item.seasons) {
            const profile = getCurrentProfile();
            const lastSeason = profile?.lastViewedSeason?.[itemId];
            const targetSeasonTab = lastSeason ? document.querySelector(`.season-tab[data-season='${lastSeason}']`) : null;
            
            document.querySelectorAll('.season-tab').forEach(tab => tab.addEventListener('click', handleSeasonTabClick));
            
            if (targetSeasonTab) {
                targetSeasonTab.click();
            } else {
                document.querySelector('.season-tab')?.click();
            }
        }
        updateMyListButton(itemId, 'detail-mylist-button');
        setupCommentsSection(itemId);
    }

    async function handleSeasonTabClick(event) {
        document.querySelectorAll('.season-tab').forEach(t => t.classList.remove('season-tab-active'));
        event.target.classList.add('season-tab-active');
        
        const itemId = event.target.dataset.itemId; 
        const seasonKey = event.target.dataset.season;
        const item = itemDetails[itemId];
        const episodesListEl = document.getElementById('episodes-list');
        const profile = getCurrentProfile();
    
        if (!item || !item.seasons || !item.seasons[seasonKey]) {
            episodesListEl.innerHTML = '<p class="text-gray-400">Dados da temporada não encontrados.</p>';
            return;
        }
    
        const seasonData = item.seasons[seasonKey];
        const episodes = seasonData.episodes;
    
        if (!episodes || !Array.isArray(episodes) || episodes.length === 0) {
            episodesListEl.innerHTML = '<p class="text-gray-400">Nenhum episódio encontrado para esta temporada.</p>';
            return;
        }
    
        if (profile) {
            if (!profile.lastViewedSeason) profile.lastViewedSeason = {};
            profile.lastViewedSeason[itemId] = seasonKey;
            await saveProfiles();
        }
    
        episodesListEl.classList.remove('view-transition');
        void episodesListEl.offsetWidth; 
        episodesListEl.classList.add('view-transition');
    
        episodesListEl.innerHTML = episodes.map((ep, index) => {
            const episodeKey = getEpisodeProgressKey(itemId, seasonKey, index);
            const epProgress = profile.watchProgress[episodeKey];
            let epProgressHtml = '';
            if (epProgress) {
                const percent = (epProgress.currentTime / epProgress.duration) * 100;
                if (percent > 5 && percent < 95) {
                    epProgressHtml = `<div class="absolute bottom-0 left-0 h-1 bg-indigo-500 rounded-bl-lg" style="width: ${percent}%"></div>`;
                }
            }
    
            return `
            <div class="relative p-4 bg-gray-800/50 rounded-lg mb-2 flex items-center gap-4 cursor-pointer hover:bg-gray-700/70" data-action="showView" data-view-name="player" data-item-id="${itemId}" data-season="${seasonKey}" data-ep-index="${index}">
                <div class="flex-1 min-w-0">
                    <p class="text-white truncate font-medium">${ep.title || `Episódio ${index + 1}`}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="flex-shrink-0 w-6 h-6 text-gray-400 group-hover:text-white transition-colors"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" /></svg>
                ${epProgressHtml}
            </div>`;
        }).join('');
    }
    
    async function handleRating(target) {
        const itemId = target.closest('[data-item-id]').dataset.itemId;
        const newRating = parseInt(target.dataset.value, 10);
        const profile = getCurrentProfile();
        const contentRef = doc(db, 'content', itemId);

        if (!profile || !itemId || !newRating) return;

        try {
            await runTransaction(db, async (transaction) => {
                const contentDoc = await transaction.get(contentRef);
                if (!contentDoc.exists()) {
                    throw "Document does not exist!";
                }
                
                let ratings = contentDoc.data().ratings || { total: 0, count: 0, avg: 0 };
                const oldRating = profile.userRatings?.[itemId] || 0;

                if (oldRating > 0) {
                    ratings.total -= oldRating;
                    ratings.count -= 1;
                }
                
                ratings.total += newRating;
                ratings.count += 1;
                ratings.avg = (ratings.total / ratings.count).toFixed(1);

                transaction.update(contentRef, { ratings: ratings });
                
                if (!profile.userRatings) {
                    profile.userRatings = {};
                }
                profile.userRatings[itemId] = newRating;
            });

            await saveProfiles();
            renderStarRating(itemId);
            showToast(`Avaliado com ${newRating} estrelas!`);

        } catch (error) {
            console.error("Erro ao avaliar:", error);
            showToast("Não foi possível registrar a sua avaliação.", true);
        }
    }


    function renderStarRating(itemId) {
        const container = document.getElementById('star-rating-container');
        const avgRatingEl = document.getElementById('average-rating');
        if (!container || !avgRatingEl) return;

        const item = itemDetails[itemId];
        const profile = getCurrentProfile();
        const userRating = (profile.userRatings && profile.userRatings[itemId]) || 0;

        let ratingColor = '';
        if (userRating >= 5) ratingColor = 'yellow';
        else if (userRating >= 3) ratingColor = 'orange';
        else if (userRating > 0) ratingColor = 'red';
        container.dataset.ratingColor = ratingColor;

        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('i');
            star.className = `fa-solid fa-star star transition-colors ${i <= userRating ? 'selected' : ''}`;
            star.dataset.action = 'rate';
            star.dataset.value = i;
            container.appendChild(star);
        }

        const ratings = item.ratings || { avg: 0, count: 0 };
        const avgRating = parseFloat(ratings.avg);
        avgRatingEl.textContent = `${avgRating.toFixed(1)} (${ratings.count} votos)`;

        let avgRatingColorClass = '';
        if (avgRating >= 4.5) avgRatingColorClass = 'rating-color-yellow';
        else if (avgRating >= 3.0) avgRatingColorClass = 'rating-color-orange';
        else if (avgRating > 0) avgRatingColorClass = 'rating-color-red';
        
        avgRatingEl.className = 'font-bold'; // Reset classes
        if(avgRatingColorClass) avgRatingEl.classList.add(avgRatingColorClass);
    }
    
    function setupCommentsSection(itemId) {
        if (unsubscribeComments) unsubscribeComments();

        const container = document.getElementById('comments-list-container');
        if (!container) return;

        const commentsQuery = query(collection(db, `content/${itemId}/comments`), orderBy('timestamp', 'desc'));
        
        unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
            const comments = [];
            snapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));
            renderComments(itemId, comments);
        }, (error) => {
            console.error("Erro ao buscar comentários:", error);
            container.innerHTML = '<p class="text-red-400">Não foi possível carregar os comentários.</p>';
        });
    }

    async function handleCommentAction(action, target) {
        const profile = getCurrentProfile();
        if (!profile) return;
        
        const itemId = target.closest('[data-item-id]').dataset.itemId;
        if (!itemId) return;

        if (action === 'add-comment') {
            const text = document.getElementById('comment-input').value.trim();
            if (text) {
                const newComment = {
                    profileId: profile.id,
                    name: profile.name,
                    avatar: profile.avatar,
                    text: text,
                    timestamp: serverTimestamp(),
                    likes: [],
                    replies: []
                };
                try {
                    await addDoc(collection(db, `content/${itemId}/comments`), newComment);
                    document.getElementById('comment-input').value = '';
                } catch (error) {
                    console.error("Error adding comment: ", error);
                    showToast("Erro ao enviar comentário.", true);
                }
            }
            return;
        }

        const commentId = target.closest('[data-comment-id]').dataset.commentId;
        if (!commentId) return;
        const commentRef = doc(db, `content/${itemId}/comments`, commentId);

        if (action === 'add-reply') {
            const container = target.closest('.comment-container');
            const textarea = container.querySelector('.comment-reply-form textarea');
            const text = textarea.value.trim();
            if (text) {
                const newReply = {
                    id: `r${Date.now()}`,
                    profileId: profile.id, name: profile.name, avatar: profile.avatar,
                    text: text, timestamp: new Date().toISOString(), likes: []
                };
                try {
                    await updateDoc(commentRef, { replies: arrayUnion(newReply) });
                } catch (error) { 
                    console.error("Error adding reply: ", error);
                    showToast("Erro ao enviar resposta.", true);
                }
            }
            return;
        }

        if (action === 'showReplyForm') {
            const form = target.closest('.comment-container').querySelector('.comment-reply-form');
            if (form) form.style.display = form.style.display === 'block' ? 'none' : 'block';
            return;
        }
        
        // Use a transaction for likes and deletes to ensure atomicity
        try {
            await runTransaction(db, async (transaction) => {
                const commentDoc = await transaction.get(commentRef);
                if (!commentDoc.exists()) return;
                
                let commentData = commentDoc.data();
                const replyId = target.closest('[data-reply-id]')?.dataset.replyId;

                if (action === 'like') {
                    const targetItem = replyId ? (commentData.replies || []).find(r => r.id === replyId) : commentData;
                    if (!targetItem) return;
                    
                    targetItem.likes = targetItem.likes || [];
                    const likeIndex = targetItem.likes.indexOf(profile.id);
                    
                    if (likeIndex > -1) {
                        targetItem.likes.splice(likeIndex, 1);
                    } else {
                        targetItem.likes.push(profile.id);
                    }
                } else if (action === 'delete') {
                    if (replyId) {
                        if (commentData.replies) {
                           commentData.replies = commentData.replies.filter(r => !(r.id === replyId && r.profileId === profile.id));
                        }
                    } else if (commentData.profileId === profile.id) {
                        transaction.delete(commentRef);
                        return;
                    }
                }
                transaction.update(commentRef, commentData);
            });
        } catch (error) {
            console.error("Erro na ação do comentário:", error);
            showToast("Ocorreu um erro.", true);
        }
    }
    
    function renderComments(itemId, comments) {
        const container = document.getElementById('comments-list-container');
        const footer = document.getElementById('comments-footer');
        if (!container || !footer) return;

        const profile = getCurrentProfile();
        
        container.innerHTML = '';
        footer.innerHTML = '';

        if (comments.length === 0) {
            container.innerHTML = '<p class="text-gray-400">Nenhum comentário ainda. Seja o primeiro a comentar!</p>';
            return;
        }

        const commentsToDisplay = comments.slice(0, commentsToShow);
        
        const commentsHTML = commentsToDisplay.map(comment => {
            const isLiked = (comment.likes || []).includes(profile.id);
            const isMyComment = comment.profileId === profile.id;
    
            const repliesHTML = (comment.replies || []).map(reply => {
                const isReplyLiked = (reply.likes || []).includes(profile.id);
                const isMyReply = reply.profileId === profile.id;
                return `
                    <div class="comment-reply mt-4" data-reply-id="${reply.id}">
                        <div class="flex items-start space-x-4">
                            <img src="${reply.avatar}" alt="${reply.name}" class="w-8 h-8 rounded-full object-cover">
                            <div class="flex-1">
                                <div class="flex items-center justify-between">
                                    <p class="font-bold text-white text-sm">${reply.name}</p>
                                    <p class="text-xs text-gray-500">${new Date(reply.timestamp).toLocaleString('pt-BR')}</p>
                                </div>
                                <p class="text-gray-300 mt-1 text-sm whitespace-pre-wrap break-words">${reply.text}</p>
                                <div class="flex items-center space-x-4 mt-2 text-xs">
                                    <button data-action="like" class="flex items-center space-x-1 text-gray-400 hover:text-white">
                                        <i class="${isReplyLiked ? 'fas' : 'far'} fa-heart ${isReplyLiked ? 'text-red-500' : ''}"></i>
                                        <span>${(reply.likes || []).length}</span>
                                    </button>
                                    ${isMyReply ? `<button data-action="delete" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash"></i></button>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
    
            return `
                <div class="comment-container" data-item-id="${itemId}" data-comment-id="${comment.id}">
                    <div class="flex items-start space-x-4 bg-gray-800/30 p-4 rounded-lg">
                        <img src="${comment.avatar}" alt="${comment.name}" class="w-10 h-10 rounded-full object-cover">
                        <div class="flex-1">
                            <div class="flex items-center justify-between">
                                <p class="font-bold text-white">${comment.name}</p>
                                <p class="text-xs text-gray-500">${comment.timestamp ? formatTimeAgo(comment.timestamp) : 'agora'}</p>
                            </div>
                            <p class="text-gray-300 mt-1 whitespace-pre-wrap break-words">${comment.text}</p>
                            <div class="flex items-center space-x-4 mt-2">
                                <button data-action="like" class="flex items-center space-x-1 text-gray-400 hover:text-white">
                                    <i class="${isLiked ? 'fas' : 'far'} fa-heart ${isLiked ? 'text-red-500' : ''}"></i>
                                    <span>${(comment.likes || []).length}</span>
                                </button>
                                <button data-action="showReplyForm" class="text-gray-400 hover:text-white text-sm">Responder</button>
                                ${isMyComment ? `<button data-action="delete" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="pl-14">
                        <div class="replies-container">${repliesHTML}</div>
                        <div class="comment-reply-form" style="display: none;">
                            <textarea class="w-full p-2 bg-gray-700/80 rounded-lg text-sm" rows="2" placeholder="Escreva uma resposta..."></textarea>
                            <div class="text-right mt-2">
                                <button data-action="add-reply" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-4 rounded-lg text-sm">Enviar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = commentsHTML;

        if (comments.length > commentsToShow) {
            footer.innerHTML = `<button data-action="show-more-comments" class="show-more-btn font-bold py-2 px-6 rounded-lg transition">Ver mais comentários</button>`;
        }
    }

    
    function setupProfilePage() {
        const navLinks = document.querySelectorAll('#profile-sidebar-nav .profile-nav-link');
        const sections = document.querySelectorAll('#profile-view .profile-section');
        const profile = getCurrentProfile();
        if (!profile) return;

        document.getElementById('profile-avatar-img').src = profile.avatar;
        document.getElementById('profile-name').textContent = profile.name;

        function showProfileSection(sectionId) {
            sections.forEach(sec => sec.classList.toggle('hidden', sec.id !== `profile-section-${sectionId}`));
            navLinks.forEach(link => link.classList.toggle('active', link.dataset.section === sectionId));
            if (sectionId === 'mylist') renderMyListPage();
            if (sectionId === 'playback') setupPlaybackSettings();
            if (sectionId === 'notifications') setupNotificationsSettings();
        }

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = e.currentTarget.dataset.section;
                if (sectionId) {
                    showProfileSection(sectionId);
                }
            });
        });
        showProfileSection('details');
    }

    function setupPlaybackSettings() {
        const skipTimeInput = document.getElementById('skip-time-input');
        const profile = getCurrentProfile();
        if (!profile) return;
        skipTimeInput.value = profile.skipTime || 10;
    }

    function setupNotificationsSettings() {
        const pushBtn = document.getElementById('enable-push-notifications-btn');
        const soundToggle = document.getElementById('enable-sound-toggle');
        const profile = getCurrentProfile();
        if (!profile) return;

        function updatePushUI() {
            if (!('Notification' in window)) {
                pushBtn.textContent = 'Indisponível';
                pushBtn.disabled = true;
                return;
            }
            if (Notification.permission === 'denied') {
                pushBtn.textContent = 'Bloqueado';
                pushBtn.disabled = true;
            } else if (Notification.permission === 'granted' && profile.pushEnabled) {
                pushBtn.textContent = 'Desativar';
                pushBtn.disabled = false;
            } else {
                pushBtn.textContent = 'Ativar';
                pushBtn.disabled = false;
            }
        }
        
        soundToggle.checked = profile.soundEnabled ?? true;
        updatePushUI();

        pushBtn.addEventListener('click', async () => {
            if (!('Notification' in window)) return;

            if (Notification.permission === 'granted') {
                profile.pushEnabled = !profile.pushEnabled;
                await saveProfiles();
                updatePushUI();
                showToast(`Notificações Push ${profile.pushEnabled ? 'ativadas' : 'desativadas'}.`);
            } else if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                profile.pushEnabled = (permission === 'granted');
                await saveProfiles();
                updatePushUI();
            }
        });
    }
    
    function renderMyListPage() {
        const container = document.getElementById('mylist-container');
        const noResults = document.getElementById('mylist-no-results');
        const profile = getCurrentProfile();
        const filteredCatalogForProfile = getFilteredCatalog();
        const myListItems = profile.myList.map(id => filteredCatalogForProfile.find(item => item.id == id)).filter(Boolean);

        if (myListItems.length > 0) {
            noResults.classList.add('hidden');
            container.classList.remove('hidden');
            renderItemsGrid(myListItems, 'mylist-container');
        } else {
            noResults.classList.remove('hidden');
            container.innerHTML = '';
        }
    }
    
    function renderGenresPage() {
        const genresView = document.getElementById('genres-view');
        const allGenres = [...new Set(Object.values(itemDetails).flatMap(item => item.genres || []))].sort();
        
        const genresHTML = allGenres.map(genre => `
            <div class="bg-gray-800/50 rounded-lg p-6 text-center text-xl font-bold cursor-pointer hover:bg-indigo-500/50 transition-colors" data-action="showView" data-view-name="genre-results" data-genre="${genre}">
                ${genre}
            </div>
        `).join('');

        genresView.innerHTML = `<h2 class="text-3xl font-bold mb-8">Explorar por Gênero</h2><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${genresHTML}</div>`;
    }

    function renderGenreResultsPage(genre) {
        const resultsView = document.getElementById('genre-results-view');
        const filteredCatalogForProfile = getFilteredCatalog();
        const results = filteredCatalogForProfile.filter(item => itemDetails[item.id]?.genres.includes(genre));
        
        resultsView.innerHTML = `<h2 class="text-3xl font-bold mb-8">Gênero: <span class="text-indigo-400">${genre}</span></h2><div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" id="genre-results-grid"></div>`;
        renderItemsGrid(results, 'genre-results-grid');
    }

    function renderSearchPage() {
        const input = document.getElementById('search-input');
        const resultsContainer = document.getElementById('search-results-container');
        const noResults = document.getElementById('search-no-results');
        
        input.value = '';
        resultsContainer.innerHTML = '';
        noResults.classList.add('hidden');

        input.addEventListener('input', () => {
            const query = input.value.toLowerCase().trim();
            if (query.length < 2) {
                resultsContainer.innerHTML = '';
                noResults.classList.add('hidden');
                return;
            }
            const filteredCatalogForProfile = getFilteredCatalog();
            const results = filteredCatalogForProfile.filter(item => item.title.toLowerCase().includes(query));
            if (results.length > 0) {
                renderItemsGrid(results, 'search-results-container');
                noResults.classList.add('hidden');
            } else {
                resultsContainer.innerHTML = '';
                noResults.classList.remove('hidden');
            }
        });
        input.focus();
    }

    async function playContent(itemId) {
        const item = itemDetails[itemId];
        const profile = getCurrentProfile();
        if (item.type === 'movie') {
            await showView('player', { itemId });
        } else if (item.type === 'series' && item.seasons) {
            const lastProgress = Object.values(profile.watchProgress || {})
                .filter(p => p.isSeries && p.itemId === itemId)
                .sort((a, b) => b.lastUpdated - a.lastUpdated)[0];
            
            if (lastProgress) {
                 await showView('player', { itemId, season: lastProgress.season, epIndex: lastProgress.epIndex });
            } else {
                await showView('player', { itemId, season: '1', epIndex: 0 });
            }
        }
    }
    
    async function saveProgress() {
        const profile = getCurrentProfile();
        if (!profile || !currentPlayingItemId || !videoPlayer.duration || videoPlayer.paused) return;
    
        let progressKey = currentPlayingItemId;
        let progressData = {
            currentTime: videoPlayer.currentTime,
            duration: videoPlayer.duration,
            lastUpdated: Date.now()
        };
    
        if (currentEpisodeData) {
            const { seasonKey, epIndex } = currentEpisodeData;
            progressKey = getEpisodeProgressKey(currentPlayingItemId, seasonKey, epIndex);
            progressData.isSeries = true;
            progressData.itemId = currentPlayingItemId;
            progressData.season = seasonKey;
            progressData.epIndex = epIndex;
        }
        
        if (!profile.watchProgress) profile.watchProgress = {};
        profile.watchProgress[progressKey] = progressData;
        await saveProfiles();
    }

    async function toggleMyList(itemId) {
        const profile = getCurrentProfile();
        if (!profile) return;
        const index = profile.myList.indexOf(itemId);
        if (index > -1) {
            profile.myList.splice(index, 1);
            showToast("Removido da sua lista");
        } else {
            profile.myList.push(itemId);
            showToast("Adicionado à sua lista");
        }
        await saveProfiles();
    
        updateMyListButton(itemId, 'detail-mylist-button');
        const heroItem = Object.values(itemDetails).find(item => item.isHero);
        if (heroItem && heroItem.id === itemId) {
            updateMyListButton(itemId, 'hero-mylist-button');
        }
    }

    function updateMyListButton(itemId, elementId) {
        const button = document.getElementById(elementId);
        if (!button) return;
        const profile = getCurrentProfile();
        if(!profile) return;
        const isInList = profile.myList.includes(String(itemId));
        if (isInList) {
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clip-rule="evenodd" /></svg><span>Na Minha Lista</span>`;
        } else {
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg><span>A Minha Lista</span>`;
        }
    }
    
    function showToast(message) {
        const toast = document.getElementById('toast-notification');
        const toastMessage = document.getElementById('toast-message');
        toastMessage.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // ===============================================
    // =========== PEDIDOS / REQUESTS V1 =============
    // ===============================================

    function renderPedidosPage() {
        const view = document.getElementById('pedidos-view');
        view.innerHTML = `
            <h2 class="text-3xl font-bold mb-4">Pedidos de Conteúdo</h2>
            <p class="text-gray-400 mb-8">Não encontrou o que procurava? Pesquise e solicite um novo filme ou série.</p>
            
            <div class="relative mb-8">
                <input type="text" id="tmdb-search-input" placeholder="Pesquisar por filme ou série..." class="w-full p-4 pl-12 bg-gray-800/50 rounded-lg text-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <svg class="w-6 h-6 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            </div>

            <div id="tmdb-search-results" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-12"></div>
            
            <div class="border-t border-gray-700 pt-8">
                <h3 class="text-2xl font-bold mb-6">Pedidos em Aberto</h3>
                <div id="pending-requests-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <p class="text-gray-500">A carregar pedidos...</p>
                </div>
            </div>
        `;

        document.getElementById('tmdb-search-input').addEventListener('input', (e) => {
            clearTimeout(tmdbSearchTimeout);
            const query = e.target.value;
            if (query.length > 2) {
                tmdbSearchTimeout = setTimeout(() => searchTMDB(query), 500);
            } else {
                document.getElementById('tmdb-search-results').innerHTML = '';
            }
        });
        
        setupPedidosListener();
    }

    async function searchTMDB(query) {
        if (!TMDB_API_KEY || TMDB_API_KEY === 'YOUR_TMDB_API_KEY_HERE') {
            showToast("A chave da API TMDB não foi configurada.");
            return;
        }
        const url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(query)}`;
        const resultsContainer = document.getElementById('tmdb-search-results');
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            const validResults = data.results.filter(r => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path);
            
            if (validResults.length === 0) {
                 resultsContainer.innerHTML = `<p class="col-span-full text-center text-gray-400">Nenhum resultado encontrado na base de dados.</p>`;
                 return;
            }

            resultsContainer.innerHTML = validResults.map(item => {
                const title = item.title || item.name;
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                return `
                    <div class="group cursor-pointer" data-action="handleTMDBSelect" data-tmdb-id="${item.id}" data-media-type="${item.media_type}">
                        <div class="relative rounded-lg overflow-hidden aspect-[2/3] bg-gray-800 transition-all duration-300 group-hover:ring-2 group-hover:ring-indigo-500">
                            <img src="${TMDB_IMG_URL}${item.poster_path}" alt="${title}" class="w-full h-full object-cover">
                        </div>
                        <h4 class="font-bold mt-2 truncate">${title}</h4>
                        <p class="text-sm text-gray-400">${year}</p>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error("Erro ao pesquisar no TMDB:", error);
            resultsContainer.innerHTML = `<p class="col-span-full text-center text-red-400">Erro ao conectar com a base de dados.</p>`;
        }
    }
    
    function setupPedidosListener() {
        if (unsubscribePedidos) unsubscribePedidos();

        const q = query(collection(db, "pedidos"), where("status", "==", "pending"));
        unsubscribePedidos = onSnapshot(q, (querySnapshot) => {
            const pendingRequests = [];
            querySnapshot.forEach((doc) => {
                pendingRequests.push({ id: doc.id, ...doc.data() });
            });
            renderPendingRequests(pendingRequests);
        }, (error) => {
            console.error("Erro ao escutar pedidos:", error);
            document.getElementById('pending-requests-container').innerHTML = `<p class="text-red-400">Não foi possível carregar os pedidos.</p>`;
        });
    }

    function renderPendingRequests(requests) {
        const container = document.getElementById('pending-requests-container');
        const profile = getCurrentProfile();
        if (!container || !profile) return;

        if (requests.length === 0) {
            container.innerHTML = '<p class="text-gray-500 col-span-full">Ainda não há pedidos em aberto.</p>';
            return;
        }

        container.innerHTML = requests.map(req => {
            const voteCount = req.requesters?.length || 0;
            const hasVoted = req.requesters?.includes(profile.id);

            return `
                <div class="bg-gray-800/50 p-4 rounded-lg flex gap-4">
                    <img src="${req.posterUrl}" alt="${req.title}" class="w-24 h-36 object-cover rounded-md flex-shrink-0">
                    <div class="flex flex-col justify-between w-full">
                        <div>
                            <h4 class="font-bold text-lg">${req.title}</h4>
                            <p class="text-sm text-gray-400">${req.year}</p>
                        </div>
                        <div class="flex items-center justify-between mt-2">
                             <p class="text-sm font-semibold">${voteCount} ${voteCount === 1 ? 'voto' : 'votos'}</p>
                             <button 
                                 class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition disabled:bg-gray-500 disabled:cursor-not-allowed" 
                                 data-action="voteForRequest" 
                                 data-request-id="${req.id}"
                                 ${hasVoted ? 'disabled' : ''}>
                                 ${hasVoted ? 'Votado' : 'Votar'}
                             </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }


    async function handleTMDBSelect(tmdbId, mediaType) {
        // 1. Check if it already exists in our catalog
        const existingItem = catalog.find(item => String(item.tmdbId) === String(tmdbId));
        if (existingItem) {
            showToast("Este item já está disponível!");
            await showView('detail', { itemId: existingItem.id });
            return;
        }

        // 2. Check if it has already been requested
        const q = query(collection(db, "pedidos"), where("tmdbId", "==", tmdbId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            showToast("Este item já foi solicitado. Você pode votar nele abaixo.");
            return;
        }
        
        // 3. If new, request it
        if (confirm("Gostaria de solicitar este item?")) {
           await createRequest(tmdbId, mediaType);
        }
    }

    async function createRequest(tmdbId, mediaType) {
        const profile = getCurrentProfile();
        if (!profile || !TMDB_API_KEY) return;
        
        try {
            const url = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
            const response = await fetch(url);
            const data = await response.json();
            
            const newRequest = {
                tmdbId: String(data.id),
                title: data.title || data.name,
                year: (data.release_date || data.first_air_date || '').split('-')[0],
                posterUrl: `${TMDB_IMG_URL}${data.poster_path}`,
                overview: data.overview,
                mediaType: mediaType,
                requesters: [profile.id],
                status: 'pending',
                requestedAt: serverTimestamp(),
                // Store all data for the admin panel
                fullData: data
            };

            await addDoc(collection(db, "pedidos"), newRequest);
            showToast("Pedido enviado com sucesso!");
            document.getElementById('tmdb-search-results').innerHTML = '';
            document.getElementById('tmdb-search-input').value = '';

        } catch (error) {
            console.error("Erro ao criar pedido:", error);
            showToast("Não foi possível criar o pedido.", true);
        }
    }

    async function voteForRequest(requestId) {
        const profile = getCurrentProfile();
        if (!profile) return;

        const requestRef = doc(db, "pedidos", requestId);
        try {
            await updateDoc(requestRef, {
                requesters: arrayUnion(profile.id)
            });
            showToast("Voto computado!");
        } catch(error) {
            console.error("Erro ao votar:", error);
            showToast("Não foi possível registrar o seu voto.", true);
        }
    }


    // ===============================================
    // =========== PLAYER CONTROLS & UX V2 ===========
    // ===============================================

    const playerContainer = document.getElementById('player-container');
    const playerControls = document.getElementById('player-controls');
    const videoOverlay = document.getElementById('video-overlay');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const rewindBtn = document.getElementById('rewind-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const prevEpisodeBtn = document.getElementById('prev-episode-btn');
    const nextEpisodeBtn = document.getElementById('next-episode-btn');
    const volumeBtn = document.getElementById('volume-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const progressBar = document.getElementById('progress-bar');
    const progressBarContainer = document.getElementById('progress-bar-container');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const skipIntroBtn = document.getElementById('skip-intro-btn');
    const seekIndicator = document.getElementById('seek-indicator');
    const seekIndicatorIcon = seekIndicator.querySelector('svg');
    const nextEpisodeOverlay = document.getElementById('next-episode-overlay');
    const nextEpisodeTitle = document.getElementById('next-episode-title');
    const nextEpisodeCountdown = document.getElementById('next-episode-countdown');
    const playNextBtn = document.getElementById('play-next-btn');

    let controlsTimeout = null;

    const icons = {
        play: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" /></svg>`,
        pause: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Zm9 0a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" /></svg>`,
        volumeHigh: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>`,
        volumeMute: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z M17.25 9l-6 6m0-6l6 6" /></svg>`,
        forward: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg>`,
        rewind: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15l-6-6m0 0l6-6m-6 6h12a6 6 0 010 12h-3" /></svg>`,
        nextEpisode: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.81V8.688zM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.688z" /></svg>`,
        prevEpisode: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953l7.108-4.062A1.125 1.125 0 0121 8.688v8.123zM11.25 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953L9.567 7.71a1.125 1.125 0 011.683.977v8.123z" /></svg>`,
        fullscreen: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>`,
        exitFullscreen: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" /></svg>`,
    };

    playPauseBtn.innerHTML = icons.play;
    rewindBtn.innerHTML = icons.rewind;
    forwardBtn.innerHTML = icons.forward;
    volumeBtn.innerHTML = icons.volumeHigh;
    fullscreenBtn.innerHTML = icons.fullscreen;
    prevEpisodeBtn.innerHTML = icons.prevEpisode;
    nextEpisodeBtn.innerHTML = icons.nextEpisode;


    function formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    
    function skip(direction) {
        const profile = getCurrentProfile();
        const skipAmount = profile.skipTime || 10;
        const finalDuration = direction * skipAmount;
        videoPlayer.currentTime = Math.max(0, Math.min(videoPlayer.duration, videoPlayer.currentTime + finalDuration));
        showSeekIndicator(finalDuration);
    }

    function showSeekIndicator(duration) {
        seekIndicatorIcon.innerHTML = duration > 0 ? icons.forward : icons.rewind;
        seekIndicator.classList.add('show');
        setTimeout(() => seekIndicator.classList.remove('show'), 500);
    }
    
    function togglePlay() {
        videoPlayer.paused ? videoPlayer.play() : videoPlayer.pause();
    }

    function updateVolumeUI() {
        if (videoPlayer.muted || videoPlayer.volume === 0) {
            volumeBtn.innerHTML = icons.volumeMute;
            volumeSlider.value = 0;
        } else {
            volumeBtn.innerHTML = icons.volumeHigh;
            volumeSlider.value = videoPlayer.volume;
        }
    }

    function toggleMute() {
        videoPlayer.muted = !videoPlayer.muted;
        if (!videoPlayer.muted && videoPlayer.volume === 0) {
            videoPlayer.volume = lastVolume;
        }
    }

    async function toggleFullscreen() {
        if (!document.fullscreenElement) {
            await enterPlayerMode();
        } else {
            await exitPlayerMode();
        }
    }

    function showControlsAndResetTimer() {
        playerControls.classList.remove('opacity-0');
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if (!videoPlayer.paused) {
                playerControls.classList.add('opacity-0');
            }
        }, 3000);
    }
    
    function findPreviousEpisode() {
        if (!currentPlayingItemId || !currentEpisodeData) return null;
        const series = itemDetails[currentPlayingItemId];
        if (!series || !series.seasons) return null;
    
        let currentSeasonKey = currentEpisodeData.seasonKey;
        let currentEpIndex = currentEpisodeData.epIndex;
    
        if (currentEpIndex > 0) {
            // Previous episode in the same season
            return { itemId: currentPlayingItemId, season: currentSeasonKey, epIndex: currentEpIndex - 1 };
        } else {
            // Last episode of the previous season
            const seasonKeys = Object.keys(series.seasons).sort((a,b) => a - b);
            const currentSeasonIndex = seasonKeys.indexOf(currentSeasonKey);
            if (currentSeasonIndex > 0) {
                const prevSeasonKey = seasonKeys[currentSeasonIndex - 1];
                const prevSeasonEpisodes = series.seasons[prevSeasonKey].episodes;
                return { itemId: currentPlayingItemId, season: prevSeasonKey, epIndex: prevSeasonEpisodes.length - 1 };
            }
        }
        return null; // No previous episode
    }

    function updateEpisodeNavButtons() {
        if (currentEpisodeData) {
            const nextEp = findNextEpisode();
            const prevEp = findPreviousEpisode();
            
            nextEpisodeBtn.classList.toggle('hidden', !nextEp);
            prevEpisodeBtn.classList.toggle('hidden', !prevEp);
    
            nextEpisodeBtn.dataset.nextData = nextEp ? JSON.stringify(nextEp) : '';
            prevEpisodeBtn.dataset.prevData = prevEp ? JSON.stringify(prevEp) : '';
    
        } else {
            nextEpisodeBtn.classList.add('hidden');
            prevEpisodeBtn.classList.add('hidden');
        }
    }

    function findNextEpisode() {
        if (!currentPlayingItemId || !currentEpisodeData) return null;
        const series = itemDetails[currentPlayingItemId];
        if (!series || !series.seasons) return null;

        let currentSeasonKey = currentEpisodeData.seasonKey;
        let currentEpIndex = currentEpisodeData.epIndex;
        
        const currentSeasonEpisodes = series.seasons[currentSeasonKey].episodes;
        if (currentEpIndex < currentSeasonEpisodes.length - 1) {
            return { itemId: currentPlayingItemId, season: currentSeasonKey, epIndex: currentEpIndex + 1 };
        } else {
            const seasonKeys = Object.keys(series.seasons).sort((a,b) => a - b);
            const currentSeasonIndex = seasonKeys.indexOf(currentSeasonKey);
            if (currentSeasonIndex < seasonKeys.length - 1) {
                const nextSeasonKey = seasonKeys[currentSeasonIndex + 1];
                return { itemId: currentPlayingItemId, season: nextSeasonKey, epIndex: 0 };
            }
        }
        return null; // No next episode
    }

    function showNextEpisodeOverlay() {
         nextEpisodeData = findNextEpisode();
         if (!nextEpisodeData) return;

         const { itemId, season, epIndex } = nextEpisodeData;
         const nextEp = itemDetails[itemId].seasons[season].episodes[epIndex];
         nextEpisodeTitle.textContent = nextEp.title || `Episódio ${epIndex + 1}`;
         nextEpisodeOverlay.classList.remove('hidden');
         nextEpisodeOverlay.classList.add('flex');

         let countdown = 5;
         nextEpisodeCountdown.textContent = countdown;
         nextEpisodeInterval = setInterval(() => {
             countdown--;
             nextEpisodeCountdown.textContent = countdown;
             if (countdown <= 0) {
                 playNextEpisode();
             }
         }, 1000);
    }

    function hideNextEpisodeOverlay() {
        clearInterval(nextEpisodeInterval);
        nextEpisodeInterval = null;
        nextEpisodeData = null;
        nextEpisodeOverlay.classList.add('hidden');
        nextEpisodeOverlay.classList.remove('flex');
    }

    async function playNextEpisode() {
        if (nextEpisodeData) {
            const wasFullscreen = !!document.fullscreenElement;
            await showView('player', nextEpisodeData, false);
            if (wasFullscreen) {
                videoPlayer.addEventListener('loadedmetadata', enterPlayerMode, { once: true });
            }
        }
        hideNextEpisodeOverlay();
    }

    playNextBtn.addEventListener('click', playNextEpisode);

    videoPlayer.addEventListener('ended', () => {
        if (nextEpisodeData) {
            playNextEpisode();
        }
    });

    videoPlayer.addEventListener('timeupdate', () => { 
        if (videoPlayer.duration) { 
            progressBar.style.width = `${(videoPlayer.currentTime / videoPlayer.duration) * 100}%`; 
            document.getElementById('current-time').textContent = formatTime(videoPlayer.currentTime); 
        }
        if (currentEpisodeData && currentEpisodeData.intro && currentEpisodeData.intro.end > 0) {
            const { start, end } = currentEpisodeData.intro;
            const showButton = videoPlayer.currentTime > start && videoPlayer.currentTime < end;
            skipIntroBtn.classList.toggle('hidden', !showButton);
        } else {
            skipIntroBtn.classList.add('hidden');
        }
        
        const remainingTime = videoPlayer.duration - videoPlayer.currentTime;
        if (currentEpisodeData && remainingTime < 10 && remainingTime > 0 && !nextEpisodeInterval) {
            showNextEpisodeOverlay();
        } else if (currentEpisodeData && remainingTime > 10 && nextEpisodeInterval) {
            hideNextEpisodeOverlay();
        }
    });

    videoPlayer.addEventListener('loadedmetadata', () => { document.getElementById('duration').textContent = formatTime(videoPlayer.duration); });
    videoPlayer.addEventListener('play', () => { playPauseBtn.innerHTML = icons.pause; showControlsAndResetTimer(); });
    videoPlayer.addEventListener('pause', () => { playPauseBtn.innerHTML = icons.play; clearTimeout(controlsTimeout); playerControls.classList.remove('opacity-0'); });
    videoPlayer.addEventListener('volumechange', updateVolumeUI);


    playerContainer.addEventListener('mousemove', showControlsAndResetTimer);
    playerContainer.addEventListener('touchstart', showControlsAndResetTimer, { passive: true });

    playPauseBtn.addEventListener('click', togglePlay);
    rewindBtn.addEventListener('click', () => skip(-1));
    forwardBtn.addEventListener('click', () => skip(1));
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    nextEpisodeBtn.addEventListener('click', () => {
        const data = JSON.parse(nextEpisodeBtn.dataset.nextData);
        if(data) showView('player', data, false);
    });
    prevEpisodeBtn.addEventListener('click', () => {
        const data = JSON.parse(prevEpisodeBtn.dataset.prevData);
        if(data) showView('player', data, false);
    });
    
    document.addEventListener('fullscreenchange', () => {
        fullscreenBtn.innerHTML = document.fullscreenElement ? icons.exitFullscreen : icons.fullscreen;
        isPlayerModeActive = !!document.fullscreenElement;
        if (!isPlayerModeActive && screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    
        // CORREÇÃO: Força a navegação para trás ao sair da tela cheia no celular com o botão "Voltar" do sistema
        const onPlayerView = !document.getElementById('player-view').classList.contains('hidden') ||
                             !document.getElementById('iframe-player-view').classList.contains('hidden');
    
        if (!isPlayerModeActive && onPlayerView && window.location.hash.includes('player')) {
            history.back();
        }
    });

    volumeBtn.addEventListener('click', toggleMute);
    volumeSlider.addEventListener('input', (e) => {
        const newVolume = parseFloat(e.target.value);
        videoPlayer.volume = newVolume;
        videoPlayer.muted = newVolume === 0;
        if (newVolume > 0) {
            lastVolume = newVolume;
        }
    });

    progressBarContainer.addEventListener('click', (e) => {
        const rect = progressBarContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        videoPlayer.currentTime = pos * videoPlayer.duration;
    });

    skipIntroBtn.addEventListener('click', () => {
        if (currentEpisodeData && currentEpisodeData.intro) {
            videoPlayer.currentTime = currentEpisodeData.intro.end;
            skipIntroBtn.classList.add('hidden');
        }
    });

    let clickTimer = null;
    videoOverlay.addEventListener('click', (e) => {
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            const rect = videoOverlay.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX < rect.width * 0.4) skip(-1);
            else if (clickX > rect.width * 0.6) skip(1);
            else togglePlay();
        } else {
            clickTimer = setTimeout(() => {
                togglePlay();
                clickTimer = null;
            }, 250);
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('player-view').classList.contains('hidden') && document.getElementById('iframe-player-view').classList.contains('hidden')) return;

        const activeElement = document.activeElement.tagName.toLowerCase();
        if (activeElement === 'input' || activeElement === 'textarea') return;

        e.preventDefault();
        switch (e.key.toLowerCase()) {
            case ' ': togglePlay(); break;
            case 'arrowright': skip(1); break;
            case 'arrowleft': skip(-1); break;
            case 'f': toggleFullscreen(); break;
            case 'm': toggleMute(); break;
            case 'arrowup': videoPlayer.volume = Math.min(1, videoPlayer.volume + 0.1); break;
            case 'arrowdown': videoPlayer.volume = Math.max(0, videoPlayer.volume - 0.1); break;
        }
    });

    window.addEventListener('scroll', () => { 
        if(currentProfileId) {
            const isHome = !document.getElementById('home-view').classList.contains('hidden');
            mainHeader.classList.toggle('bg-black/80', window.scrollY > 50 || !isHome);
            mainHeader.classList.toggle('backdrop-blur-sm', window.scrollY > 50 || !isHome);
        }
    });

    window.addEventListener('popstate', async (event) => { 
        if (!auth.currentUser) {
            handleLogout(); 
            return;
        };
        const state = event.state || { viewName: 'home', params: {} };
        await showView(state.viewName, state.params, false);
    });
    
    // --- Authentication Logic ---
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const loadingScreen = document.getElementById('loading-screen');

    function showAuthView(view) {
        loginView.classList.toggle('hidden', view !== 'login');
        loginView.classList.toggle('flex', view === 'login');
        registerView.classList.toggle('hidden', view !== 'register');
        registerView.classList.toggle('flex', view === 'register');
    }

    onAuthStateChanged(auth, async user => {
        loadingScreen.classList.remove('opacity-0');
        loadingScreen.classList.remove('hidden');
        loadingScreen.classList.add('flex');

        detachRealtimeListeners(); 

        try {
            if (user) {
                console.log("Utilizador autenticado:", user.uid);
                await loadDataAndAttachListeners();
                profiles = await loadProfiles(user.uid);
                loginView.classList.add('hidden');
                registerView.classList.add('hidden');
                showProfileSelectionView(true);
            } else {
                console.log("Nenhum utilizador autenticado.");
                allViews.forEach(id => {
                    const el = document.getElementById(id);
                    if (el && !['login-view', 'register-view', 'loading-screen'].includes(id)) {
                         el.classList.add('hidden');
                    }
                });
                mainHeader.classList.add('hidden');
                currentProfileId = null;
                profiles = [];
                showAuthView('login');
            }
        } catch (error) {
            console.error("Erro crítico durante a inicialização:", error);
            showToast("Erro crítico ao carregar dados. Tente novamente.");
        } finally {
            // This will always run, ensuring the loading screen is hidden.
            loadingScreen.classList.add('opacity-0');
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                loadingScreen.classList.remove('flex');
            }, 500);
        }
    });

    // Event listeners for auth forms
    document.getElementById('login-btn').addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        signInWithEmailAndPassword(auth, email, password)
            .catch(error => showToast(`Erro de login: ${error.message}`));
    });
    
    document.getElementById('register-btn').addEventListener('click', () => {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        createUserWithEmailAndPassword(auth, email, password)
            .catch(error => showToast(`Erro de cadastro: ${error.message}`));
    });

    document.getElementById('google-login-btn').addEventListener('click', () => {
        signInWithPopup(auth, googleProvider)
            .catch(error => showToast(`Erro com Google: ${error.message}`));
    });
     document.getElementById('google-register-btn').addEventListener('click', () => {
        signInWithPopup(auth, googleProvider)
            .catch(error => showToast(`Erro com Google: ${error.message}`));
    });

    document.getElementById('show-register-view-btn').addEventListener('click', () => showAuthView('register'));
    document.getElementById('show-login-view-btn').addEventListener('click', () => showAuthView('login'));


    // --- Initial App Load & Event Delegation ---
    document.getElementById('manage-profiles-btn').addEventListener('click', showManageProfilesView);
    document.getElementById('done-managing-btn').addEventListener('click', () => showProfileSelectionView(true));
    document.getElementById('save-profile-btn').addEventListener('click', handleSaveProfile);
    document.getElementById('cancel-edit-btn').addEventListener('click', showManageProfilesView);
    document.getElementById('delete-profile-btn').addEventListener('click', handleDeleteProfile);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    document.getElementById('logo').addEventListener('click', async (e) => { e.preventDefault(); await showView('home'); });

    document.body.addEventListener('click', async (e) => {
        const actionTarget = e.target.closest('[data-action]');
        if (!actionTarget) return;

        const { action, viewName, itemId, genre, season, epIndex, id, contentId, linkUrl, tmdbId, mediaType, requestId } = actionTarget.dataset;

        const nonPreventActions = ['close-trailer-modal', 'handleNotificationClick', 'closeNotifications', 'dismiss-notification', 'toggleCastVisibility', 'showReplyForm', 'add-reply', 'like', 'delete', 'rate', 'show-more-comments', 'close-pedido-modal', 'cancel-pedido', 'confirm-pedido'];
        if (!nonPreventActions.includes(action)) {
             e.preventDefault();
        }
            
        let params = {};
            
        switch (action) {
            case 'showNotifications':
                notificationsPanel.classList.remove('hidden');
                setTimeout(() => notificationsPanel.classList.remove('translate-x-full'), 10);
                markNotificationsAsRead();
                break;
            case 'closeNotifications':
                notificationsPanel.classList.add('translate-x-full');
                setTimeout(() => notificationsPanel.classList.add('hidden'), 300);
                break;
            case 'handleNotificationClick':
                if (contentId) await showView('detail', { itemId: contentId });
                else if (linkUrl) window.open(linkUrl, '_blank');
                notificationsPanel.classList.add('translate-x-full');
                setTimeout(() => notificationsPanel.classList.add('hidden'), 300);
                break;
            case 'dismiss-notification': {
                e.stopPropagation();
                const profile = getCurrentProfile();
                if (!profile || !id) return;
                actionTarget.closest('.notification-item')?.remove();
                const docRef = doc(db, 'notifications', id);
                try { await updateDoc(docRef, { readBy: arrayUnion(profile.id) }); } 
                catch (error) { console.error("Erro ao dispensar notificação:", error); }
                break;
            }
            case 'toggleCastVisibility': {
                const castContainer = document.getElementById('cast-container');
                if (castContainer) {
                    castContainer.classList.toggle('hidden');
                    actionTarget.textContent = castContainer.classList.contains('hidden') ? 'Ver Elenco' : 'Ocultar Elenco';
                }
                break;
            }
            case 'selectProfile': await selectProfile(itemId); break;
            case 'showEditProfileView': showEditProfileView(itemId); break;
            case 'editCurrentProfile': showEditProfileView(currentProfileId); break;
            case 'showView':
                if (itemId) params.itemId = itemId;
                if (genre) params.genre = genre;
                if (season) params.season = season;
                if (epIndex) params.epIndex = epIndex;
                await showView(viewName, params);
                break;
            case 'playContent': await playContent(itemId); break;
            case 'continuePlayback': {
                const profile = getCurrentProfile();
                const allProgressForThisSeries = Object.values(profile.watchProgress || {})
                    .filter(p => p.isSeries && p.itemId === itemId);

                let progressToResume = null;
                if (allProgressForThisSeries.length > 0) {
                    progressToResume = allProgressForThisSeries.reduce((latest, current) => 
                        (current.lastUpdated > latest.lastUpdated) ? current : latest
                    );
                } else {
                    progressToResume = profile.watchProgress[itemId];
                }
                
                if (progressToResume && progressToResume.isSeries) {
                    await showView('player', { itemId: itemId, season: progressToResume.season, epIndex: progressToResume.epIndex });
                } else if (progressToResume) {
                    await showView('player', { itemId: itemId });
                } else {
                    await showView('detail', { itemId: itemId });
                }
                break;
            }
            case 'toggleMyList': await toggleMyList(itemId); break;
            case 'showTrailer': {
                const item = itemDetails[itemId];
                if (item && item.trailer_url) {
                    const trailerModal = document.getElementById('trailer-modal');
                    const trailerIframe = document.getElementById('trailer-iframe');
                    trailerIframe.src = item.trailer_url;
                    trailerModal.classList.remove('hidden');
                }
                break;
            }
            case 'close-trailer-modal': {
                const trailerModal = document.getElementById('trailer-modal');
                const trailerIframe = document.getElementById('trailer-iframe');
                trailerIframe.src = '';
                trailerModal.classList.add('hidden');
                break;
            }
            case 'show-more-comments': {
                commentsToShow += 5;
                const currentItemId = document.querySelector('.comment-container')?.dataset.itemId;
                if(currentItemId) {
                    const commentsQuery = query(collection(db, `content/${currentItemId}/comments`), orderBy('timestamp', 'desc'));
                    const snapshot = await getDocs(commentsQuery);
                    const comments = [];
                    snapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));
                    renderComments(currentItemId, comments);
                }
                break;
            }
            case 'handleTMDBSelect': await handleTMDBSelect(tmdbId, mediaType); break;
            case 'voteForRequest': await voteForRequest(requestId); break;
            case 'close-pedido-modal':
            case 'cancel-pedido':
                closePedidoModal();
                break;
            case 'confirm-pedido':
                await createRequest(actionTarget.dataset.tmdbId, actionTarget.dataset.mediaType);
                break;
        }
    });

    document.getElementById('detail-view').addEventListener('click', async (e) => {
        const actionTarget = e.target.closest('[data-action]');
        if (!actionTarget) return;

        const { action } = actionTarget.dataset;
        
        if (['add-comment', 'add-reply', 'like', 'delete', 'showReplyForm'].includes(action)) {
            await handleCommentAction(action, actionTarget);
        } else if (action === 'rate') {
            await handleRating(actionTarget);
        }
    });

    document.getElementById('permission-allow-btn').addEventListener('click', async () => {
        if (!('Notification' in window)) {
            showToast("Notificações não são suportadas neste navegador.", true);
            return;
        }
        const permission = await Notification.requestPermission();
        const profile = getCurrentProfile();
        if (profile) {
            profile.pushEnabled = (permission === 'granted');
            await saveProfiles();
            showToast(permission === 'granted' ? 'Notificações ativadas!' : 'As notificações não foram permitidas.');
        }
        const modal = document.getElementById('permission-modal');
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 300);
    });

    document.getElementById('permission-deny-btn').addEventListener('click', () => {
        const modal = document.getElementById('permission-modal');
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 300);
    });
    
    // One-time listeners for profile settings
    document.getElementById('skip-time-input').addEventListener('change', async (e) => {
        const profile = getCurrentProfile();
        if (!profile) return;
        let value = parseInt(e.target.value, 10);
        if (isNaN(value) || value < 5) value = 5;
        if (value > 30) value = 30;
        
        profile.skipTime = value;
        e.target.value = value;
        await saveProfiles();
        showToast(`Tempo de pulo definido para ${value} segundos.`);
    });
    
    document.getElementById('enable-sound-toggle').addEventListener('change', async (e) => {
        const profile = getCurrentProfile();
        if (!profile) return;
        profile.soundEnabled = e.target.checked;
        await saveProfiles();
        showToast(`Som de notificação ${profile.soundEnabled ? 'ativado' : 'desativado'}.`);
    });
});

