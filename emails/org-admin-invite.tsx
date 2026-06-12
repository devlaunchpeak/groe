import * as React from "react";
import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, C, font, buttonStyle } from "./_components/EmailLayout";

export interface OrgAdminInviteEmailProps {
  recipientName: string;
  orgName: string;
  inviterName: string;
  /** One-time invite link — expires on first use */
  inviteUrl: string;
  /** Number of days before the invite link expires */
  expiresInDays?: number;
}

export default function OrgAdminInviteEmail({
  recipientName,
  orgName,
  inviterName,
  inviteUrl,
  expiresInDays = 7,
}: OrgAdminInviteEmailProps) {
  return (
    <EmailLayout
      preview={`${inviterName} invited you to manage ${orgName} on GROE`}
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
        You&apos;ve been invited to manage {orgName} on GROE
      </Heading>

      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 8px", fontFamily: font.body }}>
        Hi {recipientName},
      </Text>
      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 16px", fontFamily: font.body }}>
        <strong>{inviterName}</strong> has invited you to become an Organization
        Administrator for <strong>{orgName}</strong> on the GROE Resilience Platform.
      </Text>
      <Text style={{ color: C.body, fontSize: "15px", lineHeight: "1.6", margin: "0 0 24px", fontFamily: font.body }}>
        As an Org Admin you&apos;ll be able to enroll team members, monitor
        aggregated resilience data for your organization, and configure your
        team&apos;s EAP contact information.
      </Text>

      {/* What to expect */}
      <Section
        style={{
          backgroundColor: C.bg,
          borderRadius: "8px",
          padding: "18px 20px",
          margin: "0 0 28px",
          border: `1px solid ${C.border}`,
        }}
      >
        <Text style={{ color: C.heading, fontFamily: font.body, fontWeight: 600, fontSize: "13px", margin: "0 0 10px" }}>
          What you can do as Org Admin
        </Text>
        {[
          "Enroll team members and send invites",
          "View aggregated, anonymized resilience dashboards",
          "Set up your organization's EAP contact",
          "Manage user roles within your team",
        ].map((item) => (
          <Text key={item} style={{ color: C.body, fontFamily: font.body, fontSize: "14px", margin: "0 0 6px", lineHeight: "1.5" }}>
            &bull; {item}
          </Text>
        ))}
      </Section>

      <Section style={{ textAlign: "center" }}>
        <Button href={inviteUrl} style={buttonStyle}>
          Accept invitation
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
        If you weren&apos;t expecting this invitation or believe it was sent in error,
        you can ignore this email. The link will expire automatically.
      </Text>
    </EmailLayout>
  );
}

OrgAdminInviteEmail.PreviewProps = {
  recipientName: "Taylor Kim",
  orgName: "Cypress Technology Group",
  inviterName: "Bon Ishimori",
  inviteUrl: "https://app.groe.io/accept-invite?token=example",
  expiresInDays: 7,
} satisfies OrgAdminInviteEmailProps;
