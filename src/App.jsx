import React, { useState } from "react";
import './App.css';

function App() {
  const [location, setLocation] = useState(null);
  const [picturePath, setPicturePath] = useState(null);
  const [flashlightStatus, setFlashlightStatus] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(null);

  if (!window.flutter_inappwebview) {
    alert("Web ini hanya untuk di tes pada aplikasi porto portal App.");
  }

  const callFlutter = (handlerName, data) => {
    if (window.flutter_inappwebview) {
      window.flutter_inappwebview
        .callHandler(handlerName, data)
        .then((result) => {
          console.log("Hasil dari Flutter:", result);

          // Update UI sesuai handler
          if (handlerName === "getLocation") setLocation(result);
          if (handlerName === "takePicture") setPicturePath(result.path);
          if (handlerName === "toggleFlashlight") setFlashlightStatus(result.flashlight);
          if (handlerName === "getBatteryLevel") setBatteryLevel(result.level);
        })
        .catch((err) => console.error(err));
    } else {
      alert("Jalankan di Flutter WebView untuk tes JS Handler");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ marginBottom: "25px" }}><h1>React → Flutter Demo</h1></div>


      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => callFlutter("takePicture")} style={{ margin: "5px" }}>
          Ambil Gambar
        </button>
        {picturePath && (
          <div>
            <img src={`file://${picturePath}`} alt="Captured" style={{ width: "200px", marginTop: "10px" }} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => callFlutter("toggleFlashlight")} style={{ margin: "5px" }}>
          {flashlightStatus ? "Matikan Flashlight" : "Nyalakan Flashlight"}
        </button>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => callFlutter("getLocation")} style={{ margin: "5px" }}>
          Ambil Lokasi
        </button>
        {location && (
          <div>
            Latitude: {location.lat}, Longitude: {location.lng}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => callFlutter("getBatteryLevel")} style={{ margin: "5px" }}>
          Ambil Battery
        </button>
        {batteryLevel !== null && <div>Battery: {batteryLevel}%</div>}
      </div>
    </div>
  );
}

export default App;
