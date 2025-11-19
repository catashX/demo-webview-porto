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

    const checkEnv = () => {
      attempts++;

      if (window.flutter_inappwebview) {
        setEnv("flutter");
        log("✅ Flutter environment detected");
      } else if (window.tt) {
        // Feishu SDK exposes as 'tt' object
        window.tt.ready(() => {
          log("✅ Feishu SDK (tt) ready");
          setEnv("lark");
        });
        window.tt.error((err) => {
          error("❌ Feishu SDK error:", err);
          setEnv("web"); // Fallback to web on error
        });
      } else if (attempts >= maxAttempts) {
        log("⏱️ SDK detection timeout, defaulting to web environment");
        setEnv("web");
      } else {
        log(`⏳ SDK belum siap, cek lagi... (${attempts}/${maxAttempts})`);
        setTimeout(checkEnv, 500);
      }
    };

    checkEnv();
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

      <div style={{ marginTop: "20px", background: "#f0f0f0", padding: "10px", maxHeight: "200px", overflowY: "scroll" }}>
        <h3>Debug Logs:</h3>
        <pre>{logs.join("\n")}</pre>
      </div>

    </div>
  );
}

export default App;
