/* ============================================================================
   MESSAGE TEMPLATES — the wording a client receives
   ----------------------------------------------------------------------------
   Loaded from "Compliance Tracker - Reminder Templates (Email, WhatsApp,
   Notifications).xlsx" (V1/Files), the reviewable copy deck. Data, not logic:
   the Templates screen fills the {{placeholders}} in with a real compliance
   and shows the result. The sender in messages.ts is a separate, hand-synced
   copy of the live ones.

   Left out on purpose: re-send / retry (it repeats the original message, so
   it has no wording of its own), manual chase (same wording as "Missed"),
   and the staff-only bell notifications.

   `live` is false for messages the copy deck lists but the product does not
   send yet ("Proposed"). The two channels differ by design: the deck keeps
   escalation and final notice Email-only (there is no WhatsApp wording for
   them), and has a 3-day follow-up on WhatsApp only.
   ========================================================================== */

import type { Channel } from "./types.ts";

export type TemplateStage = "t7" | "t3" | "t0" | "p1" | "p7" | "p30" | "done";

export interface Template {
  id: string;
  channel: Channel;
  stage: TemplateStage;
  name: string;
  /** Short timing label for the sequence, e.g. "7 days before". */
  timing: string;
  /** Days past the due date this message is written for; 0 before it. */
  daysLate: number;
  /** Email only. */
  subject: string;
  body: string;
  /** Email only: who else is copied (staff, not the client's concern). */
  cc: string;
  live: boolean;
  offByDefault: boolean;
}

export const TEMPLATES: Template[] = [
  {
    "id": "WA-01",
    "channel": "WhatsApp",
    "stage": "t7",
    "name": "First reminder",
    "timing": "7 days before",
    "daysLate": 0,
    "subject": "",
    "body": "Dear {{client_name}}, this is {{firm_name}} regarding your {{form}} for {{period}}, due on {{due_date}}.\n\nPlease ensure this is completed well ahead of the deadline.",
    "cc": "",
    "live": true,
    "offByDefault": false
  },
  {
    "id": "WA-02",
    "channel": "WhatsApp",
    "stage": "t3",
    "name": "Follow-up",
    "timing": "3 days before",
    "daysLate": 0,
    "subject": "",
    "body": "Dear {{client_name}}, this is {{firm_name}} regarding your {{form}} for {{period}}, due on {{due_date}}.\n\nPlease ensure this is completed in time.",
    "cc": "",
    "live": true,
    "offByDefault": false
  },
  {
    "id": "WA-03",
    "channel": "WhatsApp",
    "stage": "t0",
    "name": "Due today",
    "timing": "Due date",
    "daysLate": 0,
    "subject": "",
    "body": "Dear {{client_name}}, this is {{firm_name}} regarding your {{form}} for {{period}}, due on {{due_date}}.\n\nPlease ensure this is completed at the earliest.",
    "cc": "",
    "live": true,
    "offByDefault": false
  },
  {
    "id": "WA-04",
    "channel": "WhatsApp",
    "stage": "p1",
    "name": "Missed",
    "timing": "1 day late",
    "daysLate": 1,
    "subject": "",
    "body": "Dear {{client_name}}, this is {{firm_name}} regarding your {{form}} for {{period}}, which was due on {{due_date}} and has not yet been completed. It is now {{days_overdue}} day(s) overdue.\n\nA late fee applies from the due date and increases with each additional day of delay.\n\nPlease ensure this is completed at the earliest to avoid further delay.",
    "cc": "",
    "live": true,
    "offByDefault": false
  },
  {
    "id": "WA-05",
    "channel": "WhatsApp",
    "stage": "done",
    "name": "Task completed",
    "timing": "Once filed",
    "daysLate": 0,
    "subject": "",
    "body": "Dear {{client_name}}, this is {{firm_name}}. Your {{form}} for {{period}} has been completed on your behalf. Reference number: {{ack_no}}.\n\nNo action is required from you. We will reach out ahead of the next due date.",
    "cc": "",
    "live": false,
    "offByDefault": false
  },
  {
    "id": "EM-01",
    "channel": "Email",
    "stage": "t7",
    "name": "First reminder",
    "timing": "7 days before",
    "daysLate": 0,
    "subject": "Reminder: {{form}} for {{period}} (due {{due_date}})",
    "body": "Dear {{client_name}},\n\nYour {{form}} for {{period}} is due on {{due_date}}.\n\nPlease send us the details we need so this can be completed well ahead of the deadline.\n\nIf this has already been completed, please let us know so we can update our records.\n\nRegards,\n{{firm_name}}",
    "cc": "",
    "live": true,
    "offByDefault": false
  },
  {
    "id": "EM-03",
    "channel": "Email",
    "stage": "t0",
    "name": "Due today",
    "timing": "Due date",
    "daysLate": 0,
    "subject": "Due today: {{form}} for {{period}}",
    "body": "Dear {{client_name}},\n\nYour {{form}} for {{period}} is due on {{due_date}}.\n\nPlease send us the pending details today so this can be completed on your behalf.\n\nIf this has already been completed, please share the reference number so we can update our records.\n\nRegards,\n{{firm_name}}",
    "cc": "",
    "live": true,
    "offByDefault": false
  },
  {
    "id": "EM-04",
    "channel": "Email",
    "stage": "p1",
    "name": "Missed",
    "timing": "1 day late",
    "daysLate": 1,
    "subject": "Overdue: {{form}} for {{period}}",
    "body": "Dear {{client_name}},\n\nYour {{form}} for {{period}} was due on {{due_date}} and has not yet been completed. It is now {{days_overdue}} day(s) overdue.\n\nA late fee applies from the due date and increases with each additional day of delay.\n\nPlease send us the pending details at the earliest so this can be completed without further delay.\n\nIf this has already been completed, please share the reference number so we can update our records.\n\nRegards,\n{{firm_name}}",
    "cc": "",
    "live": true,
    "offByDefault": false
  },
  {
    "id": "EM-05",
    "channel": "Email",
    "stage": "p7",
    "name": "Escalation",
    "timing": "7 days late",
    "daysLate": 7,
    "subject": "Overdue: {{form}} for {{period}} (second notice)",
    "body": "Dear {{client_name}},\n\nYour {{form}} for {{period}} was due on {{due_date}} and remains pending. It has now been {{days_overdue}} days.\n\nA late fee applies from the due date and continues to increase with each additional day of delay.\n\nPlease send us the pending details at the earliest so this can be completed without further delay.\n\nIf this has already been completed, please share the reference number so we can update our records.\n\nRegards,\n{{firm_name}}",
    "cc": "Engagement owner",
    "live": true,
    "offByDefault": false
  },
  {
    "id": "EM-06",
    "channel": "Email",
    "stage": "p30",
    "name": "Final notice",
    "timing": "30 days late",
    "daysLate": 30,
    "subject": "Overdue: {{form}} for {{period}} (final notice)",
    "body": "Dear {{client_name}},\n\nYour {{form}} for {{period}} was due on {{due_date}} and remains pending, now {{days_overdue}} days overdue.\n\nA late fee applies from the due date and continues to increase with each additional day of delay.\n\nThis is our final reminder before this is escalated internally. Please send us the pending details at the earliest so this can be completed without further delay.\n\nRegards,\n{{firm_name}}",
    "cc": "Engagement owner",
    "live": false,
    "offByDefault": true
  },
  {
    "id": "EM-09",
    "channel": "Email",
    "stage": "done",
    "name": "Task completed",
    "timing": "Once filed",
    "daysLate": 0,
    "subject": "Completed: {{form}} for {{period}}",
    "body": "Dear {{client_name}},\n\nYour {{form}} for {{period}} has been completed on your behalf. Reference number: {{ack_no}}.\n\nNo action is required from you. We will reach out ahead of the next due date.\n\nRegards,\n{{firm_name}}",
    "cc": "",
    "live": false,
    "offByDefault": false
  }
];
