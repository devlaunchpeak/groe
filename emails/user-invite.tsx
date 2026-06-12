import * as React from "react";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, C, font, buttonStyle } from "./_components/EmailLayout";

export interface UserInviteEmailProps {
  recipientName?: string;
  orgName: string;
  inviterName: string;
  /** One-time invite link — expires on first use */
  inviteUrl: string;
  /** Number of days before the invite link expires */
  expiresInDays?: number;
}

export default function UserInviteEmail({
  recipientName,
  orgName,
  inviterName,
  inviteUrl,
  expiresInDays = 7,
}: UserInviteEmailProps) {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi there,";

  return (
    <EmailLayout
      preview={`${inviterName} invited you to join ${orgName} on GROE`}
    >
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
        You&apos;ve been invited to join {orgName} on GROE
      </Heading>

      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 8px", fontFamily: font.body }}>
        {greeting}
      </Text>
      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 16px", fontFamily: font.body }}>
        <strong>{inviterName}</strong> has enrolled you in the GROE Resilience
        Platform as part of <strong>{orgName}</strong>&apos;s team wellness program.
      </Text>
      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 24px", fontFamily: font.body }}>
        GROE is a confidential, science-backed program that helps cybersecurity
        professionals recognize and recover from burnout — at their own pace,
        on their own terms.
      </Text>

      {/* Privacy callout */}
      <Section
        style={{
          backgroundColor: C.ragGreenBg,
          borderLeft: `4px solid ${C.ragGreen}`,
          borderRadius: "0 8px 8px 0",
          padding: "14px 18px",
          margin: "0 0 28px",
        }}
      >
        <Text
          style={{
            color: C.body,
            fontFamily: font.body,
            fontWeight: 600,
            fontSize: "13px",
            margin: "0 0 4px",
          }}
        >
          Your responses are always private
        </Text>
        <Text
          style={{
            color: C.body,
            fontFamily: font.body,
            fontSize: "13px",
            margin: 0,
            lineHeight: "1.5",
          }}
        >
          Only anonymized, aggregated data is ever shared with your
          organization. Your individual results and responses are never visible
          to your employer.
        </Text>
      </Section>

      <Section style={{ textAlign: "center" }}>
        <Button href={inviteUrl} style={buttonStyle}>
          Accept invitation &amp; get started
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
        This invitation expires in {expiresInDays} days and can only be used once.
      </Text>

      <Hr style={{ borderColor: C.border, margin: "24px 0 16px" }} />

      <Text style={{ color: C.muted, fontSize: "13px", lineHeight: "1.5", margin: 0, fontFamily: font.body }}>
        If you weren&apos;t expecting this invitation or have questions about
        the program, reply to this email and we&apos;ll be happy to help.
      </Text>
    </EmailLayout>
  );
}

UserInviteEmail.PreviewProps = {
  recipientName: "Alex Chen",
  orgName: "Cypress Technology Group",
  inviterName: "Taylor Kim",
  inviteUrl: "https://app.groe.io/accept-invite?token=example",
  expiresInDays: 7,
} satisfies UserInviteEmailProps;
