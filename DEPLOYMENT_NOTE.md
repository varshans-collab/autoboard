# AutoBoard Deployment Note

## Final Live App

Main demo:

https://autoboard-8e77c.web.app/stand/silkboard

Firebase Hosting root:

https://autoboard-8e77c.web.app

## Final Passenger Flow

1. Passenger scans the QR board at a stand.
2. The correct stand page opens automatically.
3. Passenger sees the live route board first.
4. Passenger can search or say a destination at the top.
5. When the destination is selected, the report panel opens directly to Tap 2.
6. Passenger taps wait time.
7. Firebase Realtime Database updates the board for everyone.

## Final Pilot Stands

- Majestic
- Shivajinagar Bus Stand
- KR Market
- Silk Board
- Hebbal

## Live Passenger Links

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

## Deploy Commands

Run these from the project folder:

```powershell
cd "C:\Users\VARSHA N S\OneDrive\文件\New project"
firebase login
firebase deploy
```

If Firebase tools are not installed:

```powershell
npm install -g firebase-tools
```

## Submission Text

AutoBoard is a Firebase-powered live shared auto route board for Bengaluru stands. QR boards at each stand open the correct passenger page, passengers see active routes first, and anyone who just boarded can update the board in two taps. The app uses Firebase Hosting and Firebase Realtime Database.
