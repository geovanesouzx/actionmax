import * as state from './state.js';

// Este módulo é responsável por todas as manipulações do DOM e renderização da UI.

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
 * Mostra ou esconde a vista de seleção de perfis.
 * @param {boolean} show - Se deve mostrar ou esconder a vista.
 */
export function showProfileSelectionView(show = true) {
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
        // Mostra a vista de gestão de perfis
        document.getElementById('manage-profiles-view').classList.remove('hidden');
        document.getElementById('manage-profiles-view').classList.add('flex');
        document.getElementById('edit-profile-view').classList.add('hidden');
        document.getElementById('edit-profile-view').classList.remove('flex');

    }
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


// ... (restante das funções de UI como renderHeroSection, renderCarousels, renderDetailPage, etc.)
// ... (movidas do `script.js` original para aqui)
