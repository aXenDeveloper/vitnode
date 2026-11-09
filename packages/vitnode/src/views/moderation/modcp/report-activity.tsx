import { cn } from "cn";
import {
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserCheckIcon,
  UserMinusIcon,
  WorkflowIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { RichTextDocument } from "@/content/rich-text/document";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormEditor } from "@/components/form/fields/editor";
import { RichTextContent } from "@/components/rich-text";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  isRichTextDocument,
  isRichTextEmpty,
} from "@/content/rich-text/document";

import type { ModcpReportDetail } from "./modcp-query";
import type { ReportPerson, ToneName } from "./report-tone";

import {
  addReportNote,
  deleteReportNote,
  editReportNote,
} from "../moderation-mutations";
import { useReportFailure } from "./report-forms";
import {
  PersonAvatar,
  PersonName,
  StatusLozenge,
  TONE_SURFACE,
} from "./report-tone";

type ReportEvent = ModcpReportDetail["events"][number];

const EVENT_STYLE: Record<
  ReportEvent["type"],
  { icon: React.ComponentType<{ className?: string }>; tone: ToneName }
> = {
  action: { icon: EyeOffIcon, tone: "destructive" },
  assigned: { icon: UserCheckIcon, tone: "info" },
  created: { icon: FlagIcon, tone: "warning" },
  note: { icon: MessageSquareIcon, tone: "info" },
  note_deleted: { icon: Trash2Icon, tone: "destructive" },
  note_edited: { icon: PencilIcon, tone: "info" },
  reopened: { icon: RotateCcwIcon, tone: "warning" },
  resolved: { icon: CheckCircle2Icon, tone: "success" },
  status_changed: { icon: WorkflowIcon, tone: "info" },
  unassigned: { icon: UserMinusIcon, tone: "muted" },
  warning: { icon: TriangleAlertIcon, tone: "warning" },
};

const isUnhide = (event: ReportEvent) =>
  event.type === "action" && event.data.action === "unhide";

const isStatus = (value: unknown): value is "done" | "in_progress" | "new" =>
  value === "new" || value === "in_progress" || value === "done";

const isResolution = (
  value: unknown,
): value is "action_taken" | "duplicate" | "no_violation" =>
  value === "no_violation" || value === "action_taken" || value === "duplicate";

const EventText = ({
  event,
  people,
}: {
  event: ReportEvent;
  people: Map<number, ReportPerson>;
}): React.ReactNode => {
  const t = useTranslations("core.moderation");
  const tEvents = useTranslations(
    "core.moderation.modcp.detail.activity.events",
  );
  const mention = (id: unknown) => {
    const person = typeof id === "number" ? people.get(id) : undefined;

    return person ? (
      <PersonName link person={person} />
    ) : (
      t("modcp.detail.timeline.someone")
    );
  };

  switch (event.type) {
    case "action":
      return tEvents(isUnhide(event) ? "action_unhide" : "action_hide");
    case "assigned":
      return event.actor && event.data.assigneeId === event.actor.id
        ? tEvents("took")
        : tEvents.rich("assigned", {
            assignee: () => mention(event.data.assigneeId),
          });
    case "resolved":
      return tEvents("resolved", {
        resolution: isResolution(event.data.resolution)
          ? t(`resolutions.${event.data.resolution}`)
          : "-",
      });
    case "status_changed":
      return tEvents.rich("status_changed", {
        status: () =>
          isStatus(event.data.to) ? (
            <StatusLozenge status={event.data.to} />
          ) : null,
      });
    case "unassigned":
      return event.data.reason === "lost_access"
        ? tEvents("lost_access")
        : tEvents.rich("unassigned", {
            assignee: () => mention(event.data.previousAssigneeId),
          });
    case "warning":
      return tEvents.rich("warning", {
        member: () => mention(event.data.userId),
        points: typeof event.data.points === "number" ? event.data.points : 0,
      });
    default:
      return tEvents(event.type);
  }
};

const NoteText = ({ body }: { body: unknown }) =>
  isRichTextDocument(body) ? (
    <RichTextContent
      className="text-foreground text-sm leading-relaxed"
      content={body}
    />
  ) : (
    <p className="text-foreground break-words whitespace-pre-wrap">
      {typeof body === "string" ? body : ""}
    </p>
  );

const NoteChange = ({ event }: { event: ReportEvent }) => {
  const t = useTranslations("core.moderation.modcp.detail.activity");
  const hasAfter = event.type === "note_edited";

  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed">
      {event.data.before ? (
        <div className="bg-destructive/5 ring-destructive/15 flex flex-col gap-1 rounded-xl rounded-tl-sm px-3.5 py-2.5 ring-1">
          <span className="text-muted-foreground text-xs font-medium">
            {t("before")}
          </span>
          <div className={cn(!hasAfter && "line-through decoration-1")}>
            <NoteText body={event.data.before} />
          </div>
        </div>
      ) : null}
      {hasAfter && event.data.after ? (
        <div className="bg-success/8 ring-success/20 flex flex-col gap-1 rounded-xl px-3.5 py-2.5 ring-1">
          <span className="text-muted-foreground text-xs font-medium">
            {t("after")}
          </span>
          <NoteText body={event.data.after} />
        </div>
      ) : null}
    </div>
  );
};

const EventBody = ({ event }: { event: ReportEvent }) => {
  if (event.type === "note_edited" || event.type === "note_deleted") {
    return <NoteChange event={event} />;
  }
  const body =
    event.data.body ??
    event.data.explanation ??
    (event.type === "reopened" ? event.data.reason : undefined);
  if (!body) return null;

  return (
    <div
      className={cn(
        "rounded-xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed",
        event.type === "resolved"
          ? "bg-success/8 ring-success/20 ring-1"
          : "bg-muted/60",
      )}
    >
      <NoteText body={body} />
    </div>
  );
};

const SystemAvatar = () => (
  <span
    aria-hidden
    className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full"
  >
    <WorkflowIcon className="size-4" />
  </span>
);

const toDocument = (body: unknown): null | RichTextDocument => {
  if (isRichTextDocument(body)) return body;
  if (typeof body !== "string" || !body) return null;

  return {
    content: [{ content: [{ text: body, type: "text" }], type: "paragraph" }],
    type: "doc",
  };
};

const noteBodySchema = z.looseObject({
  content: z.array(z.unknown()).optional(),
  type: z.literal("doc"),
});

const noteFormSchema = (message: string, initial: null | RichTextDocument) =>
  z.object({
    body: noteBodySchema
      .nullable()
      .default(initial as null | z.infer<typeof noteBodySchema>)
      .refine(
        doc => doc !== null && !isRichTextEmpty(doc as RichTextDocument),
        { message },
      ),
  });

const NoteEditForm = ({
  event,
  onCancel,
  onDone,
  reportId,
}: {
  event: ReportEvent;
  onCancel: () => void;
  onDone: () => Promise<void>;
  reportId: number;
}) => {
  const t = useTranslations("core.moderation.modcp.detail");
  const fail = useReportFailure();
  const formSchema = noteFormSchema(
    t("activity.note_required"),
    toDocument(event.data.body),
  );

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await editReportNote({
      body: values.body as RichTextDocument,
      id: reportId,
      noteId: event.id,
    });
    if (fail(result)) {
      await onDone();

      return;
    }
    toast.success(t("notes.updated"));
    onCancel();
    await onDone();
  };

  return (
    <AutoForm
      className="flex min-w-0 flex-col gap-2"
      fields={[
        {
          component: props => (
            <AutoFormEditor
              {...props}
              className="min-h-24"
              format="json"
              onEditor={editor => {
                editor?.commands.focus("end");
              }}
            />
          ),
          id: "body",
        },
      ]}
      formSchema={formSchema}
      layout={fields => (
        <>
          {fields.body}
          <div className="flex justify-end gap-2">
            <Button onClick={onCancel} size="sm" type="button" variant="ghost">
              {t("activity.cancel")}
            </Button>
            <AutoFormSubmitButton>{t("notes.save")}</AutoFormSubmitButton>
          </div>
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};

const NoteActions = ({
  event,
  onDone,
  onEdit,
  reportId,
}: {
  event: ReportEvent;
  onDone: () => Promise<void>;
  onEdit: () => void;
  reportId: number;
}) => {
  const t = useTranslations("core.moderation.modcp.detail.notes");
  const fail = useReportFailure();
  const [isConfirming, setIsConfirming] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("menu")}
              className="text-muted-foreground ms-auto"
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <MoreHorizontalIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {event.canEdit ? (
            <DropdownMenuItem onClick={onEdit}>
              <PencilIcon aria-hidden />
              {t("edit")}
            </DropdownMenuItem>
          ) : null}
          {event.canDelete ? (
            <DropdownMenuItem
              onClick={() => {
                setIsConfirming(true);
              }}
              variant="destructive"
            >
              <Trash2Icon aria-hidden />
              {t("delete")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionAlertDialog
        description={t("confirm_delete_desc")}
        onOpenChange={setIsConfirming}
        onSubmit={async ({ onClose }) => {
          const result = await deleteReportNote({
            id: reportId,
            noteId: event.id,
          });
          if (!fail(result)) toast.success(t("deleted"));
          onClose();
          await onDone();
        }}
        open={isConfirming}
        textSubmit={t("delete")}
        title={t("confirm_delete")}
      />
    </>
  );
};

const ActivityItem = ({
  event,
  onDone,
  people,
  reportId,
}: {
  event: ReportEvent;
  onDone: () => Promise<void>;
  people: Map<number, ReportPerson>;
  reportId: number;
}) => {
  const t = useTranslations("core.moderation.modcp.detail");
  const [isEditing, setIsEditing] = React.useState(false);
  const style = EVENT_STYLE[event.type];
  const tone = isUnhide(event) ? "success" : style.tone;
  const Icon = isUnhide(event) ? EyeIcon : style.icon;
  const isEdited = typeof event.data.editedAt === "string";

  return (
    <li className="flex gap-3">
      <span className="relative h-fit shrink-0">
        {event.actor ? (
          <PersonAvatar person={event.actor} size={32} />
        ) : (
          <SystemAvatar />
        )}
        <span className="bg-card ring-card absolute -end-1 -bottom-1 flex size-4.5 rounded-full ring-2">
          <span
            className={cn(
              "flex size-full items-center justify-center rounded-full",
              TONE_SURFACE[tone],
            )}
          >
            <Icon aria-hidden className="size-2.5" />
          </span>
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-sm leading-relaxed">
          {event.actor ? (
            <PersonName link person={event.actor} />
          ) : (
            <span className="text-foreground font-medium">
              {t("timeline.system")}
            </span>
          )}
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            <EventText event={event} people={people} />
          </span>
          <span aria-hidden>·</span>
          <span className="text-xs">
            <DateFormat date={event.createdAt} />
          </span>
          {isEdited ? (
            <span className="text-xs">({t("notes.edited")})</span>
          ) : null}
          {(event.canEdit || event.canDelete) && !isEditing ? (
            <NoteActions
              event={event}
              onDone={onDone}
              onEdit={() => {
                setIsEditing(true);
              }}
              reportId={reportId}
            />
          ) : null}
        </div>
        {isEditing ? (
          <NoteEditForm
            event={event}
            onCancel={() => {
              setIsEditing(false);
            }}
            onDone={onDone}
            reportId={reportId}
          />
        ) : (
          <EventBody event={event} />
        )}
      </div>
    </li>
  );
};

const ActivityFeed = ({
  events,
  onDone,
  people,
  reportId,
}: {
  events: ReportEvent[];
  onDone: () => Promise<void>;
  people: Map<number, ReportPerson>;
  reportId: number;
}) => {
  const t = useTranslations("core.moderation.modcp.detail");

  if (events.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-sm">
        {t("activity.empty")}
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-5">
      {[...events].reverse().map(event => (
        <ActivityItem
          event={event}
          key={event.id}
          onDone={onDone}
          people={people}
          reportId={reportId}
        />
      ))}
    </ol>
  );
};

const NoteComposer = ({
  id,
  me,
  onDone,
}: {
  id: number;
  me: null | ReportPerson;
  onDone: () => Promise<void>;
}) => {
  const t = useTranslations("core.moderation.modcp.detail");
  const fail = useReportFailure();
  const [isOpen, setIsOpen] = React.useState(false);
  const formSchema = noteFormSchema(t("activity.note_required"), null);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        target.isContentEditable
      ) {
        return;
      }
      if (
        event.key === "m" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await addReportNote({
      body: values.body as RichTextDocument,
      id,
    });
    if (fail(result)) return;
    toast.success(t("notes.success"), { description: t("notes.desc") });
    setIsOpen(false);
    await onDone();
  };

  return (
    <div className="flex gap-3">
      {me ? <PersonAvatar person={me} size={32} /> : null}
      {isOpen ? (
        <AutoForm
          className="flex min-w-0 flex-1 flex-col gap-2"
          fields={[
            {
              component: props => (
                <AutoFormEditor
                  {...props}
                  className="min-h-28"
                  format="json"
                  onEditor={editor => {
                    editor?.commands.focus("end");
                  }}
                  placeholder={t("activity.editor_placeholder")}
                />
              ),
              id: "body",
            },
          ]}
          formSchema={formSchema}
          layout={fields => (
            <>
              {fields.body}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-xs">
                  {t("activity.hint")}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setIsOpen(false);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {t("activity.cancel")}
                  </Button>
                  <AutoFormSubmitButton>
                    {t("notes.submit")}
                  </AutoFormSubmitButton>
                </div>
              </div>
            </>
          )}
          onSubmit={onSubmit}
        />
      ) : (
        <button
          className="bg-card ring-foreground/10 text-muted-foreground hover:ring-foreground/20 focus-visible:ring-ring flex h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-3.5 text-start text-sm shadow-xs ring-1 transition-shadow outline-none focus-visible:ring-2"
          onClick={() => {
            setIsOpen(true);
          }}
          type="button"
        >
          {t("activity.placeholder")}
          <Kbd>M</Kbd>
        </button>
      )}
    </div>
  );
};

export const ReportActivity = ({
  canNote,
  events,
  id,
  me,
  onDone,
  people,
}: {
  canNote: boolean;
  events: ReportEvent[];
  id: number;
  me: null | ReportPerson;
  onDone: () => Promise<void>;
  people: Map<number, ReportPerson>;
}) => {
  const t = useTranslations("core.moderation.modcp.detail");
  const headingId = React.useId();
  const notes = events.filter(event => event.type === "note");
  const history = events.filter(event => event.type !== "note");

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 className="text-foreground text-sm font-semibold" id={headingId}>
        {t("sections.activity")}
      </h2>
      <Tabs className="gap-5" defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes">
            {t("activity.notes")}
            <span className="text-muted-foreground text-xs tabular-nums">
              {notes.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="all">{t("activity.all")}</TabsTrigger>
          <TabsTrigger value="history">{t("activity.history")}</TabsTrigger>
        </TabsList>
        {canNote ? <NoteComposer id={id} me={me} onDone={onDone} /> : null}
        <TabsPanels>
          <TabsContent value="all">
            <ActivityFeed
              events={events}
              onDone={onDone}
              people={people}
              reportId={id}
            />
          </TabsContent>
          <TabsContent value="notes">
            <ActivityFeed
              events={notes}
              onDone={onDone}
              people={people}
              reportId={id}
            />
          </TabsContent>
          <TabsContent value="history">
            <ActivityFeed
              events={history}
              onDone={onDone}
              people={people}
              reportId={id}
            />
          </TabsContent>
        </TabsPanels>
      </Tabs>
    </section>
  );
};
