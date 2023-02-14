/**
 * This module is used to define the routes to files in `/reports`
 */

const express = require('express')
const router = express.Router()
const path = require('path')

router.get('/', function (req, res, next) {
    res.sendFile('index.html', { root: path.join(__dirname, './status') })
})

router.get('/tpen-projects', function (req, res, next) {
    res.sendFile('tpen-projects-status.html', { root: path.join(__dirname, './status') })
})

router.get('/dla-records', function (req, res, next) {
    res.sendFile('dla-records-status.html', { root: path.join(__dirname, './status') })
})

module.exports = router
