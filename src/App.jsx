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

    const checkEnv = () => {
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
            window.tt.getLocation({
              type: "gcj02", // or "wgs84"
              success: (res) => {
                const loc = { lat: res.latitude, lng: res.longitude };
                log("getLocation result:", loc);
                handleResult(handlerName, loc);
              },
              fail: (err) => {
                error("getLocation failed:", err);
              }
            });
            break;

          case "takePicture":
            window.tt.chooseImage({
              count: 1,
              sourceType: ["camera", "album"],
              success: (res) => {
                const photoUrl = res.tempFilePaths?.[0] || res.apFilePaths?.[0] || "mock_photo_path";
                log("takePicture result:", photoUrl);
                handleResult(handlerName, photoUrl);
              },
              fail: (err) => {
                error("chooseImage failed:", err);
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
