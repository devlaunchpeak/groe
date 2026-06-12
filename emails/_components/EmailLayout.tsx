import * as React from "react";
import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// GROE design system colors — mirrors CLAUDE.md
export const C = {
  bg:      "#F8F6F0",
  card:    "#FFFFFF",
  heading: "#1C4A2E",
  primary: "#2D6A4F",
  body:    "#111827",
  muted:   "#6B7280",
  border:  "#E5E7EB",
  ragGreen: "#2D6A4F",
  ragAmber: "#F59E0B",
  ragRed:   "#DC2626",
  ragGreenBg: "#F0FDF4",
  ragAmberBg: "#FFFBEB",
  ragRedBg:   "#FEF2F2",
} as const;

export const font = {
  heading: '"Space Grotesk", "Arial Black", Arial, sans-serif',
  body:    '"IBM Plex Sans", Arial, sans-serif',
  mono:    '"IBM Plex Mono", "Courier New", Courier, monospace',
} as const;

// Reusable primary CTA button style
export const buttonStyle: React.CSSProperties = {
  backgroundColor: C.primary,
  color:           "#FFFFFF",
  borderRadius:    "8px",
  padding:         "14px 28px",
  fontFamily:      font.body,
  fontWeight:      600,
  fontSize:        "15px",
  textDecoration:  "none",
  display:         "inline-block",
};

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        {/* Space Grotesk Bold — headings and GROE wordmark */}
        <Font
          fontFamily="Space Grotesk"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mF71Q-gx.woff2",
            format: "woff2",
          }}
          fontWeight={700}
          fontStyle="normal"
        />
        {/* IBM Plex Sans Regular — body text */}
        <Font
          fontFamily="IBM Plex Sans"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhd_eFaxOemdHpg.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        {/* IBM Plex Sans SemiBold — labels and callouts */}
        <Font
          fontFamily="IBM Plex Sans"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhdzVdFxOemdHpg.woff2",
            format: "woff2",
          }}
          fontWeight={600}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: C.bg,
          margin: 0,
          padding: "32px 0",
          fontFamily: font.body,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "0 16px",
          }}
        >
          {/* ── GROE Wordmark ─────────────────────────────────── */}
          <Section style={{ padding: "24px 0 0" }}>
            <Text
              style={{
                fontFamily: font.heading,
                fontWeight: 700,
                fontSize: "26px",
                color: C.heading,
                margin: 0,
                letterSpacing: "-0.5px",
              }}
            >
              GROE
            </Text>
          </Section>

          {/* ── Main Content Card ─────────────────────────────── */}
          <Section
            style={{
              backgroundColor: C.card,
              borderRadius: "12px",
              padding: "40px 32px",
              border: `1px solid ${C.border}`,
              marginTop: "20px",
            }}
          >
            {children}
          </Section>

          {/* ── Footer ───────────────────────────────────────── */}
          <Section style={{ padding: "20px 0 32px" }}>
            <Hr style={{ borderColor: C.border, margin: "0 0 16px" }} />
            <Text
              style={{
                color: C.muted,
                fontSize: "12px",
                textAlign: "center",
                margin: 0,
                fontFamily: font.body,
                lineHeight: "1.5",
              }}
            >
              GROE Resilience Platform by Green Shoe Consulting
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
