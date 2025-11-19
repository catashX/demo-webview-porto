import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [location, setLocation] = useState(null);
  const [picturePath, setPicturePath] = useState(null);
  const [flashlightStatus, setFlashlightStatus] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [env, setEnv] = useState(null);

  const [logs, setLogs] = useState([]);

  const log = (message) => {
    setLogs((prev) => [...prev, typeof message === 'object' ? JSON.stringify(message, null, 2) : message]);
  };

  const error = (...args) => {
    const message = args.map(a => (typeof a === "object" ? JSON.stringify(a, null, 2) : a)).join(" ");
    setLogs(prev => [...prev, `❌ ${message}`]);
  };


  // Detect environment
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10; // 5 seconds total (10 * 500ms)
    let timeoutId = null;

    const checkEnv = async () => {
      try {
        attempts++;
        log(`Attempt ${attempts}: Checking environment...`);

        if (window.flutter_inappwebview) {
          setEnv("flutter");
          log("✅ Flutter environment detected");
          return; // Stop checking
        }

        if (window.tt && typeof window.tt === 'object') {
          log("✅ Feishu SDK (tt) object found");

          // Log available methods for debugging
          const availableMethods = Object.keys(window.tt).filter(key => typeof window.tt[key] === 'function');
          log(`Available SDK methods: ${availableMethods.join(', ')}`);

          // Check SDK version
          if (window.tt.version) {
            log(`SDK version: ${window.tt.version}`);
          }

          // This is a Mini Program SDK (not Web App SDK)
          // Use tt.authorize() instead of tt.config()
          log("ℹ️ Detected Mini Program SDK - using authorize() for permissions");

          // Set environment immediately since authorize happens per-API call
          setEnv("lark");

          // No config needed - Mini Program handles auth differently
          log("✅ Ready to use Mini Program APIs");
          log("ℹ️ Permissions will be requested when you use camera/location");

          return; // Skip config check

          // Check if ready method exists
          if (typeof window.tt.ready === 'function') {
            window.tt.ready(() => {
              log("✅ Feishu SDK (tt) ready callback fired");
              setEnv("lark");
            });
          } else {
            log("⚠️ tt.ready not available, assuming ready");
            setEnv("lark");
          }

          // Check if error method exists
          if (typeof window.tt.error === 'function') {
            window.tt.error((err) => {
              error("❌ Feishu SDK error:", err);
            });
          }

          return; // Stop checking
        }

        if (attempts >= maxAttempts) {
          log("⏱️ SDK detection timeout, defaulting to web environment");
          setEnv("web");
          return;
        }

        // Continue checking
        log(`⏳ SDK not found yet (${attempts}/${maxAttempts})`);
        timeoutId = setTimeout(checkEnv, 500);

      } catch (err) {
        error("💥 Error in environment detection:", err);
        setEnv("web"); // Fallback to web on any error
      }
    };

    checkEnv();

    // Cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);


  // Main handler — works for both Flutter & Lark
  const callHandler = async (handlerName, data) => {
    if (env === "flutter") {
      try {
        const result = await window.flutter_inappwebview.callHandler(handlerName, data);
        log("Flutter result:", result);
        handleResult(handlerName, result);
      } catch (err) {
        error(err);
      }
    } else if (env === "lark" && window.tt) {
      try {
        switch (handlerName) {
          case "getLocation":
            // Try direct API call (H5 apps may not support authorize)
            log("📍 Calling getLocation directly...");
            window.tt.getLocation({
              type: "gcj02",
              success: (res) => {
                const loc = { lat: res.latitude, lng: res.longitude };
                log("✅ getLocation success:", loc);
                handleResult(handlerName, loc);
              },
              fail: (err) => {
                error("❌ getLocation failed:", err);
                log("ℹ️ H5 apps may not have access to location API");
                log("ℹ️ Consider using a Mini Program instead");
              }
            });
            break;

          case "takePicture":
            // Try direct API call (H5 apps may not support authorize)
            log("📸 Calling chooseImage directly...");
            window.tt.chooseImage({
              count: 1,
              sourceType: ["camera", "album"],
              success: (res) => {
                const photoUrl = res.tempFilePaths?.[0] || res.apFilePaths?.[0] || "mock_photo_path";
                log("✅ chooseImage success:", photoUrl);
                handleResult(handlerName, photoUrl);
              },
              fail: (err) => {
                error("❌ chooseImage failed:", err);
                log("ℹ️ H5 apps may not have access to camera API");
                log("ℹ️ Consider using a Mini Program instead");
              }
            });
            break;

          case "toggleFlashlight":
            const newFlash = !flashlightStatus;
            log("toggleFlashlight simulated:", newFlash);
            handleResult(handlerName, { flashlight: newFlash });
            break;

          case "getBatteryLevel":
            const mockBattery = Math.floor(Math.random() * 100);
            log("getBatteryLevel simulated:", mockBattery);
            handleResult(handlerName, { level: mockBattery });
            break;

          default:
            alert(`Handler ${handlerName} not implemented for Lark`);
        }
      } catch (err) {
        error("Lark handler error:", err);
      }
    } else {
      alert("Bukan di Flutter atau Lark.");
    }
  };

  // Handle result (update states)
  const handleResult = (handlerName, result) => {
    if (handlerName === "getLocation") setLocation(result);
    if (handlerName === "takePicture") setPicturePath(result);
    if (handlerName === "toggleFlashlight") setFlashlightStatus(result.flashlight);
    if (handlerName === "getBatteryLevel") setBatteryLevel(result.level);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>React → Flutter / Lark Demo</h1>

      {env === null ? (
        <div>
          <p>🔍 Detecting environment...</p>
          <p style={{ fontSize: "12px", color: "#666" }}>
            If this message persists, check the debug logs below.
          </p>
        </div>
      ) : (
        <>
          <p><strong>Environment:</strong> {env}</p>
        </>
      )}

      {/* Debug logs at the top for visibility */}
      <div style={{
        marginTop: "15px",
        marginBottom: "20px",
        background: "#1e1e1e",
        color: "#0f0",
        padding: "10px",
        maxHeight: "300px",
        overflowY: "scroll",
        border: "2px solid #0f0",
        borderRadius: "4px",
        fontFamily: "monospace",
        fontSize: "11px"
      }}>
        <h3 style={{ color: "#0f0", margin: "0 0 10px 0" }}>🐛 Debug Logs:</h3>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
          {logs.length === 0 ? "No logs yet..." : logs.join("\n")}
        </pre>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => callHandler("takePicture")} style={{ margin: "5px" }}>
          Ambil Gambar
        </button>
        {picturePath && (
          <div>
            <img
              key={picturePath}
              src={picturePath}
              alt="Captured"
              style={{ width: "200px", marginTop: "10px" }}
            />
          </div>
        )}
      </div>

      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => callHandler("toggleFlashlight")} style={{ margin: "5px" }}>
          {flashlightStatus ? "Matikan Flashlight" : "Nyalakan Flashlight"}
        </button>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => callHandler("getLocation")} style={{ margin: "5px" }}>
          Ambil Lokasi
        </button>
        {location && (
          <div>
            Latitude: {location.lat}, Longitude: {location.lng}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => callHandler("getBatteryLevel")} style={{ margin: "5px" }}>
          Ambil Battery
        </button>
        {batteryLevel !== null && <div>Battery: {batteryLevel}%</div>}
      </div>

    </div>
  );
}

export default App;
