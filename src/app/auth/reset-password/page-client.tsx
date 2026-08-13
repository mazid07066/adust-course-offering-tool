"use client";

import {
  FormEvent,
  useState,
} from "react";

type ResetPasswordPageClientProps = {
  token: string;
};

type ResetResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  passwordErrors?: string[];
};

export default function ResetPasswordPageClient(
  props: ResetPasswordPageClientProps
) {
  const {
    token,
  } = props;

  const [newPassword, setNewPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [completed, setCompleted] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!token) {
      setError(
        "The password-reset link is incomplete. Please request a new reset email."
      );

      return;
    }

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
          "/api/auth/reset-password",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                token,
                newPassword,
                confirmPassword,
              }),
          }
        );

      const json:
        ResetResponse =
          await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ||
            "Unable to reset your password."
        );
      }

      setCompleted(true);

      setNewPassword("");
      setConfirmPassword("");

      setMessage(
        json.message ||
          "Your UniFlow password has been reset successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reset your password."
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
              Faculty Password Reset
            </p>
          </div>

          <div className="p-6">
            {!token ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                  This password-reset link is incomplete or invalid.
                  Please request a new password-reset email.
                </div>

                <a
                  href="/auth/login"
                  className="inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Return to Login
                </a>
              </div>
            ) : completed ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm leading-6 text-green-800">
                  {message}
                </div>

                <p className="text-sm leading-6 text-slate-600">
                  For security, all active UniFlow sessions for this
                  account have been revoked. Sign in again with your
                  new password.
                </p>

                <a
                  href="/auth/login"
                  className="inline-flex w-full justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Go to UniFlow Login
                </a>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Choose a New Password
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Create a new password for your UniFlow faculty
                    account. This reset link can be used only once.
                  </p>
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <div className="font-semibold">
                    Password requirements
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
                  </ul>
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
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) =>
                      setNewPassword(
                        event.target.value
                      )
                    }
                    required
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
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(event) =>
                      setShowPassword(
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
                    ? "Resetting Password..."
                    : "Reset Password"}
                </button>

                <div className="text-center">
                  <a
                    href="/auth/login"
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Return to UniFlow Login
                  </a>
                </div>
              </form>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          UniFlow password-reset links expire after 15 minutes.
          If this link has expired, request a new reset email.
        </p>
      </div>
    </main>
  );
}
