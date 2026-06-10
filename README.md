# OneWeb React Native Simulator

React Native / Expo version of the OneWeb Core Network 3D simulator.

## Model

- 648 satellites
- 12 orbital planes
- 54 satellites per plane
- Equal angular spacing: 360 / 54 = 6.666667 degrees
- Fixed Earth/camera by default
- Satellites move along colored orbital paths
- Manual camera drag, left/right rotation, tilt, zoom, and speed controls
- AAA, QoS, gateway diversity, satellite handover, and gateway make-before-break handover

## Run on iPhone with Expo Go

```powershell
cd "C:\Users\Alex\OneDrive\Documents\OneWeb Core Network\oneweb-rn-simulator"
npm install
npm run ios
```

You can also run:

```powershell
npm start
```

Then scan the QR code with Expo Go on your iPhone.

## Build for iPhone

For a native iOS build, use Expo/EAS or copy `App.js` into an existing React Native project that already has `react-native-svg` installed.
