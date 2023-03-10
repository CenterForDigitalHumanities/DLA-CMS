const collectionsFile = await fetch('/manage/collections').then(res => res.json())
const collectionMap = new Map(Object.entries(collectionsFile))

function fetchItems(event) {
    const selectedCollection = event.target.selectedOptions[0]
    return Promise.all([fetch(selectedCollection.dataset.uri).then(res => res.json()),
    fetch(selectedCollection.dataset.managed).then(res => res.json())])
        .then(([publicCollection, managedCollection]) => {
            countItems(publicCollection)
            if (DLA_USER['http://dunbar.rerum.io/user_roles'].roles.includes('dunbar_user_reviewer')) {
                approveBtn.addEventListener('click', approveByReviewer)
                returnBtn.addEventListener('click', returnByReviewer)
                return getReviewerQueue(publicCollection, managedCollection)
            }
            if (DLA_USER['http://dunbar.rerum.io/user_roles'].roles.includes('dunbar_user_curator')) {
                approveBtn.addEventListener('click', curatorApproval)
                returnBtn.addEventListener('click', curatorReturn)
                return getCuratorQueue(publicCollection, managedCollection)
            }
        })
        .then(ok=>queue.querySelector('li').click())
        .catch(err=>console.error(err))
}

function showRecordPreview(event) {
    preview.innerHTML = ``
    preview.setAttribute("deer-template", "preview")
    preview.setAttribute("deer-id", event.target.dataset.id)
    queue.querySelector(".selected")?.classList.remove("selected")
    event.target.classList.add('selected')
}

/**
 * Generate or update the moderating Annotation for this record to include the collection this record is released to.
 */ 
async function approveByReviewer() {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const queryObj = {
        "body.releasedTo": { $exists: true },
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] },
        target: preview.getAttribute("deer-id")
    }
    const selectedCollection = collections.querySelector("select").selectedOptions[0]
    const activeCollection = collectionMap.get(selectedCollection.value)
    let reviewed = await fetch("http://tinypaul.rerum.io/dla/query", {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj)
    })
        .then(res => res.ok ? res.json() : Promise.reject(res))

    //CANNOT SAVE null INTO OUR MONGO -- objects become 404
    const reviewComment = Object.assign(reviewed[0] ?? {
        "@context": "http://www.w3.org/ns/anno.jsonld",
        type: "Annotation",
        target: preview.getAttribute("deer-id"),
        motivation: "moderating",
        creator: DLA_USER['http://store.rerum.io/agent'],
        body: {
            releaseTo: activeCollection.public,
            resultComment: null
        }
    })

    const publishFetch = (reviewed.length === 0)
        ? fetch("http://tinypaul.rerum.io/dla/create", {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(reviewComment),
            headers
        })
        : fetch("http://tinypaul.rerum.io/dla/overwrite", {
            method: 'PUT',
            mode: 'cors',
            body: JSON.stringify(reviewComment),
            headers
        })
    publishFetch
        .then(res => res.ok || Promise.reject(res))
        .then(success => approveBtn.replaceWith("✔ published"))
        .then(ok=>{
            queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).remove()
            queue.querySelector('li').click()
        })
}

/**
 * Removed this record from the managed list.  Add the optional comment to flag it as rejected for contributors.
 * Note once this commenting Annotation exists, this record will always appear to contributors as rejected when it is not in the managed list.
 */ 
async function returnByReviewer() {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const selectedCollection = collections.querySelector("select").selectedOptions[0]
    const activeCollection = collectionMap.get(selectedCollection.value)
    const managedlist = await fetch(activeCollection.managed)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(list => {
            list.itemListElement = list.itemListElement.filter(r => r['@id'] !== preview.getAttribute("deer-id"))
            list.numberOfItems = list.itemListElement.length
            return list
        })
    const callback = (commentID) => fetch("http://tinypaul.rerum.io/dla/overwrite", {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(managedlist),
        headers
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(success => approveBtn.replaceWith(`❌ Removed`))
    .then(ok=>{
        queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).remove()
        queue.querySelector('li').click()
    })
    recordComment(callback, "commenting")
}

/**
 * Offer a UI for the comment from a reviewer or contributor
 * reviewer comments are saved as a commenting Annotation
 * curator comments as saved as an emdedded string in the moderating Annotation
 * The callback() is handled in returnByReviewer() and returnByCurator()
 */ 
async function recordComment(callback, motiv) {
    const modalComment = document.createElement('div')
    modalComment.classList.add('modal')
    modalComment.innerHTML = `
    <header>Return with comment</header>
    <p> Explain why this Record is not ready for release or request changes. </p>
    <textarea></textarea>
    <button role="withmessage">Reject With Message</button>
    <button role="nomessage">Reject Without Message</button>
    <a href="#" onclick="this.parentElement.remove">❌ Cancel</a>
    `
    document.body.append(modalComment)
    document.querySelector('.modal button[role="withmessage"]').addEventListener('click', async ev => {
        ev.preventDefault()
        const conf = confirm("This record will be rejected.  Click OK to continue")
        if(!conf){return}
        const text = document.querySelector('.modal textarea').value
        let comment 
        if(motiv === "commenting"){
            //reviewer rejection, their note is tracked in a separate commenting Annotation handled here.
            comment = await saveComment(preview.getAttribute("deer-id"), text)    
        }
        else{
            //curator rejection, their note is tracked as a string embedded in the moderating Annotation.
            //this is handled in the callback()
            comment = text
        }
        document.querySelector('.modal').remove()
        callback(comment)
    })
    //Do not save a comment and do the callback for recording the rejection
    document.querySelector('.modal button[role="nomessage"]').addEventListener('click', async ev => {
        ev.preventDefault()
        const conf = confirm("This record will be rejected.  Click OK to continue")
        if(!conf){return}
        document.querySelector('.modal').remove()
        callback("")
    })
}


/**
 * Save or overwrite the commenting Annotation if the user is a reviewer.  Supports returnByReviewer().
 * Curator comments are not tracked by a separate Annotation.  They are embedded as resultComment in the moderating Annotation.
 * That resultComment is handled directly in curatorReturn()
 */ 
async function saveComment(target, text, motiv) {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const queryComment = {
        "body.comment": { $exists: true },
        "motivation" : "commenting",
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] },
        target
    }
    let commented = await fetch("http://tinypaul.rerum.io/dla/query", {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryComment)
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))

    const comment = {
        "@context": "http://www.w3.org/ns/anno.jsonld",
        type: "Annotation",
        target,
        motivation: "commenting",
        body:{
            comment: {
                type: "Comment",
                author: DLA_USER['http://store.rerum.io/agent'],
                text
            }    
        }
    }

    let commentFetch = (commented.length === 0)
        ? fetch("http://tinypaul.rerum.io/dla/create", {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(comment),
            headers
        })
        : fetch("http://tinypaul.rerum.io/dla/overwrite", {
            method: 'PUT',
            mode: 'cors',
            body: JSON.stringify(comment),
            headers
        })
    return commentFetch
        .then(res => res.ok ? res.headers.get('location') : Promise.reject(res))
}

/**
 * Add this record to the published list
 */ 
async function curatorApproval() {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const selectedCollection = collections.querySelector("select").selectedOptions[0]
    const activeCollection = collectionMap.get(selectedCollection.value)
    const activeRecord = await fetch(activeCollection.managed)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(array => array.itemListElement.find(r => r['@id'] === preview.getAttribute("deer-id")))
    let list = await fetch(activeCollection.public)
        .then(res => res.ok ? res.json() : Promise.reject(res))
    if (list.itemListElement.includes(activeRecord)) {
        approveBtn.replaceWith(`✔ Published`)
        return // already published, somehow
    }
    list.itemListElement.push(activeRecord)
    list.numberOfItems = list.itemListElement.length
    fetch("http://tinypaul.rerum.io/dla/overwrite", {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(list),
        headers
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(success => approveBtn.replaceWith(`✔ Published`))
    .then(ok=>{
        queue.querySelector(`[data-id="${preview.getAttribute("deer-id")}"]`).remove()
        queue.querySelector('li').click()
    })
}

/**
 * Reject the moderation into the public list.  Update the moderating Annotation.
 * Set an embedded resultMessage text (not tracked as a separate Annotation)
 */ 
async function curatorReturn() {
    const selectedCollection = collections.querySelector("select").selectedOptions[0]
    const activeCollection = collectionMap.get(selectedCollection.value)
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const queryObj = {
        "body.releasedTo": { $exists: true },
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] },
        target: preview.getAttribute("deer-id")
    }
    let moderated = await fetch("http://tinypaul.rerum.io/dla/query", {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj)
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))

    let moderation = Object.assign(moderated[0] ?? {
        "@context": "http://www.w3.org/ns/anno.jsonld",
        type: "Annotation",
        target: preview.getAttribute("deer-id"),
        motivation: "moderating",
        creator: DLA_USER['http://store.rerum.io/agent']
    })
    moderation.body = {}
    //CANNOT SAVE null INTO OUR MONGO -- objects become 404
    moderation.body.releasedTo = null
    moderation.body.resultComment = null

    const publishFetch = (reviewed.length === 0)
        ? fetch("http://tinypaul.rerum.io/dla/create", {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(moderation),
            headers
        })
        : fetch("http://tinypaul.rerum.io/dla/update", {
            method: 'PUT',
            mode: 'cors',
            body: JSON.stringify(moderation),
            headers
        })

    const callback = (commentText) => {
        if(commentText){moderation.body.resultComment = commentText}
        publishFetch
            .then(res => res.ok || Promise.reject(res))
            .then(success => approveBtn.replaceWith(`❌ Removed`))
            .then(ok=>{
                queue.querySelector(`[data-id="${activeRecord}"]`).remove()
                queue.querySelector('li').click()
            })
    }
    recordComment(callback, "moderating")
}

async function getReviewerQueue(publicCollection, managedCollection, limit = 10) {
    // items not on public list, but on managed list

    const disclusions = managedCollection.itemListElement.filter(record => !publicCollection.itemListElement.includes(record))
    let tempQueue = []

    switch (publicCollection.name) {
        case "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar":
            const historyWildcard = { $exists: true, $type: 'array', $eq: [] }
            const queryObj = {
                "body.transcriptionStatus": { $exists: true },
                "__rerum.history.next": historyWildcard
            }
            let transcribed = await fetch("http://tinypaul.rerum.io/dla/query", {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify(queryObj)
            })
                .then(res => res.ok ? res.json() : Promise.reject(res))
            while (tempQueue.length < limit) {
                let record = transcribed.pop()
                if (!record) break // used up the list
                let test = disclusions.find(item => item['@id'] === record.target)
                if (test) tempQueue.push(test) // candidate for promotion
            }
            break
        case "DLA Poems Collection":
        default: tempQueue = disclusions.slice(0, limit)
    }

    queue.innerHTML = `<h3>Queue for Review</h3>
    <ol>${tempQueue.reduce((a, b) => a += `<li data-id="${b['@id']}">${b.label}</li>`, ``)}</ol>`
    queue.querySelectorAll('li').forEach(addRecordHandlers)
}

async function getCuratorQueue(publicCollection, managedCollection, limit = 10) {
    // items not on public list, but marked for review

    const disclusions = managedCollection.itemListElement.filter(record => !publicCollection.itemListElement.includes(record))
    let tempQueue = []

    switch (publicCollection.name) {
        case "Correspondence between Paul Laurence Dunbar and Alice Moore Dunbar":
        case "DLA Poems Collection":
        default: tempQueue = disclusions.slice(0, limit)
    }

    queue.innerHTML = `<ol>${tempQueue.reduce((a, b) => a += `<li data-id="${b['@id']}">${b.label}</li>`, ``)}</ol>`
    queue.querySelectorAll('li').forEach(addRecordHandlers)
}

function attachCollectionHandler(selectElement) {
    selectElement.addEventListener('input', fetchItems)
}

function addRecordHandlers(record) {
    record.addEventListener('click', showRecordPreview)
}

function countItems(collection) {
    records.innerText = collection.numberOfItems
}

const select = document.createElement('select')
collectionMap.forEach((v, k) => {
    const opt = document.createElement('option')
    opt.classList.add('collection')
    opt.dataset.uri = v.public
    opt.dataset.managed = v.managed
    opt.innerText = opt.value = k
    select.append(opt)
})
collections.append(select)
attachCollectionHandler(select)

document.querySelector('auth-button button').addEventListener('dla-authenticated', drawUser)

if (window?.DLA_USER) drawUser()

function drawUser() {
    const roles = DLA_USER['http://dunbar.rerum.io/user_roles']?.roles.filter(role => role.includes('dunbar_user'))
    if (roles.includes("dunbar_user_curator")) user.dataset.role = "curator"
    if (roles.includes("dunbar_user_reviewer")) user.dataset.role = "reviewer"
    user.innerHTML = `
    <p>▶ Logged in as ${DLA_USER.nickname ?? DLA_USER.name} with role${roles.length > 1 ? `s` : ``} ${roles.map(r => r.split('_').pop()).join(" | ")}.</p>
    `
    const select = collections.querySelector('select')
    select.options.selected = true
    select.dispatchEvent(new Event('input'))
}
export { collectionMap }
