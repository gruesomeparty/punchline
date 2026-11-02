# Troubleshooting errors

Every error punchline shows in HRworks or in the side panel ends with a code such as
`(PL-302)`. The code says what punchline ran into. The table below says what each one means and
what to try. For problems with installing or logging in, see the
[install guide](install.md#troubleshooting).

## Reporting a problem

Send the person who gave you punchline:

1. **The whole error message**, including the code.
2. **The details.** In HRworks, click **Copy details** next to the error in the punchline bar.
   In the side panel, open **Debug log of the last run in HRworks** below the list and click
   **Copy**. Both list the steps punchline took: dates, times and page steps, never your
   Harvest token or your name. Absences are marked as such, never named.
3. For `PL-3xx` codes, a **screenshot of the HRworks week** in question, opened. Send it
   directly, don't post it anywhere public.
4. **What you did** right before it, for example whether you clicked in HRworks while punchline
   was working.

Copy the details before you start another comparison: each run replaces them.

## Codes

| Code   | What happened                                                                                                                | What to try                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| PL-101 | HRworks shows "Ihre Sitzung läuft bald ab".                                                                                  | Click **Ok** in HRworks and try again.                                                                                |
| PL-102 | The tab isn't on Zeitwirtschaft → Arbeitszeiten.                                                                             | Open that page and try again.                                                                                         |
| PL-103 | HRworks is set to a language punchline doesn't know yet.                                                                     | Switch HRworks to German for now and report it.                                                                       |
| PL-104 | The month or year picker shows something punchline can't read.                                                               | Pick a month in HRworks and try again. Report it if it stays.                                                         |
| PL-105 | An element punchline needs isn't on the page, such as a button. HRworks may have changed its layout.                         | Reload HRworks and try again. Report it with the details if it stays.                                                 |
| PL-201 | HRworks didn't finish a step in time, usually because it was slow or busy.                                                   | Wait a moment and try again. Don't click in HRworks while punchline works.                                            |
| PL-202 | A week stayed closed or empty after punchline clicked it three times.                                                        | Open the week by hand, then try again.                                                                                |
| PL-301 | No week in the shown month covers the date, or the week vanished while punchline read it.                                    | Don't switch months or close weeks while punchline works, then try again.                                             |
| PL-302 | The week is open, but one of its days has no row. The message says how many days the week listed, for example "5 of 7 days". | Check whether HRworks shows that day when you open the week. Report it with a screenshot of the week and the details. |
| PL-303 | A day disappeared while punchline worked on it, usually because HRworks re-rendered the week.                                | Try again. Report it if it happens every time.                                                                        |
| PL-304 | A week title, day or detail had text punchline can't read, for example another date format.                                  | Report it with the details and a screenshot of the week.                                                              |
| PL-305 | A day showed up under a week that doesn't include it.                                                                        | Reload HRworks and try again. Report it if it stays.                                                                  |
| PL-401 | The day can't take this entry: it already has one, is an absence, or HRworks allows no new time on it. Nothing was written.  | Check the day in HRworks. Change it by hand if needed.                                                                |
| PL-402 | HRworks shows other times on the day than the preview did. Nothing was written.                                              | Compare again, then write.                                                                                            |
| PL-403 | The day has several entries punchline won't sort out on its own. Nothing was written.                                        | Clean up the day in HRworks by hand.                                                                                  |
| PL-404 | HRworks dropped or changed the times punchline typed, before saving. Nothing was saved.                                      | Reload HRworks to drop the typed times, then try again.                                                               |
| PL-405 | The times were saved, but HRworks credits other hours than the break rules in the settings predict.                          | Check the break rules in the punchline settings against HRworks.                                                      |
| PL-900 | Something punchline didn't expect at all, most likely a bug.                                                                 | Report it with the details.                                                                                           |
