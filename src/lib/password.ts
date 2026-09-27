export const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores anything past 72 bytes

/** Returns what's wrong with a new password, or null if it's acceptable. */
export function passwordProblem(
  password: string,
  context: { email: string; name: string; business: string },
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "Keep it under 72 characters.";
  }
  if (/^(.)\1+$/.test(password) || /^(?:0123456789|1234567890|abcdefghijkl)/i.test(password)) {
    return "That's too easy to guess.";
  }
  const lower = password.toLowerCase();
  const personal = [context.email.split("@")[0], context.name, context.business]
    .flatMap((part) => part.toLowerCase().split(/[^a-z0-9]+/))
    .filter((word) => word.length >= 4);
  if (personal.some((word) => lower.includes(word))) {
    return "Don't use your name, business or email in it.";
  }
  return null;
}

/** 0-4, for the strength bar. Length matters most; variety helps. */
export function passwordScore(password: string) {
  if (!password) return 0;
  if (new Set(password).size < 5) return 1;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (password.length < MIN_PASSWORD_LENGTH) return 1;
  if (password.length >= 20 || (password.length >= 16 && variety >= 3)) return 4;
  if (password.length >= 14 || variety >= 3) return 3;
  return 2;
}

/**
 * How many times this password appears in known data breaches (Have I Been Pwned).
 * k-anonymity: only the first 5 characters of the SHA-1 hash ever leave the device.
 * Returns null if the check can't be completed, so signup is never blocked by an outage.
 */
export async function breachCount(password: string): Promise<number | null> {
  try {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!response.ok) return null;
    const suffix = hash.slice(5);
    for (const line of (await response.text()).split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate === suffix) return Number(count);
    }
    return 0;
  } catch {
    return null;
  }
}
