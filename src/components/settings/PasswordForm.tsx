"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { XCircleIcon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { HelperText } from "@/components/shared/HelperText";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSlowRequest } from "@/hooks/useSlowRequest";
import { AppClientError } from "@/lib/fetcher";
import {
  MIN_PASSWORD_LENGTH,
  passwordFormSchema,
  type PasswordFormValues,
} from "@/lib/schemas/settings";
import { cn } from "@/lib/utils";
import { SlowHint } from "@/components/states/SlowHint";

/** Advisory strength 0-4 (length + variety). Runs in the browser only; never stored or logged. */
export function passwordStrength(pw: string): number {
  if (pw.length === 0) return 0;
  let score = 0;
  if (pw.length >= MIN_PASSWORD_LENGTH) score++;
  if (pw.length >= MIN_PASSWORD_LENGTH + 6) score++;
  const classes = [/[a-z]/, /[A-Z]/, /d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 3) score++;
  if (classes >= 3 && pw.length >= MIN_PASSWORD_LENGTH + 6) score++;
  return pw.length < MIN_PASSWORD_LENGTH ? Math.min(score, 1) : Math.max(1, score);
}

const STRENGTH = [
  ["", "bg-neutral-soft"],
  ["Weak", "bg-negative"],
  ["Fair", "bg-warning"],
  ["Good", "bg-positive"],
  ["Strong", "bg-primary"],
] as const;

function StrengthMeter({ value }: { value: string }) {
  const level = passwordStrength(value);
  return (
    <div data-testid="password-strength" data-level={level} className="mt-3">
      <div aria-hidden="true" className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
              i <= level ? STRENGTH[level]![1] : "bg-neutral-soft",
            )}
          />
        ))}
      </div>
      <p className="text-caption mt-1.5 h-4 text-faint" aria-live="polite">
        {level > 0 ? `Strength: ${STRENGTH[level]![0]}` : ""}
      </p>
    </div>
  );
}

const EMPTY: PasswordFormValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-negative">
      <XCircleIcon className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/**
 * Change password: current + new + confirm. Posts to /api/settings/password with plain fetch (a wrong
 * current password is a 422 field error, never a "session expired"). The server re-issues this device's
 * cookie and signs every other device out. Passwords are never logged or kept after success.
 */
export function PasswordForm() {
  const online = useOnlineStatus();
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: EMPTY,
    mode: "onSubmit",
  });
  const [formError, setFormError] = React.useState<string | null>(null);
  const slow = useSlowRequest(isSubmitting);
  const newPasswordValue = useWatch({ control, name: "newPassword" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      if (res.status === 204) {
        reset(EMPTY);
        toast.success("Password updated. Other devices were signed out.");
        return;
      }
      if (res.status === 401) {
        // Intentional hard navigation: a full load clears client state once the session is gone.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login?next=%2Fsettings");
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;
      const fields = body?.error?.fieldErrors ?? {};
      let focused = false;
      for (const key of ["currentPassword", "newPassword"] as const) {
        if (fields[key]) {
          setError(key, { message: fields[key] });
          if (!focused) {
            setFocus(key);
            focused = true;
          }
        }
      }
      if (res.status === 429) {
        const wait = Math.max(1, Math.ceil(Number(res.headers.get("Retry-After") ?? "900") / 60));
        setFormError(
          `Too many attempts. Try again in ${wait} ${wait === 1 ? "minute" : "minutes"}.`,
        );
      } else if (!focused) {
        setFormError(body?.error?.message ?? "We couldn't update the password. Try again.");
      }
    } catch (error) {
      setFormError(
        error instanceof AppClientError
          ? error.message
          : "Couldn't reach the server. Check your connection and try again.",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Change password">
      <div>
        <label htmlFor="current-password" className="mb-2 block text-sm font-medium">
          Current password
        </label>
        <PasswordInput
          id="current-password"
          autoComplete="current-password"
          aria-invalid={errors.currentPassword ? true : undefined}
          aria-describedby={errors.currentPassword ? "current-password-error" : undefined}
          {...register("currentPassword")}
        />
        <FieldError id="current-password-error" message={errors.currentPassword?.message} />
      </div>
      <div>
        <label htmlFor="new-password" className="mb-2 block text-sm font-medium">
          New password
        </label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          aria-invalid={errors.newPassword ? true : undefined}
          aria-describedby={errors.newPassword ? "new-password-error" : "new-password-help"}
          {...register("newPassword")}
        />
        {errors.newPassword ? (
          <FieldError id="new-password-error" message={errors.newPassword.message} />
        ) : (
          <p id="new-password-help" className="text-caption mt-2 text-faint">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        )}
        <StrengthMeter value={newPasswordValue ?? ""} />
      </div>
      <div>
        <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium">
          Confirm new password
        </label>
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
          {...register("confirmPassword")}
        />
        <FieldError id="confirm-password-error" message={errors.confirmPassword?.message} />
      </div>
      {formError ? <FieldError id="password-form-error" message={formError} /> : null}
      <div>
        <Button
          type="submit"
          variant="secondary"
          loading={isSubmitting}
          disabled={!online}
          className="max-sm:w-full"
        >
          Update password
        </Button>
        {online ? null : (
          <HelperText>You&apos;re offline. Reconnect to change the password.</HelperText>
        )}
        <SlowHint active={slow} />
      </div>
    </form>
  );
}
