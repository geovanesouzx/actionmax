import { db, collection, getDocs, getDoc, doc, query, orderBy, onSnapshot, updateDoc, arrayUnion, arrayRemove, writeBatch, setDoc, addDoc, serverTimestamp, runTransaction, where, deleteDoc } from './firebase.js';
import * as state from './state.js';
import { showToast } from './ui.js';

// Mantém as referências dos listeners para poderem ser desligados
let unsubscribeContent = null;
let unsubscribeCarousels = null;
let unsubscribeNotifications = null;
let unsubscribeComments = null;
let unsubscribePedidos = null;
let notificationShakeInterval = null;

/**
 * Desliga todos os listeners de tempo real do Firestore.
 * Essencial para evitar memory leaks e chamadas desnecessárias ao fazer logout.
 */
export function detachRealtimeListeners() {
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

/**
 * Carrega todos os dados iniciais do Firestore e depois anexa os listeners para atualizações em tempo real.
 */
export async function loadDataAndAttachListeners() {
    // 1. Fetch inicial para evitar ecrãs vazios
    try {
        console.log("A carregar dados iniciais...");
        const contentSnapshot = await getDocs(collection(db, 'content'));
        const catalogData = [];
        const itemDetailsData = {};
        contentSnapshot.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            catalogData.push({ id: data.id, title: data.title, type: data.type, poster: data.poster, tmdbId: data.tmdb_id });
            itemDetailsData[data.id] = data;
        });
        state.setCatalog(catalogData);
        state.setItemDetails(itemDetailsData);

        const carouselsQuery = query(collection(db, 'carousels'), orderBy('order'));
        const carouselsSnapshot = await getDocs(carouselsQuery);
        const carouselsData = carouselsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.setCarousels(carouselsData);

        const categoriesQuery = query(collection(db, 'avatar_categories'), orderBy('title'));
        const categoriesSnapshot = await getDocs(categoriesQuery);
        const categoriesData = [];
        for (const categoryDoc of categoriesSnapshot.docs) {
            const category = { id: categoryDoc.id, category: categoryDoc.data().title, urls: [] };
            const avatarsSnapshot = await getDocs(collection(db, `avatar_categories/${category.id}/avatars`));
            avatarsSnapshot.forEach(avatarDoc => category.urls.push(avatarDoc.data().url));
            if (category.urls.length > 0) categoriesData.push(category);
        }
        state.setAvatars(categoriesData);
        console.log("Dados iniciais carregados.");
    } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        showToast("Falha ao carregar o catálogo.");
        return Promise.reject(error);
    }

    // 2. Anexa listeners para atualizações em tempo real
    attachRealtimeListeners();
}

/**
 * Anexa os listeners de tempo real do Firestore.
 */
function attachRealtimeListeners() {
    detachRealtimeListeners(); // Garante que não há listeners antigos

    const contentQuery = collection(db, 'content');
    unsubscribeContent = onSnapshot(contentQuery, (snapshot) => {
        console.log("Dados de conteúdo atualizados em tempo real.");
        const currentDetails = { ...state.itemDetails };
        const currentCatalog = [...state.catalog];

        snapshot.docChanges().forEach((change) => {
            const data = { id: change.doc.id, ...change.doc.data() };
            const index = currentCatalog.findIndex(item => item.id === data.id);
            
            if (change.type === "added" || change.type === "modified") {
                const catalogItem = { id: data.id, title: data.title, type: data.type, poster: data.poster, tmdbId: data.tmdb_id };
                if (index > -1) {
                    currentCatalog[index] = catalogItem;
                } else {
                    currentCatalog.push(catalogItem);
                }
                currentDetails[data.id] = data;
            } else if (change.type === "removed") {
                if (index > -1) {
                    currentCatalog.splice(index, 1);
                }
                delete currentDetails[change.doc.id];
            }
        });

        state.setCatalog(currentCatalog);
        state.setItemDetails(currentDetails);
        // A UI será atualizada pelo `refreshUI` no script principal
    }, (error) => console.error("Erro no listener de conteúdo:", error));

    const carouselsQuery = query(collection(db, 'carousels'), orderBy('order'));
    unsubscribeCarousels = onSnapshot(carouselsQuery, (snapshot) => {
        console.log("Dados de carrosséis atualizados em tempo real.");
        const carouselsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.setCarousels(carouselsData);
        // A UI será atualizada pelo `refreshUI` no script principal
    }, (error) => console.error("Erro no listener de carrosséis:", error));
}

// Outras funções de interação com o Firestore (saveProgress, toggleMyList, etc.)
// Estas funções foram movidas para `auth.js` (saveProfiles) e `player.js` (saveProgress)
// e para os seus respetivos contextos para manter a lógica coesa.
// Exemplo: `saveProfiles` agora está em `auth.js` porque está diretamente relacionado com perfis.
