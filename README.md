# PAKADEX – weekly unit logistics management system

> מערכת Web לניהול דרישות, הקצאות ולו"ז שבועי ליחידות – נבנתה מאפס, ללא פריימוורקים, ומשמשת בפועל ביום-יום.

PAKADEX is a client-side web application that lets a brigade staff and its subordinate battalions plan weekly requirements and allocations in one place. Units enter what they need, the manager reviews and imports it into a master table, publishes the approved result, and every unit then sees its own allocations. It is written in vanilla HTML / CSS / JavaScript and stores its data as JSON files in a SharePoint document library through the REST API, with a local cache so the UI stays fast.

## Main features

- **Weekly master tables** (communication, optics, intelligence) with per-battalion and total calculations that update as you type.
- **Request → import → publish → allocation workflow.** Units save their requirements, the manager imports them (changed cells are highlighted until published), then publishes; units only ever see what has been published.
- **Dynamic structure.** The manager can add or remove equipment rows, and add, edit, remove or restore companies (for a limited number of weeks or permanently); every table, sum, import and copy action adapts to the layout of the selected week.
- **Copy a week / paste to the rest of the year**, undo / redo, topic search across weeks, Hebrew date and holiday banner.
- **Scheduling grids** for rooms and the canteen with drag-and-drop, resize, copy / paste, conflict detection and automatic placement of approved requests.
- **Medical-response planning** with per-unit colours and time ranges.
- **Role-based permissions:** admin, editor, read-only and per-unit users, enforced on every page.
- **Resilient sync.** Writes go to the local cache immediately and to SharePoint afterwards; failed writes are queued and retried, and a periodic refresh keeps several users in sync without disturbing active typing.

## Architecture

```
index.html, kesher.html, optic.html, modiein.html, ...   pages (manager views + one page per unit)
script.js              tables, calculations, import / publish, scheduling grids, undo, navigation
sharepointService.js   DataService: local cache + SharePoint REST + offline queue + auto-sync
auth.js                users, roles and permissions
config.js              data source (sharepoint / local) and sync interval
*.css                  styles (RTL, self-hosted fonts)
```

Data model: one JSON file per table per week (`<table>_week<N>_year<YYYY>`), plus a `_published` copy that unit users read. Columns that exist only for some weeks are stored under explicit keys, so existing data never has to be migrated when the structure changes.

## Run it locally

1. Serve the folder with any static server, for example `npx serve .`
2. In `config.js` set `DATA_SOURCE: 'local'` so data stays in the browser (`localStorage`).
3. Open `index.html`. When the user list is empty, the first person who identifies becomes the administrator.

For a real deployment, set `DATA_SOURCE: 'sharepoint'` and point `SHAREPOINT.SITE_URL` / `FOLDER_PATH` at a site and document library you control.

## What I learned building it

Designing a data model that can change shape without migrations, keeping many users consistent on a file-based back end, preventing race conditions between slow network responses and fast navigation, and testing UI behaviour end-to-end with a headless browser against a mocked REST server.

Built by Yarin Shitrit.
