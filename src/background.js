
const DELAY = 1
const ALARM_NAME = "pos_alarm"
const BOOKMARK_FOLDER = "Pile of Shame"
const SUPPORTED_PROTOCOLS = ["http:", "https:"]
const TITLE_ENABLE = "Enable Pile of Shame"
const TITLE_DISABLE = "Disable Pile of Shame"

let folder_guid

// TODO
//  1. add record of each tab to storage
//  2. set alarm for tab sweep check
//  3. archive old tabs to bookmarks
// OPTIONAL
//  * notify on load a url already in the pile
//  * page action to disable extension on a specific tab

browser.tabs.onActivated.addListener((activeInfo) => {
  console.debug("Tab " + activeInfo.tabId + " was activated")
  browser.tabs.get(activeInfo.tabId).then((tab) => {
    console.debug("onActivated reset start time for tab " + tab.id)
    updateRecord(tab, { start: Date.now() })
  })
})


function updateRecord(tab, params) {
  let { start: start, disabled: disabled } = params
  console.debug("tab: " + tab.id)
  console.debug("start: " + start)
  console.debug("disabled: " + disabled)

  let key = tab.url.split("#")[0]
  browser.storage.local.get(key).then((result) => {
    console.debug("Tab " + tab.id + " was updated (" + tab.url + ")")

    let record = {}

    if (result.hasOwnProperty(key)) {
      record = result[key]
    }

    if (start !== undefined) {
      record.start = start
    }

    if (disabled !== undefined) {
      record.disabled = disabled
    }

    browser.storage.local.set({
      [key]: record
    })

  })
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url) {
    return
  }

  console.debug("onUpdated reset start time for tab " + tab.id)
  updateRecord(tab, { start: Date.now() })

  if (tab.incognito !== true && tab.pinned !== true && tab.audible !== true) {
    browser.pageAction.show(tab.id)
  }
})

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  browser.tabs.get(tabId).then((tab) => {
    if (removeInfo.isWindowClosing) {
      return
    }

    // remove from database
    let key = tab.url.split("#")[0]
    browser.storage.local.remove(key)
  })
})

browser.alarms.onAlarm.addListener((alarm) => {
  console.debug("alarm " + alarm.name + " triggered")
  if (alarm.name === ALARM_NAME) {
    tabSweep()
  }
})

function displayPageAction(tab) {

  browser.pageAction.show(tab.id)

  let key = tab.url.split("#")[0]
  console.log("key: " + key)
  browser.storage.local.get(key).then((result) => {
    let record = { disabled: false }

    if (result.hasOwnProperty(key)) {
      console.log("result has key " + key)
      record = Object.assign(record, result[key])
    }

    console.log("page action disabled " + record.disabled + " for tab " + tab.id)

    browser.pageAction.setIcon({
      tabId: tab.id,
      path: (record.disabled) ? "icons/disabled.svg" : "icons/enabled.svg"
    })

    browser.pageAction.setTitle({
      tabId: tab.id,
      title: (record.disabled) ? TITLE_ENABLE : TITLE_DISABLE
    })
  })

}

function togglePageAction(tab) {
  let key = tab.url.split("#")[0]
  console.log("key: " + key)
  browser.storage.local.get(key).then((result) => {
    let record = { disabled: false }

    if (result.hasOwnProperty(key)) {
      console.log("result has key " + key)
      record = Object.assign(record, result[key])
    }

    console.log("page action disabled " + record.disabled + " for tab " + tab.id)

    let value = Object.assign(record, { disabled: !record.disabled })
    browser.storage.local.set({
      [key]: value
    }).then(() => {
      displayPageAction(tab)
    })
  })
}

browser.pageAction.onClicked.addListener((tab) => {
  console.debug("pageAction.onClicked tab " + tab.id)
  togglePageAction(tab)
})

function archiveTab(tab) {
  if (tab.incognito === true || tab.pinned === true || tab.audible === true) {
    return
  }

  console.debug("archive tab " + tab.id + ", url: " + tab.url)
  browser.bookmarks.create({ title: tab.title, url: tab.url, parentId: folder_guid }).then(() => {
    let key = tab.url.split("#")[0]
    browser.storage.local.remove(key)
    browser.tabs.remove(tab.id)
  })
}

function checkTab(tab, age_limit) {
  console.debug("checkTab called for " + tab.id)
  if (tab.incognito === true || tab.pinned === true || tab.audible === true) {
    return
  }

  if (!isSupportedProtocol(tab.url)) {
    console.debug("Tab " + tab.id + " url scheme is unsupported (" + tab.url + ")")
    return
  }

  let key = tab.url.split("#")[0]
  browser.storage.local.get(key).then((result) => {
    let record = {
      start: tab.lastAccessed,
      disabled: false
    }

    if (result.hasOwnProperty(key)) {
      record = Object.assign(record, result[key])
    }

    let age = Date.now() - record.start
    console.debug("check tab " + tab.id + ", disabled: " + record.disabled + ", age: " + age)
    if (!record.disabled && age > age_limit) {
      archiveTab(tab)
    }
  })
}

function isSupportedProtocol(url) {
  var anchor = document.createElement("a")
  anchor.href = url;
  return SUPPORTED_PROTOCOLS.includes(anchor.protocol)
}

function tabSweep() {
  console.debug("performing tab sweep")
  browser.storage.local.get("max_age").then((result) => {
    let max_age = ((result.hasOwnProperty("max_age")) ? result.max_age : 1) * 60 * 1000
    console.debug("max age: " + max_age + "ms")

    browser.tabs.query({
      active: false,
      audible: false,
      pinned: false
    }).then((tabs) => {
      for (let tab of tabs) {
        checkTab(tab, max_age)
      }
    })
  })
}

function setup() {
  browser.alarms.clear(ALARM_NAME)

  browser.bookmarks.search({ title: BOOKMARK_FOLDER} ).then((result) => {
    if (result.length) {
      // move on down the chain
      return Promise.resolve(result)
    } else {
      return browser.bookmarks.create({
        title: BOOKMARK_FOLDER,
        type: "folder"
      })
    }
  }).then((root) => {
    folder_guid = root.id
  })

  browser.tabs.query({}).then((tabs) => {
    for (let tab of tabs) {
      if (tab.incognito === true) {
        continue
      }

      if (!isSupportedProtocol(tab.url)) {
        console.debug("Tab " + tab.id + " url scheme is unsupported (" + tab.url + ")")
        continue
      }

      // update database
      let key = tab.url.split("#")[0]
      console.debug("key: " + key)

      browser.storage.local.get(key).then((result) => {
        let record = {
          start: Date.now(),
          disabled: false
        }

        if (result.hasOwnProperty(key)) {
          record = Object.assign(record, result[key])
        } else {
          browser.storage.local.set({ [key]: record })
        }

        displayPageAction(tab)
      })
    }
  })

  browser.alarms.create(ALARM_NAME, { periodInMinutes: DELAY })
}

setup()
