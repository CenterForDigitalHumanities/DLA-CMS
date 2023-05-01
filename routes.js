const express = require('express')

const indexRouter = express.Router()

const manageRoutes = require('./management/manage.router')
indexRouter.use('/manage', manageRoutes)

const statusRouter = require('./status/status.router')
indexRouter.use('/status', statusRouter)

indexRouter.get('/',(req,res)=>res.redirect('/manage'))

indexRouter.use(express.static('public'))

module.exports = indexRouter
