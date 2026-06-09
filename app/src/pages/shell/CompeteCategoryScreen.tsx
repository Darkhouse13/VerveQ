import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dribbble, Swords, Users, ChevronRight } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { CategoryDrawer, type ArenaCategory } from "@/components/shell/CategoryDrawer";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

type DrawerTarget = "arena" | "duel" | null;

/**
 * Compete category step — PARKED (not routed). With Sport the only live
 * category, /compete collapses straight to the mode grid (see App.tsx and
 * CompeteModeGridScreen); the grid carries this screen's Arena/Duels tiles and
 * its "History, Geography & Science live in Learn" pointer. Re-register this
 * screen at /compete when a second category goes live.
 *
 * Per the operator decision, Sport is the only live category this pass;
 * History/Geography/Science stay under the Learn pillar. Arena & Duels tiles
 * open the category drawer, then route to the existing challenge entry — the
 * shell never reimplements those modes.
 */
export default function CompeteCategoryScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [drawer, setDrawer] = useState<DrawerTarget>(null);

  const handleSelect = (_category: ArenaCategory) => {
    // Category selection is carried into the challenge/arena entry, embedded in
    // the shell (v2 nav retained) so the user stays inside the shell.
    // (The entry screen owns category handling; the shell just routes there.)
    setDrawer(null);
    navigate(SHELL_ROUTES.duels);
  };

  return (
    <ShellLayout title={t("compete.title")} subtitle={t("compete.chooseCategory")} back>
      {/* On desktop the Sport card and the Arena/Duel row grow to fill the
          never-scroll column (md:flex-1) so the layout reads balanced instead
          of leaving a large empty gap above a vertically-centered group. */}
      <div className="flex flex-col gap-4 pt-2 md:h-full md:pt-4">
        <NeoCard
          color="yellow"
          shadow="lg"
          className="flex items-center gap-4 cursor-pointer md:flex-1"
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

        <div className="grid grid-cols-2 gap-3 md:flex-1">
          <NeoCard
            color="blue"
            className="flex flex-col gap-2 cursor-pointer min-h-[120px] md:min-h-0"
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
            className="flex flex-col gap-2 cursor-pointer min-h-[120px] md:min-h-0"
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
