/**
 * DEV-ONLY kitchen sink (VerveQ ONE P1.8): every primitive in
 * src/components/ui, side by side in every palette the app ships — `:root`,
 * then each `.theme-*` class that src/index.css defines (ink, paper when it
 * lands, learn). The visual regression baseline for the design system:
 * e2e/kitchenSink.spec.ts screenshots it at 390 and 1280.
 *
 * Redirects home outside `import.meta.env.DEV` (the DrawMockHarness /
 * VoteCardHarness precedent). No backend, no auth, no storage.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Navigate } from "react-router-dom";
import { Heart, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eyebrow } from "@/components/ui/eyebrow";
import { BackButton, CloseButton, ExitButton, IconButton } from "@/components/ui/icon-button";
import { Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeScope } from "@/components/ui/theme-scope";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

/** Palettes to show, in order; a `.theme-*` class shows only if index.css defines it. */
const CANDIDATE_THEMES = [
  { id: "root", label: ":root", className: "" },
  { id: "ink", label: ".theme-ink", className: "theme-ink" },
  { id: "paper", label: ".theme-paper", className: "theme-paper" },
] as const;

function themeDefined(className: string): boolean {
  if (!className) return true;
  const needle = `.${className}`;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    for (const rule of Array.from(rules)) {
      const text = rule.cssText;
      if (text.includes(`${needle} `) || text.includes(`${needle},`) || text.includes(`${needle}{`)) return true;
    }
  }
  return false;
}

type Range = "today" | "week" | "all";

const BADGE_TONES: BadgeTone[] = ["neutral", "muted", "action", "right", "wrong", "mode"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </section>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

function Column({ theme }: { theme: (typeof CANDIDATE_THEMES)[number] }) {
  const [tab, setTab] = useState<Range>("today");
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <ThemeScope theme={theme.className}>
      <div
        data-testid={`sink-${theme.id}`}
        className={cn(theme.className, "flex min-w-0 flex-col gap-6 bg-background p-4 text-foreground")}
      >
        <h2 className="font-mono text-body-sm font-bold">{theme.label}</h2>

        <Section title="Button · variants">
          <Row>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
          </Row>
        </Section>
        <Section title="Button · sizes, disabled, loading">
          <Row>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Row>
          <Row>
            <Button disabled>Disabled</Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
            <Button loading>Loading</Button>
          </Row>
          <Button block>Block primary</Button>
        </Section>

        <Section title="IconButton · Back · Close · Exit">
          <Row>
            <IconButton aria-label="Like">
              <Heart aria-hidden="true" />
            </IconButton>
            <IconButton aria-label="Add" variant="secondary">
              <Plus aria-hidden="true" />
            </IconButton>
            <IconButton aria-label="Add" variant="primary" size="md">
              <Plus aria-hidden="true" />
            </IconButton>
            <IconButton aria-label="Add" variant="secondary" disabled>
              <Plus aria-hidden="true" />
            </IconButton>
            <BackButton />
            <CloseButton />
            <ExitButton onExit={() => {}} />
          </Row>
        </Section>

        <Section title="Card · tones">
          <div className="grid grid-cols-2 gap-3">
            <Card>Default</Card>
            <Card tone="paper">Paper</Card>
            <Card tone="inverse">Inverse</Card>
            <Card tone="mode">Mode</Card>
          </div>
        </Section>
        <Section title="Card · elevations">
          <div className="grid grid-cols-3 gap-3">
            <Card elevation="flat" padding="sm">
              Flat
            </Card>
            <Card elevation="raised" padding="sm">
              Raised
            </Card>
            <Card elevation="lifted" padding="sm">
              Lifted
            </Card>
          </div>
          <Card interactive onClick={() => {}}>
            Interactive card (a real button)
          </Card>
        </Section>

        <Section title="Badge · tones">
          <Row>
            {BADGE_TONES.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
            <Badge tone="action" shape="tag" size="md" stamp>
              Stamp
            </Badge>
          </Row>
        </Section>

        <Section title="Eyebrow · type">
          <Eyebrow>Round 3 · Today</Eyebrow>
          <p className="font-heading text-title font-bold">Title</p>
          <p className="text-body">Body text, the reading size.</p>
          <p className="text-body-sm text-muted-foreground">Muted supporting line.</p>
        </Section>

        <Section title="Input · Textarea · Select">
          <Input placeholder="Search players" aria-label="Search players" />
          <Input defaultValue="Disabled" aria-label="Disabled field" disabled />
          <Textarea placeholder="Notes" aria-label="Notes" />
          <Select aria-label="League" defaultValue="pl">
            <option value="pl">Premier League</option>
            <option value="ll">LaLiga</option>
          </Select>
        </Section>

        <Section title="Segmented">
          <Segmented<Range>
            aria-label="Range"
            value={tab}
            onChange={setTab}
            options={[
              { value: "today", label: "Today" },
              { value: "week", label: "Week" },
              { value: "all", label: "All" },
            ]}
          />
        </Section>

        <Section title="Skeleton · Avatar">
          <Row>
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </Row>
          <Row>
            <Avatar name="Kylian Mbappe" size="sm" />
            <Avatar name="Kylian Mbappe" size="md" />
            <Avatar name="Kylian Mbappe" size="lg" />
            <Avatar name="Kylian Mbappe" size="xl" />
          </Row>
        </Section>

        <Section title="BrandMark">
          <Row>
            <BrandMark variant="mark" size="sm" />
            <BrandMark variant="mark" size="md" />
            <BrandMark variant="mark" size="lg" />
          </Row>
          <Row>
            <BrandMark variant="wordmark" size="sm" />
            <BrandMark variant="wordmark" size="md" />
            <BrandMark variant="wordmark" size="lg" />
          </Row>
          <BrandMark variant="lockup" size="md" />
        </Section>

        <Section title="Overlays · toast">
          <Row>
            <Button variant="secondary" size="sm" onClick={() => setDialog(true)} data-testid={`sink-${theme.id}-dialog`}>
              Dialog
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSheet(true)} data-testid={`sink-${theme.id}-sheet`}>
              Sheet
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirm(true)} data-testid={`sink-${theme.id}-confirm`}>
              Confirm
            </Button>
            <Button variant="secondary" size="sm" onClick={() => notify(`Toast from ${theme.label}`)} data-testid={`sink-${theme.id}-toast`}>
              Toast
            </Button>
          </Row>
        </Section>

        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog title</DialogTitle>
              <DialogDescription>One centred question or note, with a 44px close.</DialogDescription>
            </DialogHeader>
            <Button block onClick={() => setDialog(false)}>
              Got it
            </Button>
          </DialogContent>
        </Dialog>
        <Sheet open={sheet} onOpenChange={setSheet} eyebrow="Sheet" title="Bottom sheet" description="The house header, a body that scrolls.">
          <Button block onClick={() => setSheet(false)}>
            Done
          </Button>
        </Sheet>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Leave the game?"
          description="Your run so far won't count."
          confirmLabel="Leave"
          cancelLabel="Stay"
          danger
          onConfirm={() => setConfirm(false)}
        />
      </div>
    </ThemeScope>
  );
}

function KitchenSinkPage() {
  const [themes] = useState(() => CANDIDATE_THEMES.filter((t) => themeDefined(t.className)));
  // Portalled to <body>: the app frame is a phone column (max-w-md), and the
  // desktop view needs the full width to put the palettes side by side.
  return createPortal(
    <main data-testid="kitchen-sink" className="absolute inset-x-0 top-0 z-raised min-h-screen bg-background">
      <div className={cn("grid grid-cols-1", themes.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
        {themes.map((t) => (
          <Column key={t.id} theme={t} />
        ))}
      </div>
    </main>,
    document.body,
  );
}

export default function KitchenSink() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  return <KitchenSinkPage />;
}
