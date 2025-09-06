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
    onSnapshot,
    addDoc,
    query,
    where,
    serverTimestamp,
    updateDoc,
    arrayUnion,
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
const TMDB_API_KEY = "5954890d9e9b723ff3032f2ec429fec3";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {
    
    // --- App State ---
    let allContentData = [];
    let allCategories = [];
    let allAvatarCategories = [];
    let allNotifications = [];
    
    let profiles = [];
    let currentProfileId = null;
    let editingProfileId = null;
    let selectedAvatarUrl = null;
    let isPlayerModeActive = false;
    let notificationListener = null;

    let currentPlayingItemId = null;
    let currentEpisodeData = null;
    let nextEpisodeData = null;
    let nextEpisodeInterval = null;
    let progressSaveInterval = null;

    const allViews = [
        'home-view', 'detail-view', 'player-view', 'iframe-player-view', 
        'series-view', 'movies-view', 'channels-view', 'genres-view', 
        'genre-results-view', 'soon-view', 'requests-view', 'profile-view', 'search-view', 
        'profile-selection-view', 'manage-profiles-view', 'edit-profile-view', 
        'login-view', 'register-view'
    ];
    
    const mainHeader = document.getElementById('main-header');
    const videoPlayer = document.getElementById('video-player');
    const iframePlayer = document.getElementById('iframe-player');
    const errorDisplay = document.getElementById('player-error-display');
    let hlsInstance;
    
    // --- Initial Load ---
    async function checkMaintenanceMode() {
        try {
            const maintenanceDoc = await getDoc(doc(db, 'settings', 'maintenance'));
            if (maintenanceDoc.exists() && maintenanceDoc.data().enabled) {
                document.getElementById('maintenance-message').textContent = maintenanceDoc.data().message || 'Estamos em manutenção. Voltamos em breve!';
                document.getElementById('maintenance-view').classList.remove('hidden');
                document.getElementById('maintenance-view').classList.add('flex');
                document.getElementById('loading-screen').classList.add('hidden');
                return true;
            }
            return false;
        } catch (error) {
            console.warn("Could not check maintenance mode, proceeding.", error);
            return false;
        }
    }

    // --- Firestore Data Fetching ---
    async function fetchInitialData() {
        try {
            const contentSnapshot = await getDocs(collection(db, 'content'));
            allContentData = contentSnapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));

            const categoriesSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('order')));
            allCategories = categoriesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

            const avatarsSnapshot = await getDocs(collection(db, 'avatar_categories'));
            allAvatarCategories = avatarsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

            await renderFooter();

        } catch (error) {
            console.error("Erro ao buscar dados iniciais:", error);
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
                await screen.orientation.lock('landscape').catch(() => {});
            }
            isPlayerModeActive = true;
        } catch (err) {
            console.warn("Fullscreen/landscape mode not supported or denied by user.", err);
        }
    }

    async function exitPlayerMode() {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
        } catch (err) {
            console.warn("Error exiting fullscreen/landscape mode.", err);
        } finally {
            isPlayerModeActive = false;
        }
    }
    
    // --- Profile Management Functions ---
    function getProfilesStorageKey(uid) {
        return `actionMaxProfiles_${uid}`;
    }

    function loadProfiles(uid) {
        const profilesJson = localStorage.getItem(getProfilesStorageKey(uid));
        return profilesJson ? JSON.parse(profilesJson) : [];
    }

    function saveProfiles() {
        if (auth.currentUser) {
            localStorage.setItem(getProfilesStorageKey(auth.currentUser.uid), JSON.stringify(profiles));
        }
    }

    function getCurrentProfile() {
        return profiles.find(p => p.id === currentProfileId) || null;
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
        setupNotificationListener(auth.currentUser.uid);

        const hash = window.location.hash.slice(1);
        const [view, param1] = hash.split('/');
        let params = {};
        if(view === 'detail' || view === 'player') params.itemId = param1;
        if(view === 'genre-results') params.genre = param1;
        
        await showView(view || 'home', params, false);
    }
    
    // ... (existing profile rendering functions: renderProfileSelection, renderManageProfilesList, etc.)
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

    function renderAvatarGridForEdit(currentAvatar) {
        const avatarContainer = document.getElementById('edit-avatar-grid-container');
        avatarContainer.innerHTML = '';
        if (allAvatarCategories.length === 0) {
            avatarContainer.innerHTML = '<p class="text-center text-gray-400">Nenhum avatar disponível.</p>';
            return;
        }

        allAvatarCategories.forEach(cat => {
            const categoryHTML = `
                <h3 class="text-xl font-bold text-white mb-4">${cat.name}</h3>
                <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                    ${(cat.avatars || []).map(url => `
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
            const allowedRatings = ['Livre', '10+', '12+'];
            return allContentData.filter(item => allowedRatings.includes(item.rating));
        }
        return allContentData;
    }
    
    // ... (existing showView and other navigation functions)
    
    // --- Core App Logic & Player ---
    function renderCarousels() {
        let carouselsHTML = '';
        const profile = getCurrentProfile();
        if (!profile) return;
        const filteredCatalog = getFilteredCatalog();
        
        // Continue Watching Carousel (Logic remains similar)
        const continueWatchingItems = Object.keys(profile.watchProgress || {})
            .map(id => {
                const progress = profile.watchProgress[id];
                if (progress.duration > 0 && (progress.currentTime / progress.duration) > 0.95) return null;
                return filteredCatalog.find(item => item.id == id);
            })
            .filter(Boolean);

        if (continueWatchingItems.length > 0) {
            carouselsHTML += createCarousel({ title: 'Continuar a Assistir' }, continueWatchingItems);
        }

        // Dynamic Carousels from Firestore
        allCategories.forEach(category => {
            const items = filteredCatalog.filter(item => Array.isArray(item.tags) && item.tags.includes(category.tag));
            if (items.length > 0) {
                carouselsHTML += createCarousel(category, items);
            }
        });
        
        document.getElementById('carousels-container').innerHTML = carouselsHTML;
    }
    
    // ... (other rendering functions like renderHeroSection, renderDetailPage will be updated to use `allContentData`)
    
    // --- NEW FEATURE IMPLEMENTATIONS ---

    function setupNotificationListener(userId) {
        if (notificationListener) notificationListener(); // Unsubscribe from previous listener

        const q = query(collection(db, "notifications"), orderBy("timestamp", "desc"));
        notificationListener = onSnapshot(q, (snapshot) => {
            allNotifications = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            updateNotificationsUI(userId);
        });
    }

    function updateNotificationsUI(userId) {
        const unreadCount = allNotifications.filter(n => !n.readBy || !n.readBy.includes(userId)).length;
        const badge = document.getElementById('notifications-badge');
        const list = document.getElementById('notifications-list');

        badge.textContent = unreadCount;
        badge.classList.toggle('hidden', unreadCount === 0);

        if (allNotifications.length === 0) {
            list.innerHTML = '<p class="p-4 text-sm text-gray-400">Nenhuma notificação.</p>';
        } else {
            list.innerHTML = allNotifications.map(n => {
                const isRead = n.readBy && n.readBy.includes(userId);
                return `
                    <div class="notification-item p-3 border-b border-gray-700 cursor-pointer ${isRead ? 'opacity-60' : 'hover:bg-gray-700'}" data-id="${n.id}" data-content-id="${n.contentId || ''}" data-link-url="${n.linkUrl || ''}">
                        <p class="font-bold text-white">${n.title}</p>
                        <p class="text-sm text-gray-300">${n.message}</p>
                    </div>
                `;
            }).join('');
        }
    }
    
    async function markNotificationAsRead(notificationId, userId) {
        const notificationRef = doc(db, "notifications", notificationId);
        await updateDoc(notificationRef, { readBy: arrayUnion(userId) });
    }

    async function renderFooter() {
        const footerEl = document.getElementById('main-footer');
        try {
            const footerDoc = await getDoc(doc(db, 'settings', 'footer'));
            if (footerDoc.exists()) {
                const data = footerDoc.data();
                let linksHTML = '';
                if(data.telegramUrl) linksHTML += `<a href="${data.telegramUrl}" target="_blank" class="hover:text-indigo-400">Telegram</a> • `;
                // Add more links for terms, privacy, etc. as needed
                linksHTML += `<span>© ${new Date().getFullYear()} ActionMax</span>`;
                footerEl.innerHTML = linksHTML;
            }
        } catch (error) {
            console.error("Error fetching footer content:", error);
        }
    }

    // Add this to your main event listener or in a dedicated function
    document.getElementById('notifications-list').addEventListener('click', async (e) => {
        const item = e.target.closest('.notification-item');
        if (!item) return;

        const { id, contentId, linkUrl } = item.dataset;
        if (auth.currentUser) {
            await markNotificationAsRead(id, auth.currentUser.uid);
        }

        if (contentId) {
            await showView('detail', { itemId: contentId });
        } else if (linkUrl) {
            window.open(linkUrl, '_blank');
        }
        document.getElementById('notifications-panel').classList.add('hidden');
    });

    // Toggle notifications panel
    document.getElementById('notifications-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('notifications-panel').classList.toggle('hidden');
    });
    
    // Hide notifications panel on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#notifications-btn') && !e.target.closest('#notifications-panel')) {
            document.getElementById('notifications-panel').classList.add('hidden');
        }
    });

    // --- Authentication Logic ---
    onAuthStateChanged(auth, async user => {
        const isMaintenance = await checkMaintenanceMode();
        if (isMaintenance) return;
        
        loadingScreen.classList.remove('opacity-0');
        loadingScreen.classList.add('flex');

        if (user) {
            await fetchInitialData();
            profiles = loadProfiles(user.uid);
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('register-view').classList.add('hidden');
            showProfileSelectionView(true);
        } else {
            // Reset state for logged-out user
            allViews.forEach(id => {
                 const el = document.getElementById(id);
                 if (el && !['login-view', 'register-view', 'loading-screen', 'maintenance-view'].includes(id)) {
                      el.classList.add('hidden');
                 }
             });
            mainHeader.classList.add('hidden');
            if(notificationListener) notificationListener(); // unsubscribe
            currentProfileId = null;
            profiles = [];
            document.getElementById('login-view').classList.remove('hidden');
        }
        
        setTimeout(() => {
            loadingScreen.classList.add('opacity-0');
            setTimeout(() => loadingScreen.classList.add('hidden'), 500);
        }, 500);
    });
    
    // ... (rest of the script, including event listeners and existing functions, adapted to use the new data structures)
    // IMPORTANT: Make sure to adapt all `itemDetails[itemId]` calls to `allContentData.find(i => i.id === itemId)`
    // And adapt all carousel creation to use `allCategories` and `allContentData`.
});

