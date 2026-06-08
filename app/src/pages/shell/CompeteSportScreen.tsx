import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dribbble, ChevronRight } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

const SPORTS: { key: "football" | "basketball" | "tennis"; live: boolean }[] = [
  { key: "football", live: true },
  { key: "basketball", live: false },
  { key: "tennis", live: false },
];

/** Compete → sport select. Football is live; others are clearly "coming soon". */
export default function CompeteSportScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <ShellLayout title={t("compete.title")} subtitle={t("compete.chooseSport")} back>
      <div className="flex flex-col gap-4 md:h-full md:justify-center">
        {SPORTS.map((s) => {
          const inner = (
            <>
              <div className="neo-border rounded-xl bg-background p-3">
                <Dribbble size={28} strokeWidth={2.5} className="text-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-lg">
                  {t(`compete.sports.${s.key}`)}
                </p>
              </div>
              {s.live ? (
                <ChevronRight size={22} strokeWidth={2.5} />
              ) : (
                <NeoBadge color="muted">{t("common.comingSoon")}</NeoBadge>
              )}
            </>
          );

          return s.live ? (
            <NeoCard
              key={s.key}
              color="primary"
              shadow="lg"
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => navigate(SHELL_ROUTES.competeSportGrid(s.key))}
            >
              {inner}
            </NeoCard>
          ) : (
            <NeoCard
              key={s.key}
              color="default"
              className="flex items-center gap-4 opacity-60"
            >
              {inner}
            </NeoCard>
          );
        })}
      </div>
    </ShellLayout>
  );
}
