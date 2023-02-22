import { default as UTILS } from '/js/deer-utils.js'
import pLimit from '/js/plimit.js'

//They must be a logged in user with the correct permission, or they get sent back to the public index page.
if(!DLA_USER?.["http://dunbar.rerum.io/user_roles"]?.roles.includes("dunbar_user_reviewer")){
    window.location.href = "/"
}

const statlimiter = pLimit(20)
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
//Load it up on paage load!
gatherBaseData()

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
 * Get all the data needed to generate the reports
 * */
async function gatherBaseData(){
    await getTranscriptionProjects()
    await getDLAManagedList()
    let e
    if(dlaCollection.itemListElement.length && tpenProjects.length){
        e = new CustomEvent("all-info-success", { detail: { dla:dlaCollection, tpen:tpenProjects }, bubbles: true })
        document.dispatchEvent(e)
        if(document.location.href.indexOf("dlaRecords")>-1){
            loadInterfaceDLA()
        }
        else if(document.location.href.indexOf("tpenProjects")>-1){
            loadInterfaceTPEN()
        }
    }
    else{
        e = new CustomEvent("tpen-information-failure", { detail: { err: err }, bubbles: true })
    }
    document.dispatchEvent(e)
}

/**
 * Hey internet, I want the Dunbar Projects out of T-PEN.
 * */
async function getTranscriptionProjects(){  
    // return fetch(".././media/tpenShort.json",
    // {
    //     method: "GET",
    //     cache: "default",
    //     mode: "cors"
    // })
    
    return fetch(`http://t-pen.org/TPEN/getDunbarProjects`, 
    {
        method: "GET",
        cache: "default",
        mode: "cors"
    })
    .then(res=>res.ok?res.json():[])
    .then(projects=>{
        tpenProjects = projects
        let e = new CustomEvent("tpen-information-success", { detail: { tpen: projects }, bubbles: true })
        document.dispatchEvent(e)
        return projects
    })
    .catch(err=> {
        console.error(err)
        tpenProjects = []
        let e = new CustomEvent("tpen-information-failure", { detail: { err: err }, bubbles: true })
        document.dispatchEvent(e)
        return []
    })
}

/**
 * Get the DLA managed list from RERUM
 */
async function getDLAManagedList(){
    const managedList = "http://store.rerum.io/v1/id/61ae693050c86821e60b5d13"
    //const managedList = ".././media/recordsShort.json"
    if(dlaCollection.itemListElement.length === 0){
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
    else{
        return dlaCollection
    }
}

/**
 * Get the DLA released list from RERUM
 */
async function getDLAReleasedList(){
    const releasedListURI = "http://store.rerum.io/v1/id/61ae694e50c86821e60b5d15"
    if(dlaReleasedCollection.itemListElement.length === 0){
        return fetch(releasedListURI, {
            method: "GET",
            cache: "default",
            mode: "cors"
        })
        .then(response => response.json())
        .then(list => {
            dlaReleasedCollection = list
            return list
        })
        .catch(err => {
            console.error(err)
            return []
        })
    }
    else{
        return dlaReleasedCollection
    }
    
}


/**
 * Get all of the items in the DLA letter collection from RERUM.
 * It will be an array of objects, each object will have an @id to be expanded.
 * There are many, and so this needs to be a "paged query". 
 */
async function getLetterCollectionFromRERUM(){
    return getPagedQuery(100)
    /**
     * Ensure not to overflow any buffers.  Get 100 items at a time recursively, until there are less than 100 items in a return.
     * Put them all together, and return the filled response. 
     * */
    function getPagedQuery(lim, it = 0) {
        let queryObj = {
        "$or": [
            {
                "targetCollection": "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar"
            },
            {
                "body.targetCollection": "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar"
            },
            {
                "body.targetCollection.value": "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar"
            },
            {
                "body.partOf": "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar"
            }
            ],
            "__rerum.history.next": {
                "$exists": true,
                "$size": 0
            }
        }
        return fetch(`http://tinypaul.rerum.io/dla/query?limit=${lim}&skip=${it}`, {
            method: "POST",
            mode: "cors",
            //cache: "default",
            body: JSON.stringify(queryObj)
        })
        .then(response => response.json())
        .then(list => {
            dlaCollection.itemListElement = dlaCollection.itemListElement.concat(list.map(anno => ({ '@id': anno.target ?? anno["@id"] ?? anno.id })))
            if (list.length ?? (list.length % lim === 0)) {
                return getPagedQuery(lim, it + list.length)
            }
        })
    }
}

/**
 * Generate the HTML element which will represent the status passed in.  
 * This is for the T-PEN projects items.
 * */
async function generateProjectStatusElement(status, proj){
    let el, statusString, Fcode = ""
    let linkingAnnos, describingAnnos = []
    //Each status handled as its own case.  If we are uniform in what we do we can make this part much shorter if we have a strategic statusesToFind
    switch (status){
        case "T-PEN Project Fully Parsed":
            statusString = `<span class='statusString good'>${status}</span>`
            proj.pages.forEach(page => {
                if(page.numParsedLines < 5){
                    statusString = `<span title='See ${page.page_name}' class='statusString bad'>${status}</span>`
                    return
                }
            })
            el =
            `<dt class="statusLabel" title="Check if there are more than 5 lines with width > 0"> ${statusString} </dt>
            `                               
        break
        case "T-PEN Project Partially Transcribed":
            statusString = `<span class='statusString good'>${status}</span>`
            proj.pages.forEach(page => {
                //We really need to think about this one.
                if(page.numTranscribedLines < 5){
                    statusString = `<span title='See ${page.page_name}' class='statusString bad'>${status}</span>`
                    return
                }
            })
            el =
            `<dt class="statusLabel" title="Check if there are more than 5 lines with width > 0 that have text on each page"> ${statusString} </dt>
            `   
        break
        case "T-PEN Project Fully Transcribed":
            statusString = `<span class='statusString bad'>${status}</span>`
            if(proj.finalized === "true"){
                statusString = `<span class='statusString good'>${status}</span>`
            }
            el =
            `<dt class="statusLabel" title="If there are more than 5 parsed lines on each page, and every line contains text.  Logic performed in servlet and returns T/F."> ${statusString} </dt>
            `   
        break
        case "T-PEN Project Assigned":
            statusString = `<span class='statusString bad'>${status}</span>`
            if(proj.assignees.length && proj.assignees.length > 2){
                for(const a of proj.assignees){
                    //This has a.username and a.userid
                    assigneeSet.add(a.username)
                }
                statusString = `<span title="${Array.from(assigneeSet).join(" ")}" class='statusString good'>${status} to ${proj.assignees.length} users </span>`
            }
            el =
            `<dt class="statusLabel" title="Check if it is assigned to at least 2 usera"> ${statusString} </dt>
            `   
        break     
        case "T-PEN Project Linked to Delaware Records":
            linkingAnnos = await fetchQuery({$or:[{"@type":"Annotation"}, {"type":"Annotation"}], "body.tpenProject.value":""+proj.id})
            statusString = `<span class='statusString bad'>${status}</span>`
            if(linkingAnnos.length>0){
                statusString = `<span class='statusString good'> ${linkingAnnos.length} Linked Records</span>`
            }
            el =
            `<dt class="statusLabel" title="">${statusString}</dt>
            `   
        break
        case "Well Described":
            //This T-PEN project would have to be linked to a UDEL record
            //That linking annotation has a target
            //If it is described, other annos will target that same target
            //Check how many annos target, and define the good/bad threshold. 

            linkingAnnos = await fetchQuery({$or:[{"@type":"Annotation"}, {"type":"Annotation"}], "body.tpenProject.value":""+proj.id})
            describingAnnos = []
            if(linkingAnnos.length > 0){
                describingAnnos = await fetchQuery({$or:[{"@type":"Annotation"}, {"type":"Annotation"}], "target":linkingAnnos[0].target})
            }
            statusString = `<span class='statusString bad'>${status}</span>`
            //TODO this could be better.  Are there some required data points we should check for?""
            if(describingAnnos.length>0){
                statusString = `<span class='statusString good'>${status} by ${describingAnnos.length} data points</span>`
            }
            el =
            `<dt class="statusLabel" title=""> ${statusString} </dt>
            `   
        break
        
        default:
            el=""
            console.error("Uknown status "+status)
    }
    return el
}

/**
 * Generate the HTML element which will represent the status passed in.  
 * This is for the DLA items.
 * */
async function generateDLAStatusElement(status, item){
    let statusString = ""
    let el = ``
    let linkingAnnos, describingAnnos = []
    switch (status){
        case "Released":
            //Is this ID in the released list?
            statusString = `<span class='statusString bad'>Not ${status}</span>`
            let r = false
            await getDLAReleasedList()
            for(const obj in dlaReleasedCollection){
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
 * Perform a tiny query against the query parameter object passed in.
 * */
async function fetchQuery(params){
    const historyWildcard = { $exists: true, $type: 'array', $eq: [] }
    let history = {
        "__rerum.history.next": historyWildcard
    }
    let queryObj = Object.assign(history, params)

    //May have to page these in the future
    return statlimiter(() => fetch("http://tinypaul.rerum.io/dla/query", {
            method: 'POST',
            //cache: "default",
            mode: 'cors',
            body: JSON.stringify(queryObj)
        })
        .then(res => res.ok ? res.json() : Promise.reject(res))
    )
}

function getFolderFromMetadata(metaMap){
    let ok = false
    for (const m of metaMap) {
        if (m.key === "dc.identifier.other") { 
            ok = true
            return m.value 
        }
    }
    if(!ok){
        console.error("No dc.identifier.other in metadata")
        console.log(metaMap)
    }
}

/**
 *  You have a DLA Item F-Code known from a project ID.  Get the DLA record(s) that have a matching F-Code in their metadata.
 * */
async function findUdelRecordWithCode(Fcode, projID) {
    // This is the Fcode that the T-PEN project knew, like F158
    // Need to check that there is a udel item with this Fcode, looking through letters collection.
    let match = false
    let impossible = false;
    let itemHandle = ""
    for(const item of dlaCollection.itemListElement){
        const metadataUri = TPproxy + item?.source?.value.replace("edu/handle", "edu/rest/handle")+"?expand=metadata"
        match = await statlimiter(() => fetch(metadataUri, 
            {
                method: "GET",
                cache: "default",
                mode: "cors"
            })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(meta => getFolderFromMetadata(meta.metadata))
            .then(folderString => {
                if(folderString !== undefined && folderString.indexOf(" F") > -1){
                    return folderString.split(" F").pop()
                }
                else{
                    //This DLA item does not have dc.identifier.other, so there is no connected Fcode
                    impossible = true
                    return ""
                }
            }) // Like "Box 3, F4"
            .then(folderNumber => {
                const matchStr = `F${folderNumber.padStart(3, '0')}`
                return Fcode === matchStr
            })
        )
        if(match){
            itemHandle = udelHandlePrefix+item?.source?.value
            return
        }    
        if(impossible){
            console.error("Could not determine folder name for "+item?.source?.value+"?expand=metadata.  That means this T-PEN project "+projID+" cannot determine if a udel record exists for code "+Fcode+".  We are skipping the check for this project.")
            return
        }
    }
    return itemHandle
}

/**
 * You have a DLA record.  You would like to see if any transcription projects are created that are about this record.
 * Note this does not detect that record and project(s) are specifically linked yet.
 * */
async function matchTranscriptionRecords(dlaRecord) {
    const metadataUri = TPproxy + dlaRecord?.source?.value.replace("edu/handle", "edu/rest/handle")+"?expand=metadata"
    if(metadataUri.indexOf("undefined") === -1){
        return await statlimiter(() => fetch(metadataUri, 
            {
                method: "GET",
                cache: "default",
                mode: "cors"
            })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(meta => getFolderFromMetadata(meta.metadata))
            .then(folderString => folderString.split(" F").pop()) // Like "Box 3, F4"
            .then(folderNumber => {
                const matchStr = `F${folderNumber.padStart(3, '0')}`
                let matches = []
                for (const f of tpenProjects) {
                    if (f.collection_code === matchStr) { 
                        matches.push(f.id) 
                    }
                }
                return matches
            })
            .catch(err => {return []})   
        )
    }
    else{
        return []
    }
}

/**
 * Render a filterable scrollable area to go over the status of each DLA item or each  T-PEN project
 * or possibly a combinations. 
 * */
async function loadInterfaceDLA() {
    let numStatus = 0
    let numMeta = 0
    let pct = 0
    let dlaAreaLoadProgress = document.querySelector(".loadingProgress")
    let dlaAreaElem = document.getElementById("dla_browsable")

    //Set the progress bar '0 loaded' default
    dlaAreaLoadProgress.innerHTML =`<b>${numStatus}</b> of <b>${dlaCollection.itemListElement.length}</b> DLA records processed for statuses.  Thank you for your patience.`

    const DLA_FIELDS = [
        "dc.title", "dc.identifier.uri", "dc.identifier.other"
    ]

    const DLA_FILTERS = {
        Status: "status"
    }

    const DLA_SEARCH =[
        "dc.title", "dc.identifier.uri", "dc.identifier.other"
    ]

    const statusesToFind = [
        "Delaware Record Linked",
        "T-PEN Projects Matched",
        "T-PEN Projects Linked",
        "T-PEN Transcription Reviewed",
        "Envelope Linked",
        "Well Described",
        "Released"
    ]

    document.getElementById("DLADocuments").innerHTML = ""

    for(const record of dlaCollection.itemListElement){
        let statusListElements = ``
        let statusListAttributes = new Array()
        let expandedRecord = await UTILS.expand(record["@id"])
        for(status of statusesToFind){
            //Note that the assignee status will populate the assigneeSet
            let el = await generateDLAStatusElement(status, expandedRecord)
            if(el.indexOf("statusString good")>-1){
                statusListAttributes.push(status)
            }
            statusListElements += el
        }
        let data_id = TPproxy+expandedRecord?.source?.value.replace("edu/handle", "edu/rest/handle")
        let data_id_attr = data_id.indexOf("undefined") === -1 ? "data-id="+data_id+"?expand=metadata" : ""
        document.getElementById("DLADocuments").innerHTML += `
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
        //Incremenet the progress bar
        numStatus++
        pct = Math.round((numStatus/tpenProjects.length) * 100)
        dlaAreaLoadProgress.innerHTML =`<b>${numStatus}</b> of <b>${dlaCollection.itemListElement.length}</b> DLA records processed for statuses.  Thank you for your patience.</br><b>${pct}%</b>`
        dlaAreaLoadProgress.style.backgroundImage = backgroundCSS(pct)
        
    }
    dlaRecords = document.querySelectorAll(".dlaRecord")
    let dla_loading = []
    let statusSet = new Set();
    statusSet.add("Delaware Record Linked")
    statusSet.add("T-PEN Projects Matched")
    statusSet.add("T-PEN Projects Linked")
    statusSet.add("Envelope Linked")
    statusSet.add("Well Described")
    statusSet.add("Released")
    let dla_facets = {
        "status":statusSet
    }
    //Reset the progress bar.  Set the progress bar '0 loaded' default.  This is for loading the information for facteted search, which requires asking for metadata. 
    numMeta = 0
    dlaAreaLoadProgress.innerHTML =`<b>${numMeta}</b> of <b>${dlaCollection.itemListElement.length}</b> DLA records metadata gathered.  Thank you for your patience.`
    dlaAreaLoadProgress.style.backgroundImage = "none"
    Array.from(dlaRecords).forEach(r => {
        const url = r.hasAttribute("data-id") ? r.getAttribute("data-id") : ""
        let dl = ``
        if(url){
            dla_loading.push(statlimiter(() => fetch(url, 
                {
                    method: "GET",
                    cache: "default",
                    mode: "cors"
                })
                .then(status => { if (!status.ok) { throw Error(status) } return status })
                .then(response => response.json())
                .then(dlaRecordInfo => {
                    let metadataMap = new Map()
                    dlaRecordInfo.metadata?.forEach(dat => {
                        metadataMap.set(dat.key, Array.isArray(dat.value) ? dat.value.join(", ") : dat.value)
                        if((Array.isArray(dat.value) && dat.value.length > 1) || dat.value.trim() !== ""){
                            //No blanks
                            metadataMap.set(dat.key, Array.isArray(dat.value) ? dat.value.join(", ") : dat.value)
                        }
                        if (DLA_FIELDS.includes(dat.key)) {
                            //don't need to show any of these for the status.  Label is already showing.
                            //dl += `<dt class="uppercase">${dat.key}</dt><dd>${metadataMap.get(dat.key)}</dd>`
                        }
                    })
                    //Here we aren't filtering by metadata, so we don't need to build facets off the metadata
                    r.setAttribute("data-query", DLA_SEARCH.reduce((a, b) => a += (metadataMap.has(b) ? metadataMap.get(b) : "*") + " ", ""))
                    numMeta++
                    pct = Math.round((numMeta/dlaCollection.itemListElement.length) * 100)
                    dlaAreaLoadProgress.innerHTML =`<b>${numMeta}</b> of <b>${dlaCollection.itemListElement.length}</b> DLA records metadata gathered.  Thank you for your patience.</br><b>${pct}%</b>`
                    dlaAreaLoadProgress.style.backgroundImage = backgroundCSS(pct)
                    //r.querySelector("dl").innerHTML = dl
                })
                .catch(err => { throw Error(err) })
                )
            )    
        }
    })
    document.getElementById("dla_query").addEventListener("input", filterQuery)
    return Promise.all(dla_loading).
    then(() => {
        populateSidebar(dla_facets, DLA_FILTERS, "dla")
        //Now we know everything is loaded, so we can get rid of all the loading progress stuff.
        //Get rid of the loadys and the loading progress bars/messages
        document.querySelector(".sidebar.loading").classList.remove("loading")
        document.querySelector(".loadingProgress").style.display = "none"
        let e = new CustomEvent("dla-interface-loaded", { bubbles: true })
        document.dispatchEvent(e)
    })
    .catch(err=>console.error(err))
}

/**
 * Render a filterable scrollable area to go over the status of each DLA item or each  T-PEN project
 * or possibly a combinations. 
 * */
async function loadInterfaceTPEN() {
    assigneeSet = new Set()
    let tpenAreaElem = document.getElementById("tpen_browsable")
    let tpenAreaLoadProgress = document.querySelector(".loadingProgress")
    let numStatus = 0
    let numMeta = 0
    let pct = 0
    //Set the progress bar '0 loaded' default
    tpenAreaLoadProgress.innerHTML =`<b>${numStatus}</b> of <b>${tpenProjects.length}</b> T-PEN processed for statuses.  Thank you for your patience.`
    const TPEN_FIELDS = [
        "title", "subtitle", "subject", "date", "language",
        "author", "description", "location"
    ]

    const TPEN_FILTERS = {
        Status: "status",
        Assignee : "assignees"
    }

    const TPEN_SEARCH = [
        "title", "subtitle", "subject", "date", "language",
        "author", "description", "location"
    ]

    const statusesToFind = [
        "T-PEN Project Fully Parsed",
        "T-PEN Project Assigned",
        "T-PEN Project Partially Transcribed",
        "T-PEN Project Fully Transcribed",
        "T-PEN Project Linked to Delaware Records",
        "Well Described"
    ]

    document.getElementById("TPENDocuments").innerHTML = ""
    for(const proj of tpenProjects){
        let statusListElements = ``
        let statusListAttributes = new Array()
        for(const status of statusesToFind){
            //Note that the assignee status will populate the assigneeSet
            let el = await generateProjectStatusElement(status, proj)
            if(el.indexOf("statusString good")>-1){
                statusListAttributes.push(status)
            }
            statusListElements += el
        }
        document.getElementById("TPENDocuments").innerHTML += `
            <div class="tpenRecord record" data-id="${tpenManifestPrefix+proj.id}" 
              data-assignees="${Array.from(assigneeSet).join(" ")}" 
              data-status="${statusListAttributes.join(" ")}"
            >
            <h3><a target="_blank" href="${tpenProjectPrefix+proj.id}">${proj["metadata_name"]}</a></h3>
            <!--
            <div class="row">
                <dl>
                </dl>
            </div>
            -->
            <div class="row">
                <img class="thumbnail" src="${proj.thumbnail}" >
                <dl>
                    ${statusListElements}
                </dl>
            </div>
        </div>
        `
        //Incremenet the progress bar
        numStatus++
        pct = Math.round((numStatus/tpenProjects.length) * 100)
        tpenAreaLoadProgress.innerHTML =`<b>${numStatus}</b> of <b>${tpenProjects.length}</b> T-PEN projects processed for statuses.  Thank you for your patience.</br><b>${pct}%</b>`
        tpenAreaLoadProgress.style.backgroundImage = backgroundCSS(pct)
    }

    tpenRecords = document.querySelectorAll(".tpenRecord")
    let tpen_loading = []
    let statusSet = new Set();
    statusSet.add("T-PEN Project Fully Parsed")
    statusSet.add("T-PEN Project Assigned")
    statusSet.add("T-PEN Project Partially Transcribed")
    statusSet.add("T-PEN Project Fully Transcribed")
    statusSet.add("T-PEN Project Linked to Delaware Records")
    statusSet.add("Well Described")
    let tpen_facets = {
        "status":statusSet,
        "assignees":assigneeSet
    }
    //Reset the progress bar.  Set the progress bar '0 loaded' default.  This is for loading the information for facteted search, which requires asking for metadata. 
    tpenAreaLoadProgress.innerHTML =`<b>${numMeta}</b> of <b>${tpenProjects.length}</b> T-PEN projects metadata gathered for filters.  Thank you for your patience.`
    Array.from(tpenRecords).forEach(r => {
        const url = r.getAttribute("data-id")
        let dl = ``
        tpen_loading.push(statlimiter(() => fetch(url, 
                {
                    method: "GET",
                    cache: "default",
                    mode: "cors"
                })
                .then(status => { if (!status.ok) { throw Error(status) } return status })
                .then(response => response.json())
                .then(tpenProject => {
                    let metadataMap = new Map()
                    tpenProject.metadata?.forEach(dat => {
                        //Note this does not know the Project.name, it knows the Metadata.title
                        if((Array.isArray(dat.value) && dat.value.length > 1) || dat.value.trim() !== ""){
                            //No blanks
                            metadataMap.set(dat.label, Array.isArray(dat.value) ? dat.value.join(", ") : dat.value)
                        }
                        if (TPEN_FIELDS.includes(dat.label)) {
                            //don't need to show any of these for the status.  Label is already showing.
                            //dl += `<dt class="uppercase">${dat.label}</dt><dd>${metadataMap.get(dat.label)}</dd>`
                        }
                    })
                    //Here we aren't filtering by metadata, so we don't need to build facets off the metadata
                    r.setAttribute("data-query", TPEN_SEARCH.reduce((a, b) => a += (metadataMap.has(b) ? metadataMap.get(b) : "*") + " ", ""))
                    
                    //increment the progress bar
                    numMeta ++
                    pct = Math.round((numMeta/tpenProjects.length) * 100)
                    tpenAreaLoadProgress.innerHTML =`<b>${numMeta}</b> of <b>${tpenProjects.length}</b> T-PEN projects metadata gathered for filters.  Thank you for your patience.</br><b>${pct}%</b>`
                    tpenAreaLoadProgress.style.backgroundImage = backgroundCSS(pct)
                })
                .catch(err => { throw Error(err) })
            )
        )
    })
    document.getElementById("tpen_query").addEventListener("input", filterQuery)
    return Promise.all(tpen_loading)
    .then(() => {
        populateSidebar(tpen_facets, TPEN_FILTERS, "tpen")
        //Now we know everything is loaded, so we can get rid of all the loading progress stuff.
        //Get rid of the loadys and the loading progress bars/messages
        document.querySelector(".sidebar.loading").classList.remove("loading")
        document.querySelector(".loadingProgress").style.display = "none"
        let e = new CustomEvent("tpen-interface-loaded", { bubbles: true })
        document.dispatchEvent(e)
    })
    .catch(err=>console.error(err))
}

function populateSidebar(facets, filters, which) {
    //This happens after all prerequisite data is gathered and processed.  Get rid of the loadys and the loading progress bars/messages
    let side = `<ul>`
    let elemRoot = document.getElementById(which+"_browsable")
    for (const f in filters) {
        if (!facets[filters[f]]) continue
        side += `<li>${f}</li>`
        side += Array.from(facets[filters[f]]).reduce((a, b) => a += `<facet data-facet="${filters[f]}" data-label="${b}">${b}</facet>`, ``)
    }
    side += `</ul>`
    let facetFilter = document.getElementById(which+"FacetFilter")
    facetFilter.innerHTML = side
    let facetsElements = elemRoot.querySelectorAll("[data-facet]")
    Array.from(facetsElements).forEach(el => el.addEventListener("click", filterFacets))
    updateCount(which)
    loadQuery(which)
}

function updateCount(which) {
    // let visibleCount = Array.from(records).filter(el=>el.offsetParent === null).length
    let elemRoot = document.getElementById(which+"_browsable")
    let records = document.getElementsByClassName(which+"Record")
    let hiddenCount = elemRoot.querySelectorAll(".record[class*='hide-']").length
    let queryInput = document.getElementById(which+"_query")
    let countBar = queryInput.previousElementSibling
    let countBarValue = records.length - hiddenCount
    countBar.max = records.length
    countBar.textContent = countBarValue + " of " + countBar.max
    if(progress != undefined){
       clearInterval(progress) 
    }
    const notzero = countBarValue > countBar.value ? 1 : -1
    let step = parseInt((countBarValue - countBar.value) / 25) || notzero
    progress = setInterval(() => {
        countBar.value += step
        if (Math.abs(countBar.value - countBarValue) < 2) {
            countBar.value = countBarValue
            clearInterval(progress)
        }
    }, 10)
    let facetsElements = elemRoot.querySelectorAll("facet")
    Array.from(facetsElements).forEach(f => {
        const k = f.getAttribute("data-facet")
        const v = f.textContent
        let count = elemRoot.querySelectorAll(".record:not([class*='hide-'])[data-" + k + "*='" + v + "']").length
        f.setAttribute("data-count", count)
        // if (count === 0) {
        //     f.classList.add("hide-sidebar")
        // } else {
        //     f.classList.remove("hide-sidebar")
        // }
    })
}

const loadQuery = (which) => {
    const params = new URLSearchParams(location.search)
    let queryInput = document.getElementById(which+"_query")
    let elemRoot = document.getElementById(which+"_browsable")
    params.forEach((v,k)=>{
        elemRoot.querySelectorAll(`[data-facet="${k}"][data-label="${v}"]`)
         .forEach(el=>el.click())
    })
    const queryString = params.get("q")

    if(queryString){
        queryInput.value = queryString
        queryInput.dispatchEvent(new Event('input'))
    }
}

if (window.tpenQueryReset) {
    tpenQueryReset.addEventListener("click", ev => {
        Array.from(document.getElementById("tpen_browsable").querySelectorAll(".clicked")).forEach(el => el.dispatchEvent(new Event("click")))
        document.getElementById("tpen_query").value = ""
        document.getElementById("tpen_query").dispatchEvent(new Event("input"))
    })
}

if (window.dlaQueryReset) {
    dlaQueryReset.addEventListener("click", ev => {
        Array.from(document.getElementById("dla_browsable").querySelectorAll(".clicked")).forEach(el => el.dispatchEvent(new Event("click")))
        document.getElementById("dla_query").value = ""
        document.getElementById("dla_query").dispatchEvent(new Event("input"))
    })
}

function filterQuery(event) {
    const queryString = event.target.value
    let which = event.target.id.replace("_query","")
    let records = document.getElementsByClassName(which+"Record")
    Array.from(records).forEach(r => new RegExp(queryString, "i").test(r.getAttribute("data-query")) ? r.classList.remove("hide-query") : r.classList.add("hide-query"))
    //Manuscripts.querySelectorAll(".record:not([data-query*='"+queryString+"'])")
    updateCount(which)
}
function filterFacets(event) {
    let which = event.target.closest("section").id.replace("FacetFilter", "")
    const clicked = event.target
    clicked.classList.toggle("clicked")
    const action = clicked.classList.contains("clicked") ? "add" : "remove"
    const k = clicked.getAttribute("data-facet")
    const v = clicked.textContent
    let records = document.getElementsByClassName(which+"Record")
    //FIXME
    //I click on a facet that has 1 match, then on one that has 0 match. All elements are hidden.
    //I click again on the facet that had 0 matches.  Now all areas become unhidden, the count ends up as ALL instead of 1.
    //Now the count is all of all instead of 1 of all, even though my face with (1) match is still selected.
    //Subsequent facet filtering has screwed up counts
    Array.from(records).forEach(r => { if (!new RegExp(v, "i").test(r.getAttribute("data-" + k))) r.classList[action]("hide-facet") })
    updateCount(which)
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