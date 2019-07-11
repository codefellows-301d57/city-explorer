DROP TABLE IF EXISTS weathers;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS locations;

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(255),
  formatted_query VARCHAR(255),
  latitude FLOAT,
  longitude FLOAT
);

CREATE TABLE weathers (
  id SERIAL PRIMARY KEY,
  forecast VARCHAR(225),
  time VARCHAR(225),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

-- TODO: create events table
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  link TEXT,
  name TEXT,
  event_date TEXT,
  summary TEXT,
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

-- FOR HEROKU
-- git push heroku master (like normal)
-- heroku pg:push city_explorer DATABASE_URL