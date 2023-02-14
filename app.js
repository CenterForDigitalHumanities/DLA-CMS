const createError = require('http-errors')
const express = require('express')
// const dotenv = require('dotenv')
// dotenv.config()
// const logger = require('morgan')

const app = express()

// app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
// TODO: use auth0 for all exchanges

// Routers
const indexRouter = require('./routes.js')
app.use('/',indexRouter)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  console.log("404 error on "+req.originalUrl)
  next(createError(404))
})

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.redirect('/error.html')
})

module.exports = app
