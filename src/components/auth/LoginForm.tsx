"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useAnimationControls } from "framer-motion";
import { InfoIcon, TriangleAlertIcon, XCircleIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { HelperText } from "@/components/shared/HelperText";
import { Banner } from "@/components/states/Banner";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useHydrated } from "@/hooks/useHydrated";
import { loginSchema, type LoginInput } from "@/lib/schemas/login";
import { useMotionPrefs } from "@/lib/motion";
import { sanitizeNext } from "@/lib/next-param";

type FormError = { kind: "invalid" } | { kind: "limited"; minutes: number } | { kind: "network" };

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const online = useOnlineStatus();
  const hydrated = useHydrated();
  const { reduce } = useMotionPrefs();
  const shake = useAnimationControls();
  const [error, setError] = React.useState<FormError | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { password: "" } });

  const limited = error?.kind === "limited";
  const showError = error?.kind === "invalid" || error?.kind === "network";
  const message =
    error?.kind === "network" ? "Couldn't reach the server. Try again." : "Incorrect password.";

  const onSubmit = handleSubmit(
    async (values) => {
      setError(null);
      try {
        // Plain fetch (not lib/fetcher): a 401 here is "wrong password", not an expired session.
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (res.status === 204) {
          router.replace(sanitizeNext(params.get("next")));
          router.refresh();
          return;
        }
        if (res.status === 429) {
          const retry = Number(res.headers.get("Retry-After") ?? "900");
          setError({ kind: "limited", minutes: Math.max(1, Math.ceil(retry / 60)) });
          return;
        }
        setError(res.status === 401 ? { kind: "invalid" } : { kind: "network" });
      } catch {
        setError({ kind: "network" });
      }
      if (!reduce)
        await shake.start({ x: [0, -6, 6, -6, 6, -6, 0], transition: { duration: 0.32 } });
      // The field is disabled while submitting; focus it once React has re-enabled it.
      setTimeout(() => setFocus("password", { shouldSelect: true }), 50);
    },
    () => {
      setError({ kind: "invalid" });
      setFocus("password");
    },
  );

  const disabled = isSubmitting || limited;

  return (
    <motion.form
      onSubmit={onSubmit}
      animate={shake}
      noValidate
      data-testid="login-form"
      data-hydrated={hydrated ? "true" : "false"}
      className="space-y-5"
    >
      {limited ? (
        <Banner tone="warning" icon={TriangleAlertIcon} className="rounded-md border">
          Too many attempts. Try again in {error.minutes}{" "}
          {error.minutes === 1 ? "minute" : "minutes"}.
        </Banner>
      ) : null}

      <div data-login-field>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          Password
        </label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          autoFocus
          disabled={disabled}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? "password-error" : "password-help"}
          {...register("password")}
        />
        {showError ? (
          <p
            id="password-error"
            role="alert"
            className="mt-2 flex items-center gap-1.5 text-sm text-negative"
          >
            <XCircleIcon className="size-4 shrink-0" aria-hidden="true" />
            {message}
          </p>
        ) : limited ? null : (
          <p id="password-help" className="text-caption mt-2 text-faint">
            Enter the password you were given.
          </p>
        )}
      </div>

      <div data-login-field>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isSubmitting}
          disabled={disabled || !online}
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
        {online ? null : <HelperText>You&apos;re offline. Reconnect to sign in.</HelperText>}
      </div>

      <p data-login-field className="text-caption flex items-center gap-1.5 text-faint">
        <InfoIcon className="size-3.5 shrink-0" aria-hidden="true" />
        Personal use only.
      </p>
    </motion.form>
  );
}
