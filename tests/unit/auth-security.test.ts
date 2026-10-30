import { expect, test } from '@playwright/test';
import { getAuthSession } from '../../packages/auth/src/databricks-auth';

test.describe('Authentication Security & Boundary Tests', () => {
  const originalPlaywright = process.env.PLAYWRIGHT;
  const originalHost = process.env.DATABRICKS_HOST;
  const originalAppName = process.env.DATABRICKS_APP_NAME;
  const originalClientId = process.env.DATABRICKS_CLIENT_ID;

  test.afterEach(() => {
    // Restore environment variables
    if (originalPlaywright !== undefined) {
      process.env.PLAYWRIGHT = originalPlaywright;
    } else {
      delete process.env.PLAYWRIGHT;
    }
    if (originalHost !== undefined) {
      process.env.DATABRICKS_HOST = originalHost;
    } else {
      delete process.env.DATABRICKS_HOST;
    }
    if (originalAppName !== undefined) {
      process.env.DATABRICKS_APP_NAME = originalAppName;
    } else {
      delete process.env.DATABRICKS_APP_NAME;
    }
    if (originalClientId !== undefined) {
      process.env.DATABRICKS_CLIENT_ID = originalClientId;
    } else {
      delete process.env.DATABRICKS_CLIENT_ID;
    }
  });

  test('Production requests without valid authentication are rejected (returns null)', async () => {
    // Simulate production environment (PLAYWRIGHT unset, not Databricks)
    delete process.env.PLAYWRIGHT;
    delete process.env.DATABRICKS_HOST;
    delete process.env.DATABRICKS_APP_NAME;
    delete process.env.DATABRICKS_CLIENT_ID;

    const session = await getAuthSession({
      getRequestHeader: () => null,
    });

    expect(session).toBeNull();
  });

  test('Client-supplied identity headers cannot authenticate arbitrary production users', async () => {
    // Simulate public web host (like Render) outside of Databricks Apps
    delete process.env.PLAYWRIGHT;
    delete process.env.DATABRICKS_HOST;
    delete process.env.DATABRICKS_APP_NAME;
    delete process.env.DATABRICKS_CLIENT_ID;

    // Attacker sends spoofed X-Forwarded-User header
    const headers: Record<string, string> = {
      'x-forwarded-user': 'attacker-identity',
      'x-forwarded-email': 'attacker@malicious.com',
    };

    const session = await getAuthSession({
      getRequestHeader: (name: string) => headers[name.toLowerCase()] ?? null,
    });

    // In production without verified Databricks environment, client-supplied headers MUST NOT authenticate
    expect(session).toBeNull();
  });

  test('Anonymous-test headers cannot bypass authentication in a production build', async () => {
    // In production, test-specific bypass or anonymous headers have no effect
    delete process.env.PLAYWRIGHT;
    delete process.env.DATABRICKS_HOST;
    delete process.env.DATABRICKS_APP_NAME;

    const headers: Record<string, string> = {
      'x-anonymous': 'true',
      'x-forwarded-user': 'anonymous',
    };

    const session = await getAuthSession({
      getRequestHeader: (name: string) => headers[name.toLowerCase()] ?? null,
    });

    expect(session).toBeNull();
  });

  test('Test-mode authentication works only when PLAYWRIGHT===True flag is set', async () => {
    // 1. Without PLAYWRIGHT flag: returns null for unverified callers
    delete process.env.PLAYWRIGHT;
    delete process.env.DATABRICKS_HOST;
    delete process.env.DATABRICKS_APP_NAME;

    const prodSession = await getAuthSession({
      getRequestHeader: () => null,
    });
    expect(prodSession).toBeNull();

    // 2. With explicit PLAYWRIGHT flag: test fallback operates
    process.env.PLAYWRIGHT = 'True';
    const testSession = await getAuthSession({
      getRequestHeader: () => null,
    });
    expect(testSession).not.toBeNull();
    expect(testSession?.user?.id).toBe('test-user-id');
  });

  test('Test-mode correctly marks anonymous requests as unauthenticated when header is set', async () => {
    process.env.PLAYWRIGHT = 'True';

    const session = await getAuthSession({
      getRequestHeader: (name: string) =>
        name.toLowerCase() === 'x-anonymous' ? 'true' : null,
    });

    expect(session).toBeNull();
  });
});
