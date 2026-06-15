import { createClient } from '@base44/sdk';

// Get app params dynamically to ensure they're loaded from environment and URL
const getAppParams = () => {
  const toSnakeCase = (str) => str.replace(/([A-Z])/g, '_$1').toLowerCase();
  const storage = typeof window !== 'undefined' ? window.localStorage : new Map();
  
  const getAppParamValue = (paramName, { defaultValue = undefined } = {}) => {
    if (typeof window === 'undefined') return defaultValue;
    
    const storageKey = `base44_${toSnakeCase(paramName)}`;
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get(paramName);
    
    if (searchParam) {
      storage.setItem(storageKey, searchParam);
      return searchParam;
    }
    
    if (defaultValue) {
      storage.setItem(storageKey, defaultValue);
      return defaultValue;
    }
    
    const storedValue = storage.getItem(storageKey);
    return storedValue || null;
  };
  
  return {
    appId: getAppParamValue('app_id', { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
    token: getAppParamValue('access_token', { defaultValue: null }),
    functionsVersion: getAppParamValue('functions_version', { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
    appBaseUrl: getAppParamValue('app_base_url', { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
  };
};

const params = getAppParams();

//Create a client with authentication required
export const base44 = createClient({
  appId: params.appId,
  token: params.token,
  functionsVersion: params.functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl: params.appBaseUrl
});