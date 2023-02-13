const express = require('express')
const router = express.Router()

router.get('*',(req,res)=> res.sendFile('/management/index.html'))

module.exports = router
