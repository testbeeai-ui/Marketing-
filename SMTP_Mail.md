# SMTP Mail Setup Guide for Email Invitations

This comprehensive guide will help you configure SMTP (Simple Mail Transfer Protocol) settings in Supabase so that invitation emails can be sent automatically to your team members.

## Table of Contents
1. [What is SMTP?](#what-is-smtp)
2. [Why Do You Need SMTP?](#why-do-you-need-smtp)
3. [Quick Start: Gmail SMTP](#quick-start-gmail-smtp-easiest)
4. [Alternative: SendGrid](#alternative-sendgrid-recommended-for-production)
5. [Field-by-Field Explanation](#field-by-field-explanation)
6. [Common Issues and Fixes](#common-issues-and-fixes)
7. [Testing Your Configuration](#testing-your-configuration)
8. [Quick Reference: Provider Settings](#quick-reference-provider-settings)
9. [Security Tips](#security-tips)
10. [What Happens After Configuration](#what-happens-after-configuration)

---

## What is SMTP?

SMTP (Simple Mail Transfer Protocol) is the standard protocol used for sending emails over the internet. When you configure SMTP in Supabase, you're telling Supabase how to connect to an email service provider (like Gmail, SendGrid, or Mailgun) to send emails on your behalf.

---

## Why Do You Need SMTP?

**Without SMTP configuration:**
- ❌ Invitation emails won't be sent automatically
- ❌ Users won't receive invitation codes via email
- ✅ You'll need to manually copy and share invitation links

**With SMTP configuration:**
- ✅ Invitation emails are sent automatically
- ✅ Users receive professional invitation emails
- ✅ Better user experience and security

---

## Quick Start: Gmail SMTP (Easiest)

### Step 1: Enable 2-Step Verification
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable "2-Step Verification" (if not already enabled)

### Step 2: Generate App Password
1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" → "Other (Custom name)"
3. Enter "Supabase SMTP"
4. Click "Generate"
5. **Copy the 16-character password** (you'll need this!)

### Step 3: Configure in Supabase
1. Go to **Supabase Dashboard** → **Authentication** → **Email** → **SMTP Settings**
2. Toggle **"Enable custom SMTP"** to **ON** (green)
3. Fill in the following fields:

```
Sender Details:
├─ Sender email address: yourname@gmail.com
└─ Sender name: StoryTeller Enterprise (or your name)

SMTP Provider Settings:
├─ Host: smtp.gmail.com
├─ Port number: 465 (or 587)
├─ Username: yourname@gmail.com
├─ Password: [paste the 16-character App Password here]
└─ Minimum interval per user: 60 (seconds)
```

4. Click **"Save changes"**
5. Wait for confirmation ✅

---

## Alternative: SendGrid (Recommended for Production)

### Step 1: Create SendGrid Account
1. Sign up at [SendGrid](https://sendgrid.com)
2. Verify your email address

### Step 2: Create API Key
1. Go to **Settings** → **API Keys**
2. Click **"Create API Key"**
3. Name it "Supabase SMTP"
4. Select **"Full Access"** or **"Restricted Access"** with Mail Send permissions
5. **Copy the API key** (you'll only see it once!)

### Step 3: Verify Sender
1. Go to **Settings** → **Sender Authentication**
2. Verify a Single Sender (your email address)

### Step 4: Configure in Supabase
```
Sender Details:
├─ Sender email address: verified@yourdomain.com
└─ Sender name: StoryTeller Enterprise

SMTP Provider Settings:
├─ Host: smtp.sendgrid.net
├─ Port number: 587
├─ Username: apikey (literally type "apikey")
├─ Password: [paste your SendGrid API key]
└─ Minimum interval per user: 60
```

---

## Field-by-Field Explanation

### 1. **Enable custom SMTP**
- **What it does**: Toggles between Supabase's default email service and your custom SMTP
- **Action**: Turn it **ON** (green) to use your SMTP provider

### 2. **Sender email address**
- **What it does**: The email address that recipients will see as the sender
- **Example**: `noreply@yourdomain.com` or `yourname@gmail.com`
- **Important**: Must match your verified email/domain

### 3. **Sender name**
- **What it does**: The display name shown in recipients' inboxes
- **Example**: `StoryTeller Enterprise` or `Your Name`

### 4. **Host**
- **What it does**: The SMTP server address
- **Examples**:
  - Gmail: `smtp.gmail.com`
  - SendGrid: `smtp.sendgrid.net`
  - Resend: `smtp.resend.com`

### 5. **Port number**
- **What it does**: The port used for SMTP connection
- **Common values**: `465` (SSL) or `587` (TLS)
- **Recommendation**: 
  - Gmail: Use `465`
  - Most providers: Use `587`

### 6. **Username**
- **What it does**: Your SMTP authentication username
- **Examples**:
  - Gmail: Your Gmail address (`yourname@gmail.com`)
  - SendGrid: `apikey` (literally the word "apikey")
  - Resend: `resend` (literally the word "resend")

### 7. **Password**
- **What it does**: Your SMTP authentication password/API key
- **Important**:
  - Gmail: Use **App Password** (16 characters), NOT your regular password
  - SendGrid/Resend: Use your **API Key**

### 8. **Minimum interval per user**
- **What it does**: Minimum seconds between emails to the same user
- **Default**: `60` seconds (this is fine for most use cases)

---

## Common Issues and Fixes

### ❌ **Problem: "All fields must be filled" Warning**
**Solution**: Make sure ALL fields are filled:
- ✅ Sender email address
- ✅ Sender name
- ✅ Host
- ✅ Port number
- ✅ Username
- ✅ Password

### ❌ **Problem: "Authentication failed" Error**
**Possible Causes**:
- Wrong username or password
- Using regular Gmail password instead of App Password
- API key expired or incorrect

**Solutions**:
- Double-check your credentials
- For Gmail: Make sure you're using an **App Password**, not your regular password
- For SendGrid/Resend: Regenerate your API key and try again

### ❌ **Problem: "Connection timeout" Error**
**Possible Causes**:
- Wrong port number
- Firewall blocking the connection
- Wrong host address

**Solutions**:
- Try port `587` (TLS) instead of `465` (SSL) or vice versa
- Verify the host address is correct
- Check if your network/firewall allows SMTP connections

### ❌ **Problem: Emails Not Being Received**
**Possible Causes**:
- Emails going to spam folder
- Wrong sender email address
- SMTP not properly configured

**Solutions**:
- Check spam/junk folder
- Verify sender email address is correct
- Test SMTP configuration again
- Check Supabase logs for errors

### ❌ **Problem: "Rate limit exceeded" Error**
**Possible Causes**:
- Too many emails sent in a short time
- Free tier limits reached

**Solutions**:
- Wait before sending more emails
- Upgrade to a paid plan if needed
- Increase "Minimum interval per user" in SMTP settings

### ❌ **Problem: Gmail "Less secure app" Error**
**Solution**: Gmail no longer supports "less secure apps". You MUST use an App Password:
1. Enable 2-Step Verification
2. Generate an App Password
3. Use the App Password in SMTP settings

---

## Testing Your Configuration

After saving your SMTP settings:

1. Go to your organization management page
2. Click **"Add Members"**
3. Enter your own email address
4. Click **"Send Invitation"**
5. Check your inbox (and spam folder!)
6. You should receive an invitation email ✅

---

## Quick Reference: Provider Settings

| Provider | Host | Port | Username | Password |
|----------|------|------|----------|----------|
| **Gmail** | `smtp.gmail.com` | `465` | Your Gmail | App Password |
| **SendGrid** | `smtp.sendgrid.net` | `587` | `apikey` | API Key |
| **Resend** | `smtp.resend.com` | `587` | `resend` | API Key |
| **Mailgun** | `smtp.mailgun.org` | `587` | `postmaster@...` | SMTP Password |

---

## Security Tips

1. **Never share your SMTP credentials** publicly
2. **Use App Passwords** for Gmail (not your regular password)
3. **Rotate API keys** regularly (every 90 days recommended)
4. **Use environment variables** if configuring programmatically
5. **Monitor email sending** for suspicious activity
6. **Set rate limits** to prevent abuse

---

## What Happens After Configuration

Once SMTP is configured:
- ✅ Invitation emails will be sent automatically
- ✅ Users will receive professional invitation emails
- ✅ You can use the **"Resend Email"** button in the invitations table
- ✅ All future invitations will include email delivery

---

## Example: Complete Gmail Setup

Here's a complete example for Gmail:

```
✅ Enable custom SMTP: ON
✅ Sender email: john.doe@gmail.com
✅ Sender name: StoryTeller Enterprise
✅ Host: smtp.gmail.com
✅ Port: 465
✅ Username: john.doe@gmail.com
✅ Password: abcd efgh ijkl mnop (16-character App Password)
✅ Minimum interval: 60
```

Click **"Save changes"** → Done! 🎉

---

## Need Help?

If you're still having issues:

1. **Double-check all credentials** - Make sure everything is correct
2. **Verify sender email** - Must match your verified email
3. **Check Supabase logs** - Go to Dashboard → Logs
4. **Try different port** - Switch between 587 and 465
5. **Test with different provider** - Try Gmail if SendGrid doesn't work

---

## Additional Resources

- [Supabase SMTP Documentation](https://supabase.com/docs/guides/auth/auth-smtp)
- [Gmail App Passwords Guide](https://support.google.com/accounts/answer/185833)
- [SendGrid SMTP Setup](https://docs.sendgrid.com/for-developers/sending-email/getting-started-smtp)
- [Resend SMTP Documentation](https://resend.com/docs/send-with-smtp)

---

**That's it!** Once configured, your invitation emails will be sent automatically. 🎉
