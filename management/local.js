const collectionsFile = await fetch('/manage/collections').then(res => res.json())
const collectionMap = new Map(Object.entries(collectionsFile))

function fetchItems(event) {
    return Promise.all([fetch(event.target.dataset.uri).then(res => res.json()),
    fetch(event.target.dataset.managed).then(res => res.json())])
        .then(([publicCollection, managedCollection]) => {
            countItems(publicCollection)
            if (DLA_USER['http://dunbar.rerum.io/user_roles'].roles.includes('dunbar_user_reviewer')) {
                getReviewerQueue(publicCollection, managedCollection)
            }
            if (DLA_USER['http://dunbar.rerum.io/user_roles'].roles.includes('dunbar_user_curator')) {
                getCuratorQueue(publicCollection, managedCollection)
            }
        })
}

function showRecordPreview(event){
    preview.setAttribute("deer-id",event.target.dataset.id)
    preview.setAttribute("deer-template","entity")
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

function addRecordHandlers(record){
    record.addEventListener('click', showRecordPreview)
}

function countItems(collection) {
    records.innerText = collection.numberOfItems
}

collectionMap.forEach((v, k) => {
    const btn = document.createElement('button')
    btn.classList.add('collections')
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
    user.innerHTML = `
    <p>▶ Logged in as ${DLA_USER.nickname ?? DLA_USER.name} with role${roles.length > 1 ? `s` : ``} ${roles.map(r => r.split('_').pop()).join(" | ")}.</p>
    `
}
export { collectionMap }
