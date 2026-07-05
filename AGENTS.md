# Analytics Tracking - Mixpanel

This project uses Mixpanel for product analytics. Do not add another product analytics SDK unless the user explicitly asks for it.

## Tech Stack

| Detail | Value |
|---|---|
| Platform | Static vanilla HTML/CSS/JavaScript game |
| Mixpanel SDK | Browser JavaScript SDK loaded from `https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js` |
| Tracking method | Direct client-side SDK |
| CDP | None |
| Consent required | Yes, California-safe consent gate before SDK initialization |
| Token location | `index.html` -> `window.HASAN_ANALYTICS_CONFIG.mixpanelToken` |
| Analytics helper | `analytics.js` |
| Game tracking calls | `game.js` |

## Initialization

Mixpanel is initialized only in `analytics.js`. The SDK is not loaded until the player grants consent through the analytics consent bar.

Use `trackGameEvent(...)` in `game.js`, which delegates to `window.HasanAnalytics.trackEvent(...)`. Do not call `window.mixpanel.track(...)` directly from gameplay code.

## Identity

The game identifies a player after a username is saved:

| Action | Code location |
|---|---|
| `identify()` with `hasan_frenzy:${playerName.toLowerCase()}` | `game.js` -> `identifyPlayer()` |
| Profile update with player name and preferred level | `game.js` -> `identifyPlayer()` |

There is no logout flow in this game. If a logout or switch-user flow is added later, call `mixpanel.reset()` through the analytics helper before identifying a different player.

## Shared Properties

Every event automatically includes:

- `game_name`
- `app_version`
- `player_name`
- `level`
- `score`
- `best_score_overall`
- `best_score_easy`
- `best_score_medium`
- `best_score_hard`
- `sound_enabled`
- `game_state`
- `device_type`
- `viewport_width`
- `viewport_height`
- `timestamp_iso`
- `analytics_consent`

## Current Events

Event names follow the user-provided tracking spec. Property names use `snake_case`.

| Event | Trigger | Key Properties | File |
|---|---|---|---|
| `Game Opened` | Page/app opens after analytics consent is available | `has_existing_best_score`, best score fields | `game.js` |
| `Game Started` | A new playable run starts | `starting_score`, `best_score_level`, `control_method`, `board_size`, `snake_initial_length` | `game.js` |
| `Game Paused` | User manually pauses | `snake_length`, `elapsed_seconds`, food counters, `reason` | `game.js` |
| `Game Resumed` | User resumes after pause | `pause_duration_seconds`, `elapsed_seconds`, `snake_length` | `game.js` |
| `Food Eaten` | Hasan eats regular gorengan | `food_type`, before/after score, before/after snake length, position | `game.js` |
| `Special Item Eaten` | Hasan eats `sate_usus` | `item_type`, before/after score, `spawn_duration_seconds`, position | `game.js` |
| `Poison Eaten` | Hasan eats `chiki_kadaluwarsa` | `poison_type`, `penalty_type`, before/after score, position | `game.js` |
| `Game Over` | Run ends; this is the value moment | final score, best score before/after, counters, `death_reason`, `average_score_per_minute` | `game.js` |
| `Level Changed` | User changes difficulty | `from_level`, `to_level`, `current_score`, `game_state` | `game.js` |
| `Sound Toggled` | User toggles sound | `sound_enabled`, `game_state`, `level`, `score` | `game.js` |
| `Game Reset` | User clicks Reset | `level`, `score`, `game_state`, `elapsed_seconds` | `game.js` |
| `Leaderboard Viewed` | Leaderboard data loads | `selected_level`, `leaderboard_scope`, entries count, player ranks | `game.js` |
| `Leaderboard Data Reset` | Admin reset succeeds | `reset_scope`, `previous_best_score`, `previous_entries_count` | `game.js` |

## Rules

- Do not track every snake movement step.
- Do not send emails, phone numbers, payment data, or sensitive personal fields to Mixpanel.
- Keep event and property enum values lowercase where applicable.
- Update this file whenever a new Mixpanel event is added.
- Verify new events in Mixpanel Live View before considering analytics changes complete.
