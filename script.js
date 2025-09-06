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
    orderBy
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

document.addEventListener('DOMContentLoaded', () => {
    // Data will be loaded from Firestore
    let catalog = [];
    let carousels = [];
    let itemDetails = {};

    const avatars = [
        { 
            category: 'Especial',
            urls: [
                'https://pbs.twimg.com/media/EcGdw6xXsAMkqGF?format=jpg&name=large',
                'https://pbs.twimg.com/media/EcGdw6uXgAEpGA-.jpg',
                'https://pbs.twimg.com/media/FMs8_KeWYAAtoS3.jpg',
                'https://pbs.twimg.com/media/EcGdw6xXsAANIu1?format=jpg&name=large'
            ]
        },
        {
            category: 'Padrão',
            urls: [
                'https://placehold.co/128x128/f87171/ffffff?text=A1', 'https://placehold.co/128x128/fb923c/ffffff?text=A2',
                'https://placehold.co/128x128/fbbf24/ffffff?text=A3', 'https://placehold.co/128x128/a3e635/ffffff?text=A4',
                'https://placehold.co/128x128/4ade80/ffffff?text=A5', 'https://placehold.co/128x128/34d399/ffffff?text=A6',
            ]
        }
    ];
    
    // --- App State ---
    let PROFILES_STORAGE_KEY = 'actionMaxProfiles'; // Will be updated with UID
    let profiles = [];
    let currentProfileId = null;
    let editingProfileId = null;
    let selectedAvatarUrl = null;
    let isPlayerModeActive = false;

    let currentPlayingItemId = null;
    let currentEpisodeData = null;
    let nextEpisodeData = null;
    let nextEpisodeInterval = null;
    let progressSaveInterval = null;

    const allViews = ['home-view', 'detail-view', 'player-view', 'iframe-player-view', 'series-view', 'movies-view', 'genres-view', 'genre-results-view', 'profile-view', 'search-view', 'profile-selection-view', 'manage-profiles-view', 'edit-profile-view', 'login-view', 'register-view'];
    const mainHeader = document.getElementById('main-header');
    const videoPlayer = document.getElementById('video-player');
    const iframePlayer = document.getElementById('iframe-player');
    const errorDisplay = document.getElementById('player-error-display');
    let hlsInstance;

    // --- Firestore Data Fetching ---
    async function fetchFirestoreData() {
        try {
            // Fetch content (movies/series)
            const contentSnapshot = await getDocs(collection(db, 'content'));
            const catalogData = [];
            const itemDetailsData = {};
            contentSnapshot.forEach(doc => {
                const data = { id: doc.id, ...doc.data() };
                catalogData.push({
                    id: data.id,
                    title: data.title,
                    type: data.type,
                    poster: data.poster
                });
                itemDetailsData[data.id] = data;
            });
            catalog = catalogData;
            itemDetails = itemDetailsData;

            // Fetch carousels configuration, ordered by the 'order' field
            const carouselsQuery = query(collection(db, 'carousels'), orderBy('order'));
            const carouselsSnapshot = await getDocs(carouselsQuery);
            const carouselsData = [];
            carouselsSnapshot.forEach(doc => {
                carouselsData.push({ id: doc.id, ...doc.data() });
            });
            carousels = carouselsData;

        } catch (error) {
            console.error("Erro ao buscar dados do Firestore:", error);
            showToast("Não foi possível carregar o catálogo. Tente novamente mais tarde.");
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
    
    // --- Profile Management Functions ---

    function loadProfiles(uid) {
        PROFILES_STORAGE_KEY = `actionMaxProfiles_${uid}`;
        const profilesJson = localStorage.getItem(PROFILES_STORAGE_KEY);
        return profilesJson ? JSON.parse(profilesJson) : [];
    }

    function saveProfiles() {
        localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
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

        const hash = window.location.hash.slice(1);
        const [view, param1] = hash.split('/');
        let params = {};
        if(view === 'detail' || view === 'player') params.itemId = param1;
        if(view === 'genre-results') params.genre = param1;
        
        await showView(view || 'home', params, false);
    }

    function handleLogout() {
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

    function handleSaveProfile() {
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
                comments: {}
            });
        }

        saveProfiles();
        showManageProfilesView();
    }

    function handleDeleteProfile() {
         if (editingProfileId) {
            profiles = profiles.filter(p => p.id !== editingProfileId);
            saveProfiles();
            showManageProfilesView();
        }
    }

    function renderAvatarGridForEdit(currentAvatar) {
        const avatarContainer = document.getElementById('edit-avatar-grid-container');
        avatarContainer.innerHTML = '';
         avatars.forEach(cat => {
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
        if (!auth.currentUser || !currentProfileId) {
            handleLogout(); 
            return;
        }
        clearInterval(progressSaveInterval);
        hideNextEpisodeOverlay();
        currentPlayingItemId = null;
        currentEpisodeData = null;
        
        if(isPlayerModeActive){
            await exitPlayerMode();
        }

        if (hlsInstance) {
            hlsInstance.destroy(); hlsInstance = null;
        }
        videoPlayer.src = ''; iframePlayer.src = '';
        document.getElementById('progress-bar').style.width = '0%';
        document.getElementById('current-time').textContent = '00:00';
        document.getElementById('duration').textContent = '00:00';
        errorDisplay.classList.add('hidden');
        
        allViews.forEach(id => {
            const el = document.getElementById(id);
            if(el && !['profile-selection-view', 'manage-profiles-view', 'edit-profile-view', 'login-view', 'register-view'].includes(id)) {
                el.classList.add('hidden');
            }
        });
        window.scrollTo(0, 0);

        const appContainer = document.getElementById('app-container');
        appContainer.classList.add('pb-24' , 'md:pb-0');
        
        document.querySelectorAll('#main-nav .nav-link').forEach(link => {
            link.classList.toggle('text-white', link.dataset.viewName === viewName);
            link.classList.toggle('text-gray-400', link.dataset.viewName !== viewName);
        });
        document.querySelectorAll('#mobile-nav .mobile-nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.viewName === viewName);
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
                contentUrl = item.trailer_url;
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
        }
    }
    
    // --- Core App Logic & Player ---

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

        heroContainer.innerHTML = `
            <h2 class="text-3xl md:text-6xl font-bold drop-shadow-lg">${heroDetails.title}</h2>
            <div class="flex items-center justify-center md:justify-start space-x-4 my-3 md:my-4 text-xs md:text-sm">
                <span class="font-semibold">${heroDetails.year}</span>
                <span class="border border-gray-400 text-gray-400 px-2 py-0.5 rounded text-xs">${heroDetails.rating}</span>
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
        const progress = profile.watchProgress[itemId];
        
        if (progress) {
             if (!currentEpisodeData || (currentEpisodeData.seasonKey === progress.season && currentEpisodeData.epIndex === progress.epIndex)) {
                 videoPlayer.currentTime = progress.currentTime;
             }
        }
        
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
        if (isMobile) {
            videoPlayer.addEventListener('play', enterPlayerMode, { once: true });
        }

        if (finalUrl.includes('.m3u8')) {
            if (Hls.isSupported()) {
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
    }

    function showPlayerError(message) {
        errorDisplay.querySelector('p').textContent = message;
        errorDisplay.classList.remove('hidden');
    }

    function createCarousel(category, items) {
        const profile = getCurrentProfile();
        if (!profile) return '';
        
        const itemsHTML = items.map(item => {
            const progress = profile.watchProgress[item.id];
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
        const continueWatchingItems = Object.keys(profile.watchProgress)
            .map(id => {
                const progress = profile.watchProgress[id];
                if (progress.duration > 0 && (progress.currentTime / progress.duration) > 0.95) {
                    return null;
                }
                return filteredCatalogForProfile.find(item => item.id == id);
            })
            .filter(Boolean);


        if (continueWatchingItems.length > 0) {
            carouselsHTML += createCarousel({ title: 'Continuar a Assistir' }, continueWatchingItems);
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
            const seasonTabs = seasons.map(s => `<button class="season-tab border-b-2 border-transparent text-gray-400 py-2 px-4 transition" data-season="${s}" data-itemid="${itemId}">${item.seasons[s].title}</button>`).join('');
            bottomContent = `<div class="mt-8"><div class="border-b border-gray-700">${seasonTabs}</div><div id="episodes-list" class="mt-4"></div></div>`;
        }
        
        const commentsSectionHTML = `
            <div class="mt-10 pt-8 border-t border-gray-800">
                <h3 class="text-2xl font-bold mb-4">Comentários</h3>
                <div class="mb-6">
                    <textarea id="comment-input" class="w-full p-3 bg-gray-800/50 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" rows="3" placeholder="Adicione um comentário..."></textarea>
                    <button id="add-comment-btn" class="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition">Comentar</button>
                </div>
                <div class="space-y-4" id="comments-list-container"></div>
            </div>
        `;

        detailView.innerHTML = `
            <section class="relative pt-24 pb-24 min-h-screen" style="background-image: url('${item.backdrop}'); background-size: cover; background-position: center;">
                <div class="absolute inset-0 bg-black/50 backdrop-blur-xl"></div>
                <div class="absolute inset-0 detail-backdrop-gradient"></div>
                <div class="relative z-10 container mx-auto px-4 md:px-10">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
                         <div class="md:col-span-1 flex justify-center"><img src="${catalog.find(c => c.id == itemId)?.poster || 'https://placehold.co/400x600/a0aec0/000000?text=' + item.title.split(' ')[0]}" alt="${item.title}" class="rounded-lg shadow-2xl w-48 md:w-full md:max-w-xs mx-auto"></div>
                        <div class="md:col-span-3 text-white text-center md:text-left">
                            <h2 class="text-4xl md:text-6xl font-bold">${item.title}</h2>
                            <div class="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 my-4 text-sm text-gray-300"><span>${item.year}</span> <span class="border border-gray-400 px-2 py-0.5 rounded text-xs">${item.rating}</span> <span>${item.duration}</span></div>
                            <p class="mb-6 max-w-3xl mx-auto md:mx-0">${item.synopsis}</p>
                            <div class="mb-6"><p><span class="font-semibold text-gray-400">Gêneros:</span> ${item.genres.join(', ')}</p><p><span class="font-semibold text-gray-400">Elenco:</span> ${item.cast.join(', ')}</p></div>
                            <div class="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                <button data-action="playContent" data-item-id="${itemId}" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg">Assistir</button>
                                <button id="detail-mylist-button" data-action="toggleMyList" data-item-id="${itemId}" class="bg-gray-700/50 backdrop-blur-sm hover:bg-gray-600/60 text-white font-bold py-3 px-8 rounded-lg flex items-center space-x-2 transition"></button>
                            </div>
                            <div class="mt-6">
                                <h4 class="font-semibold text-lg mb-2">A sua classificação</h4>
                                <div id="star-rating-container" class="flex items-center justify-center md:justify-start space-x-1 text-3xl text-gray-600 cursor-pointer star-rating" data-item-id="${itemId}"></div>
                                <p class="text-sm text-gray-400 mt-2">Classificação Média: <span id="average-rating" class="font-bold text-yellow-400"></span></p>
                            </div>
                        </div>
                    </div>
                    ${bottomContent}
                    ${commentsSectionHTML}
                </div>
            </section>`;

        renderStarRating(itemId);
        if (item.type === 'series' && item.seasons) {
            document.querySelectorAll('.season-tab').forEach(tab => tab.addEventListener('click', handleSeasonTabClick));
            document.querySelector('.season-tab').click();
        }
        updateMyListButton(itemId, 'detail-mylist-button');
        setupCommentsSection(itemId);
    }

    function handleSeasonTabClick(event) {
        document.querySelectorAll('.season-tab').forEach(t => t.classList.remove('season-tab-active'));
        event.target.classList.add('season-tab-active');
        
        const itemId = event.target.dataset.itemid;
        const seasonKey = event.target.dataset.season;
        const item = itemDetails[itemId];
        const episodes = item.seasons[seasonKey].episodes;
        const episodesListEl = document.getElementById('episodes-list');
        const profile = getCurrentProfile();

        episodesListEl.classList.remove('view-transition');
        void episodesListEl.offsetWidth; 
        episodesListEl.classList.add('view-transition');

        episodesListEl.innerHTML = episodes.map((ep, index) => {
            const seriesProgress = profile.watchProgress[itemId];
            let epProgressHtml = '';
            if (seriesProgress && seriesProgress.season === seasonKey && seriesProgress.epIndex === index) {
                const percent = (seriesProgress.currentTime / seriesProgress.duration) * 100;
                if (percent > 5 && percent < 95) {
                    epProgressHtml = `<div class="absolute bottom-0 left-0 h-1 bg-indigo-500 rounded-bl-lg" style="width: ${percent}%"></div>`;
                }
            }

            return `
            <div class="relative p-4 bg-gray-800/50 rounded-lg mb-2 flex items-center justify-between cursor-pointer hover:bg-gray-700/70" data-action="showView" data-view-name="player" data-item-id="${itemId}" data-season="${seasonKey}" data-ep-index="${index}">
                <p>${ep.title || `Episódio ${index + 1}`}</p>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" /></svg>
                ${epProgressHtml}
            </div>`
        }).join('');
    }
    
    function renderStarRating(itemId) {
        const container = document.getElementById('star-rating-container');
        const avgRatingEl = document.getElementById('average-rating');
        if (!container || !avgRatingEl) return;
        const item = itemDetails[itemId];
        const profile = getCurrentProfile();
        const userRating = (profile.userRatings && profile.userRatings[itemId]) || 0;

        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('i');
            star.className = `fa-solid fa-star star transition-colors ${i <= userRating ? 'selected' : ''}`;
            star.dataset.value = i;
            container.appendChild(star);
        }

        avgRatingEl.textContent = `${item.ratings.avg} (${item.ratings.count} votos)`;
    }
    
    function setupCommentsSection(itemId) {
        document.getElementById('add-comment-btn').addEventListener('click', () => {
            const commentInput = document.getElementById('comment-input');
            const text = commentInput.value.trim();
            if (text) {
                const profile = getCurrentProfile();
                if (!profile.comments) profile.comments = {};
                if (!profile.comments[itemId]) profile.comments[itemId] = [];
                
                profile.comments[itemId].unshift({
                    profileId: profile.id,
                    name: profile.name,
                    avatar: profile.avatar,
                    text: text,
                    timestamp: new Date().toISOString(),
                    likes: []
                });
                
                saveProfiles();
                renderComments(itemId);
                commentInput.value = '';
            }
        });

        document.getElementById('comments-list-container').addEventListener('click', (e) => {
             const target = e.target.closest('[data-comment-action]');
             if (target) {
                const { commentAction, itemId, commentTimestamp } = target.dataset;
                handleCommentAction(commentAction, itemId, commentTimestamp);
             }
        });

        renderComments(itemId);
    }

    function handleCommentAction(action, itemId, timestamp) {
        const profile = getCurrentProfile();
        if (!profile.comments || !profile.comments[itemId]) return;

        const commentIndex = profile.comments[itemId].findIndex(c => c.timestamp === timestamp);
        if (commentIndex === -1) return;

        if (action === 'like') {
            const comment = profile.comments[itemId][commentIndex];
            const likeIndex = comment.likes.indexOf(profile.id);
            if (likeIndex > -1) {
                comment.likes.splice(likeIndex, 1);
            } else {
                comment.likes.push(profile.id);
            }
        } else if (action === 'delete') {
            if (profile.comments[itemId][commentIndex].profileId === profile.id) {
                profile.comments[itemId].splice(commentIndex, 1);
            }
        }
        saveProfiles();
        renderComments(itemId);
    }

    function renderComments(itemId) {
        const container = document.getElementById('comments-list-container');
        if (!container) return;
        const profile = getCurrentProfile();
        const comments = (profile.comments && profile.comments[itemId]) ? profile.comments[itemId] : [];

        if (comments.length === 0) {
            container.innerHTML = '<p class="text-gray-400">Nenhum comentário ainda. Seja o primeiro a comentar!</p>';
            return;
        }

        container.innerHTML = comments.map(comment => {
            const isLiked = comment.likes.includes(profile.id);
            const isMyComment = comment.profileId === profile.id;

            return `
            <div class="flex items-start space-x-4 bg-gray-800/30 p-4 rounded-lg">
                <img src="${comment.avatar}" alt="${comment.name}" class="w-10 h-10 rounded-full object-cover">
                <div class="flex-1">
                    <div class="flex items-center justify-between">
                         <p class="font-bold text-white">${comment.name}</p>
                         <p class="text-xs text-gray-500">${new Date(comment.timestamp).toLocaleString('pt-BR')}</p>
                    </div>
                    <p class="text-gray-300 mt-1 whitespace-pre-wrap break-words">${comment.text}</p>
                    <div class="flex items-center space-x-4 mt-2">
                        <button data-comment-action="like" data-item-id="${itemId}" data-comment-timestamp="${comment.timestamp}" class="flex items-center space-x-1 text-gray-400 hover:text-white">
                            <i class="${isLiked ? 'fas' : 'far'} fa-heart ${isLiked ? 'text-red-500' : ''}"></i>
                            <span>${comment.likes.length}</span>
                        </button>
                        ${isMyComment ? `<button data-comment-action="delete" data-item-id="${itemId}" data-comment-timestamp="${comment.timestamp}" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                </div>
            </div>
        `}).join('');
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
        
        skipTimeInput.value = profile.skipTime || 10;

        skipTimeInput.addEventListener('change', (e) => {
            let value = parseInt(e.target.value, 10);
            if (isNaN(value) || value < 5) value = 5;
            if (value > 30) value = 30;
            
            profile.skipTime = value;
            e.target.value = value;
            saveProfiles();
            showToast(`Tempo de pulo definido para ${value} segundos.`);
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
        const filteredCatalogForProfile = getFilteredCatalog();
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
        if (item.type === 'movie') {
            await showView('player', { itemId });
        } else if (item.type === 'series' && item.seasons) {
            await showView('player', { itemId, season: '1', epIndex: 0 });
        }
    }
    
    function saveProgress() {
        const profile = getCurrentProfile();
        if (profile && currentPlayingItemId && videoPlayer.duration > 0 && !videoPlayer.paused) {
             let progressData = {
                 currentTime: videoPlayer.currentTime,
                 duration: videoPlayer.duration,
                 lastUpdated: Date.now()
             };
            if (currentEpisodeData) {
                progressData.isSeries = true;
                progressData.season = currentEpisodeData.seasonKey;
                progressData.epIndex = currentEpisodeData.epIndex;
            }
            profile.watchProgress[currentPlayingItemId] = progressData;
            saveProfiles();
        }
    }

    function toggleMyList(itemId) {
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
        saveProfiles();
        updateMyListButton(itemId, 'detail-mylist-button');
        // updateMyListButton(11, 'hero-mylist-button'); // This should be dynamic
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
    // =========== PLAYER CONTROLS & UX V2 ===========
    // ===============================================

    const playerContainer = document.getElementById('player-container');
    const playerControls = document.getElementById('player-controls');
    const videoOverlay = document.getElementById('video-overlay');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const rewindBtn = document.getElementById('rewind-btn');
    const forwardBtn = document.getElementById('forward-btn');
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
        volumeMute: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6.375a1.125 1.125 0 0 1 1.125-1.125h3.375c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125H9.75a1.125 1.125 0 0 1-1.125-1.125V9.75Z" /></svg>`,
        forward: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg>`,
        rewind: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15l-6-6m0 0l6-6m-6 6h12a6 6 0 010 12h-3" /></svg>`,
        fullscreen: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>`,
        exitFullscreen: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" /></svg>`,
    };

    playPauseBtn.innerHTML = icons.play;
    rewindBtn.innerHTML = icons.rewind;
    forwardBtn.innerHTML = icons.forward;
    volumeBtn.innerHTML = icons.volumeHigh;
    fullscreenBtn.innerHTML = icons.fullscreen;

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

    function updateVolume(newVolume, updateSlider = true) {
        videoPlayer.muted = false;
        if (newVolume <= 0) {
            videoPlayer.volume = 0;
            volumeBtn.innerHTML = icons.volumeMute;
        } else {
            videoPlayer.volume = newVolume;
            volumeBtn.innerHTML = icons.volumeHigh;
        }
        if(updateSlider) volumeSlider.value = videoPlayer.volume;
    }

    function toggleMute() {
        videoPlayer.muted = !videoPlayer.muted;
        if (videoPlayer.muted) {
            volumeBtn.innerHTML = icons.volumeMute;
            volumeSlider.value = 0;
        } else {
            updateVolume(videoPlayer.volume || 1);
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
            await showView('player', nextEpisodeData);
        }
        hideNextEpisodeOverlay();
    }

    playNextBtn.addEventListener('click', playNextEpisode);

    videoPlayer.addEventListener('timeupdate', () => { 
        if (videoPlayer.duration) { 
            progressBar.style.width = `${(videoPlayer.currentTime / videoPlayer.duration) * 100}%`; 
            document.getElementById('current-time').textContent = formatTime(videoPlayer.currentTime); 
        }
        if (currentEpisodeData && currentEpisodeData.intro) {
            const { start, end } = currentEpisodeData.intro;
            skipIntroBtn.classList.toggle('hidden', !(videoPlayer.currentTime > start && videoPlayer.currentTime < end));
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

    playerContainer.addEventListener('mousemove', showControlsAndResetTimer);
    playerContainer.addEventListener('touchstart', showControlsAndResetTimer, { passive: true });

    playPauseBtn.addEventListener('click', togglePlay);
    rewindBtn.addEventListener('click', () => skip(-1));
    forwardBtn.addEventListener('click', () => skip(1));
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    document.addEventListener('fullscreenchange', () => {
         fullscreenBtn.innerHTML = document.fullscreenElement ? icons.exitFullscreen : icons.fullscreen;
         isPlayerModeActive = !!document.fullscreenElement;
         if (!isPlayerModeActive && screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
         }
    });

    volumeBtn.addEventListener('click', toggleMute);
    volumeSlider.addEventListener('input', (e) => updateVolume(parseFloat(e.target.value), false));

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
            case 'arrowup': updateVolume(Math.min(1, videoPlayer.volume + 0.1)); break;
            case 'arrowdown': updateVolume(Math.max(0, videoPlayer.volume - 0.1)); break;
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
        if (isPlayerModeActive || document.fullscreenElement) {
            await exitPlayerMode();
        }
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

        if (user) {
            console.log("Utilizador autenticado:", user.uid);
            await fetchFirestoreData();
            profiles = loadProfiles(user.uid);
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

        loadingScreen.classList.add('opacity-0');
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            loadingScreen.classList.remove('flex');
        }, 500);
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
        if (actionTarget) {
            e.preventDefault();
            const { action, viewName, itemId, genre, season, epIndex } = actionTarget.dataset;
            let params = {};
            
            switch (action) {
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
                    const progress = profile.watchProgress[itemId];
                    if (progress) {
                        if (progress.isSeries) {
                            await showView('player', { itemId: itemId, season: progress.season, epIndex: progress.epIndex });
                        } else {
                            await showView('player', { itemId: itemId });
                        }
                    } else {
                        await showView('detail', { itemId: itemId });
                    }
                    break;
                }
                case 'toggleMyList': toggleMyList(itemId); break;
            }
        }
    });

    document.getElementById('detail-view').addEventListener('click', (e) => {
         const star = e.target.closest('.star');
         if(star) {
            const container = star.parentElement;
            const itemId = container.dataset.itemId;
            const rating = parseInt(star.dataset.value, 10);
            const currentProfile = getCurrentProfile();

            if (!currentProfile.userRatings) currentProfile.userRatings = {};
            currentProfile.userRatings[itemId] = rating;
            saveProfiles();

            const stars = container.querySelectorAll('.star');
            stars.forEach(s => {
                s.classList.toggle('selected', s.dataset.value <= rating);
            });
         }
    });

});

