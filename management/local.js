const collectionsFile = await fetch('/manage/collections').then(res => res.json())
const collectionMap = new Map(Object.entries(collectionsFile))

function fetchItems(event) {
    return Promise.all([fetch(event.target.dataset.uri).then(res => res.json()),
    fetch(event.target.dataset.managed).then(res => res.json())])
        .then(([publicCollection, managedCollection]) => {
            countItems(publicCollection)
            if (DLA_USER['http://dunbar.rerum.io/user_roles'].roles.includes('dunbar_user_reviewer')) {
                getReviewerQueue(publicCollection, managedCollection)
                approveBtn.addEventListener('click', approveByReviewer)
                returnBtn.addEventListener('click', returnByReviewer)
            }
            if (DLA_USER['http://dunbar.rerum.io/user_roles'].roles.includes('dunbar_user_curator')) {
                getCuratorQueue(publicCollection, managedCollection)
                approveBtn.addEventListener('click', curatorApproval)
                returnBtn.addEventListener('click', curatorReturn)
            }
            queue.querySelector('li').click()
            collections.querySelector(".selected")?.classList.remove("selected")
            event.target.classList.add('selected')
        })
}

function showRecordPreview(event) {
    preview.setAttribute("deer-template", "preview")
    preview.setAttribute("deer-id", event.target.dataset.id)
    queue.querySelector(".selected")?.classList.remove("selected")
    event.target.classList.add('selected')
}

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
    const activeCollection = collectionMap.get(collections.querySelector('.collection.selected').innerText)
    let reviewed = await fetch("http://tinypaul.rerum.io/dla/query", {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj)
    })
        .then(res => res.ok ? res.json() : Promise.reject(res))

    const reviewComment = Object.assign(reviewed[0] ?? {
        "@context": "http://www.w3.org/ns/anno.jsonld",
        type: "Annotation",
        target: preview.getAttribute("deer-id"),
        motivation: "moderating"
    }, {
        creator: DLA_USER['http://store.rerum.io/agent'],
        body: {
            releaseTo: activeCollection.public,
            resultComment: null
        }
    })

    const publishFetch = (reviewed.length === 0)
        ? fetch("http://tinypaul.rerum.io/DLA/create", {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(reviewComment),
            headers
        })
        : fetch("http://tinypaul.rerum.io/DLA/overwrite", {
            method: 'PUT',
            mode: 'cors',
            body: JSON.stringify(reviewComment),
            headers
        })
    publishFetch
        .then(res => res.ok || Promise.reject(res))
        .then(success => approveBtn.replaceWith("✔ published"))
    // TODO: clear item from queue and refresh
}

async function returnByReviewer() {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const activeCollection = collectionMap.get(collections.querySelector('.collection.selected').innerText)
    const managedlist = await fetch(activeCollection.managed)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(list => {
            list.itemListElement = list.itemListElement.filter(r => r['@id'] !== preview.getAttribute("deer-id"))
            list.numberOfItems = list.itemListElement.length
            return list
        })
    const callback = fetch("http://tinypaul.rerum.io/DLA/overwrite", {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(managedlist),
        headers
    })
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(success => approveBtn.replaceWith(`❌ Removed`))

    recordComment(callback)
}

async function recordComment(callback) {
    const modalComment = document.createElement('div')
    modalComment.classList.add('modal')
    modalComment.innerHTML = `
    <header>Return with comment</header>
    <p> Explain why this Record is not ready for release or request changes. </p>
    <textarea></textarea>
    <button role="button">Commit message</button>
    <a href="#" onclick="this.parentElement.remove">❌ Cancel</a>
    `
    document.body.append(modalComment)
    document.querySelector('.modal button').addEventListener('click', async ev => {
        ev.preventDefault()
        const text = document.querySelector('.modal textarea').value
        const commentID = await saveComment(preview.getAttribute("deer-id"), text)
        callback(commentID)
    })
}

async function saveComment(target, text) {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const queryObj = {
        "body.comment": { $exists: true },
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] },
        target
    }


    let commented = await fetch("http://tinypaul.rerum.io/dla/query", {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj)
    })
        .then(res => res.ok ? res.json() : Promise.reject(res))

    const dismissingComment = Object.assign(commented[0] ?? {
        "@context": "http://www.w3.org/ns/anno.jsonld",
        type: "Annotation",
        target,
        motivation: "moderating"
    }, {
        comment: {
            type: "Comment",
            author: DLA_USER['http://store.rerum.io/agent'],
            text
        }
    })
    let commentFetch = (commented.length === 0)
        ? fetch("http://tinypaul.rerum.io/DLA/create", {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(dismissingComment),
            headers
        })
        : fetch("http://tinypaul.rerum.io/DLA/update", {
            method: 'PUT',
            mode: 'cors',
            body: JSON.stringify(dismissingComment),
            headers
        })
    return commentFetch
        .then(res => res.ok ? res.headers.get('location') : Promise.reject(res))
}

async function curatorApproval() {
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const activeCollection = collectionMap.get(collections.querySelector('.collection.selected').innerText)
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
    fetch("http://tinypaul.rerum.io/DLA/update", {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(list),
        headers
    })
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(success => approveBtn.replaceWith(`✔ Published`))
}
async function curatorReturn() {
    const activeCollection = collectionMap.get(collections.querySelector('.collection.selected').innerText)
    const activeRecord = preview.getAttribute("deer-id")
    // TODO: This is nearly a straight C/P frpm above
    const headers = {
        'Authorization': `Bearer ${window.DLA_USER?.authorization}`,
        'Content-Type': "application/json; charset=utf-8"
    }
    const queryObj = {
        "body.releasedTo": { $exists: true },
        "__rerum.history.next": { $exists: true, $type: 'array', $eq: [] },
        target: preview.getAttribute("deer-id")
    }
    let reviewed = await fetch("http://tinypaul.rerum.io/dla/query", {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj)
    })
        .then(res => res.ok ? res.json() : Promise.reject(res))

    const reviewComment = Object.assign(reviewed[0] ?? {
        "@context": "http://www.w3.org/ns/anno.jsonld",
        type: "Annotation",
        target: preview.getAttribute("deer-id"),
        motivation: "moderating"
    }, {
        creator: DLA_USER['http://store.rerum.io/agent'],
        body: {
            releaseTo: null,
            resultComment: null
        }
    })

    const publishFetch = (reviewed.length === 0)
        ? fetch("http://tinypaul.rerum.io/DLA/create", {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(reviewComment),
            headers
        })
        : fetch("http://tinypaul.rerum.io/DLA/overwrite", {
            method: 'PUT',
            mode: 'cors',
            body: JSON.stringify(reviewComment),
            headers
        })

    const callback = commentID => {
        reviewComment.body.resultComment = commentID
        publishFetch
            .then(res => res.ok || Promise.reject(res))
            .then(success => approveBtn.replaceWith("✔ published"))
    }

    recordComment(callback)
    // TODO: clear item from queue and refresh

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

    queue.innerHTML = `<ol>${tempQueue.reduce((a, b) => a += `<li data-id="${b['@id']}">${b.label}</li>`, ``)}</ol>`
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

function attachCollectionHandlers(button) {
    button.addEventListener('click', fetchItems)
}

function addRecordHandlers(record) {
    record.addEventListener('click', showRecordPreview)
}

function countItems(collection) {
    records.innerText = collection.numberOfItems
}

collectionMap.forEach((v, k) => {
    const btn = document.createElement('a')
    btn.classList.add('collection')
    btn.dataset.uri = v.public
    btn.dataset.managed = v.managed
    btn.innerText = k
    collections.append(btn)
    attachCollectionHandlers(btn)
})

document.querySelector('auth-button button').addEventListener('dla-authenticated', drawUser)

if (window?.DLA_USER) drawUser()

function drawUser() {
    const roles = DLA_USER['http://dunbar.rerum.io/user_roles']?.roles.filter(role => role.includes('dunbar_user'))
    if (roles.includes("dunbar_user_curator")) user.dataset.role = "curator"
    if (roles.includes("dunbar_user_reviewer")) user.dataset.role = "reviewer"
    user.innerHTML = `
    <p>▶ Logged in as ${DLA_USER.nickname ?? DLA_USER.name} with role${roles.length > 1 ? `s` : ``} ${roles.map(r => r.split('_').pop()).join(" | ")}.</p>
    `
    collections.querySelector('.collection').click()
}
export { collectionMap }
