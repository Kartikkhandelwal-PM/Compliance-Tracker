/* ============================================================================
   CLIENT MESSAGES
   ----------------------------------------------------------------------------
   Every reminder a client receives is composed here, so the wording is the
   same object the log stores, the preview drawer renders and the cadence
   describes. Previously each was written at its own call site and they had
   already drifted apart.

   WHO IS SPEAKING. These go out on KDK's **CA Connect** WhatsApp Business
   account, on behalf of the practice — never as the practice's own number.
   That has to be said in the message itself: a client who gets a payment
   demand from an unrecognised business account and cannot tell whose it is
   will either ignore it or report it. So every message names the sender, names
   the CA it is sent for, and closes with the firm.

   HOUSE RULES, all of which exist because this is a statutory reminder going
   to a paying client, not a marketing blast:
     • Address the entity by its own name, never "Dear Sir/Madam".
     • State the form, the period and the statutory date in the first line.
       That is the whole message; everything after it is courtesy.
     • Ask for one specific thing. "Please share the working papers" is an
       action; "please do the needful" is not.
     • Say what happens if they have already filed. Without that line every
       reminder generates a reply, and the ones that matter get buried.
     • Never threaten. Late fees are stated as a fact with a figure, once.
     • No emoji, no exclamation marks, no marketing.
   ========================================================================== */

import type { Obligation, Client, Staff } from "./types.ts";
import { fmtLong, inr } from "./dates.ts";

export interface Composed {
  /** One line for the outbox table. */
  line: string;
  /** The message as the client receives it. */
  body: string;
  /** Email only. */
  subject: string;
}

/**
 * The account these are sent from.
 *
 * Mutable, and read through `getSender()` rather than imported as a frozen
 * constant, because Settings edits it: the display name and number a client
 * sees are firm configuration, not source code. Kept in this module so the
 * dependency stays one-way — the engine imports messages, never the reverse.
 */
export interface Sender {
  name: string;
  handle: string;
  by: string;
  fromEmail: string;
  replyTo: string;
  verified: boolean;
}

let sender: Sender = {
  name: "CA Connect",
  handle: "+91 79000 12345",
  by: "KDK Software",
  fromEmail: "compliance@kdksoftware.com",
  replyTo: "compliance@kdksoftware.com",
  verified: true,
};

export function getSender(): Sender {
  return sender;
}

export function setSender(patch: Partial<Sender>) {
  sender = { ...sender, ...patch };
}

function signature(staff: Staff): string {
  const who = staff.name === "Unassigned" ? "your engagement team" : staff.name;
  return `Sent by ${sender.name} on behalf of ${who}, ${sender.by}.`;
}

export function compose(o: Obligation, client: Client, staff: Staff): Composed {
  const due = fmtLong(o.dueDate);
  const overdue = o.status === "Overdue";
  const late = o.daysOverdue;

  const line = overdue
    ? `${o.form} for ${o.periodLabel} was due on ${due} and is still pending.`
    : `${o.form} for ${o.periodLabel} is due on ${due}.`;

  const subject = overdue
    ? `Overdue: ${o.form} · ${o.periodLabel}`
    : `Reminder: ${o.form} · ${o.periodLabel}, due ${due}`;

  const opening = `Dear ${client.name},`;

  /* The fee is stated once, with a figure, and only when there is one. A
     reminder that says "penalties may apply" is noise; "₹4,200 so far, rising
     ₹200 a day" is a reason to act this afternoon. */
  const feeLine =
    overdue && o.exposure > 0
      ? `A late fee of ₹${inr(o.exposure)} has accrued so far and continues to increase for every day the return stays unfiled.`
      : null;

  const ask = overdue
    ? "Please share the pending details today so we can file on your behalf immediately."
    : "Please share the required documents so we can complete the filing before the due date.";

  const alreadyFiled = overdue
    ? "If the return has already been filed, please send us the acknowledgement number and we will update our records."
    : "If you have already filed this yourself, please let us know and we will close it at our end.";

  const body = [
    opening,
    "",
    overdue
      ? `${o.form} for ${o.periodLabel} was due on ${due} and is still showing as unfiled, ${late} ${late === 1 ? "day" : "days"} past the statutory date.`
      : `This is a reminder that ${o.form} for ${o.periodLabel} is due on ${due}.`,
    ...(feeLine ? ["", feeLine] : []),
    "",
    ask,
    "",
    alreadyFiled,
    "",
    signature(staff),
  ].join("\n");

  return { line, body, subject };
}
