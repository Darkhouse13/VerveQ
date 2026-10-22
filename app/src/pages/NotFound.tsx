import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation("shell");

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border-[3px] border-foreground bg-card p-8 text-center shadow-[8px_8px_0_0_rgba(0,0,0,1)]">
        <div className="mx-auto mb-5 inline-block rounded-xl border-[3px] border-foreground bg-primary px-5 py-2 font-heading text-5xl font-black text-primary-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          404
        </div>
        <h1 className="font-heading text-2xl font-black">{t("app.notFound.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("app.notFound.body")}
        </p>
        <Link
          to="/v2"
          className="mt-6 block w-full rounded-xl border-[3px] border-foreground bg-primary px-4 py-3 font-heading font-bold uppercase text-primary-foreground shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
        >
          {t("app.notFound.cta")}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
