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
    const searchInput = document.getElementById('searchInput');
    const mainContent = document.getElementById('mainContent');
    const pageContainer = document.getElementById('page-container');
    const detailsModal = document.getElementById('details-modal');
    const detailsModalContent = document.getElementById('details-modal-content');
    const homeLogoBtn = document.getElementById('home-logo-btn');
    
    // Elementos do Menu Profile
    const profileMenuContainer = document.getElementById('profile-menu-container');
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const profileAvatar = document.getElementById('profile-avatar');
    const signOutBtnProfile = document.getElementById('sign-out-btn-profile');

    // Elementos dos Modals
    const notificationBtn = document.getElementById('notification-btn');
    const notificationBadge = document.getElementById('notification-badge');
    const notificationModalOverlay = document.getElementById('notification-modal-overlay');
    const notificationList = document.getElementById('notification-list');
    const closeNotificationBtn = document.getElementById('close-notification-btn');
    
    const usernameModalOverlay = document.getElementById('username-modal-overlay');
    const closeUsernameBtn = document.getElementById('close-username-btn');
    const usernameForm = document.getElementById('username-form');

    const shareModalOverlay = document.getElementById('share-modal-overlay');
    const closeShareBtn = document.getElementById('close-share-btn');
    const shareLinkInput = document.getElementById('share-link-input');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const copyFeedback = document.getElementById('copy-feedback');

    // Elementos de Autenticação
    const authPages = document.querySelectorAll('.auth-page');
    const authNavButtons = document.querySelectorAll('.auth-nav-btn');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    // --- Estado da Aplicação ---
    let myList = [];
    let watchHistory = {};
    let allAverageRatings = {};
    let currentDetailsData = null;
    let unsubscribeComments = null;
    let unsubscribeRatings = null;
    let allContent = [];
    let allCategories = [];
    let allNotifications = [];
    let allFetchedNotifications = [];
    let dismissedNotificationIds = new Set();
    let unsubscribeUserDoc = null;
    const markdownConverter = new showdown.Converter();

    // --- Lógica de Autenticação e Inicialização ---
    onAuthStateChanged(auth, user => {
        if (user) {
            authWrapper.classList.add('hidden');
            appWrapper.classList.remove('hidden');
            if (!appWrapper.dataset.initialized) {
                initializeAppLogic();
                appWrapper.dataset.initialized = 'true';
            }
        } else {
            appWrapper.classList.add('hidden');
            authWrapper.classList.remove('hidden');
            showAuthPage('welcome-page');
            if (unsubscribeUserDoc) unsubscribeUserDoc();
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
        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const errorEl = document.getElementById('signup-error');
        errorEl.textContent = '';
        const usernameDocRef = doc(db, "usernames", username.toLowerCase());
        const usernameDoc = await getDoc(usernameDocRef);
        if (usernameDoc.exists()) {
            errorEl.textContent = "Este nome de usuário já está em uso.";
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await updateProfile(user, { displayName: username });
            await setDoc(doc(db, "usernames", username.toLowerCase()), { uid: user.uid });
            location.reload();
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

    signOutBtnProfile.addEventListener('click', () => signOut(auth));

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

    // --- Lógica Principal da Aplicação ---
    function initializeAppLogic() {
        
        // --- Funções de Renderização de Páginas ---
        const renderHomePage = () => {
            pageContainer.innerHTML = `
                <section id="hero" class="relative rounded-2xl overflow-hidden shadow-xl mb-12 min-h-[450px] bg-slate-800 flex items-center"></section>
                <div id="carouselsContainer"></div>
            `;
            const heroContentData = allContent.find(item => Array.isArray(item.tags) && item.tags.includes('destaque')) || allContent[0];
            if(heroContentData) renderHero(heroContentData);
            renderHomeCarousels();
        };

        const renderMyListPage = () => {
            const listContent = myList.map(item => createCardHTML(item)).join('');
            pageContainer.innerHTML = `
                <h1 class="text-3xl font-bold mb-6">Minha Lista</h1>
                ${myList.length > 0 ? `<div class="grid-container">${listContent}</div>` : '<p class="text-slate-500">Sua lista está vazia. Adicione filmes e séries para vê-los aqui.</p>'}
            `;
        };
        
        const renderProfilePage = () => {
            const user = auth.currentUser;
            pageContainer.innerHTML = `
                 <div class="max-w-4xl mx-auto">
                    <div class="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-8">
                        <img id="profile-avatar-large" src="${user.photoURL || `https://placehold.co/150x150/f1f5f9/334155?text=${user.displayName.charAt(0)}`}" alt="Avatar grande do usuário" class="w-36 h-36 rounded-full border-4 border-violet-500 flex-shrink-0 object-cover">
                        <div class="flex-grow">
                            <h1 id="profile-username" class="text-4xl lg:text-5xl font-bold">${user.displayName}</h1>
                            <p id="profile-email" class="text-slate-500 mt-2">${user.email}</p>
                            <div class="flex flex-wrap gap-4 mt-6 justify-center md:justify-start">
                                <button id="change-username-btn" class="btn-secondary">Alterar Nome</button>
                                <button id="change-photo-btn" class="btn-secondary">Alterar Foto</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            // Re-atribuir event listeners para os botões recém-criados
            document.getElementById('change-username-btn').addEventListener('click', () => openModal(usernameModalOverlay));
            document.getElementById('change-photo-btn').addEventListener('click', () => renderAvatarPage());
        };

        const renderAvatarPage = () => {
            pageContainer.innerHTML = `
                <div class="flex items-center mb-8 sm:mb-12">
                    <button id="avatar-back-btn" aria-label="Voltar" class="text-slate-600 hover:text-violet-600 transition mr-4"><i data-lucide="arrow-left" class="h-6 w-6"></i></button>
                    <h1 class="text-3xl font-bold">Escolha seu Avatar</h1>
                </div>
                <div id="avatar-category-container" class="space-y-8"></div>
            `;
            lucide.createIcons();
            document.getElementById('avatar-back-btn').addEventListener('click', renderProfilePage);
            loadAvatars();
        };
        
        const renderSearchResults = (items, query) => {
            const resultsHTML = items
                .filter(item => item.type !== 'person' && (item.poster_path || item.img))
                .map(item => createCardHTML(item)).join('');

            pageContainer.innerHTML = `
                <h2 class="text-3xl font-bold mb-6">Resultados para "${query}"</h2>
                ${resultsHTML.length > 0 ? `<div class="grid-container">${resultsHTML}</div>` : '<p class="text-center text-slate-500">Nenhum resultado encontrado.</p>'}
            `;
        };

        // --- Funções de Renderização de Componentes ---
        function renderHero(item) {
            const heroContainer = document.getElementById('hero');
            if (!heroContainer) return;
            const backdropUrl = item.bg || (item.backdrop_path ? `${'https://image.tmdb.org/t/p/original'}${item.backdrop_path}` : '');
            const title = item.title || item.name;
            const overview = item.desc || item.overview;
            const truncatedOverview = overview.length > 200 ? overview.substring(0, 200) + '...' : overview;

            heroContainer.style.backgroundImage = `url(${backdropUrl})`;
            heroContainer.innerHTML = `
                <div class="relative z-10 p-8 md:p-12 max-w-2xl text-white hero-gradient">
                    <h2 class="text-4xl md:text-5xl font-extrabold mb-4">${title}</h2>
                    <p class="text-lg mb-6 text-slate-200">${truncatedOverview}</p>
                    <button data-id="${item.id}" data-type="${item.type || (item.title ? 'movie' : 'tv')}" class="details-btn bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 px-6 rounded-full transition duration-300 flex items-center gap-2">
                        <i data-lucide="info"></i> Mais Detalhes
                    </button>
                </div>
            `;
            lucide.createIcons();
        }
        
        function createCardHTML(item) {
            const { id, title, name, img, poster_path, type } = item;
            const itemTitle = title || name;
            const posterUrl = img || (poster_path ? `${'https://image.tmdb.org/t/p/w500'}${poster_path}` : 'https://placehold.co/500x750/f1f5f9/334155?text=Imagem+N/A');
            const itemType = type || (item.hasOwnProperty('title') ? 'movie' : 'tv');

            return `
                <div class="flex-shrink-0 w-full cursor-pointer group fade-in details-btn" data-id="${id}" data-type="${itemType}">
                    <div class="relative rounded-lg overflow-hidden shadow-lg transform group-hover:scale-105 transition-transform duration-300 aspect-[2/3] bg-slate-200">
                        <img src="${posterUrl}" alt="${itemTitle}" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/500x750/f1f5f9/334155?text=Imagem+N/A';">
                        <div class="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors duration-300"></div>
                    </div>
                    <h3 class="mt-2 font-semibold truncate text-slate-700">${itemTitle}</h3>
                </div>
            `;
        }

        function renderHomeCarousels() {
            const carouselsContainer = document.getElementById('carouselsContainer');
            if (!carouselsContainer) return;

            carouselsContainer.innerHTML = ''; // Limpa antes de renderizar
            allCategories.forEach(category => {
                let categoryContent = allContent.filter(item => Array.isArray(item.tags) && item.tags.includes(category.tag));
                if (categoryContent.length > 0) {
                    const slidesHTML = categoryContent.map(item => `<div class="swiper-slide !w-40 md:!w-48">${createCardHTML(item)}</div>`).join('');
                    const section = document.createElement('section');
                    section.className = 'mb-10';
                    section.innerHTML = `
                        <h2 class="text-2xl font-bold mb-4">${category.title}</h2>
                        <div class="swiper content-carousel"><div class="swiper-wrapper">${slidesHTML}</div></div>
                    `;
                    carouselsContainer.appendChild(section);
                }
            });
            document.querySelectorAll('.content-carousel').forEach(c => initCarousel(c));
        }

        // --- Lógica de Modal de Detalhes ---
        async function showDetailsModal(id, type) {
            if (unsubscribeComments) unsubscribeComments();
            if (unsubscribeRatings) unsubscribeRatings();
            
            const itemDetails = allContent.find(item => item.id === id);
            if (!itemDetails) return;
            currentDetailsData = itemDetails;

            const { title, name, desc, overview, img, poster_path, year, release_date, duration, genre, seasons } = itemDetails;
            
            const itemTitle = title || name;
            const itemYear = year || (release_date ? new Date(release_date).getFullYear() : 'N/A');
            const posterUrl = img || (poster_path ? `${'https://image.tmdb.org/t/p/w500'}${poster_path}` : 'https://placehold.co/500x750/f1f5f9/334155?text=Imagem+N/A');
            
            detailsModalContent.innerHTML = `
                <button id="close-modal-btn" class="absolute top-3 right-3 text-slate-400 hover:text-slate-800 z-20"><i data-lucide="x" class="h-8 w-8"></i></button>
                <div class="flex flex-col md:flex-row">
                    <img src="${posterUrl}" alt="${itemTitle}" class="w-full md:w-1/3 rounded-t-lg md:rounded-l-lg md:rounded-t-none object-cover" onerror="this.onerror=null;this.src='https://placehold.co/500x750/f1f5f9/334155?text=Imagem+N/A';">
                    <div class="p-6 md:p-8 flex-1">
                        <h2 class="text-3xl font-bold mb-2">${itemTitle} (${itemYear})</h2>
                        <div class="flex items-center mb-4 text-slate-500 text-sm flex-wrap">
                            <span>${duration || ''}</span>
                        </div>
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${(genre || []).map(g => `<span class="bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full">${g}</span>`).join('')}
                        </div>
                        <div class="flex flex-wrap gap-2 my-6">
                            <button id="details-watch-btn" class="btn-primary">Assistir</button>
                            <button id="details-add-list-btn" class="btn-secondary"></button>
                            <button id="details-share-btn" class="btn-secondary !p-3 !rounded-full"><i data-lucide="share-2"></i></button>
                        </div>
                        <h3 class="text-xl font-semibold mb-2 mt-6">Sinopse</h3>
                        <p class="text-slate-600 leading-relaxed mb-4">${desc || overview || 'Sinopse não disponível.'}</p>
                        <!-- Abas de Conteúdo -->
                        <div class="mt-8">
                            <div id="details-tabs" class="flex border-b border-slate-200 mb-6">
                                ${type === 'Série' ? '<button class="details-tab-btn active" data-tab="episodes-tab">Episódios</button>' : ''}
                                <button class="details-tab-btn ${type !== 'Série' ? 'active' : ''}" data-tab="comments-tab">Comentários</button>
                            </div>
                            <div id="details-tab-content">
                                <div id="episodes-tab" class="details-tab-panel ${type !== 'Série' ? 'hidden' : ''}">
                                    <div id="seasons-section" class="space-y-4"></div>
                                </div>
                                <div id="comments-tab" class="details-tab-panel ${type === 'Série' ? 'hidden' : ''}">
                                    <!-- Conteúdo de comentários aqui -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Lógica Pós-Renderização do Modal
            updateAllListButtons(id); // Atualiza o botão "Minha Lista"
            loadCommentsAndRatings(id); // Carrega comentários e avaliações
            if (type === 'Série' && seasons) {
                renderSeasons(seasons);
            }

            openModal(detailsModal);
        }

        function closeModal(modalElement) {
            modalElement.classList.add('hidden');
            document.body.classList.remove('no-scroll');
        }

        function openModal(modalElement) {
            modalElement.classList.remove('hidden');
            document.body.classList.add('no-scroll');
            lucide.createIcons();
        }

        // --- Lógica de Navegação e Busca ---
        const showPageContent = (pageId) => {
            if (pageId === 'inicio-page') renderHomePage();
            else if (pageId === 'minha-lista-page') renderMyListPage();
            else if (pageId === 'perfil-page') renderProfilePage();
        };

        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();
            debounceTimer = setTimeout(async () => {
                if (query) {
                    const searchData = allContent.filter(item => (item.title || item.name).toLowerCase().includes(query.toLowerCase()));
                    renderSearchResults(searchData, query);
                } else {
                    renderHomePage();
                }
            }, 500);
        });

        homeLogoBtn.addEventListener('click', () => {
            searchInput.value = '';
            showPageContent('inicio-page');
        });

        // --- Event Listeners Globais ---
        document.addEventListener('click', (e) => {
            // Lógica para fechar dropdown de perfil
            if (!profileMenuContainer.contains(e.target)) {
                profileDropdown.classList.add('hidden');
            }
            // Lógica para abrir detalhes
            const detailsBtn = e.target.closest('.details-btn');
            if (detailsBtn) {
                const { id, type } = detailsBtn.dataset;
                showDetailsModal(id, type);
            }
            // Lógica para fechar modals
            if (e.target.closest('#close-modal-btn') || e.target === detailsModal) {
                closeModal(detailsModal);
            }
        });

        // --- Inicialização da Página ---
        async function initializePage() {
            try {
                const contentQuery = collection(db, 'content');
                const categoriesQuery = query(collection(db, 'categories'), orderBy("order"));
                const [contentSnapshot, categoriesSnapshot] = await Promise.all([getDocs(contentQuery), getDocs(categoriesQuery)]);
                allContent = contentSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                allCategories = categoriesSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                
                showPageContent('inicio-page');

            } catch (error) {
                console.error("Erro ao carregar dados iniciais:", error);
                pageContainer.innerHTML = `<div class="text-center p-8"><p class="text-red-600 bg-red-100 p-4 rounded-lg">Falha ao carregar o conteúdo. Tente recarregar a página.</p></div>`;
            } finally {
                loadingScreen.classList.add('opacity-0');
                loadingScreen.addEventListener('transitionend', () => loadingScreen.style.display = 'none', { once: true });
                lucide.createIcons();
            }
        }
        
        // --- Funções de Dados (Firebase) ---
        async function loadMyList() {
            const user = auth.currentUser;
            if (user) {
                const docSnap = await getDoc(doc(db, 'users', user.uid));
                myList = (docSnap.exists() && docSnap.data().myList) ? docSnap.data().myList : [];
            }
        }
        
        async function loadAvatar() {
            const user = auth.currentUser;
            if (!user) return;
            const userDocSnap = await getDoc(doc(db, 'users', user.uid));
            const avatarUrl = userDocSnap.exists() && userDocSnap.data().avatarUrl 
                ? userDocSnap.data().avatarUrl 
                : `https://placehold.co/40x40/f1f5f9/334155?text=${user.displayName.charAt(0)}`;
            profileAvatar.src = avatarUrl;
        }

        // --- Execução ---
        loadMyList();
        loadAvatar();
        initializePage();

        // --- Event Listeners de Componentes ---
        profileMenuBtn.addEventListener('click', () => profileDropdown.classList.toggle('hidden'));
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showPageContent(link.dataset.target);
                profileDropdown.classList.add('hidden');
            });
        });

        notificationBtn.addEventListener('click', () => openModal(notificationModalOverlay));
        closeNotificationBtn.addEventListener('click', () => closeModal(notificationModalOverlay));
        notificationModalOverlay.addEventListener('click', (e) => e.target === notificationModalOverlay && closeModal(notificationModalOverlay));

        closeUsernameBtn.addEventListener('click', () => closeModal(usernameModalOverlay));
        usernameModalOverlay.addEventListener('click', (e) => e.target === usernameModalOverlay && closeModal(usernameModalOverlay));

        closeShareBtn.addEventListener('click', () => closeModal(shareModalOverlay));
        shareModalOverlay.addEventListener('click', (e) => e.target === shareModalOverlay && closeModal(shareModalOverlay));
    }
});
