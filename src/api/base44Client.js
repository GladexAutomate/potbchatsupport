import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

//Create a client with authentication required
export const base44 = createClient({
  appId: appParams.appId,
  token: appParams.token,
  functionsVersion: appParams.functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl: appParams.appBaseUrl
});