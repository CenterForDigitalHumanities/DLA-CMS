/**
 * This module is used to define the routes to files in `/reports`
 */

const express = require('express')
const router = express.Router()

const root = __dirname

router.get('/css',(req,res)=>res.sendFile('local.css', { root }))
router.get('/js',(req,res)=>res.sendFile('local.js', { root }))

router.get('/tpen-projects', function (req, res, next) {
    res.sendFile('tpen-projects-status.html', { root })
})

router.get('/dla-records', function (req, res, next) {
    res.sendFile('dla-records-status.html', { root })
})

router.get('/', function (req, res, next) {
    res.sendFile('index.html', { root })
})

module.exports = router
