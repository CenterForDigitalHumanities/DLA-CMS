const express = require('express')
const path = require('path')

const indexRouter = express.Router()

const manageRoutes = require('./manage')
indexRouter.use('/manage', manageRoutes)

const reportsRouter = require('./reports')
indexRouter.use('/status', reportsRouter)

indexRouter.get('/',(req,res)=>res.redirect('/index.html'))

module.exports = indexRouter
