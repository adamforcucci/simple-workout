# Google Play — App content declarations

Answers for **Play Console → Policy and programs → App content**. Each answer is
based on what the app actually does (see `web/app/privacy/page.tsx`). If Play's
wording differs from below, choose the option that matches the reasoning given.

---

## Privacy policy
`https://workout-web-phi.vercel.app/privacy`

## App access
**All functionality is available without any access restrictions.**
There's no login; Strava is optional and uses the user's own Strava account.

## Ads
**No, my app does not contain ads.**

## Content rating (IARC questionnaire)
- Category: **All other app types** (not a game, not social, not a communication app).
- Violence, fear, sexuality, language, controlled substances, gambling: **No** to all.
- Does the app let users interact or exchange content with each other? **No.**
  (Uploading to the user's own Strava account isn't user-to-user interaction.)
- Does the app share the user's current location with others? **No.**
- Does the app allow purchases of digital goods? **No** for this release.
  (Change to Yes when the subscription is added in Phase 2.)
- Expected result: **Everyone / PEGI 3 / 4+**.

## Target audience and content
- Target age groups: **18 and over** only.
  (Keeps the app out of the Designed for Families requirements; the privacy
  policy says it isn't intended for under-16s.)
- Appeals to children? **No.**

## News app
**No.**

## Government app
**No.**

## Financial features
**My app doesn't provide any financial features.**

## Health apps declaration
- Health & fitness features: **Activity and fitness**: tracks workouts and heart rate during exercise.
- Health Connect: **Yes**, write-only, opt-in (Profile → Health Connect).
  Fill in the **Health Connect permissions** form for each permission:

  | Permission | Justification |
  |---|---|
  | `WRITE_EXERCISE` | Saves each finished gym workout as a strength-training exercise session, with a segment per set (exercise type and reps), so the user's other fitness apps can see it. |
  | `WRITE_HEART_RATE` | Saves the heart rate recorded from the user's Bluetooth strap during that workout. |
  | `WRITE_TOTAL_CALORIES_BURNED` | Saves the workout's estimated calories. |

  No read permissions are requested. The privacy policy has a Health Connect
  section, and the app's permissions-rationale screen opens it.
- Medical or clinical features: **None.** (The Terms say it's not medical advice.)

## Data safety

**Does your app collect or share any of the required user data types?** **Yes.**

The answer is "Yes" only because of Strava, which is optional. Nothing is sent to us.
Health Connect doesn't change these answers: it stores data on the phone, so
writing to it isn't collection (it would be if we read it and sent it off the device).

**Is all of the user data collected by your app encrypted in transit?** **Yes** (HTTPS only).

**Which of the following methods of account creation does your app support?** **None.**
(There are no accounts. Play may still ask for a deletion URL; the app has no
account to delete. Data is deleted by deleting it in the app, or uninstalling.)

**Data types:**

| Data type | Collected? | Shared? | Ephemeral? | Required or optional | Purpose |
|---|---|---|---|---|---|
| Health and fitness → **Fitness info** (workouts, sets) | Yes | No | No | **Optional** (only if Strava is connected) | App functionality |
| Health and fitness → **Health info** (heart rate during workouts) | Yes | No | No | **Optional** (only if Strava is connected) | App functionality |
| Personal info → **User IDs** (Strava athlete ID, passed through the sign-in server) | Yes | No | **Yes** (not stored) | **Optional** | App functionality |

Why "collected" but not "shared": Play counts data sent off the device as
collected. Sending workouts to the user's own Strava account is a transfer the
user starts and expects, which Play exempts from "sharing".

Everything else is **not collected**: name, date of birth, sex, height and body
weight stay on the phone. There's no location, contacts, files, messages,
photos, audio, app activity, browsing, diagnostics, device IDs or financial info.

**Security practices:**
- Data encrypted in transit: **Yes**
- Users can request that data be deleted: **Yes**. They can delete in the app,
  uninstall, disconnect Strava, or contact us.
- Committed to Play Families policy: **No** (18+ app).
- Independent security review: **No**.

## Foreground service types (Android 14+)

Play asks for each foreground service type declared in the manifest.

**`connectedDevice`**
- What it's for: *"During a workout the app keeps a Bluetooth connection to the
  user's heart rate strap open and records heart rate once a second, including
  while the screen is off. The service runs only while a workout is in progress
  and stops when the workout is finished or discarded."*
- Impact if deferred or interrupted: *"Heart rate recording would stop mid-workout,
  leaving gaps in the workout's heart rate and calorie data."*
- Video: a short unlisted YouTube video showing a workout starting with a strap
  connected, the screen being locked, then heart rate data shown afterwards.
  (We'll record this from the phone.)

**`specialUse`** (only used when no strap is paired)
- Subtype (already in the manifest): *"Keeps an active gym workout's rest timer
  running when no heart rate strap is connected"*
- What it's for: *"The rest timer between sets must alert the user (vibration and
  a beep) at the right moment even when the phone is locked in a pocket. No
  other foreground service type covers a user-visible workout timer without a
  connected device."*
- Impact if deferred: *"Rest alerts would arrive late or not at all."*

## Permissions Play may ask about
- **Nearby devices (Bluetooth scan/connect):** finding and connecting to heart rate straps.
- **Vibrate / wake lock:** end-of-rest alert; keeping the CPU awake during a workout.
- No location permission is used on Android 12+.
  (`ACCESS_FINE_LOCATION` is declared only for Android 11 and below, where
  Bluetooth scanning required it.)
