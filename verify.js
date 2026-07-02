console.log("=== STARTING QA VERIFICATION CHECKS ===");

// 1. Verify Phaser Configuration
if (typeof Phaser === "undefined") {
  console.error("FAIL: Phaser is not defined. CDN import failed.");
} else {
  console.log("PASS: Phaser framework successfully loaded.");
}

// 2. Verify Name Updates
const authorName = document.getElementById("author-name").innerText;
if (authorName === "Ravi Mukesh") {
  console.log("PASS: CV Author name matches 'Ravi Mukesh'.");
} else {
  console.error(`FAIL: Name is '${authorName}', expected 'Ravi Mukesh'`);
}

// 3. Test Skip Button presence
const skipBtn = document.getElementById("skip-to-cv");
if (skipBtn) {
  console.log("PASS: 'Skip to Full CV' navigation button is present.");
} else {
  console.error("FAIL: Skip to CV button is missing.");
}

// 4. Test Chapter HUD active status element presence
const activeChapter = document.getElementById("hud-active-chapter");
if (activeChapter) {
  console.log("PASS: Sidebar chapter HUD label is present.");
} else {
  console.error("FAIL: Sidebar chapter HUD label is missing.");
}

// 5. Test Start Overlay elements
const startBtn = document.getElementById("start-game-btn");
if (startBtn) {
  console.log("PASS: Start Journey button is present.");
} else {
  console.error("FAIL: Start Journey button is missing.");
}

console.log("=== QA VERIFICATION CHECKS COMPLETE ===");
