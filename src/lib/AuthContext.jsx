import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { db } from '@/lib/db';
import { fetchLiveEmployeeStatus } from '@/lib/supabaseClient';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const getAppParams = () => {
  const isNode = typeof window === 'undefined';
  const windowObj = isNode ? { localStorage: new Map() } : window;
  const storage = windowObj.localStorage;

  const toSnakeCase = (str) => {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
    if (isNode) {
      return defaultValue;
    }
    const storageKey = `base44_${toSnakeCase(paramName)}`;
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get(paramName);
    if (removeFromUrl) {
      urlParams.delete(paramName);
      const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
        }${window.location.hash}`;
      window.history.replaceState({}, document.title, newUrl);
    }
    if (searchParam) {
      storage.setItem(storageKey, searchParam);
      return searchParam;
    }
    if (defaultValue) {
      storage.setItem(storageKey, defaultValue);
      return defaultValue;
    }
    const storedValue = storage.getItem(storageKey);
    if (storedValue) {
      return storedValue;
    }
    return null;
  }

  if (getAppParamValue("clear_access_token") === 'true') {
    storage.removeItem('base44_access_token');
    storage.removeItem('token');
  }
  return {
    appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
    functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
    appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
  }
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
    
    // Recheck auth when URL parameters change (handles redirect back from Base44 login)
    const handleUrlChange = () => {
      checkAppState();
    };
    
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Background access check (only when authenticated). Detects mid-session loss of access
  // and logs the user out silently — does NOT refresh the page or interrupt their work.
  //
  // `is_blocked` is app-managed and lives only in Base44. `status` (active/inactive) is
  // owned by Supabase, so we read it LIVE from Supabase rather than waiting on the sync —
  // this way an account flipped to inactive ends the session within one interval, even if
  // no admin has User Management open. Falls back to the Base44 record if Supabase is
  // unreachable.
  useEffect(() => {
    if (!isAuthenticated) return;
    const ACCESS_CHECK_MS = 60 * 1000; // 1 min — fast enough for access control, light on load
    const interval = setInterval(async () => {
      try {
        const currentUser = await base44.auth.me();
        const empRecords = await db.EmployeeAccount.filter({ email: currentUser.email }, 1);
        const emp = empRecords?.[0];
        if (!emp) return; // unknown to this app — leave platform auth to decide

        // App-managed block (Base44 only).
        if (emp.is_blocked) {
          console.warn('User blocked detected, logging out silently');
          logout(false);
          return;
        }

        // Live Supabase status, with Base44 as fallback.
        const liveStatus = await fetchLiveEmployeeStatus({
          airtable_record_id: emp.airtable_record_id,
          employee_code: emp.employee_code,
          email: currentUser.email,
        });
        const isInactive = liveStatus ? liveStatus === 'inactive' : emp.status === 'inactive';
        if (isInactive) {
          console.warn('User inactive detected (live from Supabase), logging out silently');
          logout(false);
        }
      } catch (e) {
        // Silent fail - don't interrupt user
      }
    }, ACCESS_CHECK_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // Get fresh app params on each check
      const appParams = getAppParams();
      
      // If appId is missing, we can't proceed
      if (!appParams.appId) {
        console.error('App ID not configured');
        setAuthError({
          type: 'config_error',
          message: 'Application is not properly configured'
        });
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        setIsLoadingPublicSettings(false);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();

      // Overlay the custom role from EmployeeAccount or StaffDirectory (source of truth for app roles)
      try {
        const appEnv = window.location.hostname.startsWith('preview.') || window.location.hostname.includes('.dev.base44.app') ? 'test' : 'prod';
        const empRecords = await db.EmployeeAccount.filter({ email: currentUser.email, env: appEnv }, 1);
        console.log('Loaded EmployeeAccount for role:', empRecords);
        if (empRecords && empRecords.length > 0) {
          const emp = empRecords[0];

          // If blocked or inactive — force logout immediately, clear any pending redirect.
          // Inactive is enforced here too so the OAuth/Google login path matches the
          // staff-code login (StaffLoginModal), where inactive accounts are denied.
          if (emp.is_blocked || emp.status === 'inactive') {
            console.warn(`User is ${emp.is_blocked ? 'blocked' : 'inactive'}. Forcing logout.`);
            sessionStorage.removeItem('loginRedirect');
            setIsLoadingAuth(false);
            setAuthChecked(true);
            base44.auth.logout('/');
            return;
          }

          if (emp.POTBChatsupportrole) {
            currentUser.role = emp.POTBChatsupportrole;
            console.log('Set role from EmployeeAccount:', currentUser.role);
          }
        } else {
          // Fall back to StaffDirectory if not in EmployeeAccount
          const staffRecords = await db.StaffDirectory.filter({ email: currentUser.email, env: appEnv }, 1);
          console.log('Loaded StaffDirectory for role:', staffRecords);
          if (staffRecords && staffRecords.length > 0) {
            const staff = staffRecords[0];

            // If blocked in StaffDirectory too
            if (staff.is_blocked) {
              console.warn('User is blocked in StaffDirectory. Forcing logout.');
              sessionStorage.removeItem('loginRedirect');
              setIsLoadingAuth(false);
              setAuthChecked(true);
              base44.auth.logout('/');
              return;
            }

            if (staff.current_role) {
              currentUser.role = staff.current_role;
              console.log('Set role from StaffDirectory:', currentUser.role);
            }
          }
        }
      } catch (e) {
        console.error('Error loading app role:', e);
        // Non-critical — fall back to platform role
      }

      setUser(currentUser);
      setIsAuthenticated(true);

      // Handle redirect after successful auth
      const redirect = sessionStorage.getItem('loginRedirect');
      if (redirect) {
        sessionStorage.removeItem('loginRedirect');
        window.location.href = redirect;
      }

      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);

      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  const refreshUserRole = async () => {
    // Reload just the user's role from the database
    if (user) {
      await checkUserAuth();
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      refreshUserRole,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};