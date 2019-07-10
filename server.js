'use strict';

// APP dependencies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');

// Global vars
const PORT = process.env.PORT || 3009;

// Makes the server
const app = express();
app.use(cors());

// app.get('/location', <function-reference>) is a route
app.get('/location', searchToLatLng);
app.get('/weather', searchToWeather);
app.get('/events', searchToEvents);
app.use('*', (request, response) => response.send('you got to the wrong place'));

// Response builders
function searchToLatLng(request, response){
  const locationName = request.query.data;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${locationName}&key=${process.env.GEOCODE_API_KEY}`;
  superagent.get(url)
    .then( result => {
      const location = new Location(locationName, result);
      response.send(location);
    }).catch(e => {
      errors(response, e, locationName);
    });
}

function searchToWeather(request, response){
  const weatherData = request.query.data;
  // console.log(weatherData);
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${weatherData.latitude},${weatherData.latitude}`;
  const weatherArr = [];
  superagent.get(url)
    .then( result => {
      result.body.daily.data.map(dailyWeather => weatherArr.push(new Weather(dailyWeather)));
      response.send(weatherArr);
    }).catch(e => {
      errors(response, e, weatherData);
    });
}

function searchToEvents(request, response){
  const eventsData = request.query.data;
  const url = `https://www.eventbriteapi.com/v3/events/search/?location.latitude=${eventsData.latitude}&location.longitude=${eventsData.longitude}&token=${process.env.EVENTBRITE_API_KEY}`;
  const eventArr = [];
  superagent.get(url)
    .then( result => {
      result.body.events.map(event => eventArr.push(new Event(event)));
      response.send(eventArr);
    })
    .catch(e => {
      errors(response, e, eventsData);
    });
}

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

// Start the server
app.listen(PORT, () => console.log(`app is up on port ${PORT}`));
