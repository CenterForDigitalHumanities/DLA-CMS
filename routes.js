const express = require('express')
const path = require('path')

const indexRouter = express.Router()

const manageRoutes = require('./management/manage.router')
indexRouter.use('/manage', manageRoutes)

const reportsRouter = require('./status/status.router')
indexRouter.use('/status', reportsRouter)

indexRouter.get('/',(req,res)=>res.redirect('/index.html'))

indexRouter.use(express.static('../public'))

module.exports = indexRouter
