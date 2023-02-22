/**
 * This module is used to define the routes to files in `/reports`
 */

const express = require('express')
const router = express.Router()
const controller = require('./status.controller.js')
const root = __dirname

router.get('/css', (req, res) => res.sendFile('local.css', { root }))
router.get('/js', (req, res) => res.sendFile('local.js', { root }))

router.get('/tpenProjects', function (req, res) {
    res.sendFile('tpen-projects-status.html', { root })
})

router.get('/dlaRecords', function (req, res) {
    res.sendFile('dla-records-status.html', { root })
})

router.get('/search', function (req, res) {
    res.sendFile('search.html', { root })
})

router.get('/recent', function (req, res) {
    res.sendFile('recent.html', { root })
})

router.get('/', function (req, res) {
    res.sendFile('index.html', { root })
})

module.exports = router
