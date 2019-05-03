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
const Weather = function(forecast, time) {
  this.forecast = forecast;
  this.time = new Date(time * 1000).toDateString();
};

// Constructor for events
const Event = function(event) {
  this.link = event.link;
  this.name = event.name.text;
  this.event_date = new Date(event.start.local).toDateString();
  this.summary = event.summary;
};

// Function for handling errors
function errorHandling(error, status, response){
  response.status(status).send('Sorry, something went wrong');
}

// express middleware
app.use(cors());
app.use(express.static('./public'));


// Function for getting all the daily weather
function getDailyWeather(weatherData){
  let data = weatherData.daily.data;
  const dailyWeather = data.map(element => (new Weather(element.summary, element.time)));

  return dailyWeather;
}

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
            console.log('test insert values', Object.values(location));
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
  superagent.get(weatherURL)
    .then(result => {
      const weatherForecast = result.body.daily.data.map(day => {
        let newDaysWeather = new Weather(day);
        let sqlInsertStatement = 'INSERT INTO weather(forecast, time, created_at, location_id) VALUES ( $1, $2, $3, $4);';
        let values = Object.values(newDaysWeather);
        values.concat([Date.now(), request.query.data.id]);
        client.query(sqlInsertStatement, values);
        return newDaysWeather;
      });
      response.send(weatherForecast);
    })
    .catch(error => errorHandling(error, status, response));
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
    .catch(error => errorHandling(error, status, response));
}

// express endpoints
app.get('/location', (request, response) => {
  let queryData = request.query.data;
  getLocationData(queryData)
    .then(location => response.send(location))
    .catch(error => errorHandling(error, status, response));
  //try {
  //   let geocodeURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${queryData}&key=${process.env.GEOCODE_API_KEY}`;
  //   superagent.get(geocodeURL)
  //     .end( (err, googleMapsApiResponse) => {
  //       // turn it into a location instance
  //       const location = new Location(queryData, googleMapsApiResponse.body);
  //       // send that as our response to our frontend
  //       response.send(location);
  //     });
  // } catch( error ) {
  //   console.log('There was an error /location path');
  //   errorHandling(error, 500, 'Sorry, something went wrong.');
  // }
});


app.get('/weather', getWeather);
app.get('/events', getEvents);

// app.get('/weather', (request, response) => {
//   // check for json file
//   try {
//     let lat = request.query.data.latitude;
//     let long = request.query.data.longitude;

//     let weatherURL = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${lat},${long}`;
//     superagent
//       .get(weatherURL)
//       .end((err, weatherData) => {
//         let weather = getDailyWeather(weatherData.body);
//         response.send(weather);
//       });
//   } catch( error ) {
//     console.log('There was an error /weather path');
//     errorHandling(error, 500, 'Sorry, something went wrong.');
//   }
// });

// app.get('/events/', (request, response) => {
//   try {
//     let lat = request.query.data.latitude;
//     let long = request.query.data.longitude;

//     let eventsURL = `https://www.eventbriteapi.com/v3/events/search?location.latitude=${lat}&location.longitude=${long}&token=${process.env.EVENTBRITE_API_KEY}`;

//     superagent
//       .get(eventsURL)
//       .end((err, eventData) => {

//         let receivedEvents = eventData.body.events.slice(0, 20);
//         const events = receivedEvents.map((data) => {
//           return new Event(data.url, data.name.text, data.start.local, data.description.text);
//         });

//         response.status(200).send(events);
//       });
//   } catch (error) {
//     console.log('There was an error /events path');
//     errorHandling(error, 500, 'Sorry, something went wrong.');
//   }
// });


app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
