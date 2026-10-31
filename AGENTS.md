# Project conventions
- Centralize road-role classification and aggregation in browser-safe helpers shared by recording, maps, coverage and stats so legacy road trips and new roles remain consistent.
- Parse Rovy CSV and selected ZIP entries in browser-safe helpers; authenticated import functions insert only with a per-owner source-ID unique index so retries cannot alter existing trips.
- Persist imported durations separately and prefer them over elapsed timestamps in saved-trip displays and statistics to preserve recorded moving time.
- Process persisted pending Rovy destination names sequentially in a root-mounted signed-in queue so imports remain fast and interrupted lookups can resume.
- Keep the Rovy import page client-rendered because its protected initial loader requires the browser-held session on hard refresh.