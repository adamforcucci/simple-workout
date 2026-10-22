# Google Play: internal testing checklist

For publishing Adam's Workout App to friends through Play's **internal testing** track.
Internal testing needs no Google review and supports up to 100 testers.

1. **Create the app.** In Play Console, choose **Create app**:
   - Name: `Adam's Workout App`
   - Default language: English (Australia)
   - App or game: **App**
   - Free or paid: **Free** (Phase 2 subscriptions are added later as in-app products)
   - Accept the declarations.
2. **Set up your app** (the dashboard checklist). Answers are in [`declarations.md`](declarations.md):
   privacy policy, app access, ads, content rating, target audience, news app,
   data safety, government app, financial features, health apps.
3. **Main store listing.** Text is in [`listing.md`](listing.md). Upload:
   - App icon: `icon-512.png`
   - Feature graphic: `feature-graphic.png`
   - Phone screenshots: `screenshots/01-…png` to `07-…png`, in order
4. **Internal testing.** Go to **Test and release → Testing → Internal testing**:
   - **Testers:** create an email list (your Gmail and friends' Google accounts).
   - **Create new release:** let Google manage the app signing key (Play App Signing), then upload
     `android/app/build/outputs/bundle/release/app-release.aab`.
     Build it with `cd android && ./gradlew :app:bundleRelease`.
   - Release notes: *"First test release."*
   - Save, review, then **Start rollout to Internal testing**.
   - Copy the **opt-in link** and send it to testers. Each tester opens it,
     accepts, then installs from the Play Store.
5. **Foreground service declaration.** If Play asks before the rollout, the wording
   is in `declarations.md`. The video is `fgs-demo-redacted.mp4` (not in git): upload it
   to YouTube as **Unlisted** and paste the link.
6. **Health Connect declaration.** App content → **Health Connect**: one justification
   per write permission, from `declarations.md`.

**Every new build:** bump `versionCode` (and `versionName`) in
`android/app/build.gradle`, rebuild the AAB, and create a new internal testing release.

**Moving your own phone to the Play version:** the Play build is signed with the
release key, so it can't install over the development build. First **Profile → Backup → Save**,
then uninstall the development build, install from the Play opt-in link, and use
**Profile → Backup → Restore**. Strava needs reconnecting afterwards, because backups
deliberately leave the sign-in out.

**Later: production.** New personal accounts need a **closed test with 12+ testers
for 14 days** before Play allows a public release. Internal testing doesn't count
towards that, so start a closed test once 12 people are ready.
