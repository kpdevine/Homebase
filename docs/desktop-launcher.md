# Desktop launcher

Double-click **Pocket Planet** on the Windows Desktop. It starts the loopback server in the background when needed, waits for Pocket Planet to respond, then opens the personal workspace at `http://127.0.0.1:4173/` in the default browser. Repeated launches reuse a responding Pocket Planet server. Another application on that port produces an error rather than silently switching addresses.

The browser must use the same profile to retain its local records. The preview at port 4174 with `?preview=1`, the personal workspace, and different browsers all have separate local storage. Existing preview records are left intact. The launcher does not upload or migrate them.

`scripts/install-desktop-shortcut.ps1` recreates the shortcut using the current workspace and actual Windows Desktop location. `scripts/start-homebase.ps1 -NoBrowser` verifies/starts the server without opening a browser. Node.js must remain installed. Runtime logs are in the ignored `.local` directory. Errors appear in a message box when launched from the shortcut.

The app keeps running after its terminal closes. Closing a browser tab does not stop the background server. After a computer restart, the next shortcut launch starts it again. This is a local launcher, not a hosted phone/display deployment.

Verified on October 17, 2026: a stopped server started successfully; the next launch reused it; the `.lnk` points to the saved launcher and correct workspace.
