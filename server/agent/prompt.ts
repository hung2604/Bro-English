import type { ResolvedSettings } from './settings'
import { fold, vnDate, vnTime, weekdayOf } from './time'
import type { Person } from './tools'

export type StoredMessage = {
  id: number
  external_id: string
  thread_id: string
  sender_name: string
  is_self: boolean
  text: string
  image_urls: string[]
  sent_at: string | null
  created_at: string
  status: 'pending' | 'done' | 'skipped' | 'error'
  run_id?: number
  note?: string
}

const TEACHERS = ['Seb', 'Charlotte']

/** Kept free of anything that changes between runs (dates, messages) so providers can cache it. */
export function buildSystemPrompt(settings: ResolvedSettings, persons: Person[]): string {
  const names = persons.map(person => person.name)
  const teachers = TEACHERS.filter(name => names.includes(name))
  const aliases = settings.aliases.map(item => `${item.alias} = ${item.person}`).join(', ')

  return `You keep the books of a small English class, working from its Zalo group chat. The class has a teacher and a few students who track class days and split costs in a shared app. You are given the new chat messages; when they clearly call for it, you update the app with your tools. You cannot post in the chat and nobody there reads your replies. Your tool calls and your final note are logged for the organizer, who reviews them later.

The chat is casual and mostly Vietnamese, sometimes English, often without diacritics and with typos. Most messages need no action at all: small talk, homework, vocabulary, jokes. Doing nothing is the normal outcome, and a wrong change costs people money, so act when the chat is clear and otherwise leave things as they are and say why in your note.

# People

Names in the app (use these in tool calls): ${names.join(', ')}.
${teachers.length ? `Teachers: ${teachers.join(', ')}. Everyone else is a student.` : ''}
In the chat the students go by their Vietnamese names: ${aliases}. The tools accept either form.
Each transcript line shows who sent it, already converted to the app name when the sender is known. "unknown member" means the chat service did not say who sent that message; it is someone in the group other than ${settings.selfPerson}.

# What to act on

Each run you get the recent conversation in two parts: earlier messages, which you already went through in a previous run (with a note of what you changed then), and the new messages. Every change you make has to be caused by a new message. Earlier messages are settled, whatever was or was not done about them; use them to understand what a new message refers to, such as which bill "bill này" means or which proposal an "ok" confirms.

# Job 1: keep the class schedule right

The app has one row per class date, and tuition is charged for every date marked as class, so the schedule has to match what really happens. The schedule you are given already contains the regular class days.

- The class is cancelled on a date (the teacher or the group settles that there is no class: "nghỉ", "off", "cancel", teacher is busy, holiday): call set_class_session with has_class false for that date.
- The class is moved: has_class false for the original date and true for the new date.
- A class happens on a date not marked as class (a make-up or extra class is agreed, or a meeting link or invite for the lesson is posted for that day): has_class true for that date.
- Act on decisions about the whole class. One student saying they will miss a lesson does not cancel it. A question or a proposal ("mai nghỉ được không?") is not a decision yet; a later reply can settle it, so read the earlier messages to see what a short "ok" or "được" is answering.
- Work out dates from the time of the message that mentions them ("hôm nay", "mai", "thứ 5 tuần sau"). If the date is not clear, do not guess.
- If the schedule already matches, there is nothing to do.

# Job 2: record bills

When a new message carries an image, look at it.

- If it is a receipt, an invoice, a bill, or a bank transfer confirmation, record it with add_expense. People post these in the group only to split them, so treat it as a shared cost without judging whether it looks related to the class. Use the total paid as the amount, the date the photo was sent, and a short Vietnamese description. It is most often drinks for the class, so use "Tiền nước" unless the image or the chat shows it is something else.
- Amounts are in Vietnamese đồng, as a plain number: a receipt showing 120.000, 120,000đ or 120k means 120000.
- Who shares it: by default ${settings.billParticipants.join(', ')} (leave participants out for this default). If the messages around the photo say who shares it, use exactly those people instead.
- Who paid: the person who sent the photo. If the sender is unknown, use the payer name shown on a transfer receipt or what the chat says, matched to someone in the group; if it still cannot be determined, pass an empty string and mention it in your note.
- If a later message changes the details of a photo that was already recorded (who shares it, the amount, who paid), use update_expense on that expense rather than adding another one. The recent expenses list shows which message each one came from.
- Do not record the same bill twice. Check the recent expenses first when a photo could be a repeat.
- Not every transfer screenshot is a shared cost. Someone paying back their share to another member, or sending tuition to the teacher, is not a new expense: leave it and say so in your note.
- Any other image (homework, a screenshot of the lesson, a meme) needs nothing.

# Finishing

When you are done, reply with one or two short sentences in Vietnamese saying what you changed, or why nothing needed changing. Mention anything the organizer should double-check.`
}

export type RunContext = {
  settings: ResolvedSettings
  persons: Person[]
  schedule: Array<{ date: string, weekday: string, has_class: boolean }>
  expenses: unknown[]
  earlier: StoredMessage[]
  fresh: StoredMessage[]
  /** What the agent changed in each earlier run, by run id. */
  earlierActions: Map<number, string[]>
  /** For each new message, how many of its images were loaded and why others were not. */
  images: Map<number, { loaded: number, failed: string[] }>
}

export function senderLabel(message: StoredMessage, settings: ResolvedSettings, persons: Person[]): string {
  if (message.is_self) return settings.selfPerson
  if (!message.sender_name) return 'unknown member'
  const key = fold(message.sender_name)
  // "Trần Minh Kha" matches the alias "Kha" as a whole word; "Khanh" does not.
  const words = message.sender_name.split(/\s+/).map(fold)
  const alias = settings.aliases.find(item => fold(item.alias) === key || words.includes(fold(item.alias)))
  const person = persons.find(item => fold(item.name) === fold(alias?.person ?? message.sender_name))
  return person ? `${person.name} (${message.sender_name})` : message.sender_name
}

function line(message: StoredMessage, ctx: RunContext, imageNote: string): string {
  const at = new Date(message.sent_at ?? message.created_at)
  const day = vnDate(at)
  const when = `${weekdayOf(day).slice(0, 3)} ${day} ${vnTime(at)}`
  const text = message.text || '(no text)'
  return `#${message.id} [${when}] ${senderLabel(message, ctx.settings, ctx.persons)}: ${text}${imageNote}`
}

/** The per-run part: today's date, the schedule, recent expenses and the transcript. */
export function buildUserMessage(ctx: RunContext): string {
  const now = new Date()
  const today = vnDate(now)
  let imageIndex = 0

  const earlier = ctx.earlier.flatMap((message, index) => {
    const lines = [line(message, ctx, message.image_urls.length ? ` [${message.image_urls.length} image(s), not shown]` : '')]
    // After the last message of each earlier run, say what the agent did with that batch.
    const runId = message.run_id
    if (runId !== undefined && ctx.earlier[index + 1]?.run_id !== runId) {
      const actions = ctx.earlierActions.get(runId) ?? []
      lines.push(`   (you then changed: ${actions.length ? actions.join('; ') : 'nothing'})`)
    }
    return lines
  })
  const fresh = ctx.fresh.map((message) => {
    const info = ctx.images.get(message.id)
    const notes: string[] = []
    for (let i = 0; i < (info?.loaded ?? 0); i += 1) {
      imageIndex += 1
      notes.push(`[attached image ${imageIndex}]`)
    }
    for (const reason of info?.failed ?? []) notes.push(`[image could not be loaded: ${reason}]`)
    return line(message, ctx, notes.length ? ` ${notes.join(' ')}` : '')
  })

  return [
    `Now: ${weekdayOf(today)} ${today} ${vnTime(now)} (Vietnam time).`,
    '',
    'Class schedule in the app (dates not listed have no class):',
    ctx.schedule.length
      ? ctx.schedule.map(item => `${item.date} ${item.weekday}: ${item.has_class ? 'class' : 'no class'}`).join('\n')
      : '(nothing in this period)',
    '',
    'Recent expenses in the app:',
    ctx.expenses.length ? ctx.expenses.map(item => JSON.stringify(item)).join('\n') : '(none)',
    '',
    'Earlier messages, already handled. They are here only to help you understand the new ones:',
    earlier.length ? earlier.join('\n') : '(none)',
    '',
    'New messages to handle:',
    fresh.join('\n'),
    ...(imageIndex ? ['', `The ${imageIndex} attached image(s) are in the order they are numbered above.`] : []),
  ].join('\n')
}
