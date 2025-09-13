import * as state from './state.js';
import { saveProfiles } from './auth.js';
import { TMDB_IMG_URL } from './api.js';

/**
 * Mostra uma notificação toast.
 * @param {string} message - A mensagem a ser exibida.
 */
export function showToast(message) {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Mostra ou esconde as vistas de autenticação (login/registo).
 * @param {'login'|'register'} view - A vista a ser mostrada.
 */
export function showAuthView(view) {
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    loginView.classList.toggle('hidden', view !== 'login');
    loginView.classList.toggle('flex', view === 'login');
    registerView.classList.toggle('hidden', view !== 'register');
    registerView.classList.toggle('flex', view === 'register');
}

/**
 * Mostra a vista de seleção de perfis.
 * @param {boolean} show - Se deve mostrar ou esconder a vista.
 */
export function showProfileSelectionView(show = true) {
    const view = document.getElementById('profile-selection-view');
    if (show) {
        renderProfileSelection();
        view.classList.remove('hidden');
        view.classList.add('flex');
        document.getElementById('manage-profiles-view').classList.add('hidden');
    } else {
        view.classList.add('hidden');
        view.classList.remove('flex');
    }
}

/**
 * Mostra a vista de gestão de perfis.
 */
export function showManageProfilesView() {
    renderManageProfilesList();
    document.getElementById('profile-selection-view').classList.add('hidden');
    document.getElementById('edit-profile-view').classList.add('hidden');
    const manageView = document.getElementById('manage-profiles-view');
    manageView.classList.remove('hidden');
    manageView.classList.add('flex');
}

/**
 * Mostra a vista de edição de perfil.
 * @param {string|null} profileId - O ID do perfil a ser editado, ou null para um novo perfil.
 */
export function showEditProfileView(profileId = null) {
    state.setEditingProfileId(profileId);
    const titleEl = document.getElementById('edit-profile-title');
    const nameInput = document.getElementById('profile-name-input');
    const deleteBtn = document.getElementById('delete-profile-btn');
    const kidToggle = document.getElementById('kid-profile-toggle');
    
    state.setSelectedAvatarUrl(null);
    nameInput.value = '';
    kidToggle.checked = false;
    
    if (profileId) {
        const profile = state.profiles.find(p => p.id === profileId);
        if(profile) {
            titleEl.textContent = 'Editar Perfil';
            nameInput.value = profile.name;
            state.setSelectedAvatarUrl(profile.avatar);
            kidToggle.checked = profile.isKid || false;
            deleteBtn.classList.remove('hidden');
        }
    } else {
        titleEl.textContent = 'Adicionar Perfil';
        deleteBtn.classList.add('hidden');
    }
    
    renderAvatarGridForEdit(state.selectedAvatarUrl);
    
    document.getElementById('manage-profiles-view').classList.add('hidden');
    const editView = document.getElementById('edit-profile-view');
    editView.classList.remove('hidden');
    editView.classList.add('flex');
}

/**
 * Renderiza a lista de perfis para seleção.
 */
export function renderProfileSelection() {
    const container = document.getElementById('profiles-list-container');
    container.innerHTML = state.profiles.map(profile => `
        <div class="text-center group cursor-pointer" data-action="selectProfile" data-item-id="${profile.id}">
            <img src="${profile.avatar}" alt="${profile.name}" class="w-24 h-24 md:w-36 md:h-36 rounded-md object-cover transition-transform duration-200 group-hover:scale-105 border-4 border-transparent group-hover:border-gray-300">
            <p class="mt-2 text-gray-400 font-medium group-hover:text-white">${profile.name}</p>
        </div>
    `).join('');
}


/**
 * Renderiza a grelha de avatares para edição de perfil.
 * @param {string} currentAvatar - O URL do avatar atualmente selecionado.
 */
function renderAvatarGridForEdit(currentAvatar) {
    const avatarContainer = document.getElementById('edit-avatar-grid-container');
    avatarContainer.innerHTML = '';
    state.avatarsFromFirestore.forEach(cat => {
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
            const currentTarget = e.currentTarget;
            currentTarget.classList.add('selected');
            state.setSelectedAvatarUrl(currentTarget.dataset.url);
        });
    });
}


/**
 * Renderiza a lista de perfis para gestão.
 */
export function renderManageProfilesList() {
    const container = document.getElementById('manage-profiles-list-container');
    let profilesHTML = state.profiles.map(profile => `
        <div class="relative text-center group cursor-pointer" data-action="showEditProfileView" data-item-id="${profile.id}">
            <img src="${profile.avatar}" alt="${profile.name}" class="w-24 h-24 md:w-36 md:h-36 rounded-md object-cover">
            <div class="absolute inset-0 bg-black/60 rounded-md flex items-center justify-center">
                <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z"></path></svg>
            </div>
            <p class="mt-2 text-gray-400 font-medium">${profile.name}</p>
        </div>
    `).join('');

    if (state.profiles.length < 5) {
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

/**
 * Atualiza os links de navegação para destacar o ativo.
 * @param {string} viewName - O nome da vista ativa.
 */
export function updateNavLinks(viewName) {
    document.querySelectorAll('#main-nav .nav-link, #mobile-nav .mobile-nav-link').forEach(link => {
        const isMainNavLink = link.classList.contains('nav-link');
        const isActive = link.dataset.viewName === viewName;

        link.classList.toggle('active', isActive);
        if (isMainNavLink) {
            link.classList.toggle('text-white', isActive);
            link.classList.toggle('text-gray-400', !isActive);
        }
    });
}

/**
 * Atualiza o estilo do cabeçalho com base na posição do scroll.
 */
export function updateHeaderStyle() {
    if (!state.currentProfileId) return;
    const mainHeader = document.getElementById('main-header');
    const isHome = document.getElementById('home-view') && !document.getElementById('home-view').classList.contains('hidden');
    mainHeader.style.position = isHome ? 'fixed' : 'absolute';
    const shouldBeOpaque = window.scrollY > 50 || !isHome;
    mainHeader.classList.toggle('bg-black/80', shouldBeOpaque);
    mainHeader.classList.toggle('backdrop-blur-sm', shouldBeOpaque);
}

/**
 * Renderiza a página inicial (carrosséis e secção hero).
 */
export async function renderHomePage() {
    // A lógica de renderCarousels e renderHeroSection iria aqui
    console.log("A renderizar a página inicial...");
    // ui.renderCarousels();
    // ui.renderHeroSection();
}

/**
 * Atualiza a UI após a seleção de um perfil.
 * @param {object} profile - O perfil selecionado.
 */
export function updateUIAfterProfileSelect(profile) {
    document.getElementById('header-avatar').src = profile.avatar;
    document.getElementById('profile-avatar-img').src = profile.avatar;
    document.getElementById('profile-name').textContent = profile.name;
    document.getElementById('profile-selection-view').classList.add('hidden');
    document.getElementById('main-header').classList.remove('hidden');
}

/**
 * Verifica a permissão de notificação e mostra o modal se necessário.
 */
export function checkNotificationPermission() {
    if ('Notification' in window && Notification.permission === "default") {
        const modal = document.getElementById('permission-modal');
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }
}


// ... (restante das funções de UI)

