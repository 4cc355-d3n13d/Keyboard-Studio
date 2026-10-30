CREATE TABLE orbit_mcp_sessions (
 id text PRIMARY KEY NOT NULL,
 user_id text NOT NULL,
 label text NOT NULL,
 snapshot text NOT NULL,
 updated_at integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX orbit_mcp_sessions_owner ON orbit_mcp_sessions(user_id, updated_at);
--> statement-breakpoint
CREATE TABLE orbit_mcp_commands (
 id text PRIMARY KEY NOT NULL,
 user_id text NOT NULL,
 session_id text NOT NULL,
 tool text NOT NULL,
 arguments text NOT NULL,
 created_at integer NOT NULL,
 expires_at integer NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 result text
);
--> statement-breakpoint
CREATE INDEX orbit_mcp_commands_queue ON orbit_mcp_commands(session_id, user_id, status, created_at);
