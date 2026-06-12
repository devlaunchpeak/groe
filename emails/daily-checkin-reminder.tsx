import * as React from "react";
import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout, C, font, buttonStyle } from "./_components/EmailLayout";

export interface DailyCheckinReminderEmailProps {
  recipientName: string;
  /** Current consecutive check-in streak — omit if not tracked */
  currentStreak?: number;
  appUrl: string;
}

export default function DailyCheckinReminderEmail({
  recipientName,
  currentStreak,
  appUrl,
}: DailyCheckinReminderEmailProps) {
  const ctaUrl = `${appUrl}/assessments`;

  const streakNote =
    currentStreak && currentStreak > 1
      ? `You're on a ${currentStreak}-day streak — keep it going!`
      : currentStreak === 1
      ? "You checked in yesterday. Let's keep the momentum."
      : null;

  return (
    <EmailLayout preview={`${recipientName} — your daily GROE check-in is ready`}>
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
        How are you doing today?
      </Heading>

      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 8px", fontFamily: font.body }}>
        Hi {recipientName},
      </Text>
      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 20px", fontFamily: font.body }}>
        Your daily check-in takes less than a minute and helps you stay in tune
        with your resilience over time. Small, consistent signals add up to real
        insight.
      </Text>

      {/* Streak badge */}
      {streakNote && (
        <Section
          style={{
            backgroundColor: C.ragGreenBg,
            borderRadius: "8px",
            padding: "14px 18px",
            margin: "0 0 24px",
            border: `1px solid ${C.ragGreen}22`,
          }}
        >
          <Text
            style={{
              color: C.ragGreen,
              fontSize: "14px",
              fontWeight: 600,
              margin: 0,
              fontFamily: font.body,
            }}
          >
            🌿 {streakNote}
          </Text>
        </Section>
      )}

      <Section style={{ textAlign: "center", margin: "0 0 8px" }}>
        <Button href={ctaUrl} style={buttonStyle}>
          Complete today&apos;s check-in
        </Button>
      </Section>

      <Text
        style={{
          color: C.muted,
          fontSize: "12px",
          textAlign: "center",
          margin: "16px 0 0",
          fontFamily: font.body,
        }}
      >
        Takes about 60 seconds &middot; Responses are private
      </Text>
    </EmailLayout>
  );
}

DailyCheckinReminderEmail.PreviewProps = {
  recipientName: "Sam Okafor",
  currentStreak: 7,
  appUrl: "https://app.groe.io",
} satisfies DailyCheckinReminderEmailProps;
