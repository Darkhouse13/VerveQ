import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation("shell");

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card elevation="lifted" padding="lg" className="w-full max-w-md text-center">
        <Badge tone="action" shape="tag" stamp className="mb-5 px-5 py-2 font-mono text-display">
          404
        </Badge>
        <h1 className="font-heading text-title font-bold">{t("app.notFound.title")}</h1>
        <p className="mt-2 text-body-sm text-muted-foreground">
          {t("app.notFound.body")}
        </p>
        <Button size="lg" block className="mt-6" onClick={() => navigate("/home")}>
          {t("app.notFound.cta")}
        </Button>
      </Card>
    </div>
  );
};

export default NotFound;
