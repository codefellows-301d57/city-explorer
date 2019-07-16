'use strict';

// APP dependencies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

// Global vars
const PORT = process.env.PORT || 3009;

// PostgreSQL setup
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', e => console.error(e));

// Makes the server
const app = express();
app.use(cors());

// app.get('/location', <function-reference>) is a route
app.get('/location', searchToLatLng);
app.get('/weather', searchToWeather);
app.get('/yelp', searchToYelp);
app.get('/events', searchToEvents);
app.get('/movies', searchToMovies);
app.get('/trails', searchToHikes);
app.use('*', (request, response) => response.send('you got to the wrong place'));

// DB creators
const locationDbSelect = `SELECT * FROM locations WHERE search_query=$1`;
const weatherDbSelect = `SELECT * FROM weathers WHERE location_id=$1`;
const yelpDbSelect = `SELECT * FROM yelp WHERE location_id=$1`;
const eventDbSelect = `SELECT * FROM events WHERE location_id=$1`;
const movieDbSelect = `SELECT * FROM movies WHERE location_id=$1`;
const hikeDbSelect = `SELECT * FROM hikes WHERE location_id=$1`;

// Error message
const errors = (response, e, location) => {
  console.error(e);
  response.status(500).send(`Status 500: Sorry, something went wrong when getting the data for ${location.formatted_query}`);
}

// Constructors
function Location(query, result){
  this.search_query = query;
  this.formatted_query = result.body.results[0].formatted_address;
  this.latitude = result.body.results[0].geometry.location.lat;
  this.longitude = result.body.results[0].geometry.location.lng;
}

function Weather(weather){
  this.forecast = weather.summary;
  this.time = new Date(weather.time * 1000).toDateString();
}

function Yelp(yelp){
  this.name = yelp.name;
  this.image_url = yelp.image_url;
  this.price = yelp.price;
  this.rating = yelp.rating;
  this.url = yelp.url;
}

function Event(event){
  this.link = event.url;
  this.name = event.name.text;
  this.event_date = new Date(event.start.local).toDateString();
  this.summary = event.description.text;
}

function Movie(movie){
  this.title = movie.title;
  this.overview = movie.overview;
  this.average_votes = movie.vote_average;
  this.total_votes = movie.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
  this.popularity = movie.popularity;
  this.released_on = movie.release_date;
}

function Hike(hike){
  this.name = hike.name;
  this.location = hike.location;
  this.trail_length = hike.length;
  this.stars = hike.stars;
  this.star_votes = hike.starVotes;
  this.summary = hike.summary;
  this.trail_url = hike.url;
  this.conditions = hike.conditionStatus;
  this.condition_date = hike.conditionDate.substring(0, 10);
  this.condition_time = hike.conditionDate.substring(12, 20);
}

// Table Client Query
const insertIntoLocation = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4)`;
const insertIntoWeather = `INSERT INTO weathers (forecast, time, created_at, location_id) VALUES ($1, $2, $3, $4)`;
const insertIntoYelp = `INSERT INTO yelp (name, image_url, price, rating, url, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`;
const insertIntoEvent = `INSERT INTO events (link, name, event_date, summary, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6)`;
const insertIntoMovie = `INSERT INTO movies (title, overview, average_votes, total_votes, image_url, popularity, released_on, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
const insertIntoHikes = `INSERT INTO hikes (name, location, trail_length, stars, star_votes, summary, trail_url, conditions, condition_date, condition_time, created_at, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;

const locationFromTable = (value) => [value.search_query, value.formatted_query, value.latitude, value.longitude];
const weatherFromTable = (value, time, locationId) => [value.forecast, value.time, time, locationId];
const yelpFromTable = (value, time, locationId) => [value.name, value.image_url, value.price, value.rating, value.url, time, locationId];
const eventFromTable = (value, time, locationId) => [value.link, value.name, value.event_date, value.summary, time, locationId];
const movieFromTable = (value, time, locationId) => [value.title, value.overview, value.average_votes, value.total_votes, value.image_url, value.popularity, value.released_on, time, locationId];
const hikesFromTable = (value, time, locationId) => [value.name, value.location, value.trail_length, value.stars, value.star_votes, value.summary, value.trail_url, value.conditions, value.condition_date, value.condition_time, time, locationId];

function tableClientQuery(insertIntoTable, dataFromTable, value, time, locationId){
  client.query(
    insertIntoTable, dataFromTable(value, time, locationId)
  );
}

// Query Functions
function clientQuery(requestData, dbToSelect, url, arr, pathMapper, insertIntoTable, dataFromTable, Obj, response, tableQueried, time, authVar){
  client.query(`SELECT * FROM locations WHERE search_query=$1`, [requestData])
    .then(sqlResult => {
      const locationId = sqlResult.rows[0].id;
      querySpecifiedTable(dbToSelect, locationId, Obj, url, response, pathMapper, arr, insertIntoTable, dataFromTable, tableQueried, time, authVar);
    }).catch(e => {
      errors(response, e, requestData);
    });
}

function querySpecifiedTable(dbToSelect, locationId, Obj, url, response, pathMapper, arr, insertIntoTable, dataFromTable, tableQueried, time, authVar=''){
  client.query(dbToSelect, [locationId])
    .then(res => {
      timeQuery(tableQueried, locationId);
      if(res.rowCount === 0){
        console.log(`getting data from ${tableQueried} API`);
        superagent.get(url).set('Authorization', authVar)
          .then(result => {
            queryFunc(result, Obj, response, pathMapper, arr, locationId, insertIntoTable, dataFromTable, time);
          })
      } else {
        console.log(`sending data from ${tableQueried} DB`);
        response.send(res.rows);
      }
    })
}

function timeQuery(tableQueried, locationId){
  client.query(`SELECT created_at FROM ${tableQueried} WHERE location_id=${locationId}`)
    .then(res => {
      // let nowFromDb;
      const currentTime = Date.now();
      if(res.rows.length !== 0){
        let nowFromDb = parseInt(Object.values(res.rows[0]));
        let timeDifference = currentTime - nowFromDb;
        timeDifference = timeDifference / 60000;
        if(timeDifference > 1){
          console.log(`deleted rows from ${tableQueried} table after 1 minute check`);
          client.query(`DELETE FROM ${tableQueried} WHERE location_id=${locationId}`);
        }
      }
    })
}

function queryFunc(result, Obj, response, pathMapper, arr, locationId, insertIntoTable, dataFromTable, time){
  pathMapper(result).map(finalRes => arr.push(new Obj(finalRes)));
  arr.forEach(value => {
    tableClientQuery(insertIntoTable, dataFromTable, value, time, locationId)
  })
  response.send(arr);
}

// Response builders
function searchToLatLng(request, response){
  console.log('\n************************************')
  const locationName = request.query.data;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${locationName}&key=${process.env.GEOCODE_API_KEY}`;

  client.query(locationDbSelect, [locationName])
    .then(sqlResult => {
      if(sqlResult.rowCount === 0){
        console.log('getting location date from API')
        superagent.get(url)
          .then( result => {
            const location = new Location(locationName, result);
            tableClientQuery(insertIntoLocation, locationFromTable, location);
            response.send(location);
          })
      } else {
        console.log('sending location data from DB')
        response.send(sqlResult.rows[0]);
      }
    }).catch(e => {
      errors(response, e, locationName);
    });
}

function searchToWeather(request, response){
  const now = Date.now();
  const weatherData = request.query.data;
  const locationName = request.query.data.search_query;
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${weatherData.latitude},${weatherData.longitude}`;
  const weatherArr = [];
  const weatherPathMapper = result => result.body.daily.data;
  clientQuery(locationName, weatherDbSelect, url, weatherArr, weatherPathMapper, insertIntoWeather, weatherFromTable, Weather, response, 'weathers', now);
}

function searchToYelp(request, response){
  const now = Date.now();
  const yelpData = request.query.data;
  const locationName = request.query.data.search_query;
  const url = `https://api.yelp.com/v3/businesses/search?latitude=${yelpData.latitude}&longitude=${yelpData.longitude}`;
  const yelpArr = [];
  const yelpPathMapper = result => result.body.businesses;
  clientQuery(locationName, yelpDbSelect, url, yelpArr, yelpPathMapper, insertIntoYelp, yelpFromTable, Yelp, response, 'yelp', now, `Bearer ${process.env.YELP_API_KEY}`);
}

function searchToEvents(request, response){
  const now = Date.now();
  const eventsData = request.query.data;
  const locationName = request.query.data.search_query;
  const url = `https://www.eventbriteapi.com/v3/events/search/?location.latitude=${eventsData.latitude}&location.longitude=${eventsData.longitude}&token=${process.env.EVENTBRITE_API_KEY}`;
  const eventArr = [];
  const eventPathMapper = result => result.body.events;
  clientQuery(locationName, eventDbSelect, url, eventArr, eventPathMapper, insertIntoEvent, eventFromTable, Event, response, 'events', now);
}

function searchToMovies(request, response){
  const now = Date.now();
  const locationName = request.query.data.search_query;
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${locationName}`;
  const movieArr = [];
  const moviePathMapper = result => result.body.results;
  clientQuery(locationName, movieDbSelect, url, movieArr, moviePathMapper, insertIntoMovie, movieFromTable, Movie, response, 'movies', now);
}

function searchToHikes(request, response){
  const now = Date.now();
  const hikesData = request.query.data;
  const locationName = request.query.data.search_query;
  const url = `https://www.hikingproject.com/data/get-trails?lat=${hikesData.latitude}&lon=${hikesData.longitude}&maxDistance=10&key=${process.env.TRAIL_API_KEY}`;
  const hikesArr = [];
  const hikePathMapper = result => result.body.trails;
  clientQuery(locationName, hikeDbSelect, url, hikesArr, hikePathMapper, insertIntoHikes, hikesFromTable, Hike, response, 'hikes', now);
}

// Start the server
app.listen(PORT, () => console.log(`app is up on port ${PORT}`));
