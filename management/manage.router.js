const express = require('express')
const router = express.Router()

const root = __dirname

router.get('/collections', (req, res) => res.sendFile('collectionsMap.json', { root }))
router.get('/script', (req, res) => {
    res.sendFile('local.js', { root })
})
router.get('/css', (req, res) => {
    res.sendFile('local.css', { root })
})

router.get('/', (req, res) => {
    res.sendFile('index.html', { root })
})

module.exports = router
