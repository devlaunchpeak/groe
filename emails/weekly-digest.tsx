import * as React from "react";
import { Button, Column, Heading, Hr, Row, Section, Text } from "@react-email/components";
import { EmailLayout, C, font, buttonStyle } from "./_components/EmailLayout";

export type RagStatus = "resilient" | "developing" | "acute";

export interface WeeklyDigestEmailProps {
  recipientName: string;
  weekNumber: number;
  hMttrScore?: number;
  ragStatus?: RagStatus;
  lessonsCompleted: number;
  checkInsCompleted: number;
  /** Name of the module the user is currently working through */
  currentModule?: string;
  appUrl: string;
}

const RAG_CONFIG: Record<RagStatus, { label: string; color: string; bg: string; message: string }> = {
  resilient: {
    label:   "● Resilient",
    color:   C.ragGreen,
    bg:      C.ragGreenBg,
    message: "You're in a strong place. Keep building on this foundation.",
  },
  developing: {
    label:   "● Developing",
    color:   C.ragAmber,
    bg:      C.ragAmberBg,
    message: "You're making progress. Your learning path is tailored to support you.",
  },
  acute: {
    label:   "● Acute",
    color:   C.ragRed,
    bg:      C.ragRedBg,
    message: "This week's modules are designed to help you recover. You're not alone.",
  },
};

export default function WeeklyDigestEmail({
  recipientName,
  weekNumber,
  hMttrScore,
  ragStatus,
  lessonsCompleted,
  checkInsCompleted,
  currentModule,
  appUrl,
}: WeeklyDigestEmailProps) {
  const ctaUrl = `${appUrl}/progress`;
  const rag = ragStatus ? RAG_CONFIG[ragStatus] : null;

  return (
    <EmailLayout preview={`Your GROE weekly digest — Week ${weekNumber}`}>
      <Heading
        as="h1"
        style={{
          fontFamily: font.heading,
          fontWeight: 700,
          fontSize: "22px",
          color: C.heading,
          margin: "0 0 6px",
          lineHeight: "1.3",
        }}
      >
        Your Week {weekNumber} digest
      </Heading>
      <Text style={{ color: C.muted, fontSize: "13px", margin: "0 0 24px", fontFamily: font.body }}>
        Hi {recipientName} — here&apos;s how your resilience journey is progressing.
      </Text>

      {/* Stats row */}
      <Row style={{ margin: "0 0 24px" }}>
        <Column style={{ width: "50%", paddingRight: "8px" }}>
          <Section
            style={{
              backgroundColor: C.bg,
              borderRadius: "8px",
              padding: "18px 16px",
              border: `1px solid ${C.border}`,
              textAlign: "center",
            }}
          >
            <Text style={{ color: C.heading, fontFamily: font.heading, fontWeight: 700, fontSize: "32px", margin: "0 0 4px", lineHeight: "1" }}>
              {lessonsCompleted}
            </Text>
            <Text style={{ color: C.muted, fontFamily: font.body, fontSize: "12px", margin: 0 }}>
              Lessons completed
            </Text>
          </Section>
        </Column>
        <Column style={{ width: "50%", paddingLeft: "8px" }}>
          <Section
            style={{
              backgroundColor: C.bg,
              borderRadius: "8px",
              padding: "18px 16px",
              border: `1px solid ${C.border}`,
              textAlign: "center",
            }}
          >
            <Text style={{ color: C.heading, fontFamily: font.heading, fontWeight: 700, fontSize: "32px", margin: "0 0 4px", lineHeight: "1" }}>
              {checkInsCompleted}
            </Text>
            <Text style={{ color: C.muted, fontFamily: font.body, fontSize: "12px", margin: 0 }}>
              Check-ins logged
            </Text>
          </Section>
        </Column>
      </Row>

      {/* H-MTTR score + RAG status */}
      {rag && hMttrScore !== undefined && (
        <Section
          style={{
            backgroundColor: rag.bg,
            borderRadius: "8px",
            padding: "18px 20px",
            margin: "0 0 20px",
            border: `1px solid ${rag.color}22`,
          }}
        >
          <Row>
            <Column style={{ width: "60%" }}>
              <Text style={{ color: rag.color, fontFamily: font.body, fontWeight: 600, fontSize: "13px", margin: "0 0 4px" }}>
                {rag.label}
              </Text>
              <Text style={{ color: C.body, fontFamily: font.body, fontSize: "13px", lineHeight: "1.5", margin: 0 }}>
                {rag.message}
              </Text>
            </Column>
            <Column style={{ width: "40%", textAlign: "right" }}>
              <Text style={{ color: rag.color, fontFamily: font.heading, fontWeight: 700, fontSize: "36px", margin: 0, lineHeight: "1" }}>
                {hMttrScore}
              </Text>
              <Text style={{ color: C.muted, fontFamily: font.body, fontSize: "11px", margin: "2px 0 0" }}>
                H-MTTR score
              </Text>
            </Column>
          </Row>
        </Section>
      )}

      {/* Current module */}
      {currentModule && (
        <Section style={{ margin: "0 0 24px" }}>
          <Text style={{ color: C.muted, fontSize: "12px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.5px", margin: "0 0 6px", fontFamily: font.body }}>
            Currently in progress
          </Text>
          <Text style={{ color: C.body, fontSize: "14px", fontFamily: font.body, margin: 0 }}>
            {currentModule}
          </Text>
        </Section>
      )}

      <Hr style={{ borderColor: C.border, margin: "4px 0 24px" }} />

      <Section style={{ textAlign: "center" }}>
        <Button href={ctaUrl} style={buttonStyle}>
          View full progress report
        </Button>
      </Section>
    </EmailLayout>
  );
}

WeeklyDigestEmail.PreviewProps = {
  recipientName: "Morgan Lee",
  weekNumber: 6,
  hMttrScore: 42,
  ragStatus: "developing",
  lessonsCompleted: 3,
  checkInsCompleted: 5,
  currentModule: "Recognising Stress Responses in High-Stakes Environments",
  appUrl: "https://app.groe.io",
} satisfies WeeklyDigestEmailProps;
