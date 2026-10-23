"use client";

import { useEffect, useId, useState } from "react";
import {
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Film,
  ShieldCheck,
} from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import MediaPicker from "./MediaPicker";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { media, type MediaAsset, type MediaKind } from "@/lib/api/media-client";
import {
  QUIZ_QUESTION_TYPES,
  alignBlanks,
  countBlanks,
  emptyQuestion,
  questionForType,
  quizQuestionIssue,
  type LectureContent,
  type LectureType,
  type QuizPair,
  type QuizQuestion,
  type QuizQuestionType,
  type QuizSettings,
} from "@/suite/lms/lib/curriculum";

const FIELD =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100";

const ICON_BTN =
  "rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-error-500/10 hover:text-error-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400";

export default function LectureContentEditor({
  type,
  content,
  onChange,
}: {
  type: LectureType;
  content: LectureContent;
  onChange: (c: LectureContent) => void;
}) {
  if (type === "video") return <VideoEditor content={content} onChange={onChange} />;
  if (type === "article") return <ArticleEditor content={content} onChange={onChange} />;
  if (type === "document")
    return <DocumentEditor content={content} onChange={onChange} />;
  return <QuizEditor content={content} onChange={onChange} />;
}

/* ------------------------------------------------------------------ */
/*  Video and document — chosen from the media library                 */
/* ------------------------------------------------------------------ */

/**
 * Picking a file for a lecture.
 *
 * The old editor uploaded straight to Cloudinary and stored a bare URL, which
 * is why the media library — the S3, Drive and Cloudinary adapters, the
 * per-institution provider settings, the platform-only streaming — had no way
 * into a lesson. This goes through the library instead, so the file is a
 * record the institution owns: it lands on whichever provider they configured,
 * it can be kept to signed-in learners, and it can be re-used rather than
 * uploaded nine times.
 *
 * A lecture authored before the library still shows its stored URL and still
 * plays. Replacing the file is how it moves across; nothing is rewritten
 * underneath anyone.
 */
function MediaField({
  kind,
  content,
  onChange,
  emptyLabel,
  allowLink = true,
}: {
  kind: MediaKind;
  content: LectureContent;
  onChange: (c: LectureContent) => void;
  emptyLabel: string;
  allowLink?: boolean;
}) {
  const [picking, setPicking] = useState(false);

  /*
    Keyed by the id it describes, rather than held as a bare asset beside a
    separate "missing" flag. Two reasons. Clearing on an id change would mean
    calling setState in the effect body, which React 19 rightly complains
    about; and comparing the key is also what stops a slow response for the
    previous file painting over the one just picked.
  */
  const [resolved, setResolved] = useState<{
    id: string;
    asset: MediaAsset | null;
  } | null>(null);

  const assetId = content.mediaAssetId ?? null;
  const legacyUrl = content.url ?? "";

  /* Resolve the stored reference, so the editor shows a name and not an id. */
  useEffect(() => {
    if (assetId === null) return;

    let cancelled = false;

    media
      .get(assetId)
      .then((found) => {
        if (!cancelled) setResolved({ id: assetId, asset: found });
      })
      .catch(() => {
        /*
          The file was forgotten from the library after this lesson was
          written. A null asset against a real id is what "deleted" means
          here, and it is said out loud rather than shown as an empty slot:
          learners are already being told the media is missing, and the author
          is the only person who can fix it.
        */
        if (!cancelled) setResolved({ id: assetId, asset: null });
      });

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const current = resolved?.id === assetId ? resolved : null;
  const asset = current?.asset ?? null;
  const missing = current !== null && current.asset === null;
  const loading = assetId !== null && current === null;

  const choose = (picked: MediaAsset) => {
    setPicking(false);
    setResolved({ id: picked.id, asset: picked });

    onChange({
      ...content,
      mediaAssetId: picked.id,
      /*
        Kept in step with the asset so anything still reading the bare URL —
        an export, a player that predates the resolver — carries on working.
      */
      source: picked.isExternal ? "link" : "upload",
      url: picked.url ?? "",
      provider: picked.provider,
    });
  };

  const label = (): string => {
    if (asset !== null) return asset.name;
    if (loading) return "Loading…";
    if (missing) return "This file has been deleted";

    return legacyUrl;
  };

  const detail = (): string => {
    if (asset !== null) {
      return asset.isExternal
        ? (asset.externalHost ?? "External link")
        : asset.providerLabel;
    }

    if (loading) return "";

    if (missing) {
      return "Pick another file — learners are being told the media is missing.";
    }

    return "Added before the media library. Still plays; replace it to move it across.";
  };

  return (
    <div className="space-y-3">
      {assetId === null && legacyUrl === "" ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-4 text-sm font-medium text-neutral-600 transition-colors hover:border-primary-300 hover:bg-primary-50/40 hover:text-primary-700"
        >
          <Upload size={16} />
          {emptyLabel}
        </button>
      ) : (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${
            missing ? "border-error-200 bg-error-50/40" : "border-neutral-200"
          }`}
        >
          {missing ? (
            <AlertCircle size={15} className="shrink-0 text-error-500" />
          ) : (
            <Film size={15} className="shrink-0 text-neutral-400" />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-neutral-800">
              {label()}
            </p>
            <p className="truncate text-[11px] text-neutral-400">{detail()}</p>
          </div>

          {asset?.isPlatformOnly === true && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700"
              title="Streams through the platform. Copying the link gets nobody in."
            >
              <ShieldCheck size={11} />
              On the platform only
            </span>
          )}

          <button
            type="button"
            onClick={() => setPicking(true)}
            className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Change
          </button>
        </div>
      )}

      {picking && (
        <MediaPicker
          kind={kind}
          allowLink={allowLink}
          onPick={choose}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function VideoEditor({
  content,
  onChange,
}: {
  content: LectureContent;
  onChange: (c: LectureContent) => void;
}) {
  return (
    <MediaField
      kind="video"
      content={content}
      onChange={onChange}
      emptyLabel="Choose a video"
    />
  );
}

function DocumentEditor({
  content,
  onChange,
}: {
  content: LectureContent;
  onChange: (c: LectureContent) => void;
}) {
  const noteId = useId();

  return (
    <div className="space-y-3">
      {/*
        No pasted link here. A document lecture exists so the file is held by
        the institution and can be kept to signed-in learners — a link to
        somebody else's Drive is precisely the thing this replaces.
      */}
      <MediaField
        kind="document"
        content={content}
        onChange={onChange}
        emptyLabel="Choose a document"
        allowLink={false}
      />

      <div>
        <label
          htmlFor={noteId}
          className="mb-1 block text-xs font-medium text-neutral-700"
        >
          Tell them what it is
        </label>
        <input
          id={noteId}
          value={content.note ?? ""}
          onChange={(e) => onChange({ ...content, note: e.target.value })}
          placeholder="e.g. Ward handbook, 24 pages"
          aria-describedby={`${noteId}-hint`}
          className={FIELD}
        />
        <p id={`${noteId}-hint`} className="mt-1 text-xs text-neutral-400">
          {/* A 40 MB download on a phone on a ward deserves a warning. */}
          Shown before they open it. Worth saying if it is long or large.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Article — rich text                                               */
/* ------------------------------------------------------------------ */

function ArticleEditor({
  content,
  onChange,
}: {
  content: LectureContent;
  onChange: (c: LectureContent) => void;
}) {
  return (
    <RichTextEditor
      value={content.html ?? ""}
      onChange={(html) => onChange({ html })}
      placeholder="Write the article lesson — format with the toolbar above…"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Quiz — multiple choice, fill the blank, short answer, matching     */
/* ------------------------------------------------------------------ */

function QuizEditor({
  content,
  onChange,
}: {
  content: LectureContent;
  onChange: (c: LectureContent) => void;
}) {
  const questions: QuizQuestion[] =
    content.questions && content.questions.length > 0
      ? content.questions
      : [emptyQuestion("multiple_choice")];

  const settings = content.settings ?? {};

  const setQuestions = (next: QuizQuestion[]) =>
    onChange({ ...content, questions: next });

  const setSetting = (patch: Partial<typeof settings>) =>
    onChange({ ...content, settings: { ...settings, ...patch } });

  return (
    <div className="space-y-3">
      <QuizRules
        settings={settings}
        questionCount={questions.length}
        onChange={setSetting}
      />

      {questions.map((q, qi) => (
        <QuestionCard
          key={q.id ?? qi}
          index={qi}
          question={q}
          canRemove={questions.length > 1}
          onChange={(next) => setQuestions(questions.map((x, i) => (i === qi ? next : x)))}
          onRemove={() => setQuestions(questions.filter((_, i) => i !== qi))}
        />
      ))}

      <div className="flex flex-wrap gap-2">
        {QUIZ_QUESTION_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setQuestions([...questions, emptyQuestion(t.value)])}
            title={t.hint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:border-primary-300 hover:bg-primary-50/40 hover:text-primary-700"
          >
            <Plus size={14} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * How the quiz is sat.
 *
 * Above the questions, because these decide what writing them is for: a bank
 * of forty is a different authoring job from a fixed ten, and finding that out
 * after writing ten is the wrong order.
 *
 * Every field is optional and every blank means the old behaviour, so an
 * author who ignores this panel entirely gets exactly the quiz they would have
 * got before it existed.
 */
function QuizRules({
  settings,
  questionCount,
  onChange,
}: {
  settings: QuizSettings;
  questionCount: number;
  onChange: (patch: Partial<QuizSettings>) => void;
}) {
  const asking = settings.questionsToAsk ?? null;
  const isBank = asking !== null && asking < questionCount;

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
      <p className="text-xs font-semibold text-neutral-700">How it is sat</p>

      <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Rule
          id="quiz-pass-mark"
          label="Pass mark"
          hint="Percent of the points."
        >
          <input
            id="quiz-pass-mark"
            type="number"
            min={0}
            max={100}
            value={settings.passMark ?? 70}
            onChange={(e) => onChange({ passMark: Number(e.target.value) })}
            className={RULE_INPUT}
          />
        </Rule>

        <Rule
          id="quiz-attempts"
          label="Attempts"
          hint="Blank for unlimited."
        >
          <input
            id="quiz-attempts"
            type="number"
            min={1}
            value={settings.maxAttempts ?? ""}
            onChange={(e) =>
              onChange({
                maxAttempts: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={RULE_INPUT}
          />
        </Rule>

        <Rule
          id="quiz-time-limit"
          label="Time limit"
          hint="Minutes. Blank for untimed."
        >
          <input
            id="quiz-time-limit"
            type="number"
            min={1}
            value={settings.timeLimitMinutes ?? ""}
            onChange={(e) =>
              onChange({
                timeLimitMinutes:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={RULE_INPUT}
          />
        </Rule>

        <Rule
          id="quiz-ask"
          label="Ask"
          hint={`Blank for all ${questionCount}.`}
        >
          <input
            id="quiz-ask"
            type="number"
            min={1}
            max={questionCount}
            value={settings.questionsToAsk ?? ""}
            onChange={(e) =>
              onChange({
                questionsToAsk:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={RULE_INPUT}
          />
        </Rule>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={settings.shuffleQuestions ?? false}
            onChange={(e) => onChange({ shuffleQuestions: e.target.checked })}
            className="accent-primary-600"
          />
          Shuffle the questions
        </label>

        <label className="flex items-center gap-2 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={settings.shuffleOptions ?? false}
            onChange={(e) => onChange({ shuffleOptions: e.target.checked })}
            className="accent-primary-600"
          />
          Shuffle the answer options
        </label>
      </div>

      {/*
        Said once the numbers actually make one. A bank is the setting people
        get wrong by half-doing it — writing twelve questions and asking ten is
        not really a bank, and being told what this will do is cheaper than
        finding out from a learner.
      */}
      {isBank && (
        <p className="mt-2.5 text-[11px] text-neutral-500">
          Each learner gets {asking} of your {questionCount}, drawn when they
          start and fixed for that attempt — refreshing will not deal them a new
          set.
        </p>
      )}

      {asking !== null && asking >= questionCount && (
        <p className="mt-2.5 text-[11px] text-warning-700">
          You are asking for {asking} of {questionCount}, so everybody gets all
          of them. Write more questions than you ask to make it a bank.
        </p>
      )}
    </div>
  );
}

const RULE_INPUT =
  "w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-800 outline-none transition-colors focus:border-primary-400";

function Rule({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium text-neutral-600">
        {label}
      </label>
      {children}
      <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>
    </div>
  );
}

function QuestionCard({
  index,
  question,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  question: QuizQuestion;
  canRemove: boolean;
  onChange: (q: QuizQuestion) => void;
  onRemove: () => void;
}) {
  const issue = quizQuestionIssue(question);
  const hint = QUIZ_QUESTION_TYPES.find((t) => t.value === question.type)?.hint;

  /** Editing a fill-in-the-blank prompt adds or drops blanks as `___` appears. */
  const setPrompt = (prompt: string) =>
    onChange(
      question.type === "fill_blank"
        ? { ...question, prompt, blanks: alignBlanks(prompt, question.blanks ?? []) }
        : { ...question, prompt },
    );

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary-50 text-xs font-bold text-primary-700 tnum">
          {index + 1}
        </span>

        <SearchableSelect
          className="w-44 shrink-0"
          size="sm"
          value={question.type}
          onChange={(v) => onChange(questionForType(v as QuizQuestionType, question))}
          options={QUIZ_QUESTION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          aria-label={`Question ${index + 1} type`}
        />

        <input
          className="h-9 w-16 shrink-0 rounded-lg border border-neutral-200 bg-white px-2 text-center text-xs text-neutral-600 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          type="number"
          min={1}
          value={question.points ?? 1}
          onChange={(e) => onChange({ ...question, points: Math.max(1, Number(e.target.value) || 1) })}
          aria-label={`Question ${index + 1} points`}
          title="Points"
        />

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove question ${index + 1}`}
          className={ICON_BTN}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <textarea
        className="mt-3 min-h-16 w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        value={question.prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          question.type === "fill_blank" ? "The capital of France is ___." : "Question prompt"
        }
      />
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}

      <div className="mt-3">
        {question.type === "multiple_choice" && (
          <MultipleChoiceFields question={question} onChange={onChange} />
        )}
        {question.type === "fill_blank" && <FillBlankFields question={question} onChange={onChange} />}
        {question.type === "short_answer" && (
          <ShortAnswerFields question={question} onChange={onChange} />
        )}
        {question.type === "matching" && <MatchingFields question={question} onChange={onChange} />}
      </div>

      <input
        className={`${FIELD} mt-3`}
        value={question.explanation ?? ""}
        onChange={(e) => onChange({ ...question, explanation: e.target.value })}
        placeholder="Explanation shown after submitting (optional)"
      />

      {issue && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-accent-600">
          <AlertCircle size={13} className="shrink-0" />
          {issue} It will not be saved until you do.
        </p>
      )}
    </div>
  );
}

/* ---------- multiple choice ---------- */

function MultipleChoiceFields({
  question,
  onChange,
}: {
  question: QuizQuestion;
  onChange: (q: QuizQuestion) => void;
}) {
  const options = question.options ?? ["", ""];
  const answer = question.answer ?? 0;

  const removeOption = (oi: number) => {
    const next = options.filter((_, i) => i !== oi);
    onChange({ ...question, options: next, answer: answer >= next.length ? 0 : answer });
  };

  return (
    <div className="space-y-1.5">
      <p className="mb-1.5 text-xs text-neutral-400">Tap the circle to mark the correct answer.</p>
      {options.map((opt, oi) => {
        const correct = answer === oi;
        return (
          <div key={oi} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...question, answer: oi })}
              aria-label={`Mark option ${oi + 1} correct`}
              aria-pressed={correct}
              className={`shrink-0 transition-colors ${correct ? "text-success-600" : "text-neutral-300 hover:text-neutral-500"}`}
            >
              {correct ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
            <input
              className={FIELD}
              value={opt}
              onChange={(e) =>
                onChange({ ...question, options: options.map((o, i) => (i === oi ? e.target.value : o)) })
              }
              placeholder={`Option ${oi + 1}`}
            />
            <button
              type="button"
              onClick={() => removeOption(oi)}
              disabled={options.length <= 2}
              aria-label={`Remove option ${oi + 1}`}
              className={ICON_BTN}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
      <AddButton label="Add option" onClick={() => onChange({ ...question, options: [...options, ""] })} />
    </div>
  );
}

/* ---------- fill in the blank ---------- */

function FillBlankFields({
  question,
  onChange,
}: {
  question: QuizQuestion;
  onChange: (q: QuizQuestion) => void;
}) {
  const blanks = question.blanks ?? [];

  if (countBlanks(question.prompt) === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-3 text-xs text-neutral-400">
        Add <code className="rounded bg-neutral-100 px-1 font-mono">___</code> to the prompt above,
        then list the answers you accept for each blank.
      </p>
    );
  }

  const setAccepted = (bi: number, accepted: string[]) =>
    onChange({ ...question, blanks: blanks.map((b, i) => (i === bi ? { accepted } : b)) });

  return (
    <div className="space-y-2.5">
      {blanks.map((blank, bi) => (
        <div key={bi} className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-2.5">
          <p className="mb-1.5 text-xs font-semibold text-neutral-500">
            Blank {bi + 1} — any of these is accepted
          </p>
          <div className="space-y-1.5">
            {blank.accepted.map((value, ai) => (
              <div key={ai} className="flex items-center gap-2">
                <input
                  className={FIELD}
                  value={value}
                  onChange={(e) =>
                    setAccepted(
                      bi,
                      blank.accepted.map((a, i) => (i === ai ? e.target.value : a)),
                    )
                  }
                  placeholder={ai === 0 ? "Correct answer" : "Also accept…"}
                />
                <button
                  type="button"
                  onClick={() => setAccepted(bi, blank.accepted.filter((_, i) => i !== ai))}
                  disabled={blank.accepted.length <= 1}
                  aria-label={`Remove accepted answer ${ai + 1} for blank ${bi + 1}`}
                  className={ICON_BTN}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <AddButton
              label="Accept another spelling"
              onClick={() => setAccepted(bi, [...blank.accepted, ""])}
            />
          </div>
        </div>
      ))}
      <CaseSensitiveToggle question={question} onChange={onChange} />
    </div>
  );
}

/* ---------- short answer ---------- */

function ShortAnswerFields({
  question,
  onChange,
}: {
  question: QuizQuestion;
  onChange: (q: QuizQuestion) => void;
}) {
  const accepted = question.acceptedAnswers ?? [""];
  const set = (next: string[]) => onChange({ ...question, acceptedAnswers: next });

  return (
    <div className="space-y-1.5">
      <p className="mb-1.5 text-xs text-neutral-400">
        Extra whitespace is ignored. Any answer below counts as correct.
      </p>
      {accepted.map((value, ai) => (
        <div key={ai} className="flex items-center gap-2">
          <input
            className={FIELD}
            value={value}
            onChange={(e) => set(accepted.map((a, i) => (i === ai ? e.target.value : a)))}
            placeholder={ai === 0 ? "Correct answer" : "Also accept…"}
          />
          <button
            type="button"
            onClick={() => set(accepted.filter((_, i) => i !== ai))}
            disabled={accepted.length <= 1}
            aria-label={`Remove accepted answer ${ai + 1}`}
            className={ICON_BTN}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <AddButton label="Accept another answer" onClick={() => set([...accepted, ""])} />
      <CaseSensitiveToggle question={question} onChange={onChange} />
    </div>
  );
}

/* ---------- matching ---------- */

function MatchingFields({
  question,
  onChange,
}: {
  question: QuizQuestion;
  onChange: (q: QuizQuestion) => void;
}) {
  const pairs = question.pairs ?? [];
  const set = (next: QuizPair[]) => onChange({ ...question, pairs: next });

  return (
    <div className="space-y-1.5">
      <p className="mb-1.5 text-xs text-neutral-400">
        Learners see the right-hand column on its own and pick the match for each item.
      </p>
      {pairs.map((pair, pi) => (
        <div key={pi} className="flex items-center gap-2">
          <input
            className={FIELD}
            value={pair.left}
            onChange={(e) => set(pairs.map((p, i) => (i === pi ? { ...p, left: e.target.value } : p)))}
            placeholder={`Item ${pi + 1}`}
          />
          <span aria-hidden className="shrink-0 text-xs text-neutral-300">
            →
          </span>
          <input
            className={FIELD}
            value={pair.right}
            onChange={(e) => set(pairs.map((p, i) => (i === pi ? { ...p, right: e.target.value } : p)))}
            placeholder={`Match ${pi + 1}`}
          />
          <button
            type="button"
            onClick={() => set(pairs.filter((_, i) => i !== pi))}
            disabled={pairs.length <= 2}
            aria-label={`Remove pair ${pi + 1}`}
            className={ICON_BTN}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <AddButton label="Add pair" onClick={() => set([...pairs, { left: "", right: "" }])} />
    </div>
  );
}

/* ---------- shared bits ---------- */

function CaseSensitiveToggle({
  question,
  onChange,
}: {
  question: QuizQuestion;
  onChange: (q: QuizQuestion) => void;
}) {
  return (
    <label className="mt-1 inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-500">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-400"
        checked={question.caseSensitive ?? false}
        onChange={(e) => onChange({ ...question, caseSensitive: e.target.checked })}
      />
      Match capitalisation exactly
    </label>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-50"
    >
      <Plus size={13} />
      {label}
    </button>
  );
}
