//const UTILS = require ('../public/js/deer-utils.js')
//const UTILS = require('../public/js/deer-utils.js')

let tpenProjects = []
let tpenRecords = []
let dlaRecords = []
let assigneeSet = new Set()
const udelHandlePrefix = "https://udspace.udel.edu/handle/"
const udelRestHandlePrefix = "https://udspace.udel.edu/rest/handle/"
const udelIdPrefix = "https://udspace.udel.edu/rest/items/"
const tpenManifestPrefix = "http://t-pen.org/TPEN/project/"
const tpenProjectPrefix = "http://t-pen.org/TPEN/transcription.html?projectID="
const TPproxy = "http://tinypaul.rerum.io/dla/proxy?url="
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


/**
 * Get a limited number of recent contributions for the provided collection (managed list)
 * */
exports.getRecentCollectionContributions = async function (req, res, next) {
    res.set("Content-Type", "application/json; charset=utf-8")
    let collectionName = req.params["_id"]
    let managedList = DLA_COLLECTIONS[collectionName].managedList
    const historyWildcard = { "$exists": true, "$eq": [] }
    let query = {
        "type" : "Annotation",
        "target" : managedList,    
        "__rerum.history.next": historyWildcard 
    }
    //A TP endpoint would need to know to { $sort: {"__rerum.createdAt":-1} } and be sure to only return the amount noted in limit
    const matches = await fetch(`http://tinypaul.rerum.io/dla/recentContributions?limit=30`, {
        method: "POST",
        mode: "cors",
        //cache: "default",
        body: JSON.stringify(queryObj)
    })
    .then(response => response.json())
    return matches
}

/**
 * Get the DLA record report card for the provided record ID.
 * You will be given the Collection Name and the expanded record.
 * This returns the HTML card of the statuses.
 * */
exports.getRecordStatusInfo = async function (req, res, next) {
    res.set("Content-Type", "application/json; charset=utf-8")
    let received = JSON.parse(req.body)
    let recordID = recieved.record
    let collectionName = recieved.collection
    let statusElem = ``
    const statusesToFind = [
        "Delaware Record Linked",
        "T-PEN Projects Matched",
        "T-PEN Projects Linked",
        "T-PEN Transcription Reviewed",
        "Envelope Linked",
        "Well Described",
        "Released"
    ]
    //I can't seem to get access to UTILS in here...
    //let expandedRecord = UTILS.expand(recordID)
    let expandedRecord
    if (expandedRecord) {
        //Maybe we can cache these.  If they aren't cached, then we need to get them.
        let publicRecords = await getPublicCollection(collectionName)
        let managedRecords = await getManagedCollection(collectionName)
        let tpenProjects = await getTranscriptionProjects()
        let statusListElements = ``
        let statusListAttributes = new Array()
        let expandedRecord = await UTILS.expand(record["@id"])
        for(status of statusesToFind){
            let el = await generateDLAStatusElement(status, expandedRecord, publicRecords, managedRecords, tpenProjects)
            if(el.indexOf("statusString good")>-1){
                statusListAttributes.push(status)
            }
            statusListElements += el
        }
        let data_id = TPproxy+expandedRecord?.source?.value.replace("edu/handle", "edu/rest/handle")
        let data_id_attr = data_id.indexOf("undefined") === -1 ? "data-id="+data_id+"?expand=metadata" : ""

        const recordCard = `
        <div class="dlaRecord record" 
            ${data_id_attr}
            data-status="${statusListAttributes.join(" ")}"
            >
            <h3><a target="_blank" href="../ms.html#${expandedRecord['@id']}">${UTILS.getLabel(expandedRecord)}</a></h3>
            <div class="row">
                <dl>
                    ${statusListElements}
                </dl>
            </div>
        </div>
        `
        return recordCard 
    }
}

/**
 * Generate the HTML element which will represent the status passed in.  
 * This is for the DLA items.
 * */
async function generateDLAStatusElement(status, item, publicCollection, managedCollection){
    let statusString = ""
    let el = ``
    let linkingAnnos, describingAnnos = []
    switch (status){
        case "Released":
            //Is this ID in the released list?
            statusString = `<span class='statusString bad'>Not ${status}</span>`
            let r = false
            for(const obj in publicCollection){
                if (obj["@id"] === item["@id"]){
                    r = true
                    return
                }
            }
            if(r){
                statusString = `<span class='statusString good'>${status}</span>`
            }
            el =
            `<dt class="statusLabel" title="If this item is in the list of released records."> ${statusString} </dt>
            ` 
        break
        case "T-PEN Projects Matched":
            //Can we match a T-PEN project to this record?
            statusString = `<span class='statusString bad'>No ${status}</span>`
            let found = item?.source?.value ? await matchTranscriptionRecords(item) : []
            if(found.length > 0){
                statusString = `<span title="${found.join(" ")}" class='statusString good'>${found.length} ${status}</span>`
            }
            el =
            `<dt class="statusLabel" title="These are T-PEN projects where the image titles matched with the F-Code for this DLA item."> ${statusString} </dt>
            ` 
        break
        case "T-PEN Projects Linked":
            //Not sure what to do here.  The body.tpenProject.value is a projectID.  The target is the RERUM ID for the current item.
            statusString = `<span class='statusString bad'>No ${status}</span>`
            let tpenProjectIDs = []
            let links = item.hasOwnProperty("tpenProject") ? item.tpenProject : [] 
            //It can be an array of objects or a single object
            if(!Array.isArray(links) && typeof links === "object"){
                links = [links]
            }
            let projIDs = links.length ? links.map(proj_obj => proj_obj.value) : ""
            projIDs = Array.from(new Set(projIDs)) //Get rid of duplicates
            if(projIDs.length){
                statusString = `<span title='${projIDs.join(" ")}' class='statusString good'>${projIDs.length} ${status}</span>`
            }
            el =`<dt class="statusLabel" title="These are annotations connecting the record to T-PEN projects.  One record can be a part of multiple projects."> ${statusString} </dt>`
        break
        case "Delaware Record Linked":
            statusString = `<span class='statusString bad'>No ${status}</span>`
            if(item?.source?.value){
                statusString = `<span title='See ${item?.source?.value}' class='statusString good'>${status}</span>`
            }
            el =
            `<dt class="statusLabel" title="These are source annotations connecting the record to the handle."> ${statusString} </dt>`
        break
        case "Envelope Linked":
            //This is probably a T-PEN check, not sure. Can we check for an annotation with body that is a certain name or a primitive name of some kind?
            // statusString = "<span class='statusString bad'>Under Development!</span>"
            // el =
            // `<dt class="statusLabel" title=""> ${statusString} </dt>`
            el=``
        break
        case "Well Described":
            statusString = `<span class='statusString bad'>Not ${status}</span>`
            let required_keys = ["label", "date"]
            //Just filter down to the keys we are looking for that have a value
            let keys_to_count = Array.from(Object.keys(item)).filter(name => required_keys.includes(name) && UTILS.getValue(item[name]))
            //If it found that the object contains the required keys we are looking for...
            if(required_keys.length === keys_to_count.length){
                //Then it is well described by Annotations!  All the keys we require to meet this threshold have a value, and there may even be more.
                //-3 to ignore @context, @id, and @type.
                statusString = `<span class='statusString good'>${status} by ${Object.keys(item).length - 3} data points</span>`
            }
            /*
            else{
                //The linked metadata may have it, let's check there
                const metadataUri = TPproxy + item?.source?.value.replace("edu/handle", "edu/rest/handle")+"?expand=metadata"
                let metadata = []
                //If source is not there, then there is no linked metadata
                if(metadataUri.indexOf("undefined") === -1){
                    metadata = await fetch(metadataUri)
                    .then(res => res.ok ? res.json() : {"metadata":[]})
                    .then(meta => meta.metadata)
                    .catch(err => [])
                }
                if(metadata.length){
                    let metadata_key_count = 0
                    for (const m of metadata) {
                        if (m.key === "dc.title") { 
                            //This is the label, so count it if it has a value
                            if(m.value){
                                metadata_key_count += 1
                            }
                             
                        }
                        if(m.key === "dc.date"){
                            //This is the date, so count it if it has a value.
                            if(m.value){
                                metadata_key_count += 1
                            }
                        }
                    }    
                }
                if(required_keys.length <= metadata_key_count){
                    //Then it is well described by Annotations!  All the keys we require to meet this threshold have a value, and there may even be more.
                    //-3 to ignore @context, @id, and @type.
                    statusString = `<span class='statusString good'>${status} by ${Object.keys(item).length - 3} data points</span>`
                } 
            }
            */
            el =
            `<dt class="statusLabel" title="It at least includes a label, notes, and a date.  There may be more!"> ${statusString} </dt>
            `   
        break
        case "T-PEN Transcription Reviewed":
            // Whether or not this has been reviewed/approved for public consumption
            const query = {
                target: item["@id"],
                "body.transcriptionStatus": { $exists: true }
            }
            let data = await fetchQuery(query)
            statusString = `<span class='statusString bad'>❌ Transcription Not Reviewed</span>`
            if(data.length && data[0]?.body.transcriptionStatus !== "in progress"){
                statusString = `<span class='statusString good'>Reviewed by <deer-view deer-id="${data[0].body.transcriptionStatus}" deer-template="label">${data[0].body.transcriptionStatus}</deer-view> </span>`
            }
            el =
            `<dt class="statusLabel" title="Whether or not the transcription has been reviewed by a project admin."> ${statusString} </dt>
            `
        break 
        default:
            el=``
            console.error("Uknown status "+status)
    }
    return el
}

/**
 * You have a DLA record.  You would like to see if any transcription projects are created that are about this record.
 * Note this does not detect that record and project(s) are specifically linked yet.
 * */
async function matchTranscriptionRecords(dlaRecord) {
    const folderNumber = dlaRecord?.identifier ?? "unknown"
    const matchStr = `F${folderNumber.padStart(3, '0')}`
    let matches = []
    for (const f of tpenProjects) {
        if (f.collection_code === matchStr) { 
            matches.push(f.id) 
        }
    }
    return matches
}

/**
 * Hey internet, I want the Dunbar Projects out of T-PEN.
 * */
async function getTranscriptionProjects(){  
    return fetch(`http://t-pen.org/TPEN/getDunbarProjects`, 
    {
        method: "GET",
        cache: "default",
        mode: "cors"
    })
    .then(res=>res.ok?res.json():[])
    .then(projects=>{
        let e = new CustomEvent("tpen-information-success", { detail: { tpen: projects }, bubbles: true })
        document.dispatchEvent(e)
        return projects
    })
    .catch(err=> {
        console.error(err)
        let e = new CustomEvent("tpen-information-failure", { detail: { err: err }, bubbles: true })
        document.dispatchEvent(e)
        return []
    })
}

/**
 * Get the managed collection when all your are given in the collectionname
 */
async function getManagedCollection(collectionName){
    const managedList = "http://store.rerum.io/v1/id/61ae693050c86821e60b5d13"
    return fetch(managedList, {
        method: "GET",
        cache: "default",
        mode: "cors"
    })
    .then(response => response.json())
    .then(list => {
        dlaCollection = list
        return list
    })
    .catch(err => {
        console.error(err)
        return []
    })

}

/**
 * Get the public collection when all your are given is the collection name
 */
async function getPublicCollection(collectionName){
    const publicList = allCollections.collectionName.public
    if(dlaCollection.itemListElement.length === 0){
        return fetch(publicList, {
            method: "GET",
            cache: "default",
            mode: "cors"
        })
        .then(response => response.json())
        .then(list => {
            dlaCollection = list
            return list
        })
        .catch(err => {
            console.error(err)
            return []
        })
    }
    else{
        return dlaCollection
    }
}


