type MockSession = {
  user: {
    id: string;
    name: string;
    email: string;
    role: "SUPER_ADMIN" | "COORDINATOR" | "FACULTY";
  };
};

export async function requireAuth(): Promise<MockSession> {
  return {
    user: {
      id: "dev-user-1",
      name: "Admin",
      email: "admin@local",
      role: "SUPER_ADMIN",
    },
  };
}

export async function requireSuperAdmin() {
  return requireAuth();
}

export async function requireCoordinatorOrAdmin() {
  return requireAuth();
}

export async function requireFacultyOrAdmin() {
  return requireAuth();
}

export async function requireCoordinatorOrAdminApi() {
  return requireCoordinatorOrAdmin();
}

export async function requireSuperAdminApi() {
  return requireSuperAdmin();
}

export async function requireFacultyOrAdminApi() {
  return requireFacultyOrAdmin();
}