import ResetPasswordPageClient from "./page-client";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export default async function ResetPasswordPage(
  props: ResetPasswordPageProps
) {
  const searchParams =
    await props.searchParams;

  const tokenValue =
    searchParams.token;

  const token =
    Array.isArray(tokenValue)
      ? tokenValue[0] || ""
      : tokenValue || "";

  return (
    <ResetPasswordPageClient
      token={token}
    />
  );
}
