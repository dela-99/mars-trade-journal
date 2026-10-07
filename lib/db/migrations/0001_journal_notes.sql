CREATE TABLE IF NOT EXISTS journal_notes (
  id serial PRIMARY KEY,
  date date NOT NULL,
  time_zone varchar(100) NOT NULL,
  title varchar(200) NOT NULL,
  body text NOT NULL,
  link_mode varchar(8) NOT NULL CHECK (link_mode IN ('date', 'selected')),
  selected_trade_ids jsonb NOT NULL,
  attachments jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
