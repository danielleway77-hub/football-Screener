# Your Football Match Screener - user guide

This tool does one job: it looks at the matches you give it and shows you only the ones where **one team's recent form is above 75% and the other team's is below 35%**. For those matches it shows the extra numbers you normally open each match page to read.

It saves you from working through every match by hand. It is not betting advice (see the last section).

## 1. Signing in

Open your link, type your password and press **Sign in**. If you get it wrong five times in a row you are locked out for a few minutes; the page tells you how long. You stay signed in on that device for about 30 days.

## 2. The dashboard

The dashboard is the first page. It lists the matches that passed your rule, grouped by day (Today, Tomorrow, then later days). Use the tabs at the top to switch between **Upcoming**, **Today**, **Tomorrow** and the day after. There is a search box for league names and a sort control.

Each match card shows:

| What you see                         | What it means                                                                                                                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Form bars, e.g. 75% / 35%**        | How good each team's recent results are, as a score out of 100, copied from PrediGoal. A high bar means good recent form, a low bar means poor form. The small W / D / L badges are recent wins, draws and losses. |
| **Qualifies**                        | The match passed your rule: one team's form is **above 75** and the other's **below 35**. Exactly 75 or 35 does not count. It does not matter which side is the strong one.                                             |
| **Win / Draw / Away**                | The chance (%) PrediGoal gives to a home win, a draw and an away win. The three add up to about 100.                                                                                                                  |
| **Both teams to score: Yes / No**    | The chance that both teams score at least one goal. "Yes" comes from PrediGoal; "No" is simply 100 minus "Yes" (marked as calculated).                                                                               |
| **Over / Under 2.5 goals**           | The chance that the match has 3 or more goals in total (Over) or 2 or fewer (Under). "Under" is 100 minus "Over".                                                                                                     |
| **Predicted score**                  | PrediGoal's predicted result, for example 3 - 1. Shown only when you imported it.                                                                                                                                     |
| **Unavailable**                      | That number was not in the data you imported. It is never shown as zero.                                                                                                                                              |

Click a card to open the match page with the same figures larger.

The status card on the dashboard shows when the data was last updated and how many matches were checked and qualified. Times are shown in the timezone set in Settings (UK time by default).

## 3. Updating the data (Import)

The tool cannot read PrediGoal on its own, so you bring the data in. It takes about a minute.

**Before you start:** in **Settings**, check whether you use *league form* or *overall form* (the default is league form). On PrediGoal, select the same form option before you copy anything. The Import page reminds you.

**Smart paste (recommended)**

1. Click **Import** in the menu, then the **Paste / upload** tab.
2. In PrediGoal, open a match page. Press **Ctrl+A** (select all), then **Ctrl+C** (copy).
3. Back in the tool, click in the box **Paste text from a match page** and press **Ctrl+V**. You can paste several matches one after another (up to 20).
4. Read the preview. Each match shows what the tool understood. If a value is highlighted or missing, check it and correct it; the kickoff time can be edited in the preview.
5. Press **Import**.
6. You will see a result like "Imported 12 matches - 2 qualify." Go back to the **Dashboard** to see them.

**Uploading a file instead:** if you have a JSON or CSV file, drop it on the upload area or choose it. The page offers sample files to show the format. The preview and Import steps are the same.

Importing the same match again just updates it; it never creates a duplicate.

## 4. If data is old (stale)

If the data has not been updated for more than the time set in Settings (26 hours by default) a banner says so. Nothing is lost: your last matches are still shown, but the numbers may be out of date. Import again. Matches whose kickoff has passed disappear from the "Upcoming" view by themselves.

## 5. If an import goes wrong

| What you see                                          | What to do                                                                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| "We couldn't read that"                               | The pasted text was not a match page, or it was cut short. Go back to the match, select all, copy and paste again.                |
| Some matches "skipped" with reasons                   | Read the reason next to each one (for example a number missing, or the wrong form type). Fix it on PrediGoal or in the preview and import those again. The matches that were fine are already saved. |
| "None of the matches could be imported"               | Check the reasons shown. The most common cause is the wrong form type: make PrediGoal show the same one as your Settings.        |
| "Another update is running. Try again in a minute."   | Wait a minute and try again.                                                                                                      |
| "Couldn't reach the server" / offline banner          | Check your internet connection and try again.                                                  |
| Nothing qualifies                                     | That can be normal: the rule is strict and often only a few matches pass.                                                         |

The **Runs** page lists every update with its result (success, partial, failed) and the reason for any skipped match. If you are stuck, send your helper a screenshot of the Runs page. Never send your password.

## 6. Settings you can change

Open **Settings**. Changes are saved with the save bar at the bottom; the page warns you if you leave without saving.

| Setting                        | What it does                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Screening thresholds**       | The high (default 75) and low (default 35) form values. A live preview shows how many stored matches would qualify. The low value must be below the high one. |
| **Days ahead**                 | Look 1 day or 2 days ahead (default 2: tomorrow and the day after).                                       |
| **Form type**                  | League form (default) or overall form. Must match what you copy from PrediGoal.                           |
| **Timezone**                   | The timezone used for kickoff times and for "Today" / "Tomorrow" (default Europe/London).                  |
| **Data freshness (stale after)** | How many hours before the data counts as old (default 26).                                              |
| **Re-screen** (Maintenance)    | Checks all stored matches again against your current thresholds. Nothing is deleted.                      |
| **Password** (Security)        | Change your password (at least 10 characters). Every other device is signed out.                          |

The "Data access" section and "Ingest tokens" are for the person who looks after the tool. You can leave them alone.

## 7. What this tool does not do

- **It does not give betting advice.** It only filters matches by the rule you set and shows probabilities that come from PrediGoal. It does not tell you what to bet on, and it does not place bets.
- **The data comes from PrediGoal**, from what you copy yourself. The tool does not check or improve those numbers.
- **It does not fetch data automatically.** PrediGoal's terms require its permission for automated access, and that permission has not been granted. If PrediGoal agrees in writing, automatic or one-click updating could be added later.
- It never asks for, stores or uses your PrediGoal or Google login.
- It does not send alerts, keep betting records or track how accurate the numbers turn out to be.

Please gamble responsibly. If betting is causing you problems, free support is available in the UK from BeGambleAware (begambleaware.org) and the National Gambling Helpline.
