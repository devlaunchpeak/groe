import * as React from "react";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, C, font, buttonStyle } from "./_components/EmailLayout";

export type PaceAlertReason = "no_checkin" | "no_lesson" | "assessment_due" | "streak_at_risk";

export interface PaceAlertEmailProps {
  recipientName: string;
  reason: PaceAlertReason;
  /** How many days the user has been inactive (for no_checkin / no_lesson alerts) */
  inactiveDays?: number;
  /** Current streak count at risk (for streak_at_risk) */
  currentStreak?: number;
  appUrl: string;
}

interface AlertConfig {
  subject: string;
  preview: string;
  headline: string;
  body: string;
  ctaPath: string;
  ctaLabel: string;
  calloutText: string;
  calloutColor: string;
  calloutBg: string;
}

function getAlertConfig(
  reason: PaceAlertReason,
  inactiveDays: number,
  currentStreak: number
): AlertConfig {
  switch (reason) {
    case "no_checkin":
      return {
        subject: "Your daily check-in is waiting",
        preview: "It only takes 60 seconds — keep your streak alive",
        headline: "We haven't seen you check in lately",
        body: `You haven't logged a daily check-in in ${inactiveDays} ${inactiveDays === 1 ? "day" : "days"}. These quick signals are the backbone of your H-MTTR trend data — even a brief check-in keeps your journey on track.`,
        ctaPath: "/assessments",
        ctaLabel: "Log today's check-in",
        calloutText: `${inactiveDays} ${inactiveDays === 1 ? "day" : "days"} since your last check-in`,
        calloutColor: C.ragAmber,
        calloutBg: C.ragAmberBg,
      };
    case "no_lesson":
      return {
        subject: "Your learning path is waiting for you",
        preview: "Pick up where you left off",
        headline: "Ready to continue your learning path?",
        body: `You haven't completed a lesson in ${inactiveDays} ${inactiveDays === 1 ? "day" : "days"}. Your learning path is paced to build resilience steadily — even one short lesson keeps the momentum going.`,
        ctaPath: "/learning-path",
        ctaLabel: "Continue my learning path",
        calloutText: `${inactiveDays} ${inactiveDays === 1 ? "day" : "days"} since your last lesson`,
        calloutColor: C.ragAmber,
        calloutBg: C.ragAmberBg,
      };
    case "assessment_due":
      return {
        subject: "Your assessment window is closing soon",
        preview: "Don't let the window close — complete your assessment",
        headline: "Your next assessment is due soon",
        body: "Your assessment window closes in the next 48 hours. Missing it delays your H-MTTR score and can affect your learning path recommendations.",
        ctaPath: "/assessments",
        ctaLabel: "Start my assessment now",
        calloutText: "Assessment window closes in 48 hours",
        calloutColor: C.ragRed,
        calloutBg: C.ragRedBg,
      };
    case "streak_at_risk":
      return {
        subject: `Don't lose your ${currentStreak}-day streak`,
        preview: `You're ${inactiveDays === 0 ? "about to lose" : `${inactiveDays} day away from losing`} your streak`,
        headline: `Your ${currentStreak}-day streak is at risk`,
        body: "You're close to losing the streak you've built. Log a check-in today to protect it — it takes less than a minute.",
        ctaPath: "/assessments",
        ctaLabel: "Save my streak",
        calloutText: `🔥 ${currentStreak}-day streak — check in today to keep it`,
        calloutColor: C.ragGreen,
        calloutBg: C.ragGreenBg,
      };
  }
}

export default function PaceAlertEmail({
  recipientName,
  reason,
  inactiveDays = 0,
  currentStreak = 0,
  appUrl,
}: PaceAlertEmailProps) {
  const config = getAlertConfig(reason, inactiveDays, currentStreak);
  const ctaUrl = `${appUrl}${config.ctaPath}`;

  return (
    <EmailLayout preview={config.preview}>
      <Heading
        as="h1"
        style={{
          fontFamily: font.heading,
          fontWeight: 700,
          fontSize: "22px",
          color: C.heading,
          margin: "0 0 20px",
          lineHeight: "1.3",
        }}
      >
        {config.headline}
      </Heading>

      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 8px", fontFamily: font.body }}>
        Hi {recipientName},
      </Text>
      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 24px", fontFamily: font.body }}>
        {config.body}
      </Text>

      {/* Dynamic status callout */}
      <Section
        style={{
          backgroundColor: config.calloutBg,
          borderLeft: `4px solid ${config.calloutColor}`,
          borderRadius: "0 8px 8px 0",
          padding: "14px 18px",
          margin: "0 0 28px",
        }}
      >
        <Text
          style={{
            color: config.calloutColor,
            fontFamily: font.body,
            fontWeight: 600,
            fontSize: "14px",
            margin: 0,
          }}
        >
          {config.calloutText}
        </Text>
      </Section>

      <Section style={{ textAlign: "center" }}>
        <Button href={ctaUrl} style={buttonStyle}>
          {config.ctaLabel}
        </Button>
      </Section>

      <Hr style={{ borderColor: C.border, margin: "28px 0 20px" }} />

      <Text style={{ color: C.muted, fontSize: "13px", lineHeight: "1.5", margin: 0, fontFamily: font.body }}>
        You&apos;re receiving this because you&apos;re enrolled in the GROE Resilience Platform.
        To adjust notification preferences, visit your{" "}
        <a href={`${appUrl}/settings`} style={{ color: C.primary, textDecoration: "underline" }}>
          settings
        </a>.
      </Text>
    </EmailLayout>
  );
}

PaceAlertEmail.PreviewProps = {
  recipientName: "Jordan Rivera",
  reason: "streak_at_risk" as PaceAlertReason,
  currentStreak: 12,
  inactiveDays: 0,
  appUrl: "https://app.groe.io",
} satisfies PaceAlertEmailProps;
