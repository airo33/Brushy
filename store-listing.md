# Brushy: App Store listing (version 1.0)

This text matches what the app does **today**. Where a feature needs the Apple Developer account
(real alarm, camera AI), the text is marked **[ADD WHEN SHIPPED]**. Do not claim those features
before they work. App Review checks the description against the app.

If "Brushy" is already taken in App Store Connect, use the fallback name `Brushy: Brush Alarm`.

---

## Basics

| Field | Text | Limit |
|---|---|---|
| **Name** | Brushy | 30 |
| **Subtitle** | The alarm that makes you brush | 30 |
| **Promotional text** | Set brushing alarms, prop up your phone and brush for two minutes. Build a streak, compete with friends, and stop skipping the evening brush. | 170 |
| **Keywords** | toothbrush,teeth,dental,oral,hygiene,habit,timer,streak,reminder,alarm,routine,dentist,morning | 100 |
| **Primary category** | Health & Fitness | |
| **Secondary category** | Lifestyle | |
| **What's New (1.0)** | First release. Set your brushing alarms, brush hands-free with photo proof, and keep your streak. | 4000 |
| **Copyright** | 2026 [YOUR NAME OR COMPANY] | |
| **Support URL** | [YOUR SUPPORT PAGE OR EMAIL LINK] | |
| **Privacy Policy URL** | [HOSTED PRIVACY POLICY LINK] (required) | |

Keywords tip: don't repeat words from the name or subtitle (Apple already indexes those), and don't add
competitor names.

---

## Description

Brushing twice a day is easy to promise and easy to skip. Brushy is the alarm that doesn't let you.

Set your morning and evening alarms. When one goes off, Brushy shows a full-screen alarm and keeps
reminding you until you've actually brushed. Prop your phone against the mirror, tap Start, and the
timer runs by itself for two minutes. No holding a button with your toothbrush in your mouth.

HOW IT WORKS
• Set as many alarms as you like. Brush twice a day, or more.
• When an alarm rings, open Brushy and start your brushing timer.
• Brush hands-free. Brushy takes a photo at the start and the end as your proof.
• Finish the timer to turn the alarm off. Reminders stop once you're done.

KEEP YOUR STREAK
• Brush on every day you reach your goal and watch your streak grow.
• See your last 14 days at a glance, your best streak and your total brushes.
• Share your streak as a picture with one tap.

COMPETE WITH FRIENDS
• Add friends with a private friend code. Nobody can find you by email.
• See a friends leaderboard ranked by streak, with who has brushed today.
• You're in control: friends only see your name and streak numbers, and only after you both accept.
• Block or report anyone, and delete your friend profile any time.

MAKE IT YOURS
• Choose a 1, 2 or 3 minute brushing time and a daily goal from 1 to 4 brushes.
• Pick your alarm sound: beeps, chime or siren.
• Look back at your brush photos and delete any you don't want to keep.

PRIVATE BY DESIGN
• No account needed. Everything works on your phone, and your photos are never uploaded.
• Create a free account only if you want to back up your streak and alarms or use friends.
• No ads and no tracking. Delete your account from inside the app whenever you like.

GOOD TO KNOW
• Brushy uses notifications and your camera. Both are optional, but reminders and photo proof need them.
• iPhone silent mode and Focus settings can mute notifications. Open Brushy to see your alarm.

Brush well. Keep the streak.

**[ADD WHEN SHIPPED, real alarm]** Replace the "GOOD TO KNOW" Focus/silent line with:
"• Alarms ring even when Brushy is closed, and break through silent mode."

**[ADD WHEN SHIPPED, camera AI]** Add under HOW IT WORKS:
"• Brushy checks on your phone that you're really brushing. The camera view never leaves your device."

---

## Screenshots plan

Apple needs 3 to 10 screenshots for the largest iPhone size. Provide **6.9-inch (1320 x 2868)**; Apple scales
that set down for smaller phones. Suggested order and captions (one short line on top of each image):

1. **Home screen with a streak and both alarms** : "Brush twice a day. Keep the streak."
2. **Full-screen ringing alarm** : "An alarm that waits for you to brush."
3. **Brushing screen mid-timer with your face in view** : "Prop it up. Brush hands-free."
4. **Streak card with the 14-day dots** : "Watch your streak grow."
5. **Friends leaderboard** : "Compete with friends."
6. **Settings (time picker and sounds)** : "Your time, your sound."

Take them from a real device or the iOS Simulator, with clean example data. Use the dev "fake streak"
button for a good-looking streak, and use a name that isn't your real one for friends.

---

## Age rating (questionnaire answers)

Answer the questionnaire honestly. For Brushy:

- Violence, sexual content, profanity, horror, gambling, drugs, alcohol: **None**
- Medical or treatment information: **None** (Brushy is a habit app and gives no dental advice)
- Unrestricted web access: **No**
- **User-generated content / contact with other users:** friends can see each other's chosen display
  names. There is no chat, no free-text sharing and no photos shared. Answer according to the exact wording
  of the current questionnaire; if it asks about user-generated content, say yes and describe: "display
  names only, with report and block". Expect **4+** or **12+** depending on how Apple scores that answer.

---

## App Privacy ("nutrition label") answers

Brushy collects data **only if the user creates an account**. Nothing is used for tracking and nothing is
sold or shared with advertisers. Declare these, all **linked to the user**, purpose **App Functionality**,
**not used for tracking**:

| Data type (Apple's wording) | What it is in Brushy |
|---|---|
| Contact Info → **Email Address** | Used to sign in and to send confirmation and password reset emails |
| Identifiers → **User ID** | The account ID |
| User Content → **Other User Content** | Backed-up alarm times, settings and brushing history |
| Usage Data → **Product Interaction** | Streak numbers shared with accepted friends |
| Contact Info → **Name** | The display name chosen for the friends feature (optional) |

**Not collected:** photos and videos (they stay on the phone and are never uploaded), location, contacts,
browsing history, purchases, health data, diagnostics, advertising data.

Tracking: **No.** Third-party partners: Supabase processes account data on your behalf (a service
provider, not a data broker).

Re-check this list in App Store Connect if you ever add analytics, ads or crash reporting.

---

## Notes for App Review

Paste this into "App Review Information → Notes":

> Brushy is a habit app: it sets brushing alarms and asks the user to brush for two minutes to turn them off.
>
> **No account is needed** for the main features. Tap "Maybe later" on the sign-up prompt to continue.
> An account is optional and only used to back up streaks and alarms and for the friends feature.
>
> **To test the full app**, sign in with this demo account: [DEMO EMAIL] / [DEMO PASSWORD]. Please do not
> change the password.
>
> **Camera:** used only to take a photo at the start and end of a brushing session, shown back to the
> user as proof. Photos are stored on the device and never uploaded.
> **Notifications:** local notifications that remind the user to brush.
>
> **Friends / user content:** users add each other by private friend code and see display names and streak
> numbers only. Users can **report and block** others (Friends → ⋯ next to a name), and can delete their
> friend profile and their account in-app (Settings → Account → Delete my account).
>
> To see a ringing alarm quickly, set an alarm a minute ahead and open the app when it passes.

Create the demo account yourself before submitting, and add a couple of friends to it so the reviewer
sees a populated leaderboard. Keep that account working while the app is in review.

---

## Before you submit

- [ ] Privacy policy hosted at a public link and the placeholders filled in
- [ ] Support URL ready (a simple page or a mailto link is fine)
- [ ] Demo account created and added to the review notes
- [ ] Screenshots taken at 1320 x 2868
- [ ] App Privacy answers entered as above
- [ ] Export compliance: the app uses only standard HTTPS, so answer "No" to non-exempt encryption
      (`ITSAppUsesNonExemptEncryption` is already set to false in `app.json`)
- [ ] A process for reading the Supabase `reports` table regularly (App Review checks that you act on reports)
- [ ] Own SMTP provider set in Supabase, "Confirm email" turned on, password minimum set to 8
