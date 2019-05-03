DROP TABLE IF EXISTS location, weather, events;

CREATE TABLE location (
  id SERIAL PRIMARY KEY,
  latitude DECIMAL,
  longitude DECIMAL,
  formatted_query VARCHAR(255),
  search_query VARCHAR(255)
);

CREATE TABLE weather (
  forecast VARCHAR(512),
  time CHAR(15),
  created_at BIGINT,
  location_id INTEGER REFERENCES location(id)
);

CREATE TABLE events (
  formatted_query VARCHAR(255),
  link VARCHAR(255),
  name VARCHAR(255),
  event_date VARCHAR(255),
  summary TEXT
)