import bcrypt from "bcryptjs";

export async function hashStudentPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyStudentPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function validateStudentPasswordStrength(password: string) {
  if (!password || password.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long.",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must include at least one uppercase letter.",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: "Password must include at least one lowercase letter.",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must include at least one number.",
    };
  }

  return {
    valid: true,
    message: "Password is strong enough.",
  };
}