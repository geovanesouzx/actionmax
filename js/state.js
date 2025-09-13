/**
 * Este módulo centraliza o estado da aplicação para evitar a sua dispersão.
 * Outros módulos podem importar e usar estas variáveis e funções para garantir
 * que estão a trabalhar com a mesma fonte de dados.
 */

// Dados principais da aplicação
export let catalog = [];
export let carousels = [];
export let itemDetails = {};
export let avatarsFromFirestore = [];

// Estado do utilizador e perfil
export let profiles = [];
export let currentProfileId = null;
export let editingProfileId = null;
export let selectedAvatarUrl = null;

// Estado do leitor de vídeo
export let isPlayerModeActive = false;
export let currentPlayingItemId = null;
export let currentEpisodeData = null;
export let nextEpisodeData = null;
export let lastVolume = 1;

// Outros estados da UI
export let commentsToShow = 5;
export let lastScrollPosition = 0;

// Funções para modificar o estado (Setters)
export const setCatalog = (newCatalog) => { catalog = newCatalog; };
export const setCarousels = (newCarousels) => { carousels = newCarousels; };
export const setItemDetails = (newItemDetails) => { itemDetails = newItemDetails; };
export const setAvatars = (newAvatars) => { avatarsFromFirestore = newAvatars; };

export const setProfiles = (newProfiles) => { profiles = newProfiles; };
export const setCurrentProfileId = (id) => { currentProfileId = id; };
export const setEditingProfileId = (id) => { editingProfileId = id; };
export const setSelectedAvatarUrl = (url) => { selectedAvatarUrl = url; };

export const setPlayerMode = (isActive) => { isPlayerModeActive = isActive; };
export const setCurrentPlayingItemId = (id) => { currentPlayingItemId = id; };
export const setCurrentEpisodeData = (data) => { currentEpisodeData = data; };
export const setNextEpisodeData = (data) => { nextEpisodeData = data; };
export const setLastVolume = (volume) => { lastVolume = volume; };

export const setCommentsToShow = (count) => { commentsToShow = count; };
export const setLastScrollPosition = (position) => { lastScrollPosition = position; };

// Função para obter o perfil atual de forma segura
export function getCurrentProfile() {
    if (!currentProfileId) return null;
    return profiles.find(p => p.id === currentProfileId);
}
