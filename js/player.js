import * as state from './state.js';
import { itemDetails, getCurrentProfile, setLastVolume } from './state.js';
import { saveProfiles } from './auth.js';
import { showToast } from './ui.js';

let videoPlayer, playerContainer, playerControls, videoOverlay, playPauseBtn, rewindBtn, forwardBtn, prevEpisodeBtn, nextEpisodeBtn, volumeBtn, volumeSlider, progressBar, progressBarContainer, fullscreenBtn, skipIntroBtn, seekIndicator, seekIndicatorIcon, nextEpisodeOverlay, nextEpisodeTitle, nextEpisodeCountdown, playNextBtn, errorDisplay;

let controlsTimeout = null;
let isSeeking = false;
let nextEpisodeInterval = null;
let progressSaveInterval = null;
let hlsInstance = null;

const icons = {
    play: `<svg xmlns="http://www.w.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" /></svg>`,
    pause: `<svg xmlns="http://www.w.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Zm9 0a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" /></svg>`,
    volumeHigh: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>`,
    volumeMute: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z M15 10l5 5m0-5l-5 5" /></svg>`,
    forward: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg>`,
    rewind: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15l-6-6m0 0l6-6m-6 6h12a6 6 0 010 12h-3" /></svg>`,
    nextEpisode: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.81V8.688zM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.688z" /></svg>`,
    prevEpisode: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M21 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953l7.108-4.062A1.125 1.125 0 0121 8.688v8.123zM11.25 16.811c0 .864-.933 1.405-1.683.977l-7.108-4.062a1.125 1.125 0 010-1.953L9.567 7.71a1.125 1.125 0 011.683.977v8.123z" /></svg>`,
    fullscreen: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>`,
    exitFullscreen: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" /></svg>`,
};


export function initPlayerControls() {
    videoPlayer = document.getElementById('video-player');
    playerContainer = document.getElementById('player-container');
    playerControls = document.getElementById('player-controls');
    videoOverlay = document.getElementById('video-overlay');
    playPauseBtn = document.getElementById('play-pause-btn');
    rewindBtn = document.getElementById('rewind-btn');
    forwardBtn = document.getElementById('forward-btn');
    prevEpisodeBtn = document.getElementById('prev-episode-btn');
    nextEpisodeBtn = document.getElementById('next-episode-btn');
    volumeBtn = document.getElementById('volume-btn');
    volumeSlider = document.getElementById('volume-slider');
    progressBar = document.getElementById('progress-bar');
    progressBarContainer = document.getElementById('progress-bar-container');
    fullscreenBtn = document.getElementById('fullscreen-btn');
    skipIntroBtn = document.getElementById('skip-intro-btn');
    seekIndicator = document.getElementById('seek-indicator');
    seekIndicatorIcon = seekIndicator.querySelector('svg');
    nextEpisodeOverlay = document.getElementById('next-episode-overlay');
    nextEpisodeTitle = document.getElementById('next-episode-title');
    nextEpisodeCountdown = document.getElementById('next-episode-countdown');
    playNextBtn = document.getElementById('play-next-btn');
    errorDisplay = document.getElementById('player-error-display');

    // Set initial icons
    playPauseBtn.innerHTML = icons.play;
    rewindBtn.innerHTML = icons.rewind;
    forwardBtn.innerHTML = icons.forward;
    volumeBtn.innerHTML = icons.volumeHigh;
    fullscreenBtn.innerHTML = icons.fullscreen;
    prevEpisodeBtn.innerHTML = icons.prevEpisode;
    nextEpisodeBtn.innerHTML = icons.nextEpisode;

    // Attach event listeners
    // ... (All player event listeners from the original script go here)
}

export async function startPlayback(itemId, params) {
    // ... (Logic from initPlayer goes here)
}

export async function exitPlayerMode() {
    // ... (Logic to exit fullscreen and stop video)
}

// ... (All other player functions: formatTime, skip, togglePlay, updateVolumeUI, etc.)
// ... (These functions would be moved from the original script)

