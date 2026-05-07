# AutoBoard Submission

## What AutoBoard Solves

Passengers at shared autorickshaw stands often do not know whether an auto is currently taking their route. AutoBoard turns each stand into a live passenger-powered board. A passenger scans the QR code at the stand, checks recent routes, and reports their own boarded route in two taps.

## Final Pilot Board Stands

These are the five board-ready pilot stands for the demo:

1. Majestic
2. Shivajinagar Bus Stand
3. KR Market
4. Silk Board
5. Hebbal

The app also keeps extra nearby stands in the data, but the pitch should focus on these seven.

## Live Passenger Links

- https://autoboard-8e77c.web.app/stand/majestic
- https://autoboard-8e77c.web.app/stand/shivajinagar
- https://autoboard-8e77c.web.app/stand/krmarket
- https://autoboard-8e77c.web.app/stand/silkboard
- https://autoboard-8e77c.web.app/stand/hebbal

## QR Board Links

Open each link, print the page, and place that QR board at the matching auto stand:

- https://autoboard-8e77c.web.app/board.html?stand=majestic
- https://autoboard-8e77c.web.app/board.html?stand=shivajinagar
- https://autoboard-8e77c.web.app/board.html?stand=krmarket
- https://autoboard-8e77c.web.app/board.html?stand=silkboard
- https://autoboard-8e77c.web.app/board.html?stand=hebbal

## Demo Script

1. Show a QR board and explain: passengers currently guess which shared auto is active.
2. Scan the QR code. The stand page opens directly, with no login and no manual stand selection.
3. Search a destination from that stand and tap it.
4. Tap the wait time.
5. Show another phone or laptop updating live through Firebase Realtime Database.

## Deployment

```powershell
npm install -g firebase-tools
firebase login
firebase deploy
```

## Firebase

The app uses Firebase Hosting and Firebase Realtime Database.

Passenger updates are stored at:

```text
stands/{standId}/requests/{requestId}
```

Each request stores:

```text
standId, standName, routeId, origin, destination, waitTime, timestamp
```
