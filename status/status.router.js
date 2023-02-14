#!/usr/bin/env node

/**
 * This module is used to define the routes to files in `/reports`
 */
const express = require('express')
const router = express.Router()

router.get('/tpen-projects', function (req, res, next) {
    res.sendFile('tpen-projects-status.html')
})

router.get('/dla-records', function (req, res, next) {
    res.sendFile('dla-records-status.html')
})

router.get('/', function (req, res, next) {
    res.sendFile('index.html')
})

//router.use(express.static(path.join(__dirname+'/css', '/public')))

module.exports = router
