import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dribbble, Swords, Users, ChevronRight } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { CategoryDrawer, type ArenaCategory } from "@/components/shell/CategoryDrawer";
import { SHELL_ROUTES, MODE_ROUTES } from "@/lib/shellRoutes";

type DrawerTarget = "arena" | "duel" | null;

/**
 * Compete category step. Per the operator decision, Sport is the only live
 * category this pass; History/Geography/Science stay under the Learn pillar.
 * Arena & Duels tiles open the category drawer, then route to the existing
 * challenge entry — the shell never reimplements those modes.
 */
export default function CompeteCategoryScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [drawer, setDrawer] = useState<DrawerTarget>(null);

  const handleSelect = (_category: ArenaCategory) => {
    // Category selection is carried into the existing challenge/arena entry.
    // (The entry screen owns category handling; the shell just routes there.)
    setDrawer(null);
    navigate(MODE_ROUTES.challenge);
  };

  return (
    <ShellLayout title={t("compete.title")} subtitle={t("compete.chooseCategory")} back>
      <div className="flex flex-col gap-4 md:h-full md:justify-center">
        <NeoCard
          color="yellow"
          shadow="lg"
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => navigate(SHELL_ROUTES.competeSport)}
        >
          <div className="neo-border rounded-xl bg-background p-3">
            <Dribbble size={28} strokeWidth={2.5} className="text-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-heading font-bold text-lg">
              {t("compete.categories.sport")}
            </p>
            <p className="text-xs opacity-80">
              {t("compete.categories.sportDesc")}
            </p>
          </div>
          <ChevronRight size={22} strokeWidth={2.5} />
        </NeoCard>

        <div className="grid grid-cols-2 gap-3">
          <NeoCard
            color="blue"
            className="flex flex-col gap-2 cursor-pointer min-h-[120px]"
            onClick={() => setDrawer("arena")}
          >
            <Swords size={24} strokeWidth={2.5} />
            <div className="mt-auto">
              <p className="font-heading font-bold text-base">
                {t("modes.arena.name")}
              </p>
              <p className="text-xs opacity-80">{t("modes.arena.desc")}</p>
            </div>
          </NeoCard>
          <NeoCard
            color="pink"
            className="flex flex-col gap-2 cursor-pointer min-h-[120px]"
            onClick={() => setDrawer("duel")}
          >
            <Users size={24} strokeWidth={2.5} />
            <div className="mt-auto">
              <p className="font-heading font-bold text-base">
                {t("modes.duel.name")}
              </p>
              <p className="text-xs opacity-80">{t("modes.duel.desc")}</p>
            </div>
          </NeoCard>
        </div>

        <p className="text-xs text-muted-foreground text-center px-4">
          {t("compete.categoryHint")}
        </p>
      </div>

      <CategoryDrawer
        open={drawer !== null}
        title={
          drawer === "arena" ? t("modes.arena.name") : t("modes.duel.name")
        }
        onClose={() => setDrawer(null)}
        onSelect={handleSelect}
      />
    </ShellLayout>
  );
}
