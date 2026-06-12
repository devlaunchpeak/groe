import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as React from "react";
import { sendEmail } from "../lib/email/send";

import MagicLinkEmail from "../emails/magic-link";
import UserInviteEmail from "../emails/user-invite";
import OrgAdminInviteEmail from "../emails/org-admin-invite";
import AssessmentReminderEmail from "../emails/assessment-reminder";
import DailyCheckinReminderEmail from "../emails/daily-checkin-reminder";
import WeeklyDigestEmail from "../emails/weekly-digest";
import PaceAlertEmail from "../emails/pace-alert";

const TO = "dev@launchpeak.ai";
const APP_URL = "https://app.groe.co";

const templates = [
  {
    name: "magic-link",
    subject: "[TEST] Your GROE sign-in code",
    react: React.createElement(MagicLinkEmail, {
      recipientName: "Bon",
      code: "482951",
      expiresInMinutes: 15,
    }),
  },
  {
    name: "user-invite",
    subject: "[TEST] You've been invited to join Acme Corp on GROE",
    react: React.createElement(UserInviteEmail, {
      recipientName: "Bon",
      orgName: "Acme Corp",
      inviterName: "Jane Smith",
      inviteUrl: `${APP_URL}/invite/abc123`,
      expiresInDays: 7,
    }),
  },
  {
    name: "org-admin-invite",
    subject: "[TEST] You've been invited to manage Acme Corp on GROE",
    react: React.createElement(OrgAdminInviteEmail, {
      recipientName: "Bon",
      orgName: "Acme Corp",
      inviterName: "Jane Smith",
      inviteUrl: `${APP_URL}/invite/admin/xyz789`,
      expiresInDays: 7,
    }),
  },
  {
    name: "assessment-reminder",
    subject: "[TEST] Your GROE assessment is ready",
    react: React.createElement(AssessmentReminderEmail, {
      recipientName: "Bon",
      dueDays: 3,
      appUrl: APP_URL,
    }),
  },
  {
    name: "daily-checkin-reminder",
    subject: "[TEST] Your daily GROE check-in is ready",
    react: React.createElement(DailyCheckinReminderEmail, {
      recipientName: "Bon",
      currentStreak: 5,
      appUrl: APP_URL,
    }),
  },
  {
    name: "weekly-digest",
    subject: "[TEST] Your GROE week 12 recap",
    react: React.createElement(WeeklyDigestEmail, {
      recipientName: "Bon",
      weekNumber: 12,
      hMttrScore: 74,
      ragStatus: "developing",
      lessonsCompleted: 3,
      checkInsCompleted: 5,
      currentModule: "Managing Stress Under Pressure",
      appUrl: APP_URL,
    }),
  },
  {
    name: "pace-alert (no_checkin)",
    subject: "[TEST] Your daily check-in is waiting",
    react: React.createElement(PaceAlertEmail, {
      recipientName: "Bon",
      reason: "no_checkin",
      inactiveDays: 3,
      appUrl: APP_URL,
    }),
  },
  {
    name: "pace-alert (streak_at_risk)",
    subject: "[TEST] Your streak is at risk",
    react: React.createElement(PaceAlertEmail, {
      recipientName: "Bon",
      reason: "streak_at_risk",
      currentStreak: 7,
      appUrl: APP_URL,
    }),
  },
];

async function main() {
  console.log(`Sending ${templates.length} test emails to ${TO}...\n`);

  for (const t of templates) {
    process.stdout.write(`  ${t.name}... `);
    const result = await sendEmail({ to: TO, subject: t.subject, react: t.react });
    if (result.success) {
      console.log(`✓  (id: ${result.messageId})`);
    } else {
      console.log(`✗  ${result.error}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
