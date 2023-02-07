let request = require("supertest")

request = request("http://localhost:3333")

it('/ -- Make sure index exists', function(done) {
  request
    .get("/index.html")
    .expect(200)
    .then(response => {
        done()
    })
    .catch(err => done(err))
})