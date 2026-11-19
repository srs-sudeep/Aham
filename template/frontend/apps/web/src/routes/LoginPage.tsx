import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Text,
} from "@aham/ui-kit/components";
import { useAuth, useTranslation, type Principal } from "@aham/ui-kit";

const DEV_PRINCIPAL: Principal = {
  id: "dev-user",
  email: "dev@example.com",
  name: "Dev User",
  permissions: ["items:list", "items:read", "items:create", "items:update", "items:delete"],
};

export function LoginPage() {
  const { t } = useTranslation();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("dev@example.com");

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("login.title")}</CardTitle>
          <Text variant="muted">{t("login.subtitle")}</Text>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("login.email")}</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Text variant="muted">{t("login.hint")}</Text>
          <Button
            className="w-full"
            onClick={() => {
              setSession("dev-token", { ...DEV_PRINCIPAL, email });
              void navigate({ to: "/" });
            }}
          >
            {t("login.submit")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
