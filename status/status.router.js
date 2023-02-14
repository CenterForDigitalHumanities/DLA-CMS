#!/usr/bin/env node

/**
 * This module is used to define the routes to files in `/reports`
 */
const express = require('express')
const router = express.Router()

const root = __dirname

router.get('/tpen-projects', function (req, res, next) {
    res.sendFile('tpen-projects-status.html', { root })
})

router.get('/dla-records', function (req, res, next) {
    res.sendFile('dla-records-status.html', { root })
})

router.get('/', function (req, res, next) {
    res.sendFile('index.html', { root })
})

//router.use(express.static(path.join(__dirname+'/css', '/public')))

module.exports = router
