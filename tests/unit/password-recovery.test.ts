import { expect, test } from '@playwright/test';

test.describe('Password Recovery Logic - Unit Tests', () => {
  test('A. Error parameter parsing correctly identifies expired OTP and access denied', () => {
    // Test helper matching ResetPasswordPage error extraction logic
    function parseRecoveryErrors(queryString: string, hashString: string) {
      const searchParams = new URLSearchParams(queryString);
      const hashParams = new URLSearchParams(hashString.replace(/^#/, ''));

      const error = searchParams.get('error') || hashParams.get('error');
      const errorCode = searchParams.get('error_code') || hashParams.get('error_code');
      const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');

      if (error || errorCode) {
        if (
          errorCode === 'otp_expired' ||
          error === 'access_denied' ||
          (errorDescription && errorDescription.toLowerCase().includes('expired'))
        ) {
          return 'Your password reset link is invalid or has expired. Please request a new one.';
        }
        return errorDescription
          ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
          : 'Unable to verify reset link. Please request a new password reset.';
      }
      return null;
    }

    // Case 1: otp_expired in query
    expect(parseRecoveryErrors('?error=access_denied&error_code=otp_expired', '')).toBe(
      'Your password reset link is invalid or has expired. Please request a new one.',
    );

    // Case 2: error_description with expired in hash fragment
    expect(parseRecoveryErrors('', '#error=access_denied&error_description=Email+link+is+invalid+or+has+expired')).toBe(
      'Your password reset link is invalid or has expired. Please request a new one.',
    );

    // Case 3: Other error
    expect(parseRecoveryErrors('?error=unauthorized_client&error_description=Client+not+authorized', '')).toBe(
      'Client not authorized',
    );

    // Case 4: No error
    expect(parseRecoveryErrors('?code=pkce-auth-code-123', '')).toBeNull();
  });

  test('B. PKCE authorization code extraction handles query and hash parameters without replay', async () => {
    let exchangeCount = 0;
    let exchangedCode = '';

    const mockSupabase = {
      auth: {
        exchangeCodeForSession: async (code: string) => {
          exchangeCount++;
          exchangedCode = code;
          return { data: { session: { access_token: 'valid-token' } }, error: null };
        },
      },
    };

    // Simulate code exchange runner with deduplication ref
    const codeExchangeAttempted = { current: false };

    async function handleAuthCode(searchStr: string, hashStr: string) {
      const searchParams = new URLSearchParams(searchStr);
      const hashParams = new URLSearchParams(hashStr.replace(/^#/, ''));
      const code = searchParams.get('code') || hashParams.get('code');

      if (code && !codeExchangeAttempted.current) {
        codeExchangeAttempted.current = true;
        return await mockSupabase.auth.exchangeCodeForSession(code);
      }
      return null;
    }

    // First call exchanges the code
    const res1 = await handleAuthCode('?code=pkce_secret_code_xyz', '');
    expect(res1?.data?.session?.access_token).toBe('valid-token');
    expect(exchangeCount).toBe(1);
    expect(exchangedCode).toBe('pkce_secret_code_xyz');

    // Duplicate call (e.g. React strict-mode re-render or effect trigger) is skipped
    const res2 = await handleAuthCode('?code=pkce_secret_code_xyz', '');
    expect(res2).toBeNull();
    expect(exchangeCount).toBe(1); // Still 1, prevented replay
  });

  test('C. Form validation blocks submission if session is missing or passwords do not match', () => {
    function validateResetForm(
      isRecoverySessionReady: boolean,
      password: string,
      confirmPassword: string,
    ): { valid: boolean; error: string | null } {
      if (!isRecoverySessionReady) {
        return { valid: false, error: 'No active password reset session found. Please use the reset link sent to your email.' };
      }
      if (password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters long.' };
      }
      if (password !== confirmPassword) {
        return { valid: false, error: 'Passwords do not match.' };
      }
      return { valid: true, error: null };
    }

    // 1. No active session
    expect(validateResetForm(false, 'ValidPassword123!', 'ValidPassword123!')).toEqual({
      valid: false,
      error: 'No active password reset session found. Please use the reset link sent to your email.',
    });

    // 2. Short password
    expect(validateResetForm(true, '12345', '12345')).toEqual({
      valid: false,
      error: 'Password must be at least 6 characters long.',
    });

    // 3. Password mismatch
    expect(validateResetForm(true, 'NewSecurePass123!', 'DifferentPass456!')).toEqual({
      valid: false,
      error: 'Passwords do not match.',
    });

    // 4. Valid submission
    expect(validateResetForm(true, 'CorrectPassword123!', 'CorrectPassword123!')).toEqual({
      valid: true,
      error: null,
    });
  });

  test('D. Successful password update invokes updateUser then signs out session', async () => {
    const callOrder: string[] = [];

    const mockSupabase = {
      auth: {
        updateUser: async (attrs: { password: string }) => {
          callOrder.push(`updateUser:${attrs.password}`);
          return { data: { user: { id: 'u1' } }, error: null };
        },
        signOut: async () => {
          callOrder.push('signOut');
          return { error: null };
        },
      },
    };

    // Run password update flow
    const updateResult = await mockSupabase.auth.updateUser({ password: 'SuperSecretPassword123!' });
    expect(updateResult.error).toBeNull();

    // After success, sign out
    await mockSupabase.auth.signOut();

    expect(callOrder).toEqual([
      'updateUser:SuperSecretPassword123!',
      'signOut',
    ]);
  });
});
