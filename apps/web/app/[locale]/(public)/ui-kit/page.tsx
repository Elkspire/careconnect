import { CalendarDays, Clock3, Users, Wallet } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Drawer, Modal } from "@/components/ui/overlay";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Stepper } from "@/components/ui/stepper";
import { Tabs } from "@/components/ui/tabs";

/**
 * Every shared UI component in one place, in light or dark, with sample data, for checking how
 * they look and behave. Always there under `next dev`; a production build
 * hides it unless the server runs with UI_PREVIEW=1.
 * English sample text only: this is for the team, not patients.
 */
export const dynamic = "force-dynamic";

const PRIMARY =
  "tap-target inline-flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800";
const SECONDARY =
  "tap-target inline-flex items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-muted";

const PATIENTS = [
  { name: "Muhammad Imran Qureshi", age: 58, lastVisit: "2026-11-02", status: "checked_in" },
  { name: "Ayesha Siddiqui", age: 26, lastVisit: "2026-10-14", status: "booked" },
  { name: "Zubaida Khan", age: 71, lastVisit: null, status: "no_show" },
  { name: "Bilal Hussain", age: 29, lastVisit: "2026-11-20", status: "completed" },
] as const;

export default async function UiKitPage(props: PageProps<"/[locale]/ui-kit">) {
  if (process.env.NODE_ENV !== "development" && process.env.UI_PREVIEW !== "1") {
    notFound();
  }
  const query = await props.searchParams;
  const tab = String(query.tab ?? "all");
  const theme = query.theme === "dark" ? "dark" : "light";
  const kitHref = (next: { tab?: string; theme?: string }) => {
    const params = new URLSearchParams({ tab: next.tab ?? tab, theme: next.theme ?? theme });
    return `/ui-kit?${params}`;
  };
  const section = "mt-10 mb-3 text-base font-bold text-text";

  return (
    // data-theme scopes the dark token values to this page (and its modals,
    // which inherit the variables); the app itself only ships light.
    <div data-theme={theme} className="flex flex-1 flex-col bg-bg text-text">
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-8">
      <PageHeader kicker="Design system" title="UI kit" />
      <Tabs
        label="Theme"
        active={theme}
        items={[
          { key: "light", label: "Light", href: kitHref({ theme: "light" }) },
          { key: "dark", label: "Dark", href: kitHref({ theme: "dark" }) },
        ]}
      />

      <h2 className={section}>Tabs with counts</h2>
      <Tabs
        label="Patients"
        active={tab}
        items={[
          { key: "all", label: "All", count: 248, href: kitHref({ tab: "all" }) },
          { key: "high", label: "High priority", count: 12, href: kitHref({ tab: "high" }) },
          { key: "inactive", label: "Inactive", count: 31, href: kitHref({ tab: "inactive" }) },
          { key: "notes", label: "Notes", href: kitHref({ tab: "notes" }) },
        ]}
      />
      <p className="text-sm text-text-muted" data-testid="tab-content">
        Showing: {tab}
      </p>

      <h2 className={section}>KPI cards</h2>
      <KpiGrid>
        <KpiCard icon={CalendarDays} label="Today's appointments" value="18" hint="12 in-clinic · 6 video" />
        <KpiCard icon={Clock3} tone="amber" label="Waiting room now" value="4" hint="Avg wait 14 min" />
        <KpiCard
          icon={Users}
          tone="blue"
          label="Active patients"
          value="1,248"
          trend={{ direction: "up", label: "+36 this month", good: true }}
        />
        <KpiCard
          icon={Wallet}
          tone="purple"
          label="No-shows"
          value="7%"
          trend={{ direction: "up", label: "+2% vs last month", good: false }}
        />
      </KpiGrid>

      <h2 className={section}>Status badges</h2>
      <Card>
        <div className="flex flex-wrap gap-2" data-testid="badges">
          <StatusBadge kind="appointment" status="booked" label="Booked" />
          <StatusBadge kind="appointment" status="checked_in" label="Checked in" />
          <StatusBadge kind="appointment" status="completed" label="Completed" />
          <StatusBadge kind="appointment" status="cancelled" label="Cancelled" />
          <StatusBadge kind="appointment" status="no_show" label="No-show" />
          <StatusBadge kind="waitlist" status="waiting" label="Waiting" />
          <StatusBadge kind="waitlist" status="offered" label="Slot offered" />
          <StatusBadge kind="verification" status="pending" label="Pending review" />
          <StatusBadge kind="verification" status="verified" label="Verified" />
          <StatusBadge kind="notification" status="failed" label="Failed" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["teal", "green", "blue", "orange", "red", "purple", "gray"] as const).map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
      </Card>

      <h2 className={section}>Stepper</h2>
      <Card>
        <Stepper label="Order" steps={["Received", "Sample taken", "Processing", "Report ready"]} current={2} />
        <div className="mt-6 max-w-sm">
          <Stepper
            label="Walk-in"
            variant="bar"
            steps={["Patient", "Doctor", "Payment", "Token"]}
            current={1}
          />
        </div>
      </Card>

      <h2 className={section}>Sortable data table</h2>
      <DataTable
        caption="Patients, sortable by any column"
        initialSort={{ key: "name", direction: "ascending" }}
        columns={[
          { key: "name", header: "Patient", sortable: true },
          { key: "age", header: "Age", sortable: true, align: "end" },
          { key: "lastVisit", header: "Last visit", sortable: true },
          { key: "status", header: "Status" },
        ]}
        rows={PATIENTS.map((p) => ({
          key: p.name,
          cells: {
            name: <b className="font-semibold">{p.name}</b>,
            age: p.age,
            lastVisit: p.lastVisit ?? "—",
            status: <StatusBadge kind="appointment" status={p.status} label={p.status.replace("_", " ")} />,
          },
          sortValues: {
            name: p.name,
            age: p.age,
            lastVisit: p.lastVisit ? new Date(p.lastVisit) : null,
          },
        }))}
      />
      <div className="mt-4">
        <DataTable caption="Empty" columns={[{ key: "a", header: "Patient" }]} rows={[]} empty="No patients yet." />
      </div>

      <h2 className={section}>Modal and drawer</h2>
      <div className="flex flex-wrap gap-3">
        <Modal
          trigger="Open modal"
          title="Invite team member"
          description="They sign in with this phone number."
          footer={
            <>
              <form method="dialog">
                <button className={SECONDARY}>Cancel</button>
              </form>
              <button className={PRIMARY}>Send invite</button>
            </>
          }
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-text-label">Phone number</span>
            <input
              name="phone"
              className="tap-target w-full rounded-md border border-border-strong px-3 py-2 text-sm focus:border-primary-600 focus:outline-2 focus:outline-offset-1 focus:outline-primary-600"
            />
          </label>
          <p className="mt-4 text-sm text-text-muted">
            {"Long content scrolls inside the modal, not the page. ".repeat(40)}
          </p>
        </Modal>
        <Drawer trigger="Open drawer" title="Muhammad Imran Qureshi" description="58 y · M · CC-10421">
          <StatusBadge kind="appointment" status="checked_in" label="Checked in" />
          <p className="mt-4 text-sm text-text-muted">Patient details would go here.</p>
        </Drawer>
      </div>
    </main>
    </div>
  );
}
