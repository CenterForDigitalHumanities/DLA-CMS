const express = require('express')
const router = express.Router()

const root = __dirname

router.get('/', (req, res) => {
    res.sendFile('index.html', { root })
})

module.exports = router
