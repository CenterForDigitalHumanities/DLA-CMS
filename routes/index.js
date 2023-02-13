const express = require('express')
const path = require('path')

const manageRoutes = require('./manage')

const indexRouter = express.Router()
indexRouter.use('/manage', manageRoutes)

indexRouter.get('/',(req,res)=>res.redirect('/index.html'))

module.exports = indexRouter
