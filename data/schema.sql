DROP TABLE IF EXISTS location, weather, events, movies, yelp;

CREATE TABLE location (
  id SERIAL PRIMARY KEY,
  latitude DECIMAL,
  longitude DECIMAL,
  formatted_query VARCHAR(255),
  search_query VARCHAR(255)
);

CREATE TABLE weather (
  id SERIAL PRIMARY KEY,
  forecast VARCHAR(255),
  time VARCHAR(255),
  created_at BIGINT,
  location_id INTEGER NOT NULL REFERENCES location(id)
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  link VARCHAR(255),
  name VARCHAR(255),
  event_date VARCHAR(15),
  summary TEXT,
  created_at BIGINT,
  location_id INTEGER NOT NULL REFERENCES location(id)
);

CREATE TABLE movies (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  overview TEXT,
  average_votes DECIMAL,
  total_votes DECIMAL,
  image_url VARCHAR(255),
  popularity DECIMAL,
  released_on VARCHAR(15),
  created_at BIGINT,
  location_id INTEGER NOT NULL REFERENCES location(id)
);

CREATE TABLE yelp (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  image_url VARCHAR(255),
  price VARCHAR(15),
  rating DECIMAL,
  url VARCHAR(255),
  created_at BIGINT,
  location_id INTEGER NOT NULL REFERENCES location(id)
);
