import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [location, setLocation] = useState(null);
  const [picturePath, setPicturePath] = useState(null);
  const [flashlightStatus, setFlashlightStatus] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [env, setEnv] = useState("web");

  // Detect environment
  useEffect(() => {
    const checkEnv = () => {
      if (window.flutter_inappwebview) {
        setEnv("flutter");
      } else if (window.lark) {
        window.lark.ready(() => {
          console.log("✅ Lark SDK ready");
          setEnv("lark");
        });
        window.lark.error((err) => console.error("❌ Lark SDK error:", err));
      } else {
        console.log("⏳ Lark SDK belum siap, cek lagi...");
        setTimeout(checkEnv, 1000);
      }
    };

    checkEnv();
  }, []);



  // Main handler — works for both Flutter & Lark
  const callHandler = async (handlerName, data) => {
    if (env === "flutter") {
      // === Flutter WebView ===
      try {
        const result = await window.flutter_inappwebview.callHandler(handlerName, data);
        console.log("Flutter result:", result);
        handleResult(handlerName, result);
      } catch (err) {
        console.error(err);
      }
    } else if (env === "lark") {
      try {
        await window.lark.env.ready(); // Wait for SDK

        switch (handlerName) {
          case "getLocation":
            const res = await window.lark.biz.geolocation.get({
              accuracy: "high",
              isNeedDetail: true,
            });
            const loc = { lat: res.latitude, lng: res.longitude };
            handleResult(handlerName, loc);
            break;

          case "takePicture":
            const photos = await window.lark.biz.util.chooseImage({
              sourceType: ["camera", "album"],
              count: 1,
            });
            handleResult(handlerName, photos[0]?.url || "mock_photo_path");
            break;

          case "toggleFlashlight":
            const newFlash = !flashlightStatus;
            handleResult(handlerName, { flashlight: newFlash });
            break;

          case "getBatteryLevel":
            const mockBattery = Math.floor(Math.random() * 100);
            handleResult(handlerName, { level: mockBattery });
            break;

          default:
            alert(`Handler ${handlerName} not implemented for Lark`);
        }
      } catch (err) {
        console.error("Lark handler error:", err);
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
    </div>
  );
}

export default App;
