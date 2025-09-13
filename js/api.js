// Configurações da API TMDB
export const TMDB_API_KEY = '5954890d9e9b723ff3032f2ec429fec3';
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMG_URL = 'https://image.tmdb.org/t/p/w500';

/**
 * Pesquisa por filmes e séries na API do TMDB.
 * @param {string} query - O termo de pesquisa.
 * @returns {Promise<Array>} Uma lista de resultados válidos.
 */
export async function searchTMDB(query) {
    if (!TMDB_API_KEY) {
        console.error("A chave da API TMDB não foi configurada.");
        return [];
    }
    const url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(query)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.results.filter(r => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path);
    } catch (error) {
        console.error("Erro ao pesquisar no TMDB:", error);
        return [];
    }
}
