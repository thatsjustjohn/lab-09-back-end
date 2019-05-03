'use strict';

require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const pg = require('pg');
const superagent = require('superagent');

app.use(cors());
// use environment variable, or, if it's undefined, use 3000 by default
const PORT = process.env.PORT || 3000;

// DB
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();

// Constructor for the Location response from API
const Location = function(queryData, res){
  this.search_query = queryData;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
};

// Constructor for a DaysWeather.
const Weather = function(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toDateString();
};

// Constructor for events
const Event = function(event) {
  this.link = event.link;
  this.name = event.name.text;
  this.event_date = new Date(event.start.local).toDateString();
  this.summary = event.summary;
};

// Function for handling errors
function errorHandling(error, response){
  console.log(error);
  if(response) response.status(500).send('Sorry, something went wrong');
}

// express middleware
app.use(cors());
app.use(express.static('./public'));

// Function to get location data
function getLocationData(query){
  let sqlStatement = 'SELECT * FROM location WHERE search_query = $1;';
  let values = [query];
  return client.query(sqlStatement, values)
    .then((data) => {
      if(data.rowCount > 0){
        console.log('Data from DB');
        return data.rows[0];
      }else{
        const geocodeURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;

        return superagent.get(geocodeURL)
          .then( res => {
            let newLocation = new Location(query, res);
            let sqlInsertStatement = 'INSERT INTO location (search_query, formatted_query, latitude, longitude) VALUES ( $1, $2, $3, $4) RETURNING id;';
            let insertValues = Object.values(newLocation);
            console.log('test insert values', Object.values(newLocation));
            client.query(sqlInsertStatement, insertValues)
              .then(pgRes => {
                newLocation.id = pgRes.rows[0].id;
                return newLocation;
              });
          })
          .catch(error => errorHandling(error));
      }
    });
}

function getWeather(request, response) {
  console.log('getWeather', request);
  getData('weather', request, response);
}

let expires = {
  weather: 15 * 1000 //expiration for weather
};

let dataCurrentFunction = {
  weather: getCurrentWeatherData
};


function getData(tableName, request, response) {
  let sqlStatement= `SELECT * FROM ${tableName} WHERE location_id = $1;`;
  let values = [request.query.data.id]; //can use object.values[4]
  console.log(sqlStatement, values);
  client.query(sqlStatement, values)
    .then((data) => {
      if(data.rowCount > 0){
        let dataTimeCreated = data.rows[0].created_at;
        let now = Date.now();
        if(now - dataTimeCreated > expires[tableName]){
          let sqlDeleteStatement = `DELETE FROM ${tableName} WHERE location_id = $1`;
          client.query(sqlDeleteStatement, values)
            .then(() => {
              dataCurrentFunction[tableName](request, response);
            });
        }else{
          response.send(data.rows);
        }
      }else{
        dataCurrentFunction[tableName](request, response);
      }
    });
}

function getCurrentWeatherData(request, response){
  let lat = request.query.data.latitude;
  let long = request.query.data.longitude;
  let weatherURL = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${lat},${long}`;
  console.log('inCurrentWEatherData');
  superagent.get(weatherURL)
    .then(result => {
      const weatherForecast = result.body.daily.data.map(day => {
        let newDaysWeather = new Weather(day);
        let sqlInsertStatement = 'INSERT INTO weather(forecast, time, created_at, location_id) VALUES ( $1, $2, $3, $4);';
        let values = Object.values(newDaysWeather);
        console.log('Into DB', sqlInsertStatement, values.concat([Date.now(), request.query.data.id]));
        client.query(sqlInsertStatement, values.concat([Date.now(), request.query.data.id]));
        return newDaysWeather;
      });
      response.send(weatherForecast);
    })
    .catch(error => errorHandling(error, response));
}


function getEvents(request, response) {
  let lat = request.query.data.latitude;
  let long = request.query.data.longitude;
  let eventsURL = `https://www.eventbriteapi.com/v3/events/search?location.latitude=${lat}&location.longitude=${long}&token=${process.env.EVENTBRITE_API_KEY}`;

  superagent.get(eventsURL)
    .then(result => {
      const events = result.body.events.map(eventData => {
        const event = new Event(eventData);
        return event;
      });
      response.send(events);
    })
    .catch(error => errorHandling(error, response));
}

// express endpoints
app.get('/location', (request, response) => {
  let queryData = request.query.data;
  getLocationData(queryData)
    .then(location => response.send(location))
    .catch(error => errorHandling(error, response));
});


app.get('/weather', getWeather);
app.get('/events', getEvents);

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
