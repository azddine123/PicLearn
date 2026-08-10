/**
 * API Configuration
 *
 * Resolution order:
 *  1. EXPO_PUBLIC_API_URL from .env, if set — required for production
 *     builds (no dev server, so nothing to auto-detect).
 *  2. Auto-detected from Expo's dev server host (the LAN IP your phone
 *     already uses to reach Metro), so a physical device on the same
 *     Wi-Fi can reach the backend without ever editing .env — including
 *     when that IP changes between networks.
 *  3. localhost fallback (web / simulator only).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 8000;

const getApiUrl = (): string => {
    // @ts-ignore - expo supporte EXPO_PUBLIC_ variables
    const manualUrl = process.env.EXPO_PUBLIC_API_URL;

    if (manualUrl) {
        console.log('📡 Using API URL from .env:', manualUrl);
        return manualUrl;
    }

    // e.g. "10.32.67.163:8081" — set automatically by Expo when running
    // via `expo start`. Not available in production builds (no dev server).
    const hostUri = Constants.expoConfig?.hostUri;

    if (hostUri && Platform.OS !== 'web') {
        const host = hostUri.split(':')[0];
        const url = `http://${host}:${API_PORT}/api/v1`;
        console.log('📡 Using auto-detected API URL:', url);
        return url;
    }

    if (!__DEV__) {
        // Sans URL compilée, l'app ne peut jamais joindre le backend : crash
        // explicite au démarrage plutôt qu'un échec réseau silencieux sur
        // chaque écran.
        throw new Error(
            "EXPO_PUBLIC_API_URL est absente de ce build de production — vérifier le bloc env de eas.json."
        );
    }

    console.log('📡 Using default localhost API URL');
    return `http://localhost:${API_PORT}/api/v1`;
};

// Export de l'URL finale
export const API_URL = getApiUrl();

export default { API_URL };
