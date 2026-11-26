CREATE TABLE playtest_events (
 id TEXT PRIMARY KEY NOT NULL,
 session_id TEXT NOT NULL,
 build TEXT NOT NULL,
 name TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 elapsed_ms INTEGER NOT NULL,
 active_ms INTEGER NOT NULL,
 payload TEXT NOT NULL,
 received_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX playtest_events_session ON playtest_events(session_id, elapsed_ms);
--> statement-breakpoint
CREATE INDEX playtest_events_name ON playtest_events(build, name, received_at);
--> statement-breakpoint
CREATE TABLE playtest_feedback (
 id TEXT PRIMARY KEY NOT NULL,
 session_id TEXT NOT NULL,
 build TEXT NOT NULL,
 unclear TEXT NOT NULL,
 frustrating TEXT NOT NULL,
 continue_playing TEXT NOT NULL,
 bug TEXT NOT NULL,
 elapsed_ms INTEGER NOT NULL,
 received_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
