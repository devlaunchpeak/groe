import * as React from "react";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, C, font, buttonStyle } from "./_components/EmailLayout";

export interface AssessmentReminderEmailProps {
  recipientName: string;
  /** How many days until the assessment window closes — omit if no fixed deadline */
  dueDays?: number;
  appUrl: string;
}

export default function AssessmentReminderEmail({
  recipientName,
  dueDays,
  appUrl,
}: AssessmentReminderEmailProps) {
  const ctaUrl = `${appUrl}/assessments`;
  const urgencyLine = dueDays !== undefined
    ? dueDays <= 1
      ? "Your assessment window closes tomorrow."
      : `You have ${dueDays} days left to complete your assessment.`
    : "Your next assessment is ready when you are.";

  return (
    <EmailLayout preview={`${recipientName}, your GROE assessment is ready`}>
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
        Time for your resilience check-in
      </Heading>

      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 8px", fontFamily: font.body }}>
        Hi {recipientName},
      </Text>
      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 16px", fontFamily: font.body }}>
        Your team is tracking its collective resilience through GROE, and it&apos;s time to
        complete your latest assessment. The results help your organization understand
        where support is most needed.
      </Text>

      {/* Urgency callout */}
      <Section
        style={{
          backgroundColor: C.ragAmberBg,
          borderLeft: `4px solid ${C.ragAmber}`,
          borderRadius: "0 8px 8px 0",
          padding: "14px 18px",
          margin: "0 0 24px",
        }}
      >
        <Text
          style={{
            color: C.body,
            fontSize: "14px",
            fontWeight: 600,
            margin: 0,
            fontFamily: font.body,
          }}
        >
          {urgencyLine}
        </Text>
      </Section>

      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 28px", fontFamily: font.body }}>
        The assessment takes about <strong>10–12 minutes</strong> to complete and your
        individual responses are always kept private.
      </Text>

      <Section style={{ textAlign: "center" }}>
        <Button href={ctaUrl} style={buttonStyle}>
          Start my assessment
        </Button>
      </Section>

      <Hr style={{ borderColor: C.border, margin: "28px 0 20px" }} />

      <Text style={{ color: C.muted, fontSize: "13px", lineHeight: "1.5", margin: 0, fontFamily: font.body }}>
        Your responses are confidential. Only aggregated, anonymized data (minimum
        20 participants) is ever shared with your organization&apos;s leadership.
      </Text>
    </EmailLayout>
  );
}

AssessmentReminderEmail.PreviewProps = {
  recipientName: "Jordan Rivera",
  dueDays: 3,
  appUrl: "https://app.groe.io",
} satisfies AssessmentReminderEmailProps;
