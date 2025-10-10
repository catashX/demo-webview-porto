import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [location, setLocation] = useState(null);
  const [picturePath, setPicturePath] = useState(null);
  const [flashlightStatus, setFlashlightStatus] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [env, setEnv] = useState("web");

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
    const checkEnv = () => {
      if (window.flutter_inappwebview) {
        setEnv("flutter");
      } else if (window.lark) {
        window.lark.ready(() => {
          log("✅ Lark SDK ready");
          setEnv("lark");
        });
        window.lark.error((err) => error("❌ Lark SDK error:", err));
      } else {
        log("⏳ Lark SDK belum siap, cek lagi...");
        setTimeout(checkEnv, 1000);
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
    } else if (env === "lark" && window.lark) {
      try {
        // await window.lark.env.ready();

        switch (handlerName) {
          case "getLocation":
            if (window.lark.device?.geolocation?.get) {
              const res = await window.lark.device.geolocation.get({
                accuracy: "high",
                isNeedDetail: true,
              });
              const loc = { lat: res.latitude, lng: res.longitude };
              log("getLocation result:", loc);
              handleResult(handlerName, loc);
            } else {
              log("getLocation not supported in this environment");
            }
            break;

          case "takePicture":
            if (window.lark?.biz?.util?.chooseImage) {
              const photos = await window.lark.biz.util.chooseImage({
                sourceType: ["camera", "album"],
                count: 1,
              });
              log("takePicture result:", photos[0]?.url || "mock_photo_path");
              handleResult(handlerName, photos[0]?.url || "mock_photo_path");
            } else {
              log("chooseImage not supported, returning mock path");
              handleResult(handlerName, "mock_photo_path");
            }
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
      <p><strong>Environment:</strong> {env}</p>

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
