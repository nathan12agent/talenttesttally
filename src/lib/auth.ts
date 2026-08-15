import { signInAnonymously, UserCredential } from 'firebase/auth';
import { auth } from './firebase';

// Re-export auth for convenience
export { auth };

/**
 * Signs in anonymously with up to 3 retries on failure.
 * Waits 500 ms between each attempt.
 * Throws the last error if all 3 attempts fail.
 */
export async function signInAnonymouslyWithRetry(): Promise<UserCredential> {
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 500;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await signInAnonymously(auth);
    } catch (error) {
      lastError = error;

      if (attempt < MAX_ATTEMPTS) {
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw lastError;
}
