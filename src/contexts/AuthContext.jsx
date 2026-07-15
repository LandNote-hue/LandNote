import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  mapAuthErrorMessage,
  authRedirectUrl,
  PASSWORD_RESET_REDIRECT_PATH,
} from '../utils/authValidation.js';
import {
  accountDefaultsFromProfile,
  isRegistrationComplete,
  loadUserProfile,
  updateProfileRow,
} from '../services/profileService.js';
import {
  completeOAuthRegistrationRpc,
  abandonIncompleteRegistrationRpc,
  mapOAuthRegistrationError,
} from '../services/oauthRegistrationService.js';
import { displayNameFromUser } from '../utils/registrationStatus.js';
import {
  deleteMyAccountRpc,
  revokeExternalIntegrations,
  mapAccountDeletionError,
} from '../services/accountDeletionService.js';
import { fetchUserCompany } from '../services/companyService.js';
import { setSyncUserId, setSyncCompanyContext, clearSyncCompanyContext, setSyncMemberPermissions } from '../services/sync/syncContext.js';
import { hasAnySharedReadPermission } from '../services/sync/cloudSync.js';
import { normalizeCompanyRole, isBusinessRole, isCeoRole, isSoloRole, usesTeamCloudSync } from '../data/companyRoles.js';
import { CEO_FULL_PERMISSIONS } from '../data/memberPermissions.js';
import { fetchMyMemberPermissions } from '../services/memberPermissionsService.js';
import { fetchCompanyTeam } from '../services/teamService.js';
import {
  getRememberMe,
  setRememberMe,
  clearSupabaseAuthTokens,
  getSupabaseProjectRef,
  syncAuthTokensToRememberStore,
} from '../lib/authStorage.js';

const AuthContext = createContext(null);

const DEV_BYPASS = import.meta.env.VITE_AUTH_DEV_BYPASS === 'true';

function readOAuthErrorFromUrl() {
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (fromQuery) return decodeURIComponent(fromQuery.replace(/\+/g, ' '));
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const fromHash = hash.get('error_description') || hash.get('error');
  if (fromHash) return decodeURIComponent(fromHash.replace(/\+/g, ' '));
  return null;
}

function isRecoveryCallbackUrl() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (hash.get('type') === 'recovery') return true;
  const url = new URL(window.location.href);
  return url.pathname === PASSWORD_RESET_REDIRECT_PATH && url.searchParams.get('type') === 'recovery';
}

function cleanAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  const dirty = url.searchParams.has('code') || url.searchParams.has('error') || url.hash.length > 1;
  if (!dirty) return;
  url.searchParams.delete('code');
  url.searchParams.delete('error');
  url.searchParams.delete('error_code');
  url.searchParams.delete('error_description');
  url.searchParams.delete('type');
  url.hash = '';
  const nextPath = url.pathname === PASSWORD_RESET_REDIRECT_PATH ? '/' : url.pathname;
  window.history.replaceState({}, document.title, `${nextPath}${url.search}`);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [companyRole, setCompanyRole] = useState(null);
  const [memberPermissions, setMemberPermissions] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(() => isRecoveryCallbackUrl());

  useEffect(() => {
    if (!isSupabaseConfigured) {
      if (DEV_BYPASS) setUser({ id: 'dev-local', email: 'dev@local' });
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
      }
      if (event === 'SIGNED_IN' && window.location.pathname !== PASSWORD_RESET_REDIRECT_PATH) {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const confirmTypes = new Set(['signup', 'email', 'email_change']);
        const isEmailConfirm = confirmTypes.has(hash.get('type') || '');
        syncAuthTokensToRememberStore(getSupabaseProjectRef());
        if (isEmailConfirm) {
          sessionStorage.setItem('authFlash', '이메일 인증이 완료되었습니다.');
        }
        cleanAuthParamsFromUrl();
      }
    });

    const initAuth = async () => {
      const urlError = readOAuthErrorFromUrl();
      if (urlError) {
        setAuthError(urlError);
        cleanAuthParamsFromUrl();
      }

      // SDK가 PKCE code + code_verifier 교환을 자동 처리 (initialize)
      const { error: initError } = await supabase.auth.initialize();
      if (initError && mounted) {
        console.error('[auth] initialize', initError);
        setAuthError(mapAuthErrorMessage(initError));
      }

      const { data: { session: s }, error } = await supabase.auth.getSession();
      if (error && mounted) {
        console.error('[auth] getSession', error);
        setAuthError(mapAuthErrorMessage(error));
      }
      if (mounted) {
        setSession(s);
        setUser(s?.user ?? null);
        if (s) syncAuthTokensToRememberStore(getSupabaseProjectRef());
        if (isRecoveryCallbackUrl() || window.location.pathname === PASSWORD_RESET_REDIRECT_PATH) {
          setPasswordRecovery(true);
        }
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user?.id && user.id !== 'dev-local') setSyncUserId(user.id);
    else if (!user) {
      setSyncUserId(null);
      clearSyncCompanyContext();
    }
  }, [user?.id]);

  useEffect(() => {
    const workspaceId = company?.id ?? profile?.company_id;
    const role = normalizeCompanyRole(companyRole ?? profile?.role);
    if (user?.id && user.id !== 'dev-local' && workspaceId) {
      setSyncCompanyContext({ companyId: workspaceId, role });
      if (isSoloRole(role)) {
        setSyncMemberPermissions(null);
      } else if (isCeoRole(role)) {
        setSyncMemberPermissions(CEO_FULL_PERMISSIONS);
      } else {
        setSyncMemberPermissions(memberPermissions);
      }
    } else if (user?.id === 'dev-local') {
      setSyncCompanyContext({ companyId: 'dev-local-company', role: 'CEO' });
      setSyncMemberPermissions(CEO_FULL_PERMISSIONS);
    }
  }, [user?.id, company?.id, profile?.company_id, profile?.role, companyRole, memberPermissions]);

  const memberPermsRef = useRef(null);
  const sessionAutoSyncedUserIdRef = useRef(null);

  const refreshMemberPermissions = useCallback(async () => {
    if (!user?.id || user.id === 'dev-local') {
      setMemberPermissions(isCeoRole(companyRole) ? CEO_FULL_PERMISSIONS : null);
      setTeamMembers([]);
      memberPermsRef.current = null;
      return;
    }
    const workspaceId = company?.id ?? profile?.company_id;
    if (!isSupabaseConfigured || !workspaceId) {
      setMemberPermissions(null);
      setTeamMembers([]);
      memberPermsRef.current = null;
      return;
    }
    const role = normalizeCompanyRole(companyRole ?? profile?.role);
    if (isSoloRole(role) || !usesTeamCloudSync(role)) {
      setMemberPermissions(null);
      setTeamMembers([]);
      memberPermsRef.current = null;
      return;
    }
    try {
      const [perms, team] = await Promise.all([
        fetchMyMemberPermissions(),
        isBusinessRole(role) ? fetchCompanyTeam() : Promise.resolve([]),
      ]);
      const next = isCeoRole(role) ? CEO_FULL_PERMISSIONS : perms;
      const prevKey = JSON.stringify(memberPermsRef.current);
      const nextKey = JSON.stringify(next);
      setTeamMembers(team ?? []);

      if (prevKey !== nextKey) {
        setSyncCompanyContext({ companyId: workspaceId, role });
        setSyncMemberPermissions(next);
        setMemberPermissions(next);
        memberPermsRef.current = next;

        // 권한 변경 시(최초 로드 제외) 직원 공유 데이터 재수신 — 최초는 세션 자동동기화가 담당
        if (prevKey != null && !isCeoRole(role) && hasAnySharedReadPermission(next)) {
          try {
            const { refreshSharedCloudData } = await import('../services/sync/cloudSync.js');
            await refreshSharedCloudData(user.id);
          } catch (syncErr) {
            console.error('[permissions] shared data refresh', syncErr);
          }
        }
      }
    } catch (err) {
      console.error('[permissions] load', err);
    }
  }, [user?.id, company?.id, profile?.company_id, profile?.role, companyRole]);

  useEffect(() => {
    refreshMemberPermissions();
  }, [refreshMemberPermissions]);

  // 최초 로그인(세션) — 팀 계정만 자동 동기화. 개인(SOLO)은 제외.
  useEffect(() => {
    if (loading || profileLoading) return;
    if (!user?.id || user.id === 'dev-local') return;
    if (!isSupabaseConfigured) return;

    const role = companyRole ?? profile?.role;
    if (!usesTeamCloudSync(role)) return;

    const workspaceId = company?.id ?? profile?.company_id;
    if (!workspaceId) return;

    // 직원: 권한 로드 완료 대기 (null이면 아직 미수신)
    if (!isCeoRole(role) && memberPermissions == null) return;

    if (sessionAutoSyncedUserIdRef.current === user.id) return;
    sessionAutoSyncedUserIdRef.current = user.id;

    (async () => {
      try {
        if (isCeoRole(role)) {
          const { initialCloudSync } = await import('../services/sync/cloudSync.js');
          await initialCloudSync(user.id);
        } else if (hasAnySharedReadPermission(memberPermissions)) {
          const { refreshSharedCloudData } = await import('../services/sync/cloudSync.js');
          await refreshSharedCloudData(user.id);
        }
      } catch (err) {
        console.error('[auth] session auto cloud sync', err);
        // 실패 시 같은 세션에서 재시도 가능하도록
        if (sessionAutoSyncedUserIdRef.current === user.id) {
          sessionAutoSyncedUserIdRef.current = null;
        }
      }
    })();
  }, [
    loading,
    profileLoading,
    user?.id,
    companyRole,
    profile?.role,
    company?.id,
    profile?.company_id,
    memberPermissions,
  ]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setCompany(null);
      setCompanyRole(null);
      setMemberPermissions(null);
      setTeamMembers([]);
      return;
    }
    if (user.id === 'dev-local') {
      setProfile({
        id: 'dev-local',
        display_name: '로컬 개발',
        agency_name: 'LandNote Dev',
        company_id: 'dev-local-company',
      });
      setCompany({ id: 'dev-local-company', name: 'LandNote Dev', slug: 'landnote-dev' });
      setCompanyRole('CEO');
      setMemberPermissions(CEO_FULL_PERMISSIONS);
      return;
    }
    if (!isSupabaseConfigured) return;

    setProfileLoading(true);
    let loadedProfile = null;
    try {
      loadedProfile = await loadUserProfile(user);
      setProfile(loadedProfile);
      if (!loadedProfile) {
        setCompany(null);
        setCompanyRole(null);
        return;
      }
      if (loadedProfile.company_id) {
        const { company: c, role } = await fetchUserCompany(user.id);
        setCompany(c);
        setCompanyRole(role ?? (loadedProfile.role ? normalizeCompanyRole(loadedProfile.role) : null));
      } else {
        setCompany(null);
        setCompanyRole(loadedProfile.user_type === 'SOLO' ? 'SOLO' : null);
      }
    } catch (err) {
      console.error('[profile] load', err);
      if (loadedProfile?.role) {
        setCompanyRole(normalizeCompanyRole(loadedProfile.role));
      }
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const accountDefaults = useMemo(
    () => accountDefaultsFromProfile(user, profile, company),
    [user, profile, company],
  );

  const needsSignupCompletion = useMemo(() => {
    if (!user?.id || user.id === 'dev-local' || passwordRecovery) return false;
    if (profileLoading || loading) return false;
    return !profile || !isRegistrationComplete(profile);
  }, [user?.id, profile, profileLoading, loading, passwordRecovery]);

  const updateProfile = useCallback(async (patch) => {
    if (!user?.id) return { error: new Error('로그인이 필요합니다.') };
    if (user.id === 'dev-local') {
      const metaKeys = ['title', 'phone', 'tel', 'agency_phone', 'address', 'website'];
      setProfile((prev) => ({
        ...prev,
        ...(patch.display_name != null ? { display_name: patch.display_name } : {}),
        ...(patch.agency_name != null ? { agency_name: patch.agency_name } : {}),
      }));
      setUser((prev) => ({
        ...prev,
        user_metadata: {
          ...prev?.user_metadata,
          ...Object.fromEntries(metaKeys.filter((k) => k in patch).map((k) => [k, patch[k]])),
        },
      }));
      return { error: null };
    }
    const { data, user: updatedUser, error } = await updateProfileRow(user.id, patch);
    if (!error) {
      if (data) setProfile(data);
      if (updatedUser) setUser(updatedUser);
    }
    return { data, error };
  }, [user]);

  /**
   * 설정에서 비밀번호 변경 — 현재 비밀번호 재인증 후 갱신
   * @param {string} newPassword
   * @param {{ currentPassword: string }} opts
   */
  const updatePassword = useCallback(async (newPassword, { currentPassword } = {}) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') };
    }
    if (!currentPassword) {
      const message = '현재 비밀번호를 입력해 주세요.';
      setAuthError(message);
      return { error: new Error(message) };
    }
    const email = user?.email;
    if (!email) {
      return { error: new Error('이메일 정보를 확인할 수 없습니다.') };
    }
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password: currentPassword,
    });
    if (reauthErr) {
      const raw = mapAuthErrorMessage(reauthErr) || '';
      const message = /비밀번호|credentials|login|Invalid/i.test(raw)
        ? '현재 비밀번호가 일치하지 않습니다.'
        : (raw || '현재 비밀번호가 일치하지 않습니다.');
      setAuthError(message);
      return { error: new Error(message) };
    }
    const pwErr = validatePassword(newPassword, { forSignup: true });
    if (pwErr) {
      setAuthError(pwErr);
      return { error: new Error(pwErr) };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      const message = mapAuthErrorMessage(error);
      setAuthError(message);
      return { error: new Error(message) };
    }
    await supabase.auth.signOut({ scope: 'others' });
    return { error: null };
  }, [user?.email]);

  /** 현재 비밀번호만 검증 (새 비밀번호 입력 팝업 진입용) */
  const verifyCurrentPassword = useCallback(async (currentPassword) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') };
    }
    if (!currentPassword) {
      const message = '현재 비밀번호를 입력해 주세요.';
      setAuthError(message);
      return { error: new Error(message) };
    }
    const email = user?.email;
    if (!email) {
      return { error: new Error('이메일 정보를 확인할 수 없습니다.') };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password: currentPassword,
    });
    if (error) {
      const raw = mapAuthErrorMessage(error) || '';
      const message = /비밀번호|credentials|login|Invalid/i.test(raw)
        ? '현재 비밀번호가 일치하지 않습니다.'
        : (raw || '현재 비밀번호가 일치하지 않습니다.');
      setAuthError(message);
      return { error: new Error(message) };
    }
    return { error: null };
  }, [user?.email]);

  const confirmPasswordReset = useCallback(async (newPassword) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') };
    }
    const pwErr = validatePassword(newPassword, { forSignup: true });
    if (pwErr) {
      setAuthError(pwErr);
      return { error: new Error(pwErr) };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      const message = mapAuthErrorMessage(error);
      setAuthError(message);
      return { error: new Error(message) };
    }
    await supabase.auth.signOut({ scope: 'global' });
    setPasswordRecovery(false);
    setSession(null);
    setUser(null);
    cleanAuthParamsFromUrl();
    return { error: null };
  }, []);

  const signInWithEmail = useCallback(async (email, password, { rememberMe = getRememberMe() } = {}) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      if (DEV_BYPASS) {
        setUser({ id: 'dev-local', email });
        return { error: null };
      }
      return { error: new Error('Supabase가 설정되지 않았습니다.') };
    }

    const normalized = normalizeEmail(email);
    const emailErr = validateEmail(normalized);
    if (emailErr) {
      const err = new Error(emailErr);
      setAuthError(emailErr);
      return { error: err };
    }
    if (!password) {
      const err = new Error('비밀번호를 입력해 주세요.');
      setAuthError(err.message);
      return { error: err };
    }

    setRememberMe(rememberMe);
    clearSupabaseAuthTokens(getSupabaseProjectRef());

    const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) {
      const message = mapAuthErrorMessage(error);
      setAuthError(message);
      return { error: { ...error, message } };
    }
    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      const message = mapAuthErrorMessage({ message: 'Email not confirmed' });
      setAuthError(message);
      return { error: new Error(message) };
    }
    setSession(data.session);
    setUser(data.user);
    syncAuthTokensToRememberStore(getSupabaseProjectRef());
    return { error: null };
  }, []);

  const signUpWithEmail = useCallback(async (email, password, consent, {
    companyName = '',
    inviteToken = '',
    userType = 'SOLO',
    displayName = '',
  } = {}) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') };
    }

    const normalized = normalizeEmail(email);
    const emailErr = validateEmail(normalized);
    if (emailErr) {
      setAuthError(emailErr);
      return { error: new Error(emailErr) };
    }
    const pwErr = validatePassword(password, { forSignup: true });
    if (pwErr) {
      setAuthError(pwErr);
      return { error: new Error(pwErr) };
    }
    if (!consent?.terms_required_agreed) {
      const errMsg = '필수 약관에 동의해주세요.';
      setAuthError(errMsg);
      return { error: new Error(errMsg) };
    }

    const trimmedCompany = String(companyName || '').trim();
    let trimmedInvite = String(inviteToken || '').trim();
    const trimmedName = String(displayName || '').trim();
    const normalizedType = String(userType || 'SOLO').toUpperCase() === 'BUSINESS' ? 'BUSINESS' : 'SOLO';

    // 회사명으로 대표(CEO) 가입 시 초대 토큰은 무시 (직원 가입과 충돌 방지)
    if (normalizedType === 'BUSINESS' && trimmedCompany && trimmedInvite) {
      trimmedInvite = '';
    }

    if (!trimmedName) {
      const errMsg = normalizedType === 'BUSINESS' ? '대표자 이름을 입력해 주세요.' : '이름을 입력해 주세요.';
      setAuthError(errMsg);
      return { error: new Error(errMsg) };
    }
    if (normalizedType === 'BUSINESS' && !trimmedInvite && !trimmedCompany) {
      const errMsg = '회사명을 입력해 주세요.';
      setAuthError(errMsg);
      return { error: new Error(errMsg) };
    }

    /** @type {Record<string, unknown>} */
    const meta = {
      terms_version: consent.terms_version,
      terms_required_agreed: consent.terms_required_agreed,
      marketing_agreed: consent.marketing_agreed,
      terms_agreed_at: consent.terms_agreed_at,
      terms_items: consent.terms_items,
      display_name: trimmedName,
      full_name: trimmedName,
      user_type: trimmedInvite ? 'BUSINESS' : normalizedType,
    };
    if (trimmedInvite) {
      meta.invite_token = trimmedInvite;
    } else if (normalizedType === 'BUSINESS') {
      meta.company_name = trimmedCompany;
      meta.agency_name = trimmedCompany;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalized,
      password,
      options: {
        emailRedirectTo: authRedirectUrl('/login'),
        data: meta,
      },
    });
    if (error) {
      const message = mapAuthErrorMessage(error);
      setAuthError(message);
      return { error: { ...error, message } };
    }

    const needsEmailConfirmation = !data.user?.email_confirmed_at;
    if (needsEmailConfirmation) {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      return { error: null, needsEmailConfirmation: true };
    }

    setSession(data.session);
    setUser(data.user);
    return { error: null, needsEmailConfirmation: false };
  }, []);

  const signInWithGoogleCredential = useCallback(async (credential, { rememberMe = getRememberMe() } = {}) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') };
    }
    setRememberMe(rememberMe);
    clearSupabaseAuthTokens(getSupabaseProjectRef());
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: credential,
    });
    if (error) {
      const message = mapAuthErrorMessage(error);
      setAuthError(message);
      return { error: { ...error, message }, user: null };
    }
    setSession(data.session);
    setUser(data.user);
    syncAuthTokensToRememberStore(getSupabaseProjectRef());
    return { error: null, user: data?.user ?? null };
  }, []);

  const completeOAuthSignup = useCallback(async ({
    consent,
    userType = 'SOLO',
    displayName = '',
    companyName = '',
    inviteToken = '',
  } = {}) => {
    setAuthError(null);
    if (!isSupabaseConfigured || !user?.id) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') };
    }
    if (!consent?.terms_required_agreed) {
      const errMsg = '필수 약관에 동의해 주세요.';
      setAuthError(errMsg);
      return { error: new Error(errMsg) };
    }

    const trimmedName = String(displayName || displayNameFromUser(user)).trim();
    const normalizedType = String(userType || 'SOLO').toUpperCase() === 'BUSINESS' ? 'BUSINESS' : 'SOLO';
    const trimmedCompany = String(companyName || '').trim();
    let trimmedInvite = String(inviteToken || '').trim();

    if (normalizedType === 'BUSINESS' && trimmedCompany && trimmedInvite) {
      trimmedInvite = '';
    }

    if (!trimmedName) {
      const errMsg = normalizedType === 'BUSINESS' ? '대표자 이름을 입력해 주세요.' : '이름을 입력해 주세요.';
      setAuthError(errMsg);
      return { error: new Error(errMsg) };
    }
    if (normalizedType === 'BUSINESS' && !trimmedInvite && !trimmedCompany) {
      const errMsg = '회사명을 입력해 주세요.';
      setAuthError(errMsg);
      return { error: new Error(errMsg) };
    }

    try {
      await completeOAuthRegistrationRpc({
        consent,
        userType: trimmedInvite ? 'BUSINESS' : normalizedType,
        displayName: trimmedName,
        companyName: trimmedCompany,
        inviteToken: trimmedInvite,
      });
      await supabase.auth.updateUser({
        data: {
          display_name: trimmedName,
          full_name: trimmedName,
          user_type: trimmedInvite ? 'BUSINESS' : normalizedType,
          ...(normalizedType === 'BUSINESS' && trimmedCompany
            ? { company_name: trimmedCompany, agency_name: trimmedCompany }
            : {}),
        },
      });
      await refreshProfile();
      return { error: null };
    } catch (err) {
      const message = mapOAuthRegistrationError(err);
      setAuthError(message);
      return { error: err instanceof Error ? err : new Error(message) };
    }
  }, [user, refreshProfile]);

  const abandonOAuthSignup = useCallback(async () => {
    setAuthError(null);
    if (!isSupabaseConfigured || !user?.id) {
      setUser(null);
      setSession(null);
      return { error: null };
    }
    try {
      await abandonIncompleteRegistrationRpc();
    } catch (err) {
      console.error('[abandonOAuthSignup]', err);
    }
    try {
      const { wipeLocalDataOnAccountDeletion } = await import('../services/sync/localDataCleanup.js');
      await wipeLocalDataOnAccountDeletion(user.id);
    } catch (err) {
      console.error('[abandonOAuthSignup] local cleanup', err);
    }
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      /* user may already be deleted */
    }
    clearSupabaseAuthTokens(getSupabaseProjectRef());
    setProfile(null);
    setCompany(null);
    setCompanyRole(null);
    setUser(null);
    setSession(null);
    return { error: null };
  }, [user]);

  const signInWithOAuth = useCallback(async (provider, { rememberMe = getRememberMe() } = {}) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') };
    }

    setRememberMe(rememberMe);
    clearSupabaseAuthTokens(getSupabaseProjectRef());

    const redirectTo = `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) setAuthError(mapAuthErrorMessage(error));
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    setSyncUserId(null);
    clearSyncCompanyContext();
    sessionAutoSyncedUserIdRef.current = null;
    memberPermsRef.current = null;
    const { resetSyncSession } = await import('../services/sync/syncGate.js');
    resetSyncSession();
    setProfile(null);
    setCompany(null);
    setCompanyRole(null);
    setMemberPermissions(null);
    setTeamMembers([]);
    // IndexedDB는 지우지 않음 — 같은 계정 재로그인 시 가져오기/로컬 데이터 유지.
    // 다른 계정으로 로그인하면 prepareLocalStoreForUser가 전환 시에만 클리어.
    if (!isSupabaseConfigured) {
      setUser(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
    clearSupabaseAuthTokens(getSupabaseProjectRef());
    setUser(null);
    setSession(null);
  }, []);

  const deleteAccount = useCallback(async ({ password } = {}) => {
    setAuthError(null);
    if (!isSupabaseConfigured || !user?.id) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') };
    }
    if (user.id === 'dev-local') {
      return { error: new Error('로컬 개발 모드에서는 탈퇴할 수 없습니다.') };
    }

    const email = user.email;
    if (password) {
      if (!email) {
        return { error: new Error('이메일 정보를 확인할 수 없습니다.') };
      }
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (reauthErr) {
        const message = mapAccountDeletionError(reauthErr);
        setAuthError(message);
        return { error: new Error(message) };
      }
    }

    try {
      await revokeExternalIntegrations(user);
      await deleteMyAccountRpc();
    } catch (err) {
      const message = mapAccountDeletionError(err);
      setAuthError(message);
      return { error: err instanceof Error ? err : new Error(message) };
    }

    setSyncUserId(null);
    clearSyncCompanyContext();
    setProfile(null);
    setCompany(null);
    setCompanyRole(null);
    try {
      const { wipeLocalDataOnAccountDeletion } = await import('../services/sync/localDataCleanup.js');
      await wipeLocalDataOnAccountDeletion(user.id);
    } catch (err) {
      console.error('[deleteAccount] local cleanup', err);
    }
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      /* auth user already deleted */
    }
    clearSupabaseAuthTokens(getSupabaseProjectRef());
    setUser(null);
    setSession(null);
    return { error: null };
  }, [user]);

  const resetPassword = useCallback(async (email) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase가 설정되지 않았습니다.') };
    }
    const normalized = normalizeEmail(email);
    const emailErr = validateEmail(normalized);
    if (emailErr) {
      setAuthError(emailErr);
      return { error: new Error(emailErr) };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: authRedirectUrl(PASSWORD_RESET_REDIRECT_PATH),
    });
    if (error) {
      console.error('[resetPassword]', error);
      const message = mapAuthErrorMessage(error);
      setAuthError(message);
      return { error: new Error(message) };
    }
    return { error: null };
  }, []);

  const teamNameMap = useMemo(() => {
    /** @type {Record<string, string>} */
    const map = {};
    for (const m of teamMembers) {
      map[m.user_id] = m.display_name || (m.email ? String(m.email).split('@')[0] : '동료');
    }
    if (user?.id) {
      map[user.id] = profile?.display_name || accountDefaultsFromProfile(user, profile, company).displayName || '나';
    }
    return map;
  }, [teamMembers, user, profile, company]);

  const teamRoleMap = useMemo(() => {
    /** @type {Record<string, string>} */
    const map = {};
    for (const m of teamMembers) {
      map[m.user_id] = m.role || 'MEMBER';
    }
    return map;
  }, [teamMembers]);

  useEffect(() => {
    if (!user?.id || user.id === 'dev-local' || !isSupabaseConfigured) return undefined;
    const onFocus = () => { refreshMemberPermissions(); };
    window.addEventListener('focus', onFocus);
    // 직원: 대표가 권한을 켠 뒤에도 포커스 없이 반영되도록 주기적으로 권한 재조회
    const intervalId = window.setInterval(() => {
      refreshMemberPermissions();
    }, 20000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
    };
  }, [user?.id, refreshMemberPermissions]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    company,
    companyRole,
    memberPermissions,
    teamMembers,
    teamNameMap,
    teamRoleMap,
    profileLoading,
    needsSignupCompletion,
    accountDefaults,
    loading,
    authError,
    passwordRecovery,
    isConfigured: isSupabaseConfigured,
    isDevBypass: !isSupabaseConfigured && DEV_BYPASS,
    rememberMe: getRememberMe(),
    setRememberMePreference: setRememberMe,
    getRememberMePreference: getRememberMe,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signInWithGoogleCredential,
    completeOAuthSignup,
    abandonOAuthSignup,
    signOut,
    deleteAccount,
    resetPassword,
    confirmPasswordReset,
    updateProfile,
    updatePassword,
    verifyCurrentPassword,
    refreshProfile,
    refreshMemberPermissions,
    clearAuthError: () => setAuthError(null),
  }), [user, session, profile, company, companyRole, memberPermissions, teamMembers, teamNameMap, teamRoleMap, profileLoading, needsSignupCompletion, accountDefaults, loading, authError, passwordRecovery, signInWithEmail, signUpWithEmail, signInWithOAuth, signInWithGoogleCredential, completeOAuthSignup, abandonOAuthSignup, signOut, deleteAccount, resetPassword, confirmPasswordReset, updateProfile, updatePassword, verifyCurrentPassword, refreshProfile, refreshMemberPermissions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
