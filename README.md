# AutoBoard

AutoBoard is a crowdsourced real-time route board for shared autorickshaw stands in Bengaluru.

Passengers scan a QR board at an auto stand, see live routes reported in the last 30 minutes, and can report the auto they just boarded in two taps. There is no login and no driver app.

## Live Demo

https://autoboard-8e77c.web.app

Best demo stand:

https://autoboard-8e77c.web.app/stand/silkboard

## Final Pilot Stands

- Majestic
- Shivajinagar Bus Stand
- KR Market
- Silk Board
- Hebbal

## Passenger Links

- https://autoboard-8e77c.web.app/stand/majestic
- https://autoboard-8e77c.web.app/stand/shivajinagar
- https://autoboard-8e77c.web.app/stand/krmarket
- https://autoboard-8e77c.web.app/stand/silkboard
- https://autoboard-8e77c.web.app/stand/hebbal

## QR Board Links

- https://autoboard-8e77c.web.app/board.html?stand=majestic
- https://autoboard-8e77c.web.app/board.html?stand=shivajinagar
- https://autoboard-8e77c.web.app/board.html?stand=krmarket
- https://autoboard-8e77c.web.app/board.html?stand=silkboard
- https://autoboard-8e77c.web.app/board.html?stand=hebbal

## Tech Stack

- HTML
- CSS
- JavaScript
- Firebase Hosting
- Firebase Realtime Database

## Firebase Data Path

Passenger reports are written to:

```text
stands/{standId}/requests/{requestId}
```

Each report contains:

```text
standId
standName
routeId
origin
destination
waitTime
timestamp
```

## Deploy

```powershell
npm install -g firebase-tools
firebase login
firebase deploy
```
