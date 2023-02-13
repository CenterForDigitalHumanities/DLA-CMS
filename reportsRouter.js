#!/usr/bin/env node

/**
 * This module is used to define the routes to files in `/reports`
 */
const express = require('express')
const router = express.Router()
const path = require('path')

// HTML pages available in `/reports`
//router.use(express.static(path.join(__dirname, './reports')))

// router.get('/', function (req, res) {
//     res.redirect(301, '/index.html') // Landing page for reports
// })

router.get('/', function (req, res) {
    //res.sendFile('index.html', { root: path.join(__dirname, './reports') })
    res.json({
        message: 'Welcome',
        endpoints: {
            "/stuff": "Things"
        }
    })
})

module.exports = router
