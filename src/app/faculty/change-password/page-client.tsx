"use client";

import Link from "next/link";

import {
  FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type ChangePasswordResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  passwordErrors?: string[];
};

export default function ChangePasswordPageClient() {
  const router =
    useRouter();

  const [
    currentPassword,
    setCurrentPassword,
  ] =
    useState("");

  const [
    newPassword,
    setNewPassword,
  ] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");

  const [
    showPasswords,
    setShowPasswords,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    completed,
    setCompleted,
  ] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        "New password and confirmation password do not match."
      );

      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/faculty/change-password",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                currentPassword,
                newPassword,
                confirmPassword,
              }),
          }
        );

      const data:
        ChangePasswordResponse =
          await response.json();

      if (!response.ok) {
        if (
          response.status ===
          401
        ) {
          setError(
            data.error ||
              "Your session is no longer active."
          );

          setTimeout(() => {
            router.push(
              "/auth/login"
            );
          }, 1800);

          return;
        }

        throw new Error(
          data.error ||
            "Unable to change your password."
        );
      }

      setCompleted(true);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setMessage(
        data.message ||
          "Your password has been changed successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to change your password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-lg">

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 bg-slate-900 px-6 py-6 text-white">
            <h1 className="text-2xl font-bold">
              UniFlow Academic Planner
            </h1>

            <p className="mt-1 text-sm text-slate-300">
              Faculty Password Management
            </p>
          </div>

          <div className="p-6">

            {completed ? (
              <div className="space-y-5">

                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm leading-6 text-green-800">
                  {message}
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-6 text-blue-800">
                  Your username has not changed. Sign in again using
                  the same existing UniFlow username and your new password.
                </div>

                <Link
                  href="/auth/login"
                  className="flex w-full justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Sign In Again
                </Link>

              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >

                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Change Password
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Enter your current UniFlow password, then choose
                    a new password.
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                  Your UniFlow username will remain unchanged.
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="font-semibold">
                    New password requirements
                  </div>

                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>
                      At least 8 characters
                    </li>

                    <li>
                      At least one uppercase letter
                    </li>

                    <li>
                      At least one lowercase letter
                    </li>

                    <li>
                      At least one number
                    </li>

                    <li>
                      Must be different from the current password
                    </li>
                  </ul>
                </div>

                <div>
                  <label
                    htmlFor="currentPassword"
                    className="mb-1 block text-sm font-semibold text-slate-700"
                  >
                    Current Password
                  </label>

                  <input
                    id="currentPassword"
                    type={
                      showPasswords
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(event) =>
                      setCurrentPassword(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="newPassword"
                    className="mb-1 block text-sm font-semibold text-slate-700"
                  >
                    New Password
                  </label>

                  <input
                    id="newPassword"
                    type={
                      showPasswords
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-1 block text-sm font-semibold text-slate-700"
                  >
                    Confirm New Password
                  </label>

                  <input
                    id="confirmPassword"
                    type={
                      showPasswords
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={showPasswords}
                    onChange={(event) =>
                      setShowPasswords(
                        event.target.checked
                      )
                    }
                    className="h-4 w-4"
                  />

                  Show passwords
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "Changing Password..."
                    : "Change Password"}
                </button>

                <div className="text-center">
                  <Link
                    href="/faculty/course-choice"
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Return to Faculty Course Choice
                  </Link>
                </div>

              </form>
            )}

          </div>
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          After a successful password change, all active UniFlow
          sessions for your faculty account are closed for security.
        </p>

      </div>
    </main>
  );
}
