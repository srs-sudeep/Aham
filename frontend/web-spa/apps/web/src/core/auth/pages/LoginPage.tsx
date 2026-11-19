import { useEffect, useState } from "react";
import { useRouter, useSearch } from "@tanstack/react-router";
import {
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

const DEV_PRINCIPAL: Principal = {
  id: "dev-user",
  email: "dev@example.com",
  name: "Dev User",
  permissions: ["public", "items:*", "categories:*"],
};

export function LoginPage() {
  const { t } = useTranslation();
  const { token, setSession } = useAuth();
  const router = useRouter();
  const { redirect } = useSearch({ strict: false }) as { redirect?: string };
  const [email, setEmail] = useState(DEV_PRINCIPAL.email ?? "");

  // Navigate only after the auth state (and therefore router context) has
  // updated, otherwise the `beforeLoad` guard would still see no token.
  useEffect(() => {
    if (token) router.history.push(redirect ?? "/");
  }, [token, redirect, router]);

  function login() {
    setSession("dev-token", { ...DEV_PRINCIPAL, email, name: email.split("@")[0] || "Dev User" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("login.title")}</CardTitle>
          <Text variant="muted">{t("login.subtitle")}</Text>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              login();
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
            <Text variant="muted">{t("login.hint")}</Text>
            <Button type="submit" className="w-full">
              {t("login.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
