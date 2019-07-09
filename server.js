'use strict';

// APP dependencies
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Global vars
const PORT = process.env.PORT || 3009;

// Make my server
const app = express();
app.use(cors());

/*
$.ajax({
    url: `localhost:3000/location`,
    method: 'GET',
    data: { data: searchQuery }
  })
*/

// app.get('/location') is a route
app.get('/location', (request, response) => {
  try {
    const locationData = searchToLatLng(request.query.data);
    response.send(locationData);
  } catch(e){
    response.status(500).send('Status 500: Sorry, something went wrong when getting this location')
  }
})

app.get('/weather', (request, response) => {
  try {
    const weatherData = searchWeather();
    response.send(weatherData);
  } catch(e) {
    response.status(500).send('Status 500: Sorry, something went wrong when getting this weather data');
  }
})

app.use('*', (request, response) => {
  response.send('you got to the wrong place');
})

function searchToLatLng(locationName){
  const geoData = require('./data/geo.json');
  const location = new Location(locationName, geoData);
  return location;
}

function searchWeather(){
  let weatherArr = [];
  const weatherData = require('./data/darksky.json');
  weatherData.daily.data.forEach(dailyWeather => {
    const weather = new Weather(dailyWeather);
    weatherArr.push(weather);
  })
  return weatherArr;
}

function Location(query, geoData){
  this.search_query = query;
  this.formatted_query = geoData.results[0].formatted_address,
  this.latitude = geoData.results[0].geometry.location.lat,
  this.longitude = geoData.results[0].geometry.location.lng
}

function Weather(weatherData){
  let time = new Date(weatherData.time * 1000).toDateString();
  this.forecast = weatherData.summary;
  this.time = time;
}

// Start the server
app.listen(PORT, () => console.log(`app is up on port ${PORT}`));
