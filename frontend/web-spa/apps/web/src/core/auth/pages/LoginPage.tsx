import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearch } from "@tanstack/react-router";
import {
  ApiError,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Text,
  useAuth,
  useTranslation,
} from "@aham/ui-kit";
import type { Principal } from "@aham/ui-kit";
import { AUTH_MODE, refreshSession } from "../../../lib/api";
import { completeMfa, login, selectTenant, startSso, type LoginStep } from "../../../lib/auth";

const DEV_PRINCIPAL: Principal = {
  id: "dev-user",
  email: "dev@example.com",
  name: "Dev User",
  tenantId: "acme",
  permissions: ["public", "items:*", "categories:*"],
};

type Step = Exclude<LoginStep, { kind: "done" }> | { kind: "credentials" } | { kind: "sso" };

export function LoginPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const { redirect, sso } = useSearch({ strict: false }) as { redirect?: string; sso?: string };

  // Navigate only after the auth state (and therefore router context) has
  // updated, otherwise the `beforeLoad` guard would still see no token.
  useEffect(() => {
    if (token) router.history.push(redirect ?? "/");
  }, [token, redirect, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("login.title")}</CardTitle>
          <Text variant="muted">
            {AUTH_MODE === "dev" ? t("login.devSubtitle") : t("login.subtitle")}
          </Text>
        </CardHeader>
        <CardContent>
          {AUTH_MODE === "dev" ? <DevLogin /> : <SaasLogin ssoReturn={sso === "1"} />}
        </CardContent>
      </Card>
    </div>
  );
}

function DevLogin() {
  const { t } = useTranslation();
  const { setSession } = useAuth();
  const [email, setEmail] = useState(DEV_PRINCIPAL.email ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSession("dev-token", {
          ...DEV_PRINCIPAL,
          email,
          name: email.split("@")[0] || "Dev User",
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="login-email">{t("login.email")}</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Text variant="muted">{t("login.devHint")}</Text>
      <Button type="submit" className="w-full">
        {t("login.submit")}
      </Button>
    </form>
  );
}

function SaasLogin({ ssoReturn }: { ssoReturn: boolean }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ssoHandled = useRef(false);

  // Back from the IdP: the API set the refresh cookie; trade it for an access token.
  useEffect(() => {
    if (!ssoReturn || ssoHandled.current) return;
    ssoHandled.current = true;
    void refreshSession().then((tokenValue) => {
      if (!tokenValue) setError(t("login.ssoFailed"));
    });
  }, [ssoReturn, t]);

  async function run(action: () => Promise<LoginStep | void>) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      if (next && next.kind !== "done") setStep(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.failed"));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent, action: () => Promise<LoginStep | void>) {
    event.preventDefault();
    void run(action);
  }

  const errorText = error ? (
    <Text role="alert" className="text-destructive">
      {error}
    </Text>
  ) : null;

  if (step.kind === "select-tenant") {
    return (
      <div className="space-y-3">
        <Text>{t("login.chooseTenant")}</Text>
        {step.tenants.map((tenant) => (
          <Button
            key={tenant.tenant_id}
            variant="outline"
            className="w-full justify-between"
            disabled={busy}
            onClick={() => void run(() => selectTenant(step.sessionToken, tenant.tenant_id, email))}
          >
            <span>{tenant.name}</span>
            <Text variant="muted">{tenant.role}</Text>
          </Button>
        ))}
        {errorText}
      </div>
    );
  }

  if (step.kind === "mfa") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => submit(e, () => completeMfa(step.mfaToken, code, email))}
      >
        <div className="space-y-2">
          <Label htmlFor="login-mfa">{t("login.mfaCode")}</Label>
          <Input
            id="login-mfa"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        {errorText}
        <Button type="submit" className="w-full" disabled={busy || !code}>
          {t("login.verify")}
        </Button>
      </form>
    );
  }

  if (step.kind === "sso") {
    return (
      <form className="space-y-4" onSubmit={(e) => submit(e, () => startSso(tenantSlug))}>
        <div className="space-y-2">
          <Label htmlFor="login-tenant">{t("login.tenantSlug")}</Label>
          <Input
            id="login-tenant"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
          />
        </div>
        {errorText}
        <Button type="submit" className="w-full" disabled={busy || !tenantSlug}>
          {t("login.continueSso")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => setStep({ kind: "credentials" })}
        >
          {t("login.usePassword")}
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(e) => submit(e, () => login(email, password))}>
      <div className="space-y-2">
        <Label htmlFor="login-email">{t("login.email")}</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">{t("login.password")}</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {errorText}
      <Button type="submit" className="w-full" disabled={busy || !email || !password}>
        {t("login.submit")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => setStep({ kind: "sso" })}
      >
        {t("login.useSso")}
      </Button>
    </form>
  );
}
