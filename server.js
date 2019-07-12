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
app.get('/events', searchToEvents);
app.get('/trails', searchToHikes);
app.use('*', (request, response) => response.send('you got to the wrong place'));

//DB creators
const locationDbSelect = `SELECT * FROM locations WHERE search_query=$1`;
function locationClientQuery(location, response){
  client.query(
    `INSERT INTO locations (
      search_query,
      formatted_query,
      latitude,
      longitude
    ) VALUES ($1, $2, $3, $4)`,
    [location.search_query, location.formatted_query, location.latitude, location.longitude]
  );
  response.send(location);
}

const weatherDbSelect = `SELECT * FROM weathers WHERE location_id=$1`;
function weatherMapper(result){
  return result.body.daily.data;
}
function weatherClientQuery(value, locationId){
  client.query(
    `INSERT INTO weathers (
      forecast,
      time,
      location_id
    ) VALUES ($1, $2, $3)`,
    [value.forecast, value.time, locationId]
  );
}

const eventDbSelect = `SELECT * FROM events WHERE location_id=$1`;
function eventMapper(result){
  return result.body.events;
}
function eventClientQuery(value, locationId){
  client.query(
    `INSERT INTO events (
      link,
      name,
      event_date,
      summary,
      location_id
    ) VALUES ($1, $2, $3, $4, $5)`,
    [value.link, value.name, value.event_date, value.summary, locationId]
  );
}

const hikeDbSelect = `SELECT * FROM hikes WHERE location_id=$1`;
function hikeMapper(result){
  return result.body.trails;
}
function hikeClientQuery(value, locationId){
  client.query(
    `INSERT INTO hikes (
      name,
      location,
      trail_length,
      stars,
      star_votes,
      summary,
      trail_url,
      conditions,
      condition_date,
      condition_time,
      location_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [value.name, value.location, value.trail_length, value.stars, value.star_votes, value.summary, value.trail_url, value.conditions, value.condition_date, value.condition_time, locationId]
  );
}

// Constructors
function Location(query, result){
  this.search_query = query;
  this.formatted_query = result.body.results[0].formatted_address;
  this.latitude = result.body.results[0].geometry.location.lat;
  this.longitude = result.body.results[0].geometry.location.lng;
}

function Weather(weatherData){
  const time = new Date(weatherData.time * 1000).toDateString();
  this.forecast = weatherData.summary;
  this.time = time;
}

function Event(event){
  const date = new Date(event.start.local).toDateString();
  this.link = event.url;
  this.name = event.name.text;
  this.event_date = date;
  this.summary = event.description.text;
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

//Query Functions
function clientQuery(requestData, dbToSelect, url, arr, querier, mapper, internalQuery, Obj, response, rower){
  client.query(`SELECT * FROM locations WHERE search_query=$1`, [requestData])
    .then(sqlResult => {
      const locationId = sqlResult.rows[0].id;
      querySpecifiedTable(dbToSelect, locationId, Obj, rower, url, querier, response, mapper, arr, internalQuery);
    }).catch(e => {
      errors(response, e, requestData);
    });
}

function querySpecifiedTable(dbToSelect, locationId, Obj, rower, url, querier, response, mapper, arr, internalQuery){
  client.query(dbToSelect, [locationId])
    .then(res => {
      if(res.rowCount === 0){
        console.log('getting the data from API');
        superagent.get(url)
          .then(result => {
            querier(result, Obj, response, mapper, arr, locationId, internalQuery);
          })
      } else {
        console.log('sending the data from DB');
        response.send(res[rower]);
      }
    })
}

function queryFunc(result, Obj, response, mapper, arr, locationId, querier){
  mapper(result).map(finalRes => arr.push(new Obj(finalRes)));
  arr.forEach(value => {
    querier(value, locationId)
  })
  response.send(arr);
}

// Response builders
function searchToLatLng(request, response){
  const locationName = request.query.data;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${locationName}&key=${process.env.GEOCODE_API_KEY}`;

  client.query(locationDbSelect, [locationName])
    .then(sqlResult => {
      if(sqlResult.rowCount === 0){
        //Get the location data from API
        console.log('getting the location data from API')
        superagent.get(url)
          .then( result => {
            const location = new Location(locationName, result);
            locationClientQuery(location, response);
          })
      } else {
        //Get the location data from DB
        console.log('sending the location data from DB')
        response.send(sqlResult.rows[0]);
      }
    }).catch(e => {
      errors(response, e, locationName);
    });
}

function searchToWeather(request, response){
  const locationName = request.query.data;
  const weatherData = request.query.data.search_query;
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${locationName.latitude},${locationName.longitude}`;
  const weatherArr = [];
  clientQuery(weatherData, weatherDbSelect, url, weatherArr, queryFunc, weatherMapper, weatherClientQuery, Weather, response, 'rows');
}

function searchToEvents(request, response){
  const locationName = request.query.data;
  const eventsData = request.query.data.search_query;
  const url = `https://www.eventbriteapi.com/v3/events/search/?location.latitude=${locationName.latitude}&location.longitude=${locationName.longitude}&token=${process.env.EVENTBRITE_API_KEY}`;
  const eventArr = [];
  clientQuery(eventsData, eventDbSelect, url, eventArr, queryFunc, eventMapper, eventClientQuery, Event, response, 'rows');
}

function searchToHikes(request, response){
  const locationName = request.query.data;
  const hikesData = request.query.data.search_query;
  // const url = `https://www.hikingproject.com/data/get-trails?lat=${locationName.latitude}&lon=${locationName.longitude}&maxDistance=10&key=${process.env.TRAIL_API_KEY}`;
  const url = `https://www.hikingproject.com/data/get-trails?lat=${locationName.latitude}&lon=${locationName.longitude}&maxDistance=10&key=${process.env.TRAIL_API_KEY}`;
  const hikesArr = [];
  clientQuery(hikesData, hikeDbSelect, url, hikesArr, queryFunc, hikeMapper, hikeClientQuery, Hike, response, 'rows');
}

//Error message
const errors = (response, e, location) => {
  console.error(e);
  response.status(500).send(`Status 500: Sorry, something went wrong when getting the data for ${location.formatted_query}`);
}

// Start the server
app.listen(PORT, () => console.log(`app is up on port ${PORT}`));
