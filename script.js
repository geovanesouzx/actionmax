// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut, 
    updateProfile 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    writeBatch,
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    updateDoc,
    arrayUnion,
    arrayRemove,
    getDocs,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
 apiKey: "AIzaSyDf_AyxRX9d2JuVHvk3kScSb7bH8v5Bh-k",
 authDomain: "action-max.firebaseapp.com",
 projectId: "action-max",
 storageBucket: "action-max.appspot.com",
 messagingSenderId: "183609340889",
 appId: "1:183609340889:web:f32fc8e32d95461a1f5fc8"
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const loadingScreen = document.getElementById('loading-screen');
    const appWrapper = document.getElementById('app-wrapper');
    const authWrapper = document.getElementById('auth-wrapper');
    const playerContainer = document.getElementById('player-container');
    const playerPage = document.getElementById('player-page');
    const nextEpisodeOverlay = document.getElementById('next-episode-overlay');
    const playNextBtn = document.getElementById('play-next-btn');
    const cancelNextBtn = document.getElementById('cancel-next-btn');
    const nextEpisodeCountdown = document.getElementById('next-episode-countdown');
    const pageContents = document.querySelectorAll('.page-content');
    const mobileNav = document.getElementById('mobile-nav');
    const mainHeader = document.getElementById('main-header');
    const heroSection = document.getElementById('hero-section');
    const homeCarousels = document.getElementById('home-carousels');
    const continueWatchingContainer = document.getElementById('continue-watching-container');
    const seasonSelector = document.getElementById('season-selector');
    const episodesList = document.getElementById('episodes-list');
    const seasonsSection = document.getElementById('seasons-section');
    const authPages = document.querySelectorAll('.auth-page');
    const authNavButtons = document.querySelectorAll('.auth-nav-btn');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const signOutBtnProfile = document.getElementById('sign-out-btn-profile');
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    const searchBtn = document.getElementById('search-btn');
    const searchModalOverlay = document.getElementById('search-modal-overlay');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const searchNoResults = document.getElementById('search-no-results');
    const notificationBtn = document.getElementById('notification-btn');
    const notificationBadge = document.getElementById('notification-badge');
    const notificationModalOverlay = document.getElementById('notification-modal-overlay');
    const notificationModal = document.getElementById('notification-modal');
    const notificationList = document.getElementById('notification-list');
    const closeNotificationBtn = document.getElementById('close-notification-btn');
    const detailsAddListBtn = document.getElementById('details-add-list-btn');
    const detailsWatchBtn = document.getElementById('details-watch-btn');
    const detailsTrailerBtn = document.getElementById('details-trailer-btn');
    const myListContainer = document.getElementById('my-list-container');
    const myListEmptyMsg = document.getElementById('my-list-empty');
    const changePhotoBtn = document.getElementById('change-photo-btn');
    const avatarCategoryContainer = document.getElementById('avatar-category-container');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileAvatarLarge = document.getElementById('profile-avatar-large');
    const avatarBackBtn = document.getElementById('avatar-back-btn');
    const changeUsernameBtn = document.getElementById('change-username-btn');
    const usernameModalOverlay = document.getElementById('username-modal-overlay');
    const usernameModal = document.getElementById('username-modal');
    const closeUsernameBtn = document.getElementById('close-username-btn');
    const usernameForm = document.getElementById('username-form');
    const genresDropdown = document.getElementById('genres-dropdown');
    const mobileGenresBtn = document.getElementById('mobile-genres-btn');
    const genresModalOverlay = document.getElementById('genres-modal-overlay');
    const genresModal = document.getElementById('genres-modal');
    const closeGenresBtn = document.getElementById('close-genres-btn');
    const mobileGenresContainer = document.getElementById('mobile-genres-container');
    const commentForm = document.getElementById('comment-form');
    const commentsContainer = document.getElementById('comments-container');
    const commentAvatar = document.getElementById('comment-avatar');
    const userRatingStars = document.getElementById('user-rating-stars');
    const averageRatingEl = document.getElementById('average-rating');
    const genreResultsContainer = document.getElementById('genre-results-container');
    const filmesContainer = document.getElementById('filmes-container');
    const seriesContainer = document.getElementById('series-container');
    const aovivoContainer = document.getElementById('aovivo-container');
    const embreveContainer = document.getElementById('embreve-container');
    const upcomingEpisodesSection = document.getElementById('upcoming-episodes-section');
    const upcomingEpisodesList = document.getElementById('upcoming-episodes-list');
    const profileGate = document.getElementById('profile-gate');
    const profileGateTitle = document.getElementById('profile-gate-title');
    const profilesList = document.getElementById('profiles-list');
    const profileGateActions = document.getElementById('profile-gate-actions');
    const manageProfilesBtn = document.getElementById('manage-profiles-btn');
    const changeProfileBtn = document.getElementById('change-profile-btn');


    // --- Estado da Aplicação ---
    let currentProfile = null;
    let myList = [];
    let watchHistory = {};
    let currentDetailsData = null;
    let lastPageId = 'inicio-page';
    let unsubscribeComments = null;
    let allContent = [];
    let allCategories = [];
    let allNotifications = [];
    let currentPlaying = { season: null, episode: null, nextEpisodeInfo: null, contentId: null };
    let nextEpisodeInterval = null;
    let watchProgressInterval = null;
    let lastSelectedSeason = {}; // Objeto para memorizar a última temporada vista por série
    const markdownConverter = new showdown.Converter();
    let isManagingProfiles = false;
    let profileToEditIndex = null;

    // --- Lógica de Autenticação do Firebase ---
    onAuthStateChanged(auth, user => {
        if (user) {
            authWrapper.classList.add('hidden');
            handleUserProfileGate();
        } else {
            profileGate.classList.add('hidden');
            appWrapper.classList.add('hidden');
            authWrapper.classList.remove('hidden');
            showAuthPage('welcome-page');
            setTimeout(() => {
                loadingScreen.classList.add('opacity-0');
                loadingScreen.addEventListener('transitionend', () => loadingScreen.style.display = 'none', { once: true });
            }, 500);
        }
    });

    const showAuthPage = (pageId) => {
        authPages.forEach(page => page.classList.add('hidden'));
        document.getElementById(pageId)?.classList.remove('hidden');
    };

    authNavButtons.forEach(button => {
        button.addEventListener('click', () => showAuthPage(button.dataset.target));
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const errorEl = document.getElementById('signup-error');
        errorEl.textContent = '';

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // Após o cadastro, o onAuthStateChanged vai direcionar para a criação de perfil
        } catch (error) {
            errorEl.textContent = getFirebaseErrorMessage(error);
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            errorEl.textContent = getFirebaseErrorMessage(error);
        }
    });

    signOutBtnProfile.addEventListener('click', () => {
        currentProfile = null;
        signOut(auth);
    });


    function getFirebaseErrorMessage(error) {
        switch (error.code) {
            case 'auth/invalid-email': return 'Formato de e-mail inválido.';
            case 'auth/user-not-found':
            case 'auth/invalid-credential':
            case 'auth/wrong-password': return 'E-mail ou senha incorretos.';
            case 'auth/email-already-in-use': return 'Este e-mail já está em uso.';
            case 'auth/weak-password': return 'A senha deve ter pelo menos 6 caracteres.';
            default: return 'Ocorreu um erro. Tente novamente.';
        }
    }
    
    // --- Lógica de Perfis ---
    
    const handleUserProfileGate = async () => {
        const user = auth.currentUser;
        if (!user) return;
    
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
    
        if (docSnap.exists() && docSnap.data().profiles && docSnap.data().profiles.length > 0) {
            displayProfiles(docSnap.data().profiles);
        } else {
            // Primeiro login ou sem perfis, força a criação do primeiro
            displayProfileCreation(true);
        }
        
        profileGate.classList.remove('hidden');
        profileGate.classList.add('flex');
        loadingScreen.classList.add('opacity-0');
        loadingScreen.addEventListener('transitionend', () => loadingScreen.style.display = 'none', { once: true });
    };

    const displayProfiles = (profiles, isManaging = false) => {
        profileGateTitle.textContent = isManaging ? 'Gerir Perfis' : 'Quem está a assistir?';
        profilesList.innerHTML = '';
    
        profiles.forEach((profile, index) => {
            const profileEl = document.createElement('div');
            profileEl.className = 'profile-item text-center cursor-pointer group';
            profileEl.dataset.profileIndex = index;
    
            profileEl.innerHTML = `
                <div class="relative">
                    <img src="${profile.avatarUrl}" alt="${profile.name}" class="w-24 h-24 sm:w-36 sm:h-36 rounded-md object-cover border-4 border-transparent group-hover:border-white transition">
                    ${isManaging ? `<div class="absolute inset-0 bg-black/60 flex items-center justify-center"><i class="fas fa-pencil-alt text-3xl"></i></div>` : ''}
                </div>
                <p class="mt-2 text-gray-400 group-hover:text-white transition">${profile.name}</p>
            `;
            profilesList.appendChild(profileEl);
        });
    
        if (profiles.length < 4 && !isManaging) {
            const addProfileEl = document.createElement('div');
            addProfileEl.className = 'profile-item text-center cursor-pointer group';
            addProfileEl.id = 'add-profile-btn';
            addProfileEl.innerHTML = `
                <div class="w-24 h-24 sm:w-36 sm:h-36 rounded-md border-4 border-transparent group-hover:border-white transition bg-gray-800 flex items-center justify-center">
                    <i class="fas fa-plus text-5xl text-gray-400 group-hover:text-white"></i>
                </div>
                <p class="mt-2 text-gray-400 group-hover:text-white transition">Adicionar Perfil</p>
            `;
            profilesList.appendChild(addProfileEl);
        }
    
        manageProfilesBtn.textContent = isManaging ? 'Concluído' : 'Gerir Perfis';
        profileGateActions.classList.remove('hidden');
    };
    
    const displayProfileCreation = (isFirstProfile = false, profileToEdit = null) => {
        profileGateTitle.textContent = profileToEdit ? 'Editar Perfil' : 'Criar Perfil';
        profilesList.innerHTML = `
            <div class="flex flex-col items-center">
                <form id="profile-form" class="flex flex-col items-center gap-4">
                    <div class="relative">
                        <img id="profile-form-avatar" src="${profileToEdit?.avatarUrl || 'https://placehold.co/150x150/040714/a78bfa?text=?'}" class="w-36 h-36 rounded-md object-cover cursor-pointer">
                        <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                            <i class="fas fa-pencil-alt text-3xl"></i>
                        </div>
                    </div>
                    <input type="text" id="profile-form-name" placeholder="Nome" value="${profileToEdit?.name || ''}" required class="form-input text-center bg-gray-700 border-gray-600 rounded p-2 w-48">
                    <p id="profile-form-error" class="text-red-400 text-sm h-4"></p>
                    <div class="flex gap-4 mt-4">
                        <button type="submit" class="btn-primary py-2 px-8 rounded">Salvar</button>
                        ${!isFirstProfile ? `<button type="button" id="cancel-profile-form" class="btn-secondary py-2 px-6 rounded">Cancelar</button>` : ''}
                    </div>
                </form>
            </div>
        `;
        profileGateActions.classList.add('hidden');
    };
    
    const selectProfile = async (profileIndex) => {
        const user = auth.currentUser;
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        currentProfile = { ...docSnap.data().profiles[profileIndex], index: profileIndex };
    
        profileGate.classList.remove('flex');
        profileGate.classList.add('hidden');
        appWrapper.classList.remove('hidden');
    
        if (!appWrapper.dataset.initialized) {
            initializeAppLogic();
            appWrapper.dataset.initialized = 'true';
        } else {
            await loadProfileData();
            await renderAllPages();
        }
    };
    
    const loadProfileData = async () => {
        if (!currentProfile) return;
        
        myList = currentProfile.myList || [];
        watchHistory = currentProfile.watchHistory || {};
    
        profileAvatar.src = currentProfile.avatarUrl;
        profileAvatarLarge.src = currentProfile.avatarUrl;
        commentAvatar.src = currentProfile.avatarUrl;
        document.getElementById('profile-username').textContent = currentProfile.name;
    };
    
    const saveProfileData = async () => {
        const user = auth.currentUser;
        if (!user || currentProfile === null) return;
    
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
        const profiles = docSnap.exists() && docSnap.data().profiles ? docSnap.data().profiles : [];
        
        profiles[currentProfile.index] = {
            ...profiles[currentProfile.index],
            myList: myList,
            watchHistory: watchHistory
        };
    
        await setDoc(userDocRef, { profiles }, { merge: true });
    };

    // --- Lógica Principal da Aplicação ---
    function initializeAppLogic() {
        appWrapper.classList.remove('opacity-0');

        const initCarousel = (container) => {
            if (!container) return;
            if (container.swiper) container.swiper.destroy(true, true);
            new Swiper(container, {
                slidesPerView: 2.2, 
                spaceBetween: 16,
                mousewheel: true,
                navigation: {
                    nextEl: container.parentElement.querySelector('.swiper-button-next'),
                    prevEl: container.parentElement.querySelector('.swiper-button-prev'),
                },
                breakpoints: {
                    640: { slidesPerView: 3, spaceBetween: 16 },
                    768: { slidesPerView: 4, spaceBetween: 24 },
                    1024: { slidesPerView: 5, spaceBetween: 24 },
                    1280: { slidesPerView: 6, spaceBetween: 24 },
                },
            });
        };
        
        const initAvatarCarousel = (container) => {
            if (!container) return;
            if (container.swiper) container.swiper.destroy(true, true);
            new Swiper(container, {
                loop: true,
                slidesPerView: 'auto',
                spaceBetween: 16,
                mousewheel: true,
                navigation: {
                    nextEl: container.parentElement.querySelector('.swiper-button-next'),
                    prevEl: container.parentElement.querySelector('.swiper-button-prev'),
                },
            });
        };

        const toggleMyList = (itemData) => {
            if (!itemData) return;
            const itemIndex = myList.findIndex(item => item.id === itemData.id);
            if (itemIndex > -1) myList.splice(itemIndex, 1);
            else myList.push(itemData);
            saveProfileData();
            updateAllListButtons(itemData.id);
        };
        
        const updateAllListButtons = (itemId) => {
            const isInList = myList.some(item => item.id === itemId);
            if (currentDetailsData && currentDetailsData.id === itemId) {
                const icon = document.getElementById('details-add-list-icon');
                const text = document.getElementById('details-add-list-text');
                icon.className = isInList ? 'fas fa-check' : 'fas fa-plus';
                text.textContent = isInList ? 'Na sua lista' : 'Minha Lista';
            }
            if (heroSection.dataset.id === itemId) {
                const heroIcon = document.getElementById('hero-add-list-icon');
                const heroText = document.getElementById('hero-add-list-text');
                heroIcon.className = isInList ? 'fas fa-check' : 'fas fa-plus';
                heroText.textContent = isInList ? 'Na sua lista' : 'Minha Lista';
            }
        };

        const renderMyListPage = () => {
            if (!myListContainer) return;
            myListContainer.innerHTML = '';
            if (myList.length === 0) {
                myListEmptyMsg?.classList.remove('hidden');
                return;
            }
            myListEmptyMsg?.classList.add('hidden');
            const slidesHTML = myList.map(itemData => `<div class="swiper-slide">${createCardHTML(itemData)}</div>`).join('');
            myListContainer.innerHTML = `<div class="relative"><div class="swiper content-carousel"><div class="swiper-wrapper">${slidesHTML}</div></div><div class="swiper-button-prev -left-4 !hidden md:!flex"></div><div class="swiper-button-next -right-4 !hidden md:!flex"></div></div>`;
            initCarousel(myListContainer.querySelector('.content-carousel'));
        };

        const showPage = (pageId, pushState = true, data = null) => {
            if (unsubscribeComments) unsubscribeComments();
            const isDetailsPage = pageId === 'details-page';
            const isAvatarPage = pageId === 'avatar-page';
            const isPlayerPage = pageId === 'player-page';
            if (!isDetailsPage && !isAvatarPage && !isPlayerPage) lastPageId = pageId;
            pageContents.forEach(page => page.classList.add('hidden'));
            const targetPage = document.getElementById(pageId);
            mobileNav.classList.toggle('hidden', isDetailsPage || isAvatarPage || isPlayerPage);
            mainHeader.classList.toggle('hidden', isDetailsPage || isAvatarPage || isPlayerPage);

            const body = document.body;
            if (isPlayerPage || isDetailsPage) {
                body.classList.remove('pb-24', 'lg:pb-0');
            } else {
                body.classList.add('pb-24', 'lg:pb-0');
            }

            if (targetPage) {
                targetPage.classList.remove('hidden');
                if (isDetailsPage && data) {
                    currentDetailsData = data;
                    populateDetailsPage(data);
                    updateAllListButtons(data.id);
                    loadComments(data.id);
                    loadRatingData(data.id);
                } else if (isAvatarPage) {
                    updateSelectedAvatarVisual();
                } else if (!isPlayerPage) {
                    currentDetailsData = null;
                }
                if (pageId === 'perfil-page') renderMyListPage();
                if (pageId === 'filmes-page') renderAllMoviesPage();
                if (pageId === 'series-page') renderAllSeriesPage();
                if (pageId === 'aovivo-page') renderAoVivoPage();
                if (pageId === 'embreve-page') renderEmBrevePage();
                if (pushState) {
                    const url = data ? `#/details/${data.id}` : `#${pageId.replace('-page', '')}`;
                    history.pushState({ page: pageId, data: data }, '', url);
                }
            } else {
                document.getElementById('inicio-page')?.classList.remove('hidden');
            }
            mobileNavLinks.forEach(link => link.classList.toggle('active', link.dataset.target === pageId));
            window.scrollTo(0, 0);
        };

        const populateDetailsPage = (data) => {
            document.getElementById('details-bg-desktop').src = data.bg || '';
            document.getElementById('details-bg-mobile').src = data.bg_mobile || data.img || data.bg || '';
            document.getElementById('details-poster').src = data.img || '';
            document.getElementById('details-title').textContent = data.title || 'Título não encontrado';
            document.getElementById('details-desc').textContent = data.desc || 'Descrição não disponível.';
            document.getElementById('details-year').textContent = data.year || '';
            document.getElementById('details-duration').textContent = data.duration || '';
            document.getElementById('details-genre').textContent = Array.isArray(data.genre) ? data.genre.join(', ') : (data.genre || '');
            
            if (data.trailerSrc) {
                detailsTrailerBtn.classList.remove('hidden');
            } else {
                detailsTrailerBtn.classList.add('hidden');
            }

            if (data.type === 'Série' && data.seasons) {
                currentDetailsData.parsedSeasons = data.seasons;
                seasonsSection.classList.remove('hidden');
                const seasonKeys = Object.keys(data.seasons).sort((a,b) => a-b);
                const initialSeason = lastSelectedSeason[data.id] || seasonKeys[0];
                renderSeasonSelector(data.seasons, initialSeason);
                renderEpisodes(data.seasons, initialSeason);
            } else {
                seasonsSection.classList.add('hidden');
            }

            if (data.emBreve && typeof data.emBreve === 'object') {
                upcomingEpisodesSection.classList.remove('hidden');
                renderUpcomingEpisodes(data.emBreve);
            } else {
                upcomingEpisodesSection.classList.add('hidden');
            }

            renderRecommendedCarousel(data);
        };
        
        const renderSeasonSelector = (seasons, activeSeason) => {
            seasonSelector.innerHTML = '';
            Object.keys(seasons).sort((a,b) => a - b).forEach((seasonNum) => {
                const btn = document.createElement('button');
                btn.textContent = seasonNum;
                btn.className = `season-btn font-semibold py-2 px-4 rounded-lg ${seasonNum === activeSeason ? 'active' : ''}`;
                btn.dataset.season = seasonNum;
                seasonSelector.appendChild(btn);
            });
        };

        const renderEpisodes = (seasons, seasonNum) => {
            episodesList.innerHTML = '';
            const episodes = seasons[seasonNum];
            Object.keys(episodes).sort((a,b) => a - b).forEach(epNum => {
                const episodeData = episodes[epNum];
                const videoSrc = (typeof episodeData === 'string') ? episodeData : episodeData.src;
                const episodeTitle = (typeof episodeData === 'object' && episodeData.title) ? episodeData.title : '';

                const epCard = document.createElement('div');
                epCard.className = 'episode-card bg-gray-800/50 rounded-lg p-3 text-center cursor-pointer flex flex-col justify-center items-center';
                epCard.dataset.videoSrc = videoSrc;
                epCard.dataset.episode = epNum;
                epCard.innerHTML = `
                    <i class="fas fa-play-circle text-3xl mb-2 text-violet-300"></i>
                    <p class="font-semibold text-sm">Episódio ${epNum}</p>
                    <p class="text-xs text-gray-400 text-center mt-1 w-full truncate" title="${episodeTitle}">${episodeTitle}</p>
                `;
                episodesList.appendChild(epCard);
            });
        };

        const renderUpcomingEpisodes = (upcomingData) => {
            upcomingEpisodesList.innerHTML = '';
            Object.entries(upcomingData).forEach(([epNum, epInfo]) => {
                const item = document.createElement('div');
                item.className = 'bg-gray-800/50 rounded-lg p-3 flex justify-between items-center';
                item.innerHTML = `
                    <p class="font-semibold">Episódio ${epNum}: ${epInfo.title || ''}</p>
                    <p class="text-sm text-gray-400">${epInfo.releaseDate || ''}</p>
                `;
                upcomingEpisodesList.appendChild(item);
            });
        };

        const findNextEpisode = (seasonNum, epNum) => {
            if (!seasonNum || !epNum || !currentDetailsData?.parsedSeasons) return null;
            const seasons = currentDetailsData.parsedSeasons;
            const seasonKeys = Object.keys(seasons).sort((a, b) => a - b);
            const currentSeasonIndex = seasonKeys.indexOf(String(seasonNum));
            
            const episodeKeys = Object.keys(seasons[seasonNum]).sort((a, b) => a - b);
            const currentEpisodeIndex = episodeKeys.indexOf(String(epNum));

            if (currentEpisodeIndex > -1 && currentEpisodeIndex < episodeKeys.length - 1) {
                const nextEpNum = episodeKeys[currentEpisodeIndex + 1];
                return { src: seasons[seasonNum][nextEpNum], season: seasonNum, episode: nextEpNum };
            } else if (currentSeasonIndex > -1 && currentSeasonIndex < seasonKeys.length - 1) {
                const nextSeasonNum = seasonKeys[currentSeasonIndex + 1];
                const nextSeasonEpisodeKeys = Object.keys(seasons[nextSeasonNum]).sort((a, b) => a - b);
                if(nextSeasonEpisodeKeys.length > 0) {
                    const nextEpNum = nextSeasonEpisodeKeys[0];
                    return { src: seasons[nextSeasonNum][nextEpNum], season: nextSeasonNum, episode: nextEpNum };
                }
            }
            return null;
        };

        const handleVideoEnd = () => {
            if (currentPlaying.nextEpisodeInfo) {
                nextEpisodeOverlay.classList.remove('hidden');
                nextEpisodeOverlay.classList.add('flex');
                let countdown = 5;
                nextEpisodeCountdown.textContent = `Próximo episódio em ${countdown}...`;
                nextEpisodeInterval = setInterval(() => {
                    countdown--;
                    nextEpisodeCountdown.textContent = `Próximo episódio em ${countdown}...`;
                    if (countdown <= 0) {
                        clearInterval(nextEpisodeInterval);
                        playNextBtn.click();
                    }
                }, 1000);
                nextEpisodeOverlay.dataset.intervalId = nextEpisodeInterval;
            } else if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        };

        const getYoutubeEmbedUrl = (url) => {
            let videoId;
            const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/;
            const match = url.match(youtubeRegex);
            if (match) {
                videoId = match[1];
                return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
            }
            return null;
        };

        const playContent = (src, seasonNum = null, epNum = null) => {
            playerContainer.innerHTML = '';
            if (!src) return;

            clearInterval(watchProgressInterval);

            currentPlaying = {
                season: seasonNum,
                episode: epNum,
                nextEpisodeInfo: findNextEpisode(seasonNum, epNum),
                contentId: currentDetailsData.id
            };

            const isVideoFile = src.endsWith('.mp4') || src.endsWith('.m3u8');
            const youtubeEmbedUrl = getYoutubeEmbedUrl(src);

            if (src.trim().startsWith('<iframe')) {
                playerContainer.innerHTML = src;
            } else if (youtubeEmbedUrl) {
                playerContainer.innerHTML = `<iframe src="${youtubeEmbedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else if (isVideoFile) {
                const videoEl = document.createElement('video');
                videoEl.className = 'w-full h-full';
                videoEl.controls = true;
                videoEl.autoplay = true;
                videoEl.controlsList = "nodownload";
                videoEl.innerHTML = `<source src="${src}" type="video/mp4">Seu navegador não suporta o elemento de vídeo.`;
                
                videoEl.addEventListener('loadedmetadata', () => {
                    const progress = watchHistory[currentPlaying.contentId];
                    if (progress && progress.currentTime) {
                        videoEl.currentTime = progress.currentTime;
                    }
                });

                videoEl.addEventListener('ended', handleVideoEnd);
                playerContainer.appendChild(videoEl);

                watchProgressInterval = setInterval(() => {
                    if (!videoEl.paused) {
                        updateWatchHistory(currentPlaying.contentId, videoEl.currentTime, videoEl.duration);
                    }
                }, 10000); // Salva a cada 10 segundos
            } else if (src.trim().startsWith('http')) {
                // Fallback para outros links, tentando usar um iframe
                playerContainer.innerHTML = `<iframe src="${src}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else {
                playerContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center"><p class="text-white">Formato de vídeo não suportado.</p></div>`;
            }

            showPage('player-page', true, currentDetailsData);
            if (window.innerWidth < 768) {
                playerPage.requestFullscreen?.();
                screen.orientation?.lock('landscape').catch(err => console.log("Falha ao travar orientação:", err));
            }
        };

        playNextBtn.addEventListener('click', () => {
            clearInterval(nextEpisodeOverlay.dataset.intervalId);
            nextEpisodeOverlay.classList.add('hidden');
            nextEpisodeOverlay.classList.remove('flex');
            const next = currentPlaying.nextEpisodeInfo;
            if (next) playContent(next.src, next.season, next.episode);
        });

        cancelNextBtn.addEventListener('click', () => {
            clearInterval(nextEpisodeOverlay.dataset.intervalId);
            nextEpisodeOverlay.classList.add('hidden');
            nextEpisodeOverlay.classList.remove('flex');
            if (document.fullscreenElement) document.exitFullscreen();
        });

        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                screen.orientation?.unlock();
            }
        });
        
        const openModal = (overlay, modal) => {
            overlay.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
                modal?.classList.remove('opacity-0', 'scale-95');
            }, 10);
        };

        const closeModal = (overlay, modal) => {
            overlay.classList.add('opacity-0');
            modal?.classList.add('opacity-0', 'scale-95');
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 300);
        };

        const handleSearch = (e) => {
            const query = e.target.value.toLowerCase().trim();
            searchResultsContainer.innerHTML = '';
            if (query.length < 2) {
                searchNoResults.classList.add('hidden');
                return;
            }
            const matchingContent = allContent.filter(item => item.title.toLowerCase().includes(query));
            if (matchingContent.length > 0) {
                searchNoResults.classList.add('hidden');
                const slidesHTML = matchingContent.map(itemData => `<div class="swiper-slide">${createCardHTML(itemData)}</div>`).join('');
                searchResultsContainer.innerHTML = `<div class="relative"><div class="swiper content-carousel"><div class="swiper-wrapper">${slidesHTML}</div></div><div class="swiper-button-prev -left-4 !hidden md:!flex"></div><div class="swiper-button-next -right-4 !hidden md:!flex"></div></div>`;
                initCarousel(searchResultsContainer.querySelector('.content-carousel'));
            } else {
                searchNoResults.classList.remove('hidden');
            }
        };

        const updateSelectedAvatarVisual = () => {
            const currentAvatarSrc = profileAvatarLarge.src;
            avatarCategoryContainer.querySelectorAll('.avatar-option').forEach(option => {
                option.classList.toggle('selected', option.src === currentAvatarSrc)
            });
        };

        const loadAvatars = async () => {
            const q = query(collection(db, 'avatar_categories'), orderBy('order'));
            onSnapshot(q, async (catSnapshot) => {
                avatarCategoryContainer.innerHTML = '';
                const categories = catSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                for (const cat of categories) {
                    const catDiv = document.createElement('div');
                    const avatarQuery = query(collection(db, "avatars"), where("category", "==", cat.id));
                    const avatarSnapshot = await getDocs(avatarQuery);
                    
                    const avatars = [];
                    avatarSnapshot.forEach(doc => {
                        avatars.push(doc.data());
                    });
                    avatars.sort((a, b) => (a.order || 0) - (b.order || 0));

                    const slidesHTML = avatars.map(avatar => {
                        return `
                            <div class="swiper-slide !w-24 !h-24 sm:!w-32 sm:!h-32">
                                <img src="${avatar.url}" alt="Avatar" class="avatar-option w-full h-full rounded-full object-cover cursor-pointer border-4 border-transparent" onerror="this.onerror=null;this.src='https://placehold.co/160x160/cccccc/000000?text=Error';">
                            </div>
                        `;
                    }).join('');

                    catDiv.innerHTML = `
                        <h3 class="text-2xl font-bold mb-4">${cat.name}</h3>
                        <div class="relative">
                            <div class="swiper avatar-carousel">
                                <div class="swiper-wrapper">${slidesHTML}</div>
                            </div>
                            <div class="swiper-button-prev -left-4 !hidden md:!flex"></div>
                            <div class="swiper-button-next -right-4 !hidden md:!flex"></div>
                        </div>
                    `;
                    avatarCategoryContainer.appendChild(catDiv);
                    initAvatarCarousel(catDiv.querySelector('.avatar-carousel'));
                }
                updateSelectedAvatarVisual();
            });
        };

        const loadAvatar = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                const userDocRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(userDocRef);
                const defaultAvatar = `https://placehold.co/150x150/040714/a78bfa?text=${user.displayName.charAt(0).toUpperCase()}`;
                const savedAvatar = (docSnap.exists() && docSnap.data().avatarUrl) ? docSnap.data().avatarUrl : defaultAvatar;
                
                profileAvatar.src = savedAvatar;
                profileAvatarLarge.src = savedAvatar;
                commentAvatar.src = savedAvatar;
            } catch (error) {
                console.error("Error loading avatar:", error);
            }
        };

        const selectAvatar = async (e) => {
            const newAvatarUrl = e.target.src;
            profileAvatar.src = newAvatarUrl;
            profileAvatarLarge.src = newAvatarUrl;
            commentAvatar.src = newAvatarUrl;
            updateSelectedAvatarVisual();
            const user = auth.currentUser;
            if(user) await setDoc(doc(db, 'users', user.uid), { avatarUrl: newAvatarUrl }, { merge: true });
            setTimeout(() => history.back(), 200);
        };

        usernameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newUsernameInput = document.getElementById('new-username-input');
            const newUsername = newUsernameInput.value.trim();
            const errorEl = document.getElementById('username-error');
            const currentUser = auth.currentUser;
            errorEl.textContent = '';
            if (newUsername === currentUser.displayName) {
                errorEl.textContent = "Este já é o seu nome de usuário.";
                return;
            }
            const usernameDocRef = doc(db, "usernames", newUsername.toLowerCase());
            const usernameDoc = await getDoc(usernameDocRef);
            if (usernameDoc.exists()) {
                errorEl.textContent = "Este nome de usuário já está em uso.";
                return;
            }
            try {
                const oldUsername = currentUser.displayName;
                const batch = writeBatch(db);
                const oldDocRef = doc(db, "usernames", oldUsername.toLowerCase());
                batch.delete(oldDocRef);
                batch.set(usernameDocRef, { uid: currentUser.uid });
                await batch.commit();
                await updateProfile(currentUser, { displayName: newUsername });
                document.getElementById('profile-username').textContent = newUsername;
                closeModal(usernameModalOverlay, usernameModal);
                newUsernameInput.value = '';
            } catch (error) {
                console.error("Erro ao alterar nome de usuário:", error);
                errorEl.textContent = "Não foi possível alterar o nome. Tente novamente.";
            }
        });

        const populateGenres = () => {
            const allGenres = allContent.flatMap(item => item.genre || []);
            const uniqueGenres = [...new Set(allGenres)].sort();
            
            genresDropdown.innerHTML = '';
            mobileGenresContainer.innerHTML = '';
            uniqueGenres.forEach(genre => {
                const linkHTML = `<a href="#/genre/${genre}" class="block px-4 py-2 text-sm text-gray-300 hover:bg-violet-500 hover:text-white genre-link" data-genre="${genre}">${genre}</a>`;
                genresDropdown.innerHTML += linkHTML;
                mobileGenresContainer.innerHTML += linkHTML;
            });
        };
        
        const showGenrePage = (genre) => {
            showPage('genre-page', true, {genre});
            document.getElementById('genre-title').textContent = genre;
            genreResultsContainer.innerHTML = '';
            const genreContent = allContent.filter(item => Array.isArray(item.genre) && item.genre.includes(genre));
            const contentHTML = genreContent.map(itemData => createCardHTML(itemData)).join('');
            genreResultsContainer.innerHTML = contentHTML;
        };

        document.body.addEventListener('click', (e) => {
            if (e.target.classList.contains('genre-link')) {
                e.preventDefault();
                closeModal(genresModalOverlay, genresModal);
                showGenrePage(e.target.dataset.genre);
            }
        });

        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const commentInput = document.getElementById('comment-input');
            const text = commentInput.value.trim();
            const user = auth.currentUser;
            if (text && user && currentDetailsData) {
                await addDoc(collection(db, 'comments'), {
                    contentId: currentDetailsData.id, text: text, authorName: user.displayName,
                    authorId: user.uid, authorAvatar: profileAvatar.src, createdAt: serverTimestamp(), likes: []
                });
                commentInput.value = '';
            }
        });

        const loadComments = (contentId) => {
            commentsContainer.innerHTML = '';
            const q = query(collection(db, 'comments'), where('contentId', '==', contentId));
            unsubscribeComments = onSnapshot(q, (querySnapshot) => {
                const comments = [];
                querySnapshot.forEach((doc) => comments.push({ id: doc.id, ...doc.data() }));
                comments.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
                commentsContainer.innerHTML = '';
                const currentUser = auth.currentUser;
                comments.forEach((comment) => {
                    const isLiked = (comment.likes || []).includes(currentUser.uid);
                    const isOwner = comment.authorId === currentUser.uid;
                    const commentEl = document.createElement('div');
                    commentEl.className = 'flex items-start gap-4';
                    commentEl.innerHTML = `<img src="${comment.authorAvatar}" class="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="Avatar do usuário" onerror="this.onerror=null;this.src='https://placehold.co/40x40/040714/a78bfa?text=A';"><div class="flex-grow bg-gray-800/50 p-3 rounded-lg"><div class="flex justify-between items-center"><p class="font-semibold text-white">${comment.authorName}</p>${isOwner ? `<button data-comment-id="${comment.id}" class="delete-comment-btn text-gray-500 hover:text-red-500"><i class="fas fa-trash"></i></button>` : ''}</div><p class="text-gray-300 py-2">${comment.text}</p><div class="flex items-center gap-2 text-gray-400"><button data-comment-id="${comment.id}" class="like-btn ${isLiked ? 'liked' : ''}"><i class="fas fa-heart"></i></button><span>${(comment.likes || []).length}</span></div></div>`;
                    commentsContainer.appendChild(commentEl);
                });
            });
        };
        
        const handleStarRating = async (rating) => {
            const user = auth.currentUser;
            if (user && currentDetailsData) {
                await setDoc(doc(db, "ratings", `${user.uid}_${currentDetailsData.id}`), {
                    contentId: currentDetailsData.id, userId: user.uid, rating: rating
                });
                loadRatingData(currentDetailsData.id);
            }
        };

        const loadRatingData = async (contentId) => {
            const user = auth.currentUser;
            averageRatingEl.textContent = 'N/A';
            userRatingStars.querySelectorAll('.fa-star').forEach(star => star.className = 'far fa-star');
            if (user) {
                const docSnap = await getDoc(doc(db, "ratings", `${user.uid}_${contentId}`));
                if (docSnap.exists()) {
                    const userRating = docSnap.data().rating;
                    for (let i = 0; i < userRating; i++) userRatingStars.children[i].className = 'fas fa-star selected';
                }
            }
            const q = query(collection(db, "ratings"), where("contentId", "==", contentId));
            const querySnapshot = await getDocs(q);
            let totalRating = 0, count = 0;
            querySnapshot.forEach((doc) => {
                totalRating += doc.data().rating;
                count++;
            });
            if (count > 0) averageRatingEl.textContent = (totalRating / count).toFixed(1);
        };

        userRatingStars.addEventListener('click', (e) => {
            if (e.target.matches('.fa-star')) handleStarRating(parseInt(e.target.dataset.value));
        });
        
        const listenForNotifications = () => {
            const q = query(collection(db, "notifications"));
            onSnapshot(q, (snapshot) => {
                allNotifications = [];
                snapshot.forEach(doc => allNotifications.push(doc.data()));
                allNotifications.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
                const lastChecked = localStorage.getItem('lastCheckedNotifications');
                const newNotifications = allNotifications.filter(n => !lastChecked || n.createdAt?.toDate() > new Date(lastChecked));
                if (newNotifications.length > 0) {
                    notificationBadge.textContent = newNotifications.length;
                    notificationBadge.classList.remove('hidden');
                } else {
                    notificationBadge.classList.add('hidden');
                }
            });
        };

        const renderNotifications = () => {
            notificationList.innerHTML = allNotifications.length === 0 ? `<p class="text-gray-400 text-center">Nenhuma notificação.</p>` : allNotifications.map(notif => {
                const contentLink = notif.contentId ? `data-content-id="${notif.contentId}"` : '';
                const cursorClass = notif.contentId ? 'cursor-pointer hover:bg-gray-700' : '';
                return `<div class="p-3 bg-gray-700/50 rounded-lg notification-item ${cursorClass}" ${contentLink}><p class="font-semibold">${notif.title}</p><p class="text-sm text-gray-400">${notif.message}</p></div>`;
            }).join('');
        };

        notificationList.addEventListener('click', (e) => {
            const item = e.target.closest('.notification-item');
            if(item && item.dataset.contentId) {
                const contentData = allContent.find(c => c.id === item.dataset.contentId);
                if(contentData) {
                    closeModal(notificationModalOverlay, notificationModal);
                    showPage('details-page', true, contentData);
                }
            }
        });

        navLinks.forEach(link => link.addEventListener('click', (e) => {
            const target = link.getAttribute('data-target');
            if (target) {
                e.preventDefault();
                showPage(target);
            }
        }));
        
        document.body.addEventListener('click', async (e) => {
            const card = e.target.closest('.movie-card');
            if (card && card.dataset.id) {
                e.preventDefault();
                const cardData = allContent.find(item => item.id === card.dataset.id);
                if (cardData) {
                    if (cardData.type === 'Canal') {
                        playContent(cardData.videoSrc);
                    } else {
                        if (!searchModalOverlay.classList.contains('hidden')) {
                            closeModal(searchModalOverlay);
                            setTimeout(() => showPage('details-page', true, cardData), 300);
                        } else {
                            showPage('details-page', true, cardData);
                        }
                    }
                }
            }
            const likeBtn = e.target.closest('.like-btn');
            if (likeBtn) {
                const commentId = likeBtn.dataset.commentId;
                const commentRef = doc(db, "comments", commentId);
                const user = auth.currentUser;
                await updateDoc(commentRef, { likes: likeBtn.classList.contains('liked') ? arrayRemove(user.uid) : arrayUnion(user.uid) });
            }
            const deleteBtn = e.target.closest('.delete-comment-btn');
            if (deleteBtn) {
                await deleteDoc(doc(db, "comments", deleteBtn.dataset.commentId));
            }
        });

        detailsAddListBtn?.addEventListener('click', () => toggleMyList(currentDetailsData));
        
        detailsWatchBtn?.addEventListener('click', () => {
            if (currentDetailsData) {
                if (currentDetailsData.type === 'Filme' && currentDetailsData.videoSrc) {
                    playContent(currentDetailsData.videoSrc);
                } else if (currentDetailsData.type === 'Série') {
                    const firstSeasonNum = Object.keys(currentDetailsData.parsedSeasons).sort((a,b) => a-b)[0];
                    if (firstSeasonNum) {
                        const firstEpisodeNum = Object.keys(currentDetailsData.parsedSeasons[firstSeasonNum]).sort((a,b) => a-b)[0];
                        if (firstEpisodeNum) {
                            const episodeData = currentDetailsData.parsedSeasons[firstSeasonNum][firstEpisodeNum];
                            const videoSrc = (typeof episodeData === 'string') ? episodeData : episodeData.src;
                            playContent(videoSrc, firstSeasonNum, firstEpisodeNum);
                        }
                    }
                }
            }
        });

        detailsTrailerBtn?.addEventListener('click', () => {
            if (currentDetailsData && currentDetailsData.trailerSrc) {
                playContent(currentDetailsData.trailerSrc);
            }
        });

        const heroWatchBtn = document.getElementById('hero-watch-btn');
        const heroAddListBtn = document.getElementById('hero-add-list-btn');
        const heroTitle = document.getElementById('hero-title');

        heroWatchBtn.addEventListener('click', () => {
            const heroData = allContent.find(item => item.id === heroSection.dataset.id);
            if (heroData) playContent(heroData.videoSrc);
        });
        heroAddListBtn.addEventListener('click', () => {
             const heroData = allContent.find(item => item.id === heroSection.dataset.id);
             if(heroData) toggleMyList(heroData);
        });
        heroTitle.addEventListener('click', () => {
            const heroData = allContent.find(item => item.id === heroSection.dataset.id);
            if(heroData) showPage('details-page', true, heroData);
        });

        searchBtn?.addEventListener('click', () => openModal(searchModalOverlay));
        closeSearchBtn?.addEventListener('click', () => closeModal(searchModalOverlay));
        searchInput?.addEventListener('input', handleSearch);
        searchModalOverlay?.addEventListener('click', (e) => { if (e.target === searchModalOverlay) closeModal(searchModalOverlay); });
        notificationBtn?.addEventListener('click', () => {
            renderNotifications();
            openModal(notificationModalOverlay, notificationModal);
            notificationBadge.classList.add('hidden');
            localStorage.setItem('lastCheckedNotifications', new Date().toISOString());
        });
        closeNotificationBtn?.addEventListener('click', () => closeModal(notificationModalOverlay, notificationModal));
        notificationModalOverlay?.addEventListener('click', (e) => { if (e.target === notificationModalOverlay) closeModal(notificationModalOverlay, notificationModal); });
        changePhotoBtn?.addEventListener('click', () => showPage('avatar-page'));
        avatarBackBtn?.addEventListener('click', (e) => { e.preventDefault(); history.back(); });
        avatarCategoryContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('avatar-option')) {
                selectAvatar(e);
            }
        });
        changeUsernameBtn.addEventListener('click', () => openModal(usernameModalOverlay, usernameModal));
        closeUsernameBtn.addEventListener('click', () => closeModal(usernameModalOverlay, usernameModal));
        usernameModalOverlay.addEventListener('click', (e) => { if (e.target === usernameModalOverlay) closeModal(usernameModalOverlay, usernameModal); });
        mobileGenresBtn.addEventListener('click', () => openModal(genresModalOverlay, genresModal));
        closeGenresBtn.addEventListener('click', () => closeModal(genresModalOverlay, genresModal));
        genresModalOverlay.addEventListener('click', (e) => { if (e.target === genresModalOverlay) closeModal(genresModalOverlay, genresModal); });

        seasonSelector.addEventListener('click', (e) => {
            if (e.target.matches('.season-btn')) {
                const seasonNum = e.target.dataset.season;
                if (currentDetailsData) {
                    lastSelectedSeason[currentDetailsData.id] = seasonNum;
                }
                document.querySelectorAll('.season-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                renderEpisodes(currentDetailsData.parsedSeasons, seasonNum);
            }
        });

        episodesList.addEventListener('click', (e) => {
            const epCard = e.target.closest('.episode-card');
            if (epCard) {
                const activeSeasonBtn = seasonSelector.querySelector('.season-btn.active');
                playContent(epCard.dataset.videoSrc, activeSeasonBtn.dataset.season, epCard.dataset.episode);
            }
        });

        window.addEventListener('popstate', (e) => {
            playerContainer.innerHTML = ''; // Limpa o player ao voltar
            clearInterval(watchProgressInterval);
            if (document.fullscreenElement) document.exitFullscreen();
            if (e.state && e.state.page) showPage(e.state.page, false, e.state.data);
            else showPage(lastPageId || 'inicio-page', false);
        });

        const createCardHTML = (data, progress = null) => {
            const progressHTML = progress ? `
                <div class="absolute bottom-0 left-0 w-full h-1.5 bg-gray-500/50">
                    <div class="h-full bg-violet-500" style="width: ${progress}%;"></div>
                </div>
            ` : '';
            return `
                <div class="movie-card rounded-lg overflow-hidden relative" data-id="${data.id}">
                    <img src="${data.img}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://placehold.co/240x360/cccccc/000000?text=Image';">
                    ${progressHTML}
                </div>
            `;
        };
        
        const renderRecommendedCarousel = (currentItem) => {
            const recommendedContainer = document.getElementById('recommended-section');
            recommendedContainer.innerHTML = '';

            if (!currentItem || !currentItem.genre || currentItem.genre.length === 0) {
                return;
            }

            const primaryGenre = currentItem.genre[0];
            let recommendations = allContent.filter(item =>
                item.id !== currentItem.id &&
                item.genre &&
                item.genre.includes(primaryGenre)
            );

            recommendations.sort(() => 0.5 - Math.random());
            recommendations = recommendations.slice(0, 15);

            if (recommendations.length > 0) {
                const slidesHTML = recommendations.map(itemData => `<div class="swiper-slide">${createCardHTML(itemData)}</div>`).join('');
                const carouselHTML = `
                    <h2 class="text-2xl font-bold text-white mb-6">Recomendados para Si</h2>
                    <div class="relative">
                        <div class="swiper content-carousel">
                            <div class="swiper-wrapper">${slidesHTML}</div>
                        </div>
                        <div class="swiper-button-prev -left-4 !hidden md:!flex"></div>
                        <div class="swiper-button-next -right-4 !hidden md:!flex"></div>
                    </div>
                `;
                recommendedContainer.innerHTML = carouselHTML;
                initCarousel(recommendedContainer.querySelector('.content-carousel'));
            }
        };

        const renderAllPages = async () => {
            if (!currentProfile) return;
            await loadProfileData();
            renderContinueWatchingCarousel();
            setupHero();
            renderHomeCarousels();
            populateGenres();
            renderAllMoviesPage();
            renderAllSeriesPage();
            renderAoVivoPage();
            renderEmBrevePage();
            if(document.getElementById('perfil-page').classList.contains('hidden') === false) {
                renderMyListPage();
            }
        }

        const renderHomeCarousels = () => {
            homeCarousels.innerHTML = '';
            allCategories.forEach(category => {
                let categoryContent = allContent.filter(item => Array.isArray(item.tags) && item.tags.includes(category.tag));
                
                const orderedIds = category.contentOrder || [];
                categoryContent.sort((a, b) => {
                    const indexA = orderedIds.indexOf(a.id);
                    const indexB = orderedIds.indexOf(b.id);
                    if (indexA === -1 && indexB === -1) return a.title.localeCompare(b.title);
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                });

                if (categoryContent.length > 0) {
                     const slidesHTML = categoryContent.map(itemData => `<div class="swiper-slide">${createCardHTML(itemData)}</div>`).join('');
                     const carouselHTML = `
                         <div class="space-y-6">
                             <h2 class="text-2xl font-bold text-white">${category.title}</h2>
                             <div class="relative">
                                 <div class="swiper content-carousel"><div class="swiper-wrapper">${slidesHTML}</div></div>
                                 <div class="swiper-button-prev -left-4 !hidden md:!flex"></div>
                                 <div class="swiper-button-next -right-4 !hidden md:!flex"></div>
                             </div>
                         </div>`;
                     homeCarousels.innerHTML += carouselHTML;
                }
            });
            document.querySelectorAll('#home-carousels .content-carousel').forEach(c => initCarousel(c));
        };
        
        const renderAllMoviesPage = () => {
            const movies = allContent.filter(item => item.type === 'Filme');
            const contentHTML = movies.map(itemData => createCardHTML(itemData)).join('');
            filmesContainer.innerHTML = contentHTML;
        };

        const renderAllSeriesPage = () => {
            const series = allContent.filter(item => item.type === 'Série');
            const contentHTML = series.map(itemData => createCardHTML(itemData)).join('');
            seriesContainer.innerHTML = contentHTML;
        };
        
        const renderAoVivoPage = () => {
            const channels = allContent.filter(item => item.type === 'Canal');
            aovivoContainer.innerHTML = channels.map(channel => createCardHTML(channel)).join('');
        };

        const renderEmBrevePage = () => {
            const emBreveContent = allContent.filter(item => item.emBreve);
            embreveContainer.innerHTML = emBreveContent.map(item => createCardHTML(item)).join('');
        };
        
        const setupHero = () => {
            const heroContentData = allContent.find(item => Array.isArray(item.tags) && item.tags.includes('destaque'));
            if (heroContentData) {
                document.getElementById('hero-bg-desktop').src = heroContentData.bg || '';
                document.getElementById('hero-bg-mobile').src = heroContentData.bg_mobile || heroContentData.img || heroContentData.bg || '';
                heroSection.dataset.id = heroContentData.id;
                heroSection.dataset.videoSrc = heroContentData.videoSrc || '';
                document.getElementById('hero-title').textContent = heroContentData.title;
                document.getElementById('hero-desc').textContent = heroContentData.desc;
                document.getElementById('hero-genre').textContent = Array.isArray(heroContentData.genre) ? heroContentData.genre.join(', ') : (heroContentData.genre || '');
                document.getElementById('hero-year').textContent = heroContentData.year || '';
                document.getElementById('hero-duration').textContent = heroContentData.duration || '';
            } else {
                document.getElementById('hero-title').textContent = "Bem-vindo ao ActionMax";
                document.getElementById('hero-desc').textContent = "Navegue pelas seções para encontrar algo para assistir.";
            }
        };

        const loadSiteSettings = () => {
            const docRef = doc(db, "site_settings", "footer");
            onSnapshot(docRef, (docSnap) => {
                const socialLinksContainer = document.getElementById('social-links-container');
                const termosContent = document.getElementById('termos-content');
                const privacidadeContent = document.getElementById('privacidade-content');
                const ajudaContent = document.getElementById('ajuda-content');

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.telegramUrl) {
                        socialLinksContainer.innerHTML = `<a href="${data.telegramUrl}" target="_blank" class="hover:text-white transition-colors"><i class="fab fa-telegram-plane text-xl"></i></a>`;
                    } else {
                        socialLinksContainer.innerHTML = '';
                    }
                    termosContent.innerHTML = data.termosContent ? markdownConverter.makeHtml(data.termosContent) : '<p>Conteúdo não disponível.</p>';
                    privacidadeContent.innerHTML = data.privacidadeContent ? markdownConverter.makeHtml(data.privacidadeContent) : '<p>Conteúdo não disponível.</p>';
                    ajudaContent.innerHTML = data.ajudaContent ? markdownConverter.makeHtml(data.ajudaContent) : '<p>Conteúdo não disponível.</p>';
                } else {
                    socialLinksContainer.innerHTML = `<a href="#" class="hover:text-white transition-colors"><i class="fab fa-telegram-plane text-xl"></i></a>`;
                    termosContent.innerHTML = '<p>Os termos de serviço serão adicionados em breve.</p>';
                    privacidadeContent.innerHTML = '<p>A política de privacidade será adicionada em breve.</p>';
                    ajudaContent.innerHTML = '<p>A seção de ajuda será adicionada em breve.</p>';
                }
            });
        };

        // --- Lógica de Continuar Assistindo ---
        async function updateWatchHistory(contentId, currentTime, duration) {
            const user = auth.currentUser;
            if (user && contentId) {
                const progress = (currentTime / duration) * 100;
                if (progress > 95) {
                    delete watchHistory[contentId];
                } else {
                    watchHistory[contentId] = {
                        currentTime,
                        duration,
                        watchedAt: serverTimestamp()
                    };
                }
                await saveProfileData();
            }
        }

        function renderContinueWatchingCarousel() {
            continueWatchingContainer.innerHTML = '';
            const historyItems = Object.entries(watchHistory)
                .map(([id, data]) => ({ id, ...data }))
                .filter(item => item.currentTime && item.duration);

            historyItems.sort((a, b) => (b.watchedAt?.toDate() || 0) - (a.watchedAt?.toDate() || 0));

            if (historyItems.length === 0) return;

            const slidesHTML = historyItems.map(item => {
                const contentData = allContent.find(c => c.id === item.id);
                if (!contentData) return '';
                const progress = (item.currentTime / item.duration) * 100;
                return `<div class="swiper-slide">${createCardHTML(contentData, progress)}</div>`;
            }).join('');

            const carouselHTML = `
                <div class="space-y-6 mb-8">
                    <h2 class="text-2xl font-bold text-white">Continuar Assistindo</h2>
                    <div class="relative">
                        <div class="swiper content-carousel"><div class="swiper-wrapper">${slidesHTML}</div></div>
                        <div class="swiper-button-prev -left-4 !hidden md:!flex"></div>
                        <div class="swiper-button-next -right-4 !hidden md:!flex"></div>
                    </div>
                </div>`;
            continueWatchingContainer.innerHTML = carouselHTML;
            initCarousel(continueWatchingContainer.querySelector('.content-carousel'));
        }

        const setupRealtimeListeners = async () => {
            let isInitialLoad = true;
            
            loadAvatars();
            listenForNotifications();
            loadSiteSettings();

            try {
                const contentQuery = collection(db, 'content');
                const categoriesQuery = query(collection(db, 'categories'), orderBy("order"));

                const [contentSnapshot, categoriesSnapshot] = await Promise.all([
                    getDocs(contentQuery),
                    getDocs(categoriesQuery)
                ]);

                allContent = contentSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                allCategories = categoriesSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

                if (currentProfile) {
                    await renderAllPages();
                }

                if (isInitialLoad) {
                    isInitialLoad = false;
                    const hash = window.location.hash;
                    if (hash.startsWith('#/details/')) {
                        const itemId = hash.split('/')[2];
                        const data = allContent.find(item => item.id === itemId);
                        if (data) showPage('details-page', false, data);
                        else showPage('inicio-page', false);
                    } else if (hash.startsWith('#/genre/')) {
                        showGenrePage(decodeURIComponent(hash.split('/')[2]));
                    } else {
                        const pageId = (hash && hash !== '#') ? hash.substring(1) + '-page' : 'inicio-page';
                        if (document.getElementById(pageId) && currentProfile) showPage(pageId, false);
                        else if (currentProfile) showPage('inicio-page', false);
                    }
                }

                onSnapshot(contentQuery, (snapshot) => {
                    allContent = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                    if(currentProfile) renderAllPages(); 
                });

                onSnapshot(categoriesQuery, (snapshot) => {
                    allCategories = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                    if(currentProfile) renderAllPages();
                });

            } catch (error) {
                console.error("Erro ao carregar dados iniciais:", error);
                loadingScreen.innerHTML = '<h2 class="text-red-500 text-center p-4">Falha ao carregar o site. Por favor, recarregue a página.</h2>';
            }
        };

        if(auth.currentUser && !appWrapper.dataset.initialized) {
            initializeAppLogic();
            appWrapper.dataset.initialized = 'true';
        }
    }
});
