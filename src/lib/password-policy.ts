export const PASSWORD_MIN_LENGTH = 8;

export function validateUniFlowPassword(password: string) {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(
      `Password must contain at least ${PASSWORD_MIN_LENGTH} characters.`
    );
  }

  if (!/[A-Z]/.test(password)) {
    errors.push(
      "Password must contain at least one uppercase letter."
    );
  }

  if (!/[a-z]/.test(password)) {
    errors.push(
      "Password must contain at least one lowercase letter."
    );
  }

  if (!/[0-9]/.test(password)) {
    errors.push(
      "Password must contain at least one number."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
