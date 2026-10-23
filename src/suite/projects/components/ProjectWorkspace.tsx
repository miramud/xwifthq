"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarRange,
  CheckCircle2,
  Flag,
  FolderOpen,
  Pencil,
  Play,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import {
  AvatarStack,
  Button,
  ButtonLink,
  Card,
  Chip,
  Empty,
  PageHeader,
  Panel,
  Progress,
  Segmented,
  UnderlineTabs,
  cx,
  type PageTab,
} from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import { useAuth } from "@/lib/auth-store";
import {
  ApiError,
  board as boardApi,
  companies as companiesApi,
  portfolios as portfoliosApi,
  projects as projectsApi,
  sprints as sprintsApi,
  workItems as workItemsApi,
  type BoardSetup,
  type ExternalCompany,
  type Portfolio,
  type Project,
  type Sprint,
  type SprintReport,
  type WorkItem,
  type WorkItemType,
} from "@/lib/api/projects-client";
import AiWorkshop from "./AiWorkshop";
import BacklogImport from "./BacklogImport";
import ClientLinks from "./ClientLinks";
import CostReport from "./CostReport";
import ProjectFinancePanel from "./ProjectFinancePanel";
import PerformancePanel from "./PerformancePanel";
import ProjectAssistant from "./ProjectAssistant";
import ProjectCharterPanel from "./ProjectCharterPanel";
import ProjectDocuments from "./ProjectDocuments";
import ProjectMonthView from "./ProjectMonthView";
import SchedulePanel from "./SchedulePanel";
import ProjectSettingsDialog from "./ProjectSettingsDialog";
import ProjectChannels from "./ProjectChannels";
import ProjectTeam from "./ProjectTeam";
import SprintDialog from "./SprintDialog";
import StoryBacklog from "./StoryBacklog";
import StoryBoard from "./StoryBoard";
import StakeholderMap from "./StakeholderMap";
import TimeSheet from "./TimeSheet";
import TestingWorkspace from "./testing/TestingWorkspace";
import WorkItemList from "./WorkItemList";
import WorkItemPanel from "./WorkItemPanel";
import {
  InfoRow,
  LIFECYCLE_HUE,
  Notice,
  Skeleton,
  fmtDate,
  fmtRange,
  plural,
} from "./ui/pkit";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * One project: its board, its sprints and its team.
 *
 * Tabs rather than pages. The board and the backlog are the same table
 * filtered differently, and the team and the stakeholder map are short lists
 * somebody checks while looking at the board — separate routes would mean four
 * loads of the same project to answer one question.
 *
 * The board's columns come from the project, so they are fetched once here and
 * handed down rather than re-fetched per view.
 */

/**
 * `stakeholders` is offered on every project, including internal ones.
 *
 * Hiding it there would be tidier and worse: the tab is where somebody finds
 * out *why* there is nobody to map, and a tab that appears the moment a
 * company is set is a tab nobody knew to look for.
 */
type Tab =
  | "backlog"
  | "sprint"
  | "team"
  | "stakeholders"
  | "performance"
  | "schedule"
  | "calendar"
  | "charter"
  | "documents"
  | "clients"
  | "notifications"
  | "time"
  | "cost"
  | "finance"
  | "import"
  | "generate"
  | "testing";

/**
 * How the work is drawn.
 *
 * A board answers "what is happening"; a list answers "what is in here". A
 * sprint is a board's size; a thousand-row backlog is not, which is why the
 * backlog tab opens as a list and the sprint opens as a board.
 */
type View = "board" | "list" | "items";

export default function ProjectWorkspace({ slug }: { slug: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [setup, setSetup] = useState<BoardSetup | null>(null);
  const [sprintList, setSprintList] = useState<Sprint[]>([]);
  /*
    Null until somebody picks: the default is read from the sprints once they
    load — the sprint backlog when one is running, the product backlog when
    none is — rather than guessed before they arrive.
  */
  const [tabChoice, setTab] = useState<Tab | null>(null);
  const [viewChoice, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * The project itself was refused: 404 (no such project here) or 403 with the
   * API's own reason. Only the project's own request decides this - a refused
   * side list (sprints, companies) is an ordinary error, not "you are not on
   * this project" - and every reload starts clear.
   */
  const [blocked, setBlocked] = useState<{ status: number; message: string } | null>(null);
  /** Null closed, "new" creating, otherwise the item being edited. */
  const [panel, setPanel] = useState<WorkItem | "new" | null>(null);
  /** Where a new item was asked for from: a board lane, a type, a story. */
  const [newDefaults, setNewDefaults] = useState<{ statusId?: string; type?: WorkItemType; parentId?: string }>({});
  const { user } = useAuth();
  const [boardKey, setBoardKey] = useState(0);
  /**
   * Bumped when a dependency changes, so the schedule re-derives.
   *
   * Separate from `boardKey` because they answer to different things: an
   * edge moves the critical path and nothing on the board, and a card moved
   * between columns moves neither.
   */
  const [scheduleKey, setScheduleKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Set by the header's "+", which opens the Team tab with the add form showing. */
  const [addingMember, setAddingMember] = useState(false);
  /**
   * The sprint being edited.
   *
   * `PATCH /sprints/{id}` existed from the first commit and nothing
   * called it, so a sprint's dates were fixed at the 14-day default and
   * its goal could be displayed and never written - and editable dates
   * were an explicit requirement.
   */
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [shelves, setShelves] = useState<Portfolio[]>([]);
  /** Current clients, for the company field in Settings. */
  const [clients, setClients] = useState<ExternalCompany[]>([]);
  /**
   * The report, and the sprint it belongs to.
   *
   * Carried together because the numbers may be the *last closed* sprint's
   * when none is running — and an unlabelled figure under the current sprint
   * strip reads as being about the current sprint.
   */
  const [report, setReport] = useState<{ sprint: Sprint; data: SprintReport } | null>(null);

  const active = sprintList.find((s) => s.status === "active") ?? null;
  /*
    The sprint the sprint backlog shows: the running one, else the next one
    planned — planning *is* filling a sprint backlog before it starts.
  */
  const sprintInView = active ?? sprintList.find((s) => s.status === "planning") ?? null;

  const tab: Tab = tabChoice ?? (active !== null ? "sprint" : "backlog");
  /* A backlog is list-sized; a sprint is board-sized. */
  const view: View = viewChoice ?? (tab === "backlog" ? "list" : "board");

  /**
   * Open an item the schedule or calendar knows only by id.
   *
   * Those two screens are the only ones that hold ids without holding the
   * items — everything else comes from a backlog page that already has them —
   * which is why `workItems.get` exists at all.
   */
  const openItemById = useCallback((id: string) => {
    void workItemsApi
      .get(id)
      .then(setPanel)
      .catch(() => setError("Could not open that item."));
  }, []);

  /*
    `?item=<id>` - where a notification (bell, Slack, WhatsApp) links to.
    Opened once, then taken off the address so closing the panel and
    refreshing does not open it again. `replace`, not `push`: the back button
    should leave the project, not reopen the item.
  */
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const linkedItem = searchParams?.get("item") ?? null;
  /* The id already opened, so a re-render before the address updates cannot open it twice. */
  const openedLink = useRef<string | null>(null);
  /*
    Waits for the project: opening first would race the first load, whose
    `setError(null)` would wipe a "could not open" before anybody read it.
  */
  const projectLoaded = project !== null;

  useEffect(() => {
    if (linkedItem === null || linkedItem === "") {
      openedLink.current = null;
      return;
    }
    if (!projectLoaded || openedLink.current === linkedItem) return;
    openedLink.current = linkedItem;

    openItemById(linkedItem);

    const rest = new URLSearchParams(searchParams?.toString() ?? "");
    rest.delete("item");
    const query = rest.toString();
    router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
  }, [linkedItem, projectLoaded, openItemById, pathname, router, searchParams]);

  /**
   * Whether this tab is showing work items.
   *
   * Read rather than `tab !== "team"`, which was true of every tab that was
   * not the team - so adding the stakeholder map put a board/list toggle and
   * an "Add item" button above a list of the client's finance director.
   */
  const isWorkTab = tab === "sprint" || tab === "backlog";

  const load = useCallback(async () => {
    try {
      /*
        The board's setup comes from its own endpoint rather than being
        inferred from an existing item. The earlier version did the latter,
        which left a brand-new project with no columns to put a first item
        into - unusable in exactly the state every project starts in.
      */
      setBlocked(null);

      let found: Awaited<ReturnType<typeof projectsApi.get>>;

      try {
        found = await projectsApi.get(slug);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
          setBlocked({ status: e.status, message: e.message });

          return;
        }

        throw e;
      }

      /* The project shows as soon as it is here; a side list that fails says so beside it. */
      setProject(found);

      const [sprints, boardSetup, folders, companyList] = await Promise.all([
        sprintsApi.list(slug),
        boardApi.get(slug),
        portfoliosApi.list(),
        companiesApi.list(),
      ]);

      setSprintList(sprints);
      setSetup(boardSetup);
      setShelves(folders);
      /*
        Current clients only. A former client stays available to the projects
        that already name it - the field shows what is set even when it is no
        longer offered - but new work should not be filed under a relationship
        somebody has marked finished.
      */
      setClients(companyList.data.filter((c) => c.isActive || c.id === found.externalCompanyId));
      setError(null);

      /*
        The sprint's own numbers. Computed by the API from its frozen
        snapshots, and until now returned to nobody — `committed`, `completed`,
        `carriedOver`, `addedMidSprint` and velocity all existed and were
        displayed on no screen.
      */
      const running = sprints.find((s) => s.status === 'active')
        ?? sprints.filter((s) => s.status === 'closed').at(-1);

      setReport(
        running === undefined
          ? null
          : { sprint: running, data: (await sprintsApi.get(running.id)).meta.report },
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not load.");
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);

    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  if (blocked !== null) {
    return (
      <Card>
        <Empty
          icon={AlertTriangle}
          hue="sun"
          title={blocked.status === 404 ? "This project could not be found" : "You cannot open this project"}
          hint={
            blocked.status === 404
              ? "It may have been deleted or renamed, or it belongs to another organisation."
              : `${blocked.message} If you should be on it, a project manager or the delivery lead can add you.`
          }
          action={
            <ButtonLink href="/suite/projects" icon={ArrowLeft} size="sm">
              Back to your projects
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  if (project === null) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading the project">
        <Skeleton className="h-20" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-56 lg:col-span-2" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  /*
    Who is on it, for the header. The project payload carries its members when
    the API loaded them; the board's assignee list is the same people otherwise.
  */
  const people = (project.members ?? []).length > 0
    ? (project.members ?? []).map((m) => ({ name: m.name }))
    : (setup?.assignees ?? []).map((a) => ({ name: a.name }));

  const tabs: PageTab[] = (
    [
      /* The owner's order: the product backlog first, then the sprint drawn from it. */
      { key: "backlog", label: "Product backlog" },
      {
        key: "sprint",
        label: sprintInView === null ? "Sprint backlog" : `Sprint backlog · S${sprintInView.sequence}`,
      },
      { key: "team", label: "Team" },
      /*
        Testing (5 Oct 2026): test sprints, the case library and the test
        backlog. Open to everybody on the project - the developers fixing a
        finding read the case that found it; what each person may change is
        decided inside by `can.manageTesting`.
      */
      { key: "testing", label: "Testing" },
      {
        key: "stakeholders",
        label: "Stakeholders",
        count:
          project.stakeholderCount === undefined || project.stakeholderCount === 0
            ? undefined
            : project.stakeholderCount,
      },
      /*
        Open to everybody on the project. Velocity, carry-over and rework
        are the team's own numbers, and a burndown only the manager can
        see is one discussed in a meeting rather than looked at on a
        Tuesday. The money signal inside it is withheld server-side.
      */
      { key: "performance", label: "Performance" },
      /*
        Also open to everybody. What waits for what is the order the
        whole team works in, and a critical path only the manager can
        see is one the people doing the work cannot plan around.
      */
      { key: "schedule", label: "Schedule" },
      /*
        The same four layers a month at a time. Separate from the
        schedule because they answer different questions: one is
        "what decides the end date", the other is "what is happening
        in February".
      */
      { key: "calendar", label: "Calendar" },
      /*
        Readable by anybody on the project. A charter nobody on the
        team can read is a charter that does not do its job.
      */
      { key: "charter", label: "Charter" },
      { key: "documents", label: "Documents" },
      /*
        Offered only to whoever may change the project itself.
        Handing a project status to somebody outside the institution
        is a decision about the engagement, not about the work — and
        a tab that only ever refuses is worse than no tab.
      */
      ...((project.can.manageShares ?? project.can.update) ? [{ key: "clients", label: "Client links" }] : []),
      /*
        Where the team's updates are posted - the project's own Slack
        channel and WhatsApp group. Same gate as the project settings
        they used to live in.
      */
      ...((project.can.manageChannels ?? project.can.update) ? [{ key: "notifications", label: "Notifications" }] : []),
      /*
        Time is everybody's: anybody on the project logs their own hours,
        and a timesheet gated behind a manager is one filled in from
        memory at the end of the month.
      */
      { key: "time", label: "Time" },
      /*
        Cost is not. A rate card says what each colleague is charged out
        at and the report gives the margin on the client's work - see
        `ProjectPolicy::viewCost`. Offered only to somebody who may read
        it, since the tab would otherwise only ever refuse.
      */
      ...(project.can.viewCost ? [{ key: "cost", label: "Cost" }] : []),
      /*
        Expected expense (Finance's approved budget) against what the
        project has actually cost - labour, travel, events, purchases,
        memos - down to who raised each request. Same gate as the cost
        report: it names rates and pay-derived labour.
      */
      ...(project.can.viewCost ? [{ key: "finance", label: "Finance" }] : []),
      /*
        Offered only to whoever may put work on the board. Unlike the
        stakeholder tab - which explains itself to a reader who cannot
        use it - an import screen has nothing to say to somebody who
        cannot import, and a tab that only ever refuses is worse than
        no tab.
      */
      ...((project.can.importBacklog ?? project.can.manageBoard) ? [{ key: "import", label: "Import" }] : []),
      /*
        Same gate as the import, and for the same two reasons: it adds
        work to everybody's board, and it spends the institution's
        provider budget.
      */
      ...((project.can.generate ?? project.can.manageBoard) ? [{ key: "generate", label: "Generate" }] : []),
    ] as PageTab[]
  );

  const chooseTab = (key: string) => {
    setTab(key as Tab);
    if (key !== "team") setAddingMember(false);
    /* A backlog is list-sized; a sprint is board-sized. */
    if (key === "backlog") setView("list");
    if (key === "sprint") setView("board");
  };

  /* Handed to whichever view is showing, which puts it beside its own search. */
  const viewSwitch = (
    <Segmented
      label="Show the work as"
      value={view}
      onChange={setView}
      options={[
        { key: "board", label: "Board" },
        { key: "list", label: "List" },
        /* The flat table: still the tool for estimating many items at once. */
        { key: "items", label: "Items" },
      ]}
    />
  );

  /*
    Anybody who can open the project may add work to it: `WorkItemPolicy::create`
    is membership *or* managing the board, and those are exactly the people who
    can see it (the engineering lead and the delivery lead reach it through
    `manageBoard`). Whom it may be given to is the panel's question.
  */
  const addItem = (defaults: { statusId?: string; type?: WorkItemType; parentId?: string } = {}) => {
    setNewDefaults(defaults);
    setPanel("new");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/suite/projects"
            className="inline-flex items-center gap-1.5 rounded outline-none hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            All projects
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="min-w-0 break-words">{project.name}</span>
            <Chip hue={project.isOverdue ? "coral" : LIFECYCLE_HUE[project.status]} dot className="text-[13px]">
              {project.statusLabel}
              {project.isOverdue ? " · overdue" : ""}
            </Chip>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-xs font-semibold text-neutral-600">{project.code ?? project.slug}</span>
            <span aria-hidden>·</span>
            <span>{project.typeLabel}</span>
            <span aria-hidden>·</span>
            <span>{project.currency}</span>
            {project.externalCompany != null && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Building2 size={13} aria-hidden />
                  {project.externalCompany.name}
                </span>
              </>
            )}
          </span>
        }
        actions={
          <>
            {(people.length > 0 || project.can.manageMembers) && (
              <span className="mr-1 flex items-center gap-1.5" title={plural(people.length, "person", "people")}>
                {people.length > 0 && <AvatarStack people={people} max={4} size={32} />}
                <span className="sr-only">{plural(people.length, "person", "people")} on this project</span>
                {/*
                  Adding people lived only behind the Team tab's own button, two
                  clicks from the board with nothing pointing at it. The "+" sits
                  where people look for it: on the end of the faces.
                */}
                {project.can.manageMembers && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingMember(true);
                      chooseTab("team");
                    }}
                    aria-label="Add people to this project"
                    title="Add people to this project"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-neutral-300 bg-white text-neutral-500 outline-none transition hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <UserPlus size={15} aria-hidden />
                  </button>
                )}
              </span>
            )}
            {project.viewerRole !== null && (
              <Chip hue="sky" icon={ShieldCheck}>
                {project.viewerRole.replace("_", " ").replace(/^./, (c) => c.toUpperCase())}
              </Chip>
            )}
            {/*
              Drafting work from a brief or an uploaded PRD or sheet. The
              project chat is still the floating button in the corner.
            */}
            {(project.can.generate ?? project.can.manageBoard) && (
              <Button icon={Sparkles} onClick={() => chooseTab("generate")}>
                Generate With AI
              </Button>
            )}
            {project.can.update && (
              <Button icon={Settings} onClick={() => setSettingsOpen(true)}>
                Settings
              </Button>
            )}
            {isWorkTab && (
              <Button variant="primary" icon={Plus} onClick={() => addItem()}>
                Add item
              </Button>
            )}
          </>
        }
      />

      {error !== null && <Notice tone="error">{error}</Notice>}

      {/* ----------------------------- summary ------------------------ */}

      <div className="grid gap-4 lg:grid-cols-3">
        <SprintPanel
          sprint={active}
          canManage={project.can.manageSprints ?? project.can.manageBoard}
          busy={busy}
          onCreate={() => void run(() => sprintsApi.create(project.slug))}
          onStart={(id) => void run(() => sprintsApi.start(id))}
          onClose={(id) => void run(() => sprintsApi.close(id))}
          onEdit={(sprint) => setEditingSprint(sprint)}
          planned={sprintList.filter((s) => s.status === "planning")}
          report={report}
        />

        <ProjectFacts project={project} sprintCount={sprintList.length} people={people.length} />
      </div>

      {/* ------------------------------ tabs -------------------------- */}

      {/*
        The tabs have the row to themselves. The Board / List / Items switch
        used to sit at the end of it, where it took the room the last tabs
        needed and covered them; it describes how *this* list is drawn, so it
        lives in the list's own toolbar beside its search (`viewSwitch`).
      */}
      {/*
        Wrapped so the page's section spacing lands on the wrapper: the strip
        carries `-mb-px` to sit on its own rule, which overrode the gap and put
        the search box flush against the tabs.
      */}
      <div className="pb-1">
        <UnderlineTabs tabs={tabs} active={tab} onChange={chooseTab} />
      </div>

      {tab === "team" ? (
        <ProjectTeam
          /* Remounted when asked from the header, so the add form opens even if the tab was already showing. */
          key={addingMember ? "adding" : "team"}
          project={project}
          startAdding={addingMember}
          onChanged={() => {
            setAddingMember(false);
            void load();
          }}
        />
      ) : tab === "stakeholders" ? (
        <StakeholderMap project={project} onChanged={() => void load()} />
      ) : tab === "performance" ? (
        <PerformancePanel project={project} sprints={sprintList} />
      ) : tab === "schedule" ? (
        <SchedulePanel
          project={project}
          refreshKey={scheduleKey}
          /*
            Opening from the schedule is how a slack figure turns into a
            change: the dependency editor is inside the item panel, and a
            row you cannot act on is a report rather than a plan.
          */
          onOpenItem={openItemById}
        />
      ) : tab === "calendar" ? (
        <ProjectMonthView
          project={project}
          refreshKey={scheduleKey}
          onOpenItem={openItemById}
        />
      ) : tab === "charter" ? (
        <ProjectCharterPanel project={project} />
      ) : tab === "documents" ? (
        <ProjectDocuments project={project} />
      ) : tab === "clients" ? (
        <ClientLinks project={project} />
      ) : tab === "notifications" ? (
        <ProjectChannels project={project} />
      ) : tab === "time" ? (
        <TimeSheet project={project} sprints={sprintList} setup={setup} />
      ) : tab === "cost" ? (
        <CostReport project={project} sprints={sprintList} />
      ) : tab === "finance" ? (
        <ProjectFinancePanel project={project} />
      ) : tab === "generate" ? (
        <AiWorkshop
          project={project}
          sprints={sprintList}
          onAddPeople={
            project.can.manageMembers
              ? () => {
                  setAddingMember(true);
                  chooseTab("team");
                }
              : undefined
          }
          onCommitted={() => {
            /* Committing creates work items, so the board behind this is stale. */
            setBoardKey((n) => n + 1);
            void load();
          }}
        />
      ) : tab === "testing" ? (
        <TestingWorkspace
          project={project}
          sprints={sprintList}
          setup={setup}
          refreshKey={boardKey}
          onOpenItem={(item) => setPanel(item)}
          onChanged={() => setBoardKey((n) => n + 1)}
        />
      ) : tab === "import" ? (
        <BacklogImport
          project={project}
          sprints={sprintList}
          onImported={() => {
            /*
              A commit creates work items, so the board behind this tab is now
              stale - and the item count in the sprint strip with it.
            */
            setBoardKey((n) => n + 1);
            void load();
          }}
        />
      ) : setup === null ? (
        <Skeleton className="h-64" />
      ) : tab === "sprint" && sprintInView === null ? (
        <Card>
          <Empty
            icon={Zap}
            title="No sprint to fill yet"
            hint="Plan a sprint above, then move stories into it from the product backlog."
            action={
              <Button size="sm" onClick={() => chooseTab("backlog")}>
                Open the product backlog
              </Button>
            }
          />
        </Card>
      ) : view === "items" ? (
        <WorkItemList
          project={project}
          setup={setup}
          sprintId={tab === "sprint" ? sprintInView?.id : undefined}
          refreshKey={boardKey}
          onOpen={(item) => setPanel(item)}
          viewSwitch={viewSwitch}
        />
      ) : view === "list" ? (
        <StoryBacklog
          viewSwitch={viewSwitch}
          project={project}
          setup={setup}
          sprintId={tab === "sprint" ? sprintInView?.id : undefined}
          sprints={sprintList}
          refreshKey={boardKey}
          viewerId={user?.id}
          itemPanelOpen={panel !== null}
          onOpenItem={(item) => setPanel(item)}
          onNewItem={addItem}
          onChanged={() => void load()}
        />
      ) : (
        <StoryBoard
          viewSwitch={viewSwitch}
          project={project}
          setup={setup}
          sprintId={tab === "sprint" ? sprintInView?.id : undefined}
          sprints={sprintList}
          refreshKey={boardKey}
          viewerId={user?.id}
          itemPanelOpen={panel !== null}
          onOpenItem={(item) => setPanel(item)}
          onNewItem={addItem}
          onChanged={() => void load()}
        />
      )}

      {editingSprint !== null && (
        <SprintDialog
          sprint={editingSprint}
          onClose={() => setEditingSprint(null)}
          onSaved={() => {
            setEditingSprint(null);
            void load();
          }}
        />
      )}

      {settingsOpen && (
        <ProjectSettingsDialog
          project={project}
          portfolios={shelves}
          companies={clients}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            void load();
          }}
          onDeleted={() => {
            window.location.href = "/suite/projects";
          }}
        />
      )}

      {panel !== null && setup !== null && (
        <WorkItemPanel
          project={project}
          setup={setup}
          item={panel === "new" ? null : panel}
          /*
            Creating from the sprint board puts the item in the sprint;
            creating from the backlog leaves it unscheduled, which is what the
            product backlog *is*.
          */
          sprint={panel === "new" && tab === "sprint" ? sprintInView : null}
          sprints={sprintList}
          initialStatusId={panel === "new" ? newDefaults.statusId : undefined}
          initialType={panel === "new" ? newDefaults.type : undefined}
          initialParentId={panel === "new" ? newDefaults.parentId : undefined}
          viewerId={user?.id}
          onClose={() => setPanel(null)}
          onSaved={() => {
            setPanel(null);
            setBoardKey((k) => k + 1);
            setScheduleKey((k) => k + 1);
            void load();
          }}
          onScheduleChanged={() => setScheduleKey((k) => k + 1)}
        />
      )}

      {/* The project assistant: the header button above and a floating launcher both open it. */}
      <ProjectAssistant project={project} onOpenItem={openItemById} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The sprint, the one action available on it, and what it did.
 *
 * Start and close are buttons rather than a status dropdown because each
 * freezes a snapshot that can never be taken again — a select would make
 * freezing a sprint's record look like setting an attribute.
 */
function SprintPanel({
  sprint,
  planned,
  canManage,
  busy,
  onCreate,
  onStart,
  onClose,
  onEdit,
  report,
}: {
  sprint: Sprint | null;
  planned: Sprint[];
  canManage: boolean;
  busy: boolean;
  onCreate: () => void;
  onStart: (id: string) => void;
  onClose: (id: string) => void;
  onEdit: (sprint: Sprint) => void;
  report: { sprint: Sprint; data: SprintReport } | null;
}) {
  const next = planned[0];

  /*
    How far through its window the running sprint is — time, not work. The
    work is in the numbers below, read from the sprint's frozen snapshots.
  */
  const elapsed =
    sprint === null || sprint.lengthInDays <= 0
      ? 0
      : sprint.hasOverrun
        ? 100
        : ((sprint.lengthInDays - Math.max(0, sprint.daysRemaining)) / sprint.lengthInDays) * 100;

  const actions =
    !canManage ? null : sprint !== null ? (
      <>
        {/*
          Dates move on a running sprint. Refusing that would push people
          into closing early and opening a replacement, which throws away
          the commitment snapshot that makes velocity mean anything.
        */}
        <Button size="sm" icon={Pencil} disabled={busy} onClick={() => onEdit(sprint)}>
          Dates &amp; goal
        </Button>
        <Button size="sm" icon={CheckCircle2} disabled={busy} onClick={() => onClose(sprint.id)}>
          Close sprint
        </Button>
      </>
    ) : next !== undefined ? (
      <>
        {/* Before it starts is when its dates and goal most want setting. */}
        <Button size="sm" icon={Pencil} disabled={busy} onClick={() => onEdit(next)}>
          Dates &amp; goal
        </Button>
        <Button size="sm" icon={Play} disabled={busy} onClick={() => onStart(next.id)} className="!border-mint-100 !bg-mint-50 !text-mint-700 hover:!bg-mint-100">
          Start it
        </Button>
      </>
    ) : (
      <Button size="sm" icon={Plus} disabled={busy} onClick={onCreate}>
        Plan a sprint
      </Button>
    );

  return (
    <Panel
      className="lg:col-span-2"
      icon={Zap}
      hue={sprint !== null ? "blue" : "slate"}
      title={sprint !== null ? sprint.name : next !== undefined ? `${next.name} is planned` : "No sprint running"}
      subtitle={
        sprint !== null
          ? fmtRange(sprint.startsOn, sprint.endsOn)
          : next !== undefined
            ? fmtRange(next.startsOn, next.endsOn)
            : "The next one defaults to fourteen days."
      }
      actions={actions === null ? undefined : <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
    >
      {sprint !== null && (
        <div className="space-y-3">
          {sprint.goal !== null && (
            <RichTextView value={sprint.goal} size="sm" className="rounded-xl border-l-4 border-primary-300 bg-primary-50/50 px-3.5 py-2.5" />
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {sprint.hasOverrun ? (
              /* Reported, never auto-closed. A sprint nobody closed is a fact. */
              <Chip hue="coral" icon={AlertTriangle}>
                Ran out {Math.abs(sprint.daysRemaining)} days ago
              </Chip>
            ) : (
              <Chip hue="blue" icon={Timer}>
                {sprint.daysRemaining} days left
              </Chip>
            )}
            {sprint.committed !== undefined && (
              <span className="text-neutral-600">
                <span className="font-semibold text-neutral-900">{sprint.committed.hours}h</span> committed across{" "}
                {sprint.committed.estimated} of {sprint.committed.total} items
              </span>
            )}
          </div>

          <Progress
            value={elapsed}
            hue={sprint.hasOverrun ? "coral" : "blue"}
            label={`Day ${Math.min(sprint.lengthInDays, sprint.lengthInDays - Math.max(0, sprint.daysRemaining))} of ${sprint.lengthInDays}`}
            showValue
          />
        </div>
      )}

      {sprint === null && next !== undefined && next.goal !== null && (
        <RichTextView value={next.goal} size="sm" className="rounded-xl border-l-4 border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-neutral-700" />
      )}

      {report !== null && (
        <SprintNumbers report={report.data} sprint={report.sprint} className={sprint !== null || next?.goal ? "mt-5" : ""} />
      )}

      {sprint === null && report === null && next === undefined && (
        <p className="text-sm text-neutral-500">
          Work lands in the product backlog until a sprint is planned and started.
        </p>
      )}
    </Panel>
  );
}

/**
 * What the sprint actually did.
 *
 * Every figure is read from the sprint's frozen snapshots rather than from
 * live rows, so a carried-over item finishing next month cannot improve a past
 * sprint's numbers.
 *
 * **Coverage travels with the hours.** The backlog this module was designed
 * against had 118 tasks and no estimates at all, so "18h" alone would be a
 * confident figure over an arbitrary subset. "18h across 4 of 11 estimated"
 * is the honest version, and it is also the nudge that gets the rest filled in.
 */
function SprintNumbers({
  report,
  sprint,
  className,
}: {
  report: SprintReport;
  sprint: Sprint;
  className?: string;
}) {
  const cells: { label: string; value: string; hint?: string; hue?: Hue }[] = [
    {
      label: "Committed",
      value: `${report.committed.count} items`,
      hint: coverage(report.committed),
    },
    {
      label: "Completed",
      value: `${report.completed.count} items`,
      hint: coverage(report.completed),
      hue: report.completed.count > 0 ? "mint" : undefined,
    },
    {
      label: "Carried over",
      value: `${report.carriedOver.count}`,
      hint: "Committed, not finished",
    },
    {
      /* The most actionable number in delivery — see PROJECTS_MODULE.md § 3. */
      label: "Added mid-sprint",
      value: `${report.addedMidSprint.count}`,
      hint: "Not in the commitment",
      hue: report.addedMidSprint.count > 0 ? "sun" : undefined,
    },
    {
      label: "Velocity",
      /* Null until it closes. Zero would be a claim about a team. */
      value: report.velocityHours === null ? "-" : `${report.velocityHours}h`,
      hint: report.velocityHours === null ? "Measured when the sprint closes" : "Finished hours",
      hue: report.velocityHours === null ? undefined : "grape",
    },
  ];

  const share =
    report.committed.count === 0 ? null : Math.round((report.completed.count / report.committed.count) * 100);

  return (
    <div className={className}>
      {/*
        Named, because when no sprint is running these are the *last closed*
        one's numbers — and an unlabelled figure under the current sprint strip
        reads as being about the current sprint.
      */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {sprint.name}
          {sprint.status === "closed" ? " · closed" : ""}
        </p>
        {share !== null && (
          <span className="text-xs text-neutral-600">
            <span className="font-semibold tabular-nums text-neutral-900">{share}%</span> of the commitment finished
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={cx("rounded-2xl p-3.5", cell.hue ? HUE[cell.hue].soft : "bg-neutral-50")}
          >
            <dt className={cx("text-xs font-medium", cell.hue ? "opacity-90" : "text-neutral-500")}>{cell.label}</dt>
            <dd className={cx("mt-1 text-lg font-bold leading-tight tabular-nums", cell.hue ? "" : "text-neutral-900")}>
              {cell.value}
            </dd>
            {cell.hint !== undefined && (
              <dd className={cx("mt-0.5 text-[11px] leading-snug", cell.hue ? "opacity-80" : "text-neutral-500")}>
                {cell.hint}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Hours, and how much of the count they actually cover. */
function coverage(totals: { count: number; hours: number; estimated: number }): string {
  if (totals.count === 0) return "Nothing yet";

  if (totals.estimated === 0) return "None estimated";

  return `${totals.hours}h across ${totals.estimated} of ${totals.count} estimated`;
}

/** A bare `YYYY-MM-DD` as local midnight, so no timezone moves the day. */
function bareDay(value: string): number {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);

  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

/**
 * The project's promise, beside the sprint: its window, how much of it has
 * gone, who it is for and who is on it.
 *
 * **The bar is time, not work.** There is no project-wide completion figure,
 * and inventing one from the board would be a number nobody agreed to. A
 * window with no target says so rather than drawing an empty bar.
 */
function ProjectFacts({
  project,
  sprintCount,
  people,
}: {
  project: Project;
  sprintCount: number;
  people: number;
}) {
  /*
    A finished project has no days to go. Counting down to its target kept
    saying "12 days to go" on work closed last month, and the time bar kept
    filling; both now stop, and the line says when it ended.
  */
  const finished = project.status === "complete" || project.status === "cancelled";
  const ended = project.status === "cancelled" ? "Cancelled" : "Finished";

  const timeUsed =
    !finished && project.startsOn !== null && project.targetEndsOn !== null
      ? (() => {
          const start = bareDay(project.startsOn);
          const end = bareDay(project.targetEndsOn);
          const today = new Date();
          const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

          return end <= start ? null : Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
        })()
      : null;

  const target = finished
    ? project.actualEndsOn !== null
      ? `${ended} ${fmtDate(project.actualEndsOn)}`
      : ended
    : project.daysToTarget === null
      ? "No target set"
      : project.daysToTarget < 0
        ? `${Math.abs(project.daysToTarget)} days past target`
        : project.daysToTarget === 0
          ? "Due today"
          : `${project.daysToTarget} days to go`;

  return (
    <Panel title="Project" subtitle={target} icon={Target} hue={project.isOverdue && !finished ? "coral" : "mint"}>
      {timeUsed !== null && (
        <div className="mb-3">
          <Progress value={timeUsed} hue={project.isOverdue ? "coral" : "mint"} label="Time used" showValue size="sm" />
        </div>
      )}

      <div className="divide-y divide-neutral-100">
        <InfoRow icon={CalendarRange} hue="sky" label="Window" value={fmtRange(project.startsOn, project.targetEndsOn)} />
        {project.actualEndsOn !== null && (
          <InfoRow icon={Flag} hue="grape" label="Finished" value={fmtDate(project.actualEndsOn)} />
        )}
        <InfoRow
          icon={Users}
          hue="coral"
          label="Team"
          value={`${plural(people, "person", "people")} · ${plural(sprintCount, "sprint")}`}
        />
        {project.portfolio != null && (
          <InfoRow icon={FolderOpen} hue="sun" label="Folder" value={project.portfolio.name} />
        )}
      </div>
    </Panel>
  );
}
