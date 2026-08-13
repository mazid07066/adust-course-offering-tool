"use client";

import Link from "next/link";
import {
  FormEvent,
  useState,
} from "react";

type ForgotPasswordResponse = {
  success?: boolean;
  message?: string;
};

const GENERIC_MESSAGE =
  "If this email is linked to an active faculty account, a password-reset email has been sent.";

export default function ForgotPasswordPageClient() {
  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/auth/forgot-password",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              email:
                email.trim(),
            }),
          }
        );

      const data:
        ForgotPasswordResponse =
          await response.json();

      /*
       * The API deliberately returns a generic response
       * regardless of whether the account exists.
       */
      setSubmitted(true);

      setMessage(
        data.message ||
          GENERIC_MESSAGE
      );
    } catch {
      setError(
        "Unable to submit the password-reset request at this time. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function startAnotherRequest() {
    setSubmitted(false);
    setEmail("");
    setMessage("");
    setError("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-800">
            UniFlow Academic Planner
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Faculty Password Recovery
          </p>
        </div>

        {submitted ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm leading-6 text-green-800">
              {message}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm leading-6 text-slate-600">
                If your email is registered with an active faculty
                account, check your inbox for a message from
                <strong> UniFlow Academic Planner</strong>.
              </p>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                The reset link expires after
                <strong> 15 minutes</strong>.
              </p>
            </div>

            <Link
              href="/auth/login"
              className="flex w-full justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Return to Login
            </Link>

            <button
              type="button"
              onClick={startAnotherRequest}
              className="w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Submit Another Request
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Forgot Your Password?
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Enter the email address already registered in your
                UniFlow faculty profile. We will send a secure
                password-reset link if the email is linked to an active
                faculty account.
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
              Your username will not change. After resetting your
              password, sign in using the same existing UniFlow
              username and your new password.
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {error}
              </div>
            ) : null}

            <div>
              <label
                htmlFor="facultyEmail"
                className="mb-1 block text-sm font-semibold text-slate-700"
              >
                Registered Faculty Email
              </label>

              <input
                id="facultyEmail"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="name@adust.edu.bd"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Sending Reset Link..."
                : "Send Password Reset Link"}
            </button>

            <div className="text-center">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Return to UniFlow Login
              </Link>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-xs leading-5 text-slate-400">
          For security, UniFlow does not disclose whether an entered
          email address exists in the system.
        </p>
      </div>
    </main>
  );
}
