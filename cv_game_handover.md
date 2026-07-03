# Recruiter CV Platformer Game - Project Handover Document

This document provides a comprehensive overview of the design, codebase architecture, hosting instructions, and personalization mechanisms for the **Interactive Career Journey Platformer**.

---

## 1. Stack & Architecture

* **Core Engine**: **Phaser v3.60.0** (WebGL / Canvas fallback, Arcade Physics).
* **Styling & Presentation**: HTML5 semantic markup + CSS3 variables, Glassmorphism panels, and fluid Grid layout.
* **Sound Effects**: Synthesized dynamically at runtime using the browser's native **Web Audio API** (zero audio file loads).
* **Vector Art**: Drawn programmatically via Phaser's **Graphics API** (zero image file loads, instant loading).
* **Hosting**: Static file hosting on **GitHub Pages** (Jekyll compiler disabled for speed).

---

## 2. File Directory

All project files are contained inside the [`resume-game/`](file:///c:/Users/RaviM/Desktop/Linkedin/resume-game) directory:

* **[`index.html`](file:///c:/Users/RaviM/Desktop/Linkedin/resume-game/index.html)**: Main dashboard page layout. Holds the two-column grid (game canvas on left, interactive cards on right), the timeline content database, the tag-safe typewriter animation script, and event listeners coordinating gameplay with the DOM.
* **[`style.css`](file:///c:/Users/RaviM/Desktop/Linkedin/resume-game/style.css)**: Stylesheets defining dark themes, glassmorphism, responsive column shifting, overlay screens, and the critical canvas size constraints.
* **[`game.js`](file:///c:/Users/RaviM/Desktop/Linkedin/resume-game/game.js)**: Holds the Phaser config, preload/create/update functions, programmatically baked body state textures, floating collectible badges, narrative obstacles, parallax silhouette assets, and Web Audio synthesizer oscillators.
* **[`verify.js`](file:///c:/Users/RaviM/Desktop/Linkedin/resume-game/verify.js)**: Automated QA test suite executing assertions inside the browser console.
* **[`Ravi_CV_07_2026.pdf`](file:///c:/Users/RaviM/Desktop/Linkedin/resume-game/Ravi_CV_07_2026.pdf)**: Up-to-date printable PDF resume linked in the call-to-action buttons.
* **[`.nojekyll`](file:///c:/Users/RaviM/Desktop/Linkedin/resume-game/.nojekyll)**: Bypasses Jekyll builds on GitHub Actions, guaranteeing instant deployment.

---

## 3. Core Mechanisms & Solutions

### A. Decoupled Event System
The Phaser game does not mutate the document structure directly. Instead, it dispatches native custom window events that `index.html` listens to:
* `cv-milestone`: Dispatched when the player crosses a flag. Details contain `{ id: 1|2|3 }` to trigger the typewriter reveal.
* `skill-collected`: Dispatched when the player touches a floating skill badge. Details contain `{ id: 'python'|'sql'|... }` to activate the corresponding sidebar badge.
* `cv-challenge`: Dispatched when the player overlaps with a red capsule obstacle. Appends a *"Challenge Overcome"* line to the stream.
* `cv-complete`: Dispatched when the player crosses the finish line. Triggers the digital business card overlay showing the final score.

### B. Tag-Safe Typewriter Animation
Using standard character-by-character appending breaks nested HTML tags (like `<li>` and `<ul>`). The custom `typewriterReveal()` function resolves this by building a temporary DOM node hierarchy, clearing all inner text node values while preserving the structural tags, moving the nodes directly into the live DOM tree via `appendChild`, and typing characters into the preserved text node references on a 15ms interval.

### C. Canvas Feedback Loop Prevention
Standard Phaser responsive configurations (`Phaser.Scale.FIT`) inside fluid grid layouts can trigger a recursive sizing loop. Because the canvas resizing increases the container width, the scale manager scales the canvas up again indefinitely. We resolved this by disabling Phaser's scaling manager in javascript and enforcing a strict CSS bounds override:
```css
#game-viewport canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
```
Since the parent `#game-viewport` container is aspect-ratio locked to 3:2 (matching the canvas), the browser GPU handles the fluid scaling with zero distortion and zero recursive scripting loops.

### D. Arcade Physics Bobbing Sync
To keep collectible hitboxes aligned with their hovering visual tweens, we sync their physics body positions with their game object coordinates inside the `update()` loop:
```javascript
skillPickups.children.iterate(child => {
  if (child && child.body) {
    child.body.updateFromGameObject();
  }
});
```

---

## 4. How to Run Locally

You can launch a lightweight web server in your terminal:
```bash
python -m http.server 8000 --directory c:\Users\RaviM\Desktop\Linkedin\resume-game
```
Then open your browser and navigate to `http://localhost:8000/`.

---

## 5. Recruiter Personalization

You can personalize the site for specific recruiters by adding the `?name=` query parameter:
* URL: `https://ravi-mr-98.github.io/ravi-cv-game/?name=Sarah`
This displays the greeting: **"Welcome, Sarah — explore Ravi's career journey below"** in the sidebar.

---

## 6. GitHub Pages Deployment Steps

1. Push your changes to your public repository:
   * URL: `https://github.com/Ravi-MR-98/ravi-cv-game`
2. Open your repository on GitHub.
3. Click the **Settings** tab.
4. Click **Pages** in the left-hand sidebar menu.
5. Under **Build and deployment**:
   * Set **Branch** to `main` and keep the directory as `/ (root)`.
   * Click **Save**.
6. The site will deploy instantly at: `https://ravi-mr-98.github.io/ravi-cv-game/`
