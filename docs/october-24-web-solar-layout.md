# October 24 web layout and Solar editor fixes

After approving the Training release with “And then push all,” the owner requested the real web layout match the landscape demo, followed by fixes to Current vibes editing and its placement below member details. Deliver these follow-ups through the normal GitHub and Firebase Hosting workflow.

Wide screens now retain the landscape composition: score on the left, tasks on the right, and the breakdown spanning the next row. Remove inherited 80% body scaling, size containment on main and score panels, and fixed-height grid rows. Panels and task lists grow with content and the clock remains below main. Remove inherited nested scrolling from daily cards, planning columns, and Calendar where ordinary document flow suffices.

The shared modal geometry now uses VisualViewport height, width and offsets, with window-size fallbacks. Keyboard resizing, viewport panning, focus and orientation resizing update those bounds. A focused text editor scrolls within its dialog when necessary, without calling page scrollIntoView or replacing its draft. Background scrolling is locked while a dialog is open. The Current vibes textarea has bounded height and cannot be dragged larger than its editor.

Solar member vibes span both the identity and scoring columns. The owner label is 7px UI text, distinct from the handwritten name and vibes. The member card stays a grid; its detail wrapper uses display:contents so vibes can occupy the whole next row.

Validation includes regression tests for keyboard resize/pan, dialog-only editor reveal, preserved draft text, orientation width changes, cleanup, and browsers without VisualViewport. Browser sample QA checked a phone editor at reduced available heights and rotated dimensions, with its field inside the dialog bounds and page scroll remaining zero. Desktop Overview, Training, Nutrition, Sentiments, To-do and Calendar showed no horizontal overflow. A long task list pushed Breakdown and the clock below it with visible gaps. Windows viewport checks do not certify physical iPhone keyboard behavior.

Training release checkpoint: 82f483dd84b5ccec693759ba7cfbe35b4ceea6ff, deployed to pocketplanet.day with matching file hashes. Keep unrelated reminder policy changes and local preview fixtures out of this follow-up release.

## Mobile settings and module navigation

The owner also requested a complete mobile settings readability pass. Module selection is now one full-width row per module, with 14px UI names, Enabled/Disabled status, a checkbox and two 44px ordering buttons. A mobile section picker replaces the cramped seven-button navigation. Choice descriptions, hints, section titles and actions use larger type. Settings landing actions and expandable groups share borders and spacing; the name editor stacks naturally on phones. Editing a checkbox or goal no longer resets the settings scroll position. The section picker and desktop navigation stay synchronized with the setup flow, and enabled modules/order still save through the existing validated settings model.

Overview now uses the same label grid row and alignment as other module buttons, retaining its unnumbered marker. Browser sample QA verified module reorder/save persistence, enabling Sleep, and single-line module names at 320px. No settings data model or scoring changes are introduced by this presentation pass.

Final regular suite: 245 tests, 244 passed, one emulator-only skip. No Firestore rule changes. The phone module labels, including Overview, measured the same 31px vertical offset and centered alignment. At 1280px, a long task list ended at 1641px, Breakdown began at 1661px, and the clock began at 1923px below main; no horizontal overflow was reported. The focused vibes field remained within the dialog at reduced 312×240 and rotated 675×312 CSS viewports, with unchanged draft text and zero page scrolling.
