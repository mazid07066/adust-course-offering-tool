import { getSessionUser } from "@/lib/auth-session";

export async function auth() {
  const user = await getSessionUser();

  if (!user) {
    return null;
  }

  return {
    user: {
      id: String(user.id),
      username: user.username,
      name: user.full_name,
      role: user.role,
      teacherId: user.teacher_id,
      isActive: user.is_active,
    },
  };
}

export const handlers = {
  GET: async () => {
    return new Response("NextAuth legacy route is disabled.", { status: 410 });
  },
  POST: async () => {
    return new Response("NextAuth legacy route is disabled.", { status: 410 });
  },
};

export async function signIn() {
  throw new Error("Use /auth/login and /api/auth/login for this project.");
}

export async function signOut() {
  throw new Error("Use /api/auth/logout for this project.");
}