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
// app.get('/hikes', searchToHikes);
app.use('*', (request, response) => response.send('you got to the wrong place'));

// Response builders
function searchToLatLng(request, response){
  const locationName = request.query.data;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${locationName}&key=${process.env.GEOCODE_API_KEY}`;

  client.query(`SELECT * FROM locations WHERE search_query=$1`, [locationName])
    .then(sqlResult => {
      if(sqlResult.rowCount === 0){
        //Get the data from API
        console.log('getting new data from API')
        superagent.get(url)
          .then( result => {
            const location = new Location(locationName, result);
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
          }).catch(e => {
            errors(response, e, locationName);
          });
      } else {
        //Get data from database
        console.log('sending from DB')
        response.send(sqlResult.rows[0]);
      }
    });
}

function searchToWeather(request, response){
  const locationName = request.query.data;
  const weatherData = request.query.data.search_query;
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${locationName.latitude},${locationName.longitude}`;
  const weatherArr = [];

  client.query(`SELECT * FROM locations WHERE search_query=$1`, [weatherData])
    .then(sqlResult => {
      if(sqlResult.rowCount === 0){
        console.log('/weather if no row', sqlResult.rowCount);
        superagent.get(url)
          .then(result => {
            result.body.daily.data.map(dailyWeather => weatherArr.push(new Weather(dailyWeather)));
            response.send(weatherArr);
          })
      } else {
        const locationId = sqlResult.rows[0].id;
        client.query(`SELECT * FROM weathers WHERE location_id=$1`, [locationId])
          .then(weatherResult => {
            if(weatherResult.rowCount === 0){
              //Get the data from API
              console.log('getting new data from API')
              superagent.get(url)
                .then( result => {
                  result.body.daily.data.map(dailyWeather => weatherArr.push(new Weather(dailyWeather)));
                  weatherArr.forEach(value => {
                    client.query(
                      `INSERT INTO weathers (
                      forecast,
                      time,
                      location_id
                      ) VALUES ($1, $2, $3)`,
                      [value.forecast, value.time, locationId]
                    );
                  })
                  response.send(weatherArr);
                });
            } else {
              //Get data from database
              console.log('sending from DB')
              response.send(sqlResult.rows[0]);
            }
          });
      }
    }).catch(e => {
      errors(response, e, weatherData);
    });
}

function searchToEvents(request, response){
  const locationName = request.query.data;
  const eventsData = request.query.data.search_query;
  const url = `https://www.eventbriteapi.com/v3/events/search/?location.latitude=${locationName.latitude}&location.longitude=${locationName.longitude}&token=${process.env.EVENTBRITE_API_KEY}`;
  const eventArr = [];

  client.query(`SELECT * FROM locations WHERE search_query=$1`, [eventsData])
    .then(sqlResult => {
      if(sqlResult.rowCount === 0){
        superagent.get(url)
          .then(result => {
            result.body.events.map(event => eventArr.push(new Event(event)));
            response.send(eventArr);
          })
      } else {
        const locationId = sqlResult.rows[0].id;
        client.query(`SELECT * FROM events WHERE location_id=$1`, [locationId])
          .then(eventResult => {
            if(eventResult.rowCount === 0){
              //Get the data from API
              console.log('getting new data from API')
              superagent.get(url)
                .then( result => {
                  // console.log(result.body.events);
                  result.body.events.map(events => eventArr.push(new Event(events)));
                  eventArr.forEach(value => {
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
                  })
                  response.send(eventArr);
                });
            } else {
              //Get data from database
              console.log('sending from DB')
              response.send(sqlResult.rows[0]);
            }
          });
      }
    }).catch(e => {
      errors(response, e, eventsData);
    });
}

// function searchToHikes(request, response){
//   const hikesData = request.query.data;
//   const url = `https://www.hikingproject.com/data/get-trails?lat=${hikesData.latitude}&lon=${hikesData.longitude}&maxDistance=10&key=${process.env.TRAIL_API_KEY}`;
//   const hikesArr = [];
//   superagent.get(url)
//     .then( result => {
//       result.body.trails.map(hike => hikesArr.push(new Hike(hike)));
//       response.send(hikesArr);
//     }).catch(e => {
//       errors(response, e, hikesData);
//     });
// }

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

// function Hike(hike){
//   const date = new Date(hike.conditionDate).toDateString();
//   this.name = hike.name;
//   this.location = hike.location;
//   this.trail_length = hike['length'];
//   this.stars = hike.stars;
//   this.star_votes = hike.starVotes;
//   this.summary = hike.summary;
//   this.trail_url = hike.url;
//   this.conditions = hike.conditionStatus;
//   this.condition_date = date;
//   this.condition_time = date;
// }

// Start the server
app.listen(PORT, () => console.log(`app is up on port ${PORT}`));
