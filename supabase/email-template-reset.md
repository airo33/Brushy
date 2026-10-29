# Password reset email (Supabase)

Brushy resets passwords with a one-time **code** typed into the app, not a link.
By default Supabase's reset email only contains a link, so change the template once:

1. Supabase dashboard -> **Authentication** -> **Emails** (or "Email Templates") -> **Reset password**.
2. Set the **Subject** to: `Your Brushy password reset code`
3. Replace the **Message body** with:

```html
<h2>Reset your Brushy password</h2>
<p>Enter this code in the app:</p>
<h1 style="letter-spacing: 4px;">{{ .Token }}</h1>
<p>The code expires soon. If you didn't ask for this, you can ignore this email.</p>
```

4. Save.

The code length is set under **Authentication -> Providers -> Email -> "Email OTP length"**
(default 6). The app accepts 6 to 10 digits.

## Email limits

Supabase's built-in email sender only allows a handful of emails per hour for the whole
project. That is fine for testing. Before real users, add your own SMTP provider under
**Authentication -> SMTP Settings** (Resend, Postmark, SendGrid, etc.).
