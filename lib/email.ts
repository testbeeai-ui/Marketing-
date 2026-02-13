/**
 * Email service for sending invitation emails
 * Uses Supabase's built-in email functionality or can be extended to use Resend/SendGrid
 */

interface SendInvitationEmailParams {
  to: string;
  organizationName: string;
  invitationCode: string;
  inviteUrl: string;
  inviterName?: string;
}

export async function sendInvitationEmail({
  to,
  organizationName,
  invitationCode,
  inviteUrl,
  inviterName = "Team",
}: SendInvitationEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    // Option 1: Use Resend (Recommended - Free tier: 100 emails/day)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || "StoryTeller <onboarding@resend.dev>",
            to: [to],
            subject: `You've been invited to join ${organizationName}`,
            html: generateInvitationEmailHTML({
              organizationName,
              invitationCode,
              inviteUrl,
              inviterName,
            }),
            text: generateInvitationEmailText({
              organizationName,
              invitationCode,
              inviteUrl,
              inviterName,
            }),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const msg = errorData.message || `Resend API returned ${response.status}`;
          throw new Error(msg);
        }

        const data = await response.json();
        console.log("Email sent successfully via Resend:", data.id);
        return { success: true };
      } catch (error) {
        console.error("Resend email error:", error);
        // Return the actual Resend error so the user sees it (e.g. invalid key, domain not verified)
        const message = error instanceof Error ? error.message : "Resend request failed";
        return { success: false, error: `Resend: ${message}` };
      }
    }

    // Option 2: Use custom email service URL
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    const emailServiceKey = process.env.EMAIL_SERVICE_KEY;
    
    if (emailServiceUrl && emailServiceKey) {
      try {
        const response = await fetch(emailServiceUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${emailServiceKey}`,
          },
          body: JSON.stringify({
            to,
            subject: `You've been invited to join ${organizationName}`,
            html: generateInvitationEmailHTML({
              organizationName,
              invitationCode,
              inviteUrl,
              inviterName,
            }),
            text: generateInvitationEmailText({
              organizationName,
              invitationCode,
              inviteUrl,
              inviterName,
            }),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Email service returned ${response.status}`);
        }

        return { success: true };
      } catch (error) {
        console.error("Custom email service error:", error);
        // Fall through
      }
    }

    // Option 3: Use Supabase SMTP (requires configuration in Supabase Dashboard)
    // Note: Supabase doesn't provide a direct API for sending custom emails
    // You need to configure SMTP in: Supabase Dashboard > Authentication > Email > SMTP Settings
    // See SMTP_Mail.md for detailed instructions
    
    // If no email service is configured, return an error
    const errorMessage = 
      "Email service not configured. " +
      "Please set RESEND_API_KEY environment variable (recommended) or configure SMTP in Supabase Dashboard. " +
      "See SMTP_Mail.md for setup instructions.";
    
    console.error(errorMessage);
    console.log(`Invitation details for manual sharing: Code: ${invitationCode}, URL: ${inviteUrl}`);
    
    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function generateInvitationEmailHTML({
  organizationName,
  invitationCode,
  inviteUrl,
  inviterName,
}: Omit<SendInvitationEmailParams, "to">): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation to join ${organizationName}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">You've been invited!</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            Hi there,
          </p>
          <p style="font-size: 16px; margin-bottom: 20px;">
            <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on StoryTeller Enterprise.
          </p>
          <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your invitation code:</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #667eea; font-family: monospace; letter-spacing: 2px;">
              ${invitationCode}
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Accept Invitation
            </a>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="font-size: 12px; color: #999; word-break: break-all; background: white; padding: 10px; border-radius: 4px;">
            ${inviteUrl}
          </p>
          <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;
}

function generateInvitationEmailText({
  organizationName,
  invitationCode,
  inviteUrl,
  inviterName,
}: Omit<SendInvitationEmailParams, "to">): string {
  return `
You've been invited to join ${organizationName}!

${inviterName} has invited you to join ${organizationName} on StoryTeller Enterprise.

Your invitation code: ${invitationCode}

Accept your invitation by clicking this link:
${inviteUrl}

This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
  `.trim();
}
