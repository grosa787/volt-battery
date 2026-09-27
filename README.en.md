# Volt Battery

[Русский](README.md)

A compact macOS battery monitor built with Electron and JavaScript. It shows the Mac's charge level, voltage, remaining/full/design capacity, battery health, charge cycles, and power adapter status. Mac readings refresh every 2.5 seconds; iPhone and iPad readings refresh every 10 seconds.

The Mac card shows two separate percentages: **Battery health by macOS** and the calculated **full capacity / design capacity** ratio. The raw ratio is not the same as macOS's battery health assessment.

On first launch, choose Russian or English. The choice is saved, and the RU/EN button in the top right lets you change it later.

## Install and run

Download the DMG from [Releases](https://github.com/grosa787/volt-battery/releases) and drag the app into Applications. iPhone and iPad readings require `libimobiledevice` on the Mac. To run from source: `npm install`, then `npm start`. To build a DMG: `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist`.

The app is not signed with an Apple Developer certificate. macOS may ask you to confirm the first launch in **System Settings → Privacy & Security**.

## iPhone and iPad

1. Connect the device by USB, unlock it, and tap **Trust This Computer**.
2. For Wi-Fi, open the device in Finder and enable **Show this iPhone/iPad when on Wi-Fi**. Keep the Mac and device on the same network.
3. Install the companion tools if needed: `brew install libimobiledevice`.

The app discovers paired devices automatically and combines USB and Wi-Fi sightings by device ID, preferring USB. If a device sleeps or leaves the network, its last reading remains visible for up to five minutes with a timestamp. iOS battery diagnostics vary by model and version; `—` means that a value was not available.

## Verify

Run `npm test`. To print current telemetry from source, run `node -e "require('./electron/telemetry').snapshot('all').then(console.log)"`.

References: [Apple's Wi-Fi syncing guide](https://support.apple.com/en-lk/guide/mac-help/mchlada1d602/mac), [libimobiledevice](https://github.com/libimobiledevice/libimobiledevice), [diagnostics commands](https://github.com/libimobiledevice/libimobiledevice/blob/master/docs/idevicediagnostics.1).
