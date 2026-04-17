import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: "SUPER_ADMIN" | "COORDINATOR" | "FACULTY";
      departmentId?: string | null;
      departmentCode?: string | null;
      facultyId?: string | null;
      facultyInitial?: string | null;
    };
  }

  interface User {
    role: "SUPER_ADMIN" | "COORDINATOR" | "FACULTY";
    departmentId?: string | null;
    departmentCode?: string | null;
    facultyId?: string | null;
    facultyInitial?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: "SUPER_ADMIN" | "COORDINATOR" | "FACULTY";
    departmentId?: string | null;
    departmentCode?: string | null;
    facultyId?: string | null;
    facultyInitial?: string | null;
  }
}