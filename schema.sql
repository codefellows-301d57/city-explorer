DROP TABLE IF EXISTS weathers;
DROP TABLE IF EXISTS yelp;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS hikes;
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
  created_at BIGINT,
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE yelp (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  image_url TEXT,
  price VARCHAR(255),
  rating FLOAT,
  url TEXT,
  created_at BIGINT,
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  link TEXT,
  name TEXT,
  event_date TEXT,
  summary TEXT,
  created_at BIGINT,
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE movies (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  overview TEXT,
  average_votes FLOAT,
  total_votes INTEGER,
  image_url TEXT,
  popularity FLOAT,
  released_on VARCHAR(225),
  created_at BIGINT,
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE hikes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  location VARCHAR(255),
  trail_length FLOAT,
  stars FLOAT,
  star_votes INTEGER,
  summary TEXT,
  trail_url TEXT,
  conditions VARCHAR(255),
  condition_date VARCHAR(255),
  condition_time VARCHAR(255),
  created_at BIGINT,
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

-- FOR HEROKU
-- git push heroku master (like normal)
-- heroku pg:push city_explorer DATABASE_URL