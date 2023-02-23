//Mock the logged in user for now
window.DLA_USER = {
    "http://store.rerum.io/agent": "http://store.rerum.io/v1/id/62572ba71d974d1311abd673",
    "http://rerum.io/app_flag": [
        "rerum",
        "dla",
        "lrda",
        "glossing"
    ],
    "http://dunbar.rerum.io/app_flag": [
        "rerum",
        "dla",
        "lrda",
        "glossing"
    ],
    "http://rerum.io/user_roles": {
        "roles": [
            "dunbar_user_admin",
            "glossing_user_admin",
            "rerum_user_admin"
        ]
    },
    "http://dunbar.rerum.io/user_roles": {
        "roles": [
            "dunbar_user_admin",
            "dunbar_user_reviewer"
        ]
    },
    "nickname": "Bry-Dun",
    "name": "bry-dun-admin",
    "picture": "https://s.gravatar.com/avatar/fc39f4f5b1c3381abe2ef2d25e79af3d?s=480&r=pg&d=https%3A%2F%2Fcenterfordigitalhumanities.github.io%2Frerum-consortium%2Flogo.png",
    "updated_at": "2023-02-22T20:49:55.167Z",
    "email": "bry-dun@dunbar.io",
    "email_verified": false,
    "iss": "https://cubap.auth0.com/",
    "aud": "z1DuwzGPYKmF7POW9LiAipO5MvKSDERM",
    "iat": 1677098997,
    "exp": 1677134997,
    "sub": "auth0|62572ba64325a2006a43ec69",
    "at_hash": "cDsHsUhU7AIQ5B1-aSfVGA",
    "sid": "YvXo9fmoCtMAp62OQiYQn0g-yycDD8VQ",
    "nonce": "1AJsAOx-yEONXs9DFe7avviuAXMz8z5j",
    "authorization": "abcdefg"
}
//They must be a logged in user with the correct permission, or they get sent back to the public index page.
if(!DLA_USER?.["http://dunbar.rerum.io/user_roles"]?.roles.includes("dunbar_user_reviewer")){
    window.location.href = "/"
}
const DLA_COLLECTIONS = 
{
    "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar": {
        "managedList" : "http://store.rerum.io/v1/id/61ae693050c86821e60b5d13",
        "publicList" :  "http://store.rerum.io/v1/id/61ae694e50c86821e60b5d15"
    },
    "Other Correspondence": {
        "managedList" : "",
        "publicList" :  ""
    },
    "DLA Poems Collection": {
        "managedList" : "http://store.rerum.io/v1/id/6353016612678843589262b0",
        "publicList" :  ""
    },
    "Performances linked in eCommons": {
        "managedList" : "",
        "publicList" :  ""
    },
    "Music linked in eCommons": {
        "managedList" : "",
        "publicList" :  ""
    },
    "Dialect records from eCommons": {
        "managedList" : "",
        "publicList" :  ""
    },
    "Dunbar namesake schools": {
        "managedList" : "",
        "publicList" :  ""
    },
    "Dunbar namesake Monuments, parks, and landmarks": {
        "managedList" : "",
        "publicList" :  ""
    },
    "OHC Linked Records": {
        "managedList" : "",
        "publicList" :  ""
    },
    "New Digitization in eCommons": {
        "managedList" : "",
        "publicList" :  ""
    }
}
let tpenProjects = []
let dlaCollection = {
    name: "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar",
    itemListElement: []
}
let dlaReleasedCollection = {
    name: "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar",
    itemListElement: []
}
let tpenRecords = []
let dlaRecords = []
let assigneeSet = new Set()
const udelHandlePrefix = "https://udspace.udel.edu/handle/"
const udelRestHandlePrefix = "https://udspace.udel.edu/rest/handle/"
const udelIdPrefix = "https://udspace.udel.edu/rest/items/"
const tpenManifestPrefix = "http://t-pen.org/TPEN/project/"
const tpenProjectPrefix = "http://t-pen.org/TPEN/transcription.html?projectID="
const TPproxy = "http://tinypaul.rerum.io/dla/proxy?url="
let progress = undefined

//Load it up on page load!
if(window.location.pathname.includes("status/search")){
    //Is there any base data worth grabbing and sticking into cache to make searching faster
}
else if(window.location.pathname.includes("status/recent")){
    //Only show a certain number of DLA records that have recently recieved updated contributions
}
//gatherBaseData()

function backgroundCSS(pct){
    let backgroundImageCSS = (function() {
        let test = function(regexp) {return regexp.test(window.navigator.userAgent)}
        switch (true) {
            case test(/edg/i): 
            //Microsoft Edge
                return `-ms-linear-gradient(left, green, green ${pct}%, transparent ${pct}%, transparent 100%)`
            case test(/trident/i): 
            //Microsoft Internet Explorer
                return `-ms-linear-gradient(left, green, green ${pct}%, transparent ${pct}%, transparent 100%)`
            case test(/firefox|fxios/i): 
            //Mozilla Firefox
                return `-moz-linear-gradient(left, green, green ${pct}%, transparent ${pct}%, transparent 100%)`
            case test(/opr\//i): 
            //Opera
                return `-o-linear-gradient(left, green, green ${pct}%, transparent ${pct}%, transparent 100%)`
            case test(/ucbrowser/i): 
            //UC browser
                return `-webkit-linear-gradient(left, green, green ${pct}%, transparent ${pct}%, transparent 100%)`
            case test(/samsungbrowser/i): 
            //Samsung Browser
                return `-webkit-linear-gradient(left, green, green ${pct}%, transparent ${pct}%, transparent 100%)`
            case test(/chrome|chromium|crios/i): 
            //Google Chrome
                return `-webkit-linear-gradient(left, green, green ${pct}%, transparent ${pct}%, transparent 100%)`
            case test(/safari/i): 
            //Apple Safari
                return `-webkit-linear-gradient(left, green, green ${pct}%, transparent ${pct}%, transparent 100%)`
            default: 
                return `Other`
    }
    })()
    return backgroundImageCSS+""
}

/**
 * Checks array of stored roles for any of the roles provided.
 * @param {Array} roles Strings of roles to check.
 * @returns Boolean user has one of these roles.
 */
function userHasRole(roles){
    if (!Array.isArray(roles)) { roles = [roles] }
    try {
        return Boolean(DLA_USER?.["http://dunbar.rerum.io/user_roles"]?.roles.filter(r=>roles.includes(r)).length)
    } catch (err) {
        return false
    }
}

// fetch("/status/recordTranscriptionStatus", {
//     method: "POST",
//     mode: "cors",
//     headers: {
//         "Content-Type": "application/json; charset=utf-8"
//     },
//     body: JSON.stringify({"recordID":"http://store.rerum.io/v1/id/618d9b9a50c86821e60b2cbc"})
// }).then(response => response.ok ? response.json() : Promise.reject(response))
