const express = require("express");
const fs = require("fs");
const path = require("path");
const prettier = require("prettier");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let ROOT = null;
let MAIN, BACKUP, MODIFIED, INDEX;

// 🧠 Autopilot JS block
const autopilotBlock = `enterPointingToHorizon: true,
initialPosition: { yaw: -160.06, class: "PanoramaCameraPosition", pitch: -2.09 },
initialSequence: {
  mandatory: true,
  movements: [
    {
      targetYaw: 179,
      targetPitch: 0,
      path: "longest",
      duration: 2000,
      easing: "cubic_in_out",
      class: "TargetPanoramaCameraMovement"
    }
  ],
  class: "PanoramaCameraSequence"
}`;

// 🔄 Set global paths after folder input
function setPaths(folderPath) {
  ROOT = folderPath;
  MAIN = path.join(ROOT, "script_general.js");
  BACKUP = path.join(ROOT, "backup_script_general.js");
  MODIFIED = path.join(ROOT, "modified_script_general.js");
  INDEX = path.join(ROOT, "index.htm");
  app.use(express.static(ROOT)); // Serve updated static files
}

// ✨ Prettify JS using Prettier
async function prettify(code) {
  try {
    return await prettier.format(code, { parser: "babel" });
  } catch (err) {
    console.warn("⚠️ Prettier failed:", err.message);
    return code;
  }
}

// 🧠 Inject autopilot logic into the script
function injectAutopilot(rawCode) {
  const regex = /(initialSequence\s*:\s*)"this\.sequence_[A-Z0-9_]+?"/g;
  const matches = [...rawCode.matchAll(regex)];
  const modifiedCode = rawCode.replace(regex, autopilotBlock);
  return { modifiedCode, count: matches.length };
}

// 🧩 Inject UI buttons and script into index.htm
function patchIndexFile() {
  const html = fs.readFileSync(INDEX, "utf-8");
  const alreadyHasUI = html.includes("autopilot-controls");

  if (alreadyHasUI) {
    console.log("✅ Autopilot controls already present in index.htm");
    return;
  }

  const controlsHTML = `
    <!-- 🔘 Autopilot Control Buttons -->
    <div id="autopilot-controls">
      <button onclick="enableAutopilot()">▶️ Enable Autopilot</button>
      <button onclick="disableAutopilot()">⛔ Disable Autopilot</button>
    </div>

    <script>
      var devicesUrl = { general: "script_general.js" };
      async function enableAutopilot() {
        await fetch("/enable-autopilot", { method: "POST" });
        localStorage.setItem("autopilotEnabled", "true");
        devicesUrl.general = "modified_script_general.js?v=" + Date.now();
        window.location.reload();
      }

      async function disableAutopilot() {
        await fetch("/disable-autopilot", { method: "POST" });
        localStorage.setItem("autopilotEnabled", "false");
        devicesUrl.general = "script_general.js?v=" + Date.now();
        window.location.reload();
      }

      (function init() {
        const mode = localStorage.getItem("autopilotEnabled");
        devicesUrl.general = (mode === "true" ? "modified_script_general.js" : "script_general.js") + "?v=" + Date.now();
      })();
    </script>

    <style>
      #autopilot-controls {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 999;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #autopilot-controls button {
        padding: 10px 15px;
        background: #0f172a;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        transition: background 0.2s;
      }
      #autopilot-controls button:hover {
        background: #1e293b;
      }
    </style>`;

  const updated = html.replace("</body>", `${controlsHTML}\n</body>`);
  fs.writeFileSync(INDEX, updated, "utf-8");
  console.log("✅ Autopilot UI injected into index.htm");
}

// 📦 Create backup, modified files, and patch UI
async function initializeFiles() {
  patchIndexFile();

  if (!fs.existsSync(BACKUP)) {
    fs.copyFileSync(MAIN, BACKUP);
    console.log("📦 Backup created.");
  }

  const raw = fs.readFileSync(MAIN, "utf-8");
  const pretty = await prettify(raw);
  const { modifiedCode, count } = injectAutopilot(pretty);
  const final = await prettify(modifiedCode);
  fs.writeFileSync(MODIFIED, final, "utf-8");
  console.log(`✅ Autopilot version created (${count} panoramas updated).`);
}

// 🎯 Endpoint to set user folder path from frontend
app.post("/set-path", async (req, res) => {
  const folderPath = req.body.path;
  if (!folderPath) {
    return res.status(400).json({ success: false, message: "No path provided." });
  }

  if (!fs.existsSync(folderPath)) {
    return res.status(400).json({ success: false, message: "Folder not found." });
  }

  if (!fs.existsSync(path.join(folderPath, "script_general.js"))) {
    return res.status(400).json({ success: false, message: "Missing script_general.js" });
  }

  try {
    setPaths(folderPath);
    await initializeFiles();
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed:", err);
    res.status(500).json({ success: false, message: "Internal error." });
  }
});

// ▶️ Enable autopilot
app.post("/enable-autopilot", (req, res) => {
  try {
    fs.copyFileSync(MODIFIED, MAIN);
    console.log("🔁 Autopilot script applied.");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to enable autopilot." });
  }
});

// ⏹️ Disable autopilot
app.post("/disable-autopilot", (req, res) => {
  try {
    fs.copyFileSync(BACKUP, MAIN);
    console.log("🔁 Original script restored.");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to disable autopilot." });
  }
});

// Root route
app.get("/", (req, res) => {
  if (!INDEX || !fs.existsSync(INDEX)) {
    return res.send("👋 Please set your folder path using POST /set-path");
  }
  res.sendFile(INDEX);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log("📭 Awaiting user to submit their folder path via UI.");
});
