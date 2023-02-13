const router = require('express')

router.get('/',(req,res)=> res.send('/management/index.html'))

module.exports(router)
