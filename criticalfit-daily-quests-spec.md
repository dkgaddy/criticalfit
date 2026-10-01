# CriticalFit — Daily Quests (Guild Feature) Spec

**For Claude Code.** This spec defines *what* to build. *How* it plugs into the existing app (data layer, Activity logging, MET math, Guild gating, profile/Character Sheet, styling) must be discovered from the repo first. Do not guess at existing structures.

---

## 0. Before writing code

Read the codebase and report back on the following before implementing:

1. How Activities are stored and logged, including the MET table and calorie function (27 existing activities). Check whether a "circuit training" activity already exists.
2. How Guild membership is checked and how existing features are gated (Wizard search, Advanced Charting, Build Meals, Themes).
3. How the Character Sheet / Profile stores user settings, and where weight lives for calorie math.
4. How the user's timezone is handled (the evening push reminder already respects it).
5. The Journal home layout, card components, theme/background system, and modal patterns (e.g., the dragon promotion screen).
6. The paywall component and the feature-list copy.

Propose where new tables/collections, components, and routes should go. Wait for approval, then build in the order in §13.

---

## 1. Goal & scope

**Goal:** Give Guild members a daily 15-minute home circuit workout ("Quest"), matched to their equipment and level, that auto-logs as an Activity and feeds Life Points. It replaces the unbuilt "Get exclusive fitness suggestions" paywall line with a real feature.

**MVP includes:**
- An exercise library (static seed data, §11)
- Quest Preferences on the Character Sheet
- Daily Quest generation (Upper / Lower / Full rotation)
- Quest flow: Journal card → Briefing → Active Quest → Victory
- Auto-logging as an Activity
- Personal bests
- A weekly campaign counter
- A free-user locked teaser and paywall copy update

**Out of scope (later versions):** Patrol mode (outdoor timed callouts), Arena mode (spaced stations), Renown/titles/cosmetic rewards, exercise illustrations, quest push notifications, Claude-generated narration.

---

## 2. Quest format: the Stationless Circuit

- A circuit is a sequence of **stations** (strength or core exercises). A **cardio transition** move runs after every station, including the last one.
- One **round** is every station plus its transitions.
- The user completes as many rounds as possible within the time limit (AMRAP). The score is **rounds + extra stations**, displayed like "3 rounds + 2."
- **Rep-based stations:** the user taps **Done** to advance.
- **Timed stations and all transitions:** a countdown auto-advances.
- The workout ends when the overall timer hits zero, wherever the user is in the round.

---

## 3. Quest Preferences (Character Sheet)

Add a "Quest Preferences" section. These settings are user-driven and can be changed anytime. Changes apply to the **next** generated quest; today's quest regenerates only if not yet started.

| Setting | Options | Default |
|---|---|---|
| Difficulty | Beginner / Intermediate / Advanced | Beginner |
| Quest length | 10 / 15 / 20 / 30 min | 15 |
| Stations per circuit | 3 / 4 / 5 | 4 |
| Equipment owned (multi-select) | Dumbbells, Resistance bands, Bench or sturdy chair, Post or pole (band anchor) | Bench or chair checked |
| Include exercises that need space (~10–15 ft) | On / Off | Off |

A wall is assumed available. Difficulty is driven **only** by rep and time targets.

---

## 4. Quest generation

### Day type rotation
- Quests cycle **Upper → Lower → Full → Upper…** based on the **last completed** quest's type, not the calendar. A missed day doesn't skip a type. New users start with Upper.
- On the Briefing screen, Guild users can switch the day type (Upper / Lower / Full) before starting. Switching doesn't count against rerolls.

### Station composition (N = stations per circuit)
- **Every circuit:** exactly 1 core station, placed second-to-last.
- **Upper day:** N−1 upper exercises.
- **Lower day:** N−1 lower exercises.
- **Full day:** N−1 drawn from the upper, lower, and full-body pools, with at least 1 upper and at least 1 lower. Full-body exercises appear on Full days only.
- **Cardio transitions:** drawn from the cardio pool. Rotate through them so the same move doesn't appear twice in a row within a round.

### Filtering
- Exclude exercises whose equipment the user lacks. "Bands or DB" exercises qualify with either.
- Exclude `needsSpace` exercises unless the space setting is on.
- If filtering leaves fewer exercises than needed, allow repeats in the pool. This should be rare; a no-equipment user with no chair still has 3 upper options. Never fail to generate.

### Determinism & rerolls
- Generation is seeded by `userId + localDate + dayType + rerollIndex`. Reloading shows the same quest.
- Avoid repeating any station exercise that appeared in the user's previous completed quest, where the pool allows.
- Guild users get **2 rerolls per day**. A reroll keeps the day type and re-picks the exercises and name.
- The day boundary follows the user's local timezone.

### Naming
Pick a name and flavor line from the pool for the day type (§10) using the same seed.

---

## 5. Screens & flow

### 5.1 Journal quest card
Place it below the energy cards and above Log Ration / Log Activity.
- **Guild:** "Today's Quest: Siege of the Iron Gate" · Upper · 15 min · equipment icons · weekly campaign progress ("Weekly Campaign 2/3") · **View Quest** button.
- **Completed today:** shows the score and "Quest complete ✓." Tapping it shows the summary.
- **Free users:** the same card with a lock icon and **Join the Guild to accept**, which opens the paywall.

### 5.2 Briefing
- Quest name, flavor line, day type, length, difficulty
- Station list in order, with the target for each ("12 reps," "30s") and the cardio transitions listed between them
- An **ⓘ** icon on every exercise opens its explanation pop-up (§11)
- "Personal best for this quest type: 3 rounds + 1" (or "No record yet")
- Controls: day type switcher, **Reroll** (with remaining count), **Begin Quest**
- One line: "Warm up for 2–3 minutes before you begin."
- **Free users:** station names blurred, with the Guild call to action in place of Begin

### 5.3 Active Quest
Design it to be readable from about 6 feet away, with large touch targets for sweaty hands.
- A huge overall countdown at the top
- The current exercise name in very large type, with its target (reps, or a station countdown)
- The **ⓘ** pop-up available on the current exercise
- "Next: …" preview
- A big **Done** button for rep stations
- Round counter ("Round 3 · Station 2/4")
- **Pause / Resume** (paused time doesn't count), and **End Quest**, which asks for confirmation
- **Cues:** a short beep at each transition and 3-2-1 beeps before timed segments end (Web Audio API). Call `navigator.vibrate` where supported; iOS Safari doesn't support it, so fail silently.
- **Screen Wake Lock API** while active, with graceful fallback if unsupported
- Resume on reload: if the app is closed mid-quest, restore state from local persistence. Offer Resume or End.

### 5.4 Victory
- Score ("3 rounds + 2"), with a "New best!" flag when it beats the personal best
- Energy Used, the Life Points change, and whether the fire is lit
- Weekly campaign progress, with a celebration banner when the weekly target is reached
- The dragon art for the user's current stage, using the promotion-screen styling
- **Continue the Quest** returns to the Journal

### 5.5 Ending early
"End Quest" asks for confirmation. If at least 1 minute of active time has passed, offer **Log what I did**, which logs the actual active time with the partial score. Otherwise discard.

---

## 6. Energy & Activity logging

- On completion (or a partial log), create **one** Activity entry through the existing logging path, named `Quest: <quest name>`.
- Duration is active time only, excluding pauses.
- Calories come from the existing MET function, using circuit-training METs by difficulty:
  - Beginner: 4.3
  - Intermediate: 6.0
  - Advanced: 8.0

  4.3 and 8.0 are the Compendium of Physical Activities values for moderate and vigorous circuit training; 6.0 is an interpolation. If the app already has a circuit-training MET, reconcile with it and flag the difference.
- Link the Activity to the QuestCompletion record (`activityId`). Never create a second Activity for the same completion.
- If the user deletes that Activity from the Journal, mark the completion `activityDeleted` and keep the score.
- Life Points, the fire, charts, and dragon logic all update through the existing Activity pipeline. No special-casing.

---

## 7. Data model (adapt to the existing storage layer)

- **ExerciseLibrary:** a static seed file in the repo (§11). No user writes.
- **QuestPreferences:** fields on the user profile (§3).
- **DailyQuest:** `userId, localDate, dayType, rerollIndex, name, flavor, stations[] (exerciseId, target, unit), transitions[], difficulty, durationMin, status (ready|active|completed|abandoned)`
- **QuestCompletion:** `id, userId, dailyQuestId, dayType, difficulty, durationMin, rounds, extraStations, activeSeconds, activityId, activityDeleted, completedAt, partial (bool)`
- **Personal best:** the highest score (rounds, then extra stations) among completions with the same `dayType + difficulty + durationMin`. Compute it on read or cache it.
- **Weekly campaign:** count completed, non-partial QuestCompletions in the current local week (Monday start). The target is 3.
- **Disclaimer acknowledgment:** a timestamp stored on the profile.

All new data respects existing auth and Guild checks server-side, not just in the UI.

---

## 8. Guild gating & paywall

- **Free users:** generation still runs so they see a real quest name, type, and length on the card. Starting a quest, rerolling, switching types, and seeing the exercise list all require Guild.
- Gate server-side wherever quest data is fetched or completions are written.
- **Paywall copy:** replace "Get exclusive fitness suggestions" with:
  **Daily Quests** — 15-minute home circuits matched to your gear and level

---

## 9. Safety

- **First-run disclaimer modal** before the first quest: "Quests are general fitness suggestions, not medical advice. Check with a doctor before starting a new exercise program. Stop if you feel pain, dizziness, or shortness of breath." Require **I understand** before continuing, and store the acknowledgment.
- No medical claims in quest copy.
- Form cues focus on safety (joint alignment, controlled movement).

---

## 10. Quest names & flavor lines

### Upper
- **Siege of the Iron Gate** — The gate won't lift itself.
- **Shieldwall at Dawn** — Brace, push, hold the line.
- **The Blacksmith's Trial** — Hammer, anvil, repeat.
- **Raising the Drawbridge** — Heavy chains, strong arms.
- **Storming the Battlements** — Up the walls, over the top.
- **The Archer's Draw** — Steady shoulders, true aim.
- **Forge of the Mountain King** — Iron is shaped in fire.
- **Hold the Line** — The wall stands because you do.

### Lower
- **March of the Mountain Pass** — The summit is earned one step at a time.
- **Through the Bog** — Lift your knees or lose your boots.
- **The Long Road to Fatburn Forest** — The trail never ends, only your excuses.
- **Climb of Mount Protein** — Every ledge makes you stronger.
- **Flight from the Troll Bridge** — Run now, rest later.
- **Ranger's Pursuit** — The quarry is fast. Be faster.
- **Stairs of the Endless Tower** — Count the steps, not the floors.
- **Crossing the Frozen River** — Light feet, strong legs.

### Full
- **Dungeons and Dumbbells** — Every room holds a trial.
- **The Dragon's Proving Grounds** — Your dragon is watching.
- **Ambush at Lake Nightrun** — No warning. No mercy.
- **Trial of the Ancient Wyrm** — Only the relentless pass.
- **Night Watch at the Keep** — Stay sharp until dawn.
- **Raid on the Goblin Camp** — Hit hard, move fast.
- **The Gauntlet** — Run it. Survive it.
- **Tournament of Champions** — The crowd wants a hero.

---

## 11. Exercise library (seed data)

**Fields:**
- `id`, `name`, `role` (upper | lower | full | core | cardio)
- `equipment` (array, any-of; empty = none)
- `needsSpace` (bool), `unit` (reps | seconds | steps)
- `targets` {beginner, intermediate, advanced}
- `cue` (short form cue, shown on Briefing and Active screens)
- `details` (full explanation for the ⓘ pop-up)

"Each side" exercises display "per side." For walking lunges, steps are counted as total steps.

### Upper
| id | Name | Equipment | Unit | B / I / A | Cue | Details (ⓘ) |
|---|---|---|---|---|---|---|
| pushups | Pushups | — | reps | 8 / 12 / 20 | Body in a straight line; chest to just above the floor. | Hands slightly wider than shoulders. Keep hips level with shoulders, lower until your chest is a few inches off the floor, then press back up. |
| incline_pushups | Incline Pushups | bench | reps | 10 / 15 / 20 | Hands on the bench; easier than floor pushups. | Place hands on a bench or sturdy chair, walk feet back until your body is straight, then lower your chest to the edge and press up. |
| decline_pushups | Decline Pushups | bench | reps | 6 / 10 / 15 | Feet on the bench; harder than floor pushups. | Place feet on a bench or sturdy chair and hands on the floor. Keep your core tight so your hips don't sag, lower your chest, then press up. |
| pike_pushups | Pike Pushups | — | reps | 5 / 8 / 12 | Hips high, lower your head toward the floor. | Start in a downward-dog shape with hips high. Bend your elbows to lower the top of your head toward the floor between your hands, then press back up. Targets the shoulders. |
| walking_pushups | Walking Pushups | — | reps | 6 / 10 / 14 | Pushup, walk sideways, pushup, walk back. | Do a standard pushup. At the top, move your left hand and left foot in to center, then move your right hand and right foot out. Do another pushup, then reverse the motion back to where you started. Repeat. Each pushup counts as one rep. |
| tricep_dips | Tricep Dips | bench | reps | 8 / 12 / 20 | Elbows straight back, shoulders down. | Sit on the edge of a bench or sturdy chair, hands beside your hips. Slide off the edge, bend your elbows straight back to lower until about 90°, then press up. Bend your knees to make it easier. |
| standing_chest_press | Standing Chest Press | bands, anchor | reps | 12 / 15 / 20 | Press away from your chest; control the return. | Wrap the band around a post or pole with your back to it, holding a handle in each hand. Walk forward until there's tension, then press both hands straight out in front of your chest and slowly bring them back. |
| front_raises | Front Raises | bands or dumbbells | reps | 10 / 12 / 15 | Straight arms forward to shoulder height. | Stand tall holding dumbbells or a band anchored under your feet. With arms straight, raise them in front of you to shoulder height, then lower slowly. Don't swing. |
| lateral_raises | Lateral Raises | bands or dumbbells | reps | 10 / 12 / 15 | Straight arms out to the sides, shoulder height. | Stand tall holding dumbbells or a band anchored under your feet. With arms nearly straight, raise them out to your sides to shoulder height, then lower slowly. |
| tricep_kickbacks | Tricep Kickbacks | dumbbells | reps | 10 / 12 / 15 per arm | Upper arm still; extend the forearm back. | Hinge forward with a flat back. Keep your upper arm against your side, elbow bent at 90°, and straighten your arm back until it's fully extended. Return slowly. |
| overhead_tricep_ext | Overhead Tricep Extensions | dumbbells | reps | 10 / 12 / 15 | Elbows point up; lower the weight behind your head. | Stand holding one dumbbell overhead with both hands. Keep elbows pointing up and close to your head, lower the weight behind your head, then straighten your arms. |
| standing_curls | Standing Curls | dumbbells | reps | 10 / 12 / 15 | Elbows pinned at your sides; no swinging. | Stand with dumbbells at your sides, palms forward. Curl up toward your shoulders keeping your elbows still, then lower slowly. |
| one_arm_rows | One Arm Rows | dumbbells | reps | 10 / 12 / 15 per arm | Flat back; pull the elbow toward your hip. | Place one hand and knee on a bench (or brace a hand on your knee in a staggered stance). Pull the dumbbell up toward your hip, squeezing your shoulder blade, then lower. |

### Lower
| id | Name | Equipment | Space | Unit | B / I / A | Cue | Details (ⓘ) |
|---|---|---|---|---|---|---|---|
| squats | Squats | — | | reps | 15 / 20 / 30 | Sit back, chest up, knees track over toes. | Feet shoulder-width apart. Push your hips back and bend your knees until your thighs are about parallel to the floor, then stand up through your heels. |
| jump_squats | Jump Squats | — | | reps | 8 / 12 / 20 | Squat, explode up, land softly. | Lower into a squat, then jump straight up. Land softly with bent knees and go straight into the next rep. |
| wall_sits | Wall Sits | — | | seconds | 30 / 45 / 60 | Back flat on the wall, thighs parallel. | Slide your back down a wall until your knees are at about 90°, with knees above your ankles. Hold. |
| walking_lunges | Walking Lunges | — | ✓ | steps | 10 / 16 / 20 | Long step, back knee toward the floor. | Step forward and lower until both knees are at about 90°, then push up and step through into the next lunge. In a room, go back and forth. |
| backward_walking_lunges | Backward Walking Lunges | — | ✓ | steps | 10 / 16 / 20 | Step back, lower, keep the chest up. | Step backward into a lunge, lowering until both knees are at about 90°, then continue stepping backward with the other leg. Go back and forth across the room. |
| in_place_lunges | Alternating In-Place Lunges | — | | reps | 10 / 16 / 24 | Step forward, lower, return; switch legs. | Step one foot forward, lower until both knees are at about 90°, push back to standing, then alternate legs. Count total reps. |
| side_hops | Side Hops | — | | reps | 20 / 30 / 40 | Two feet together, hop side to side. | Feet together, hop sideways over an imaginary line, then immediately hop back. Each hop counts. Stay light on the balls of your feet. |
| bunny_hops | Bunny Hops | — | ✓ | reps | 10 / 15 / 20 | Two-foot hops forward and back. | Feet together, make small two-footed hops forward. In a room, hop forward a few times, then back. Land softly with bent knees. |

### Full body (Full days only)
| id | Name | Equipment | Space | Unit | B / I / A | Cue | Details (ⓘ) |
|---|---|---|---|---|---|---|---|
| wall_sit_press | Wall Sit + Shoulder Press | dumbbells | | reps | 8 / 10 / 12 | Hold the wall sit while pressing overhead. | Get into a wall sit with a dumbbell in each hand at your shoulders. While holding the wall sit, do the full set of shoulder press reps, pressing straight overhead and lowering back to your shoulders. Stand up only after the last rep. |
| burpees | Burpees | — | | reps | 5 / 10 / 15 | Squat, kick back, chest down, jump up. | Squat and place your hands on the floor, jump your feet back to a plank, lower your chest to the floor, push up, jump your feet back in, then jump up with arms overhead. Step instead of jumping to make it easier. |
| bear_crawl | Bear Crawl | — | ✓ | seconds | 20 / 30 / 45 | Knees an inch off the floor, crawl forward. | On hands and toes with knees bent and hovering just off the floor, crawl forward by moving opposite hand and foot together. Keep your back flat. Go back and forth across the room. |
| crab_walk | Crab Walk | — | ✓ | seconds | 20 / 30 / 45 | Hips up, walk on hands and feet. | Sit, place your hands behind you with fingers pointing toward your feet, and lift your hips. Walk on your hands and feet, keeping your hips up. Go back and forth across the room. |

### Core
| id | Name | Unit | B / I / A | Cue | Details (ⓘ) |
|---|---|---|---|---|---|
| low_plank | Low Plank | seconds | 20 / 40 / 60 | On forearms, straight line head to heels. | Forearms on the floor, elbows under your shoulders. Squeeze your core and glutes so your hips don't sag or pike. Hold. |
| crunches | Crunches | reps | 15 / 20 / 30 | Lift your shoulders, not your neck. | Lie on your back, knees bent, hands lightly behind your head. Curl your shoulders off the floor using your abs, then lower. Don't pull on your neck. |
| leg_raises | Leg Raises | reps | 10 / 15 / 20 | Lower back pressed down; slow lower. | Lie on your back, legs straight, hands under your hips. Raise your legs to vertical, then lower slowly without letting your lower back arch off the floor. Bend your knees to make it easier. |
| side_plank | Side Plank | seconds | 15 / 25 / 40 per side | Straight line, hips lifted. | Lie on your side, propped on one forearm with the elbow under your shoulder. Lift your hips so your body forms a straight line. Hold, then switch sides. Drop the bottom knee to make it easier. |
| dead_bugs | Dead Bugs | reps | 10 / 16 / 20 | Opposite arm and leg extend; back stays flat. | Lie on your back with arms pointing up and knees bent at 90° above your hips. Slowly extend your opposite arm and leg toward the floor, return, then switch. Keep your lower back pressed down. Count total reps. |

### Cardio (transitions only)
Transition lengths: Beginner 20s, Intermediate 30s, Advanced 40s.

| id | Name | Cue | Details (ⓘ) |
|---|---|---|---|
| mountain_climbers | Mountain Climbers | Plank position, drive the knees fast. | From a high plank, drive one knee toward your chest, then quickly switch legs in a running motion. Keep hips level. |
| high_knees | High Knees | Knees to hip height, quick feet. | Run in place, driving your knees up to hip height and pumping your arms. |
| running_in_place | Running in Place | Light, quick steps. | Jog in place on the balls of your feet at a steady, quick pace. |
| jumping_jacks | Jumping Jacks | Arms and legs out and in together. | Jump your feet out wide while raising your arms overhead, then jump back together with arms at your sides. Step side to side to make it easier. |

---

## 12. Acceptance criteria

- [ ] Preferences save and affect the next generated quest.
- [ ] The same user, date, day type, and reroll index always produce the same quest.
- [ ] No quest includes equipment the user lacks, or `needsSpace` exercises when space is off.
- [ ] Every circuit has exactly 1 core station. Full days include at least 1 upper and 1 lower.
- [ ] Day type rotates by the last completed quest.
- [ ] The timer, pause, Done, auto-advance, and round counting are accurate. Pauses are excluded from active time.
- [ ] The Active Quest screen survives an app reload mid-quest.
- [ ] Completion creates exactly one Activity with correct MET-based calories. Life Points, the fire, and charts update.
- [ ] Personal bests and the weekly campaign count are correct across timezones and the Monday week boundary.
- [ ] Free users see the locked card and blurred briefing, and can't start, reroll, or write completions. Gating is enforced server-side.
- [ ] The disclaimer appears once, before the first quest.
- [ ] The paywall copy is updated.
- [ ] Every ⓘ pop-up shows the exercise's details text.
- [ ] Usable on a phone: large type and targets, wake lock where supported, no layout breaks across themes.

---

## 13. Build order

1. Exercise library seed file, plus unit tests for filtering and composition rules
2. Quest Preferences on the Character Sheet
3. The quest generator (pure function, seeded), with tests
4. DailyQuest and QuestCompletion storage, plus server-side Guild gating
5. Journal quest card (Guild and locked states)
6. Briefing screen, with the ⓘ pop-up, rerolls, and the day type switcher
7. Active Quest screen: timer engine, cues, wake lock, reload recovery
8. Victory screen, Activity logging, personal bests, weekly campaign
9. Disclaimer modal and paywall copy update
10. End-to-end pass against §12
