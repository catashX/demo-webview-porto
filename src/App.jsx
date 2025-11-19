import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [location, setLocation] = useState(null);
  const [picturePath, setPicturePath] = useState(null);
  const [flashlightStatus, setFlashlightStatus] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [env, setEnv] = useState(null);

  // Lark-specific states
  const [userProfile, setUserProfile] = useState(null);
  const [qrCodeResult, setQrCodeResult] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [authCode, setAuthCode] = useState(null);

  // Auth demo state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [companyAccount, setCompanyAccount] = useState(null);

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

  // Demo: Simulate Lark Authentication (hardcoded)
  const simulateLarkAuth = () => {
    log("🔑 [DEMO] Simulating Lark authentication...");
    log("📡 Calling tt.requestAuthCode() ...");

    // Simulate getting auth code
    setTimeout(() => {
      const mockAuthCode = "mock_auth_code_" + Date.now();
      log(`✅ Got auth code: ${mockAuthCode}`);

      log("📤 Sending code to backend...");

      // Simulate backend exchange for user info
      setTimeout(() => {
        const mockLarkUser = {
          user_id: "ou_7d8a6e6860c3102433b85060ebbbfe0d",
          name: "John Doe",
          email: "john.doe@company.com",
          avatar: "https://via.placeholder.com/100",
          mobile: "+1234567890"
        };

        log("✅ Backend returned user info:", mockLarkUser);
        log("🔗 Linking Lark account to company database...");

        // Simulate database linking
        setTimeout(() => {
          const companyUser = {
            id: 12345,
            company_email: mockLarkUser.email,
            lark_user_id: mockLarkUser.user_id,
            lark_name: mockLarkUser.name,
            lark_avatar: mockLarkUser.avatar,
            linked_at: new Date().toISOString()
          };

          log("✅ Account linked successfully!");
          log("📝 Company account ID: " + companyUser.id);
          log("🎉 User authenticated and logged in!");

          // Set authenticated state
          setIsAuthenticated(true);
          setCompanyAccount(companyUser);
          setUserProfile({
            name: mockLarkUser.name,
            avatarUrl: mockLarkUser.avatar,
            openId: mockLarkUser.user_id
          });

        }, 800);
      }, 1000);
    }, 600);
  };


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
      // Use standard browser APIs instead of Lark SDK
      // These work in ANY webview without special authentication!
      try {
        switch (handlerName) {
          case "getLocation":
            log("📍 Using browser's geolocation API...");
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const loc = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                  };
                  log("✅ Location obtained:", loc);
                  handleResult(handlerName, loc);
                },
                (err) => {
                  error("❌ Geolocation failed:", err.message);
                  log("ℹ️ User may have denied location permission");
                },
                { enableHighAccuracy: true }
              );
            } else {
              error("❌ Geolocation not supported in this browser");
            }
            break;

          case "takePicture":
            log("📸 Using HTML5 file input for camera...");
            // Create a hidden file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment'; // Use rear camera
            input.style.display = 'none';

            input.onchange = (e) => {
              const file = e.target.files[0];
              if (file) {
                // Create object URL for preview
                const photoUrl = URL.createObjectURL(file);
                log("✅ Photo captured:", file.name);
                handleResult(handlerName, photoUrl);
              }
              document.body.removeChild(input);
            };

            document.body.appendChild(input);
            input.click();
            break;

          case "toggleFlashlight":
            const newFlash = !flashlightStatus;
            log("toggleFlashlight simulated:", newFlash);
            handleResult(handlerName, { flashlight: newFlash });
            break;

          case "getBatteryLevel":
            log("🔋 Using Battery API...");
            if (navigator.getBattery) {
              navigator.getBattery().then((battery) => {
                const level = Math.floor(battery.level * 100);
                log("✅ Battery level:", level + "%");
                handleResult(handlerName, { level });
              });
            } else {
              const mockBattery = Math.floor(Math.random() * 100);
              log("⚠️ Battery API not available, using mock:", mockBattery);
              handleResult(handlerName, { level: mockBattery });
            }
            break;

          // Lark-exclusive APIs (impossible in normal browsers!)
          case "getUserProfile":
            log("👤 Getting Lark user profile...");
            window.tt.getUserInfo({
              success: (res) => {
                log("✅ User info received:", res);
                const userInfo = {
                  name: res.userInfo?.nickName || "Unknown",
                  avatarUrl: res.userInfo?.avatarUrl || "",
                  openId: res.userInfo?.openId || ""
                };
                handleResult(handlerName, userInfo);
              },
              fail: (err) => {
                error("❌ Failed to get user info:", err);
              }
            });
            break;

          case "chooseContact":
            log("👥 Opening Lark contact picker...");
            window.tt.chooseContact({
              selectedLimit: 5, // Allow selecting up to 5 contacts
              success: (res) => {
                log("✅ Contacts selected:", res);
                const contacts = res.users?.map(u => ({
                  name: u.name || "Unknown",
                  openId: u.openId,
                  avatar: u.avatar
                })) || [];
                handleResult(handlerName, { contacts });
              },
              fail: (err) => {
                error("❌ Failed to choose contact:", err);
              }
            });
            break;

          case "scanQRCode":
            log("📷 Opening Lark QR scanner...");
            window.tt.scanCode({
              onlyFromCamera: true,
              scanType: ["qrCode", "barCode"],
              success: (res) => {
                log("✅ QR Code scanned:", res.result);
                handleResult(handlerName, { code: res.result });
              },
              fail: (err) => {
                error("❌ Scan failed:", err);
              }
            });
            break;

          case "getChatInfo":
            log("💬 Getting current chat/bot context...");
            window.tt.getChatInfo({
              success: (res) => {
                log("✅ Chat info received:", res);
                const chatInfo = {
                  chatId: res.chatId || "N/A",
                  chatType: res.chatType || "Unknown",
                  chatName: res.chatName || "Unknown"
                };
                handleResult(handlerName, chatInfo);
              },
              fail: (err) => {
                error("❌ Failed to get chat info:", err);
                log("ℹ️ This only works when opened from a Lark chat/bot");
              }
            });
            break;

          case "showToast":
            log("🔔 Showing Lark native toast...");
            window.tt.showToast({
              title: data?.message || "Hello from Lark! 🎉",
              icon: "success",
              duration: 2000,
              success: () => {
                log("✅ Toast shown");
                handleResult(handlerName, { shown: true });
              }
            });
            break;

          case "requestAuthCode":
            log("🔑 Calling real window.tt.requestAuthCode...");
            if (window.tt.requestAuthCode) {
              window.tt.requestAuthCode({
                appId: "cli_a7d8a6e6860c300d", // Optional: Try passing your App ID if needed
                success: (res) => {
                  log("✅ Auth Code received:", res.code);
                  handleResult(handlerName, { code: res.code });
                },
                fail: (err) => {
                  error("❌ requestAuthCode failed:", err);
                  log("ℹ️ This API usually requires Mini Program or specific H5 permissions");
                }
              });
            } else {
              error("❌ window.tt.requestAuthCode is not a function");
            }
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
    if (handlerName === "getUserProfile") setUserProfile(result);
    if (handlerName === "scanQRCode") setQrCodeResult(result.code);
    if (handlerName === "chooseContact") setSelectedContacts(result.contacts);
    if (handlerName === "getChatInfo") setChatInfo(result);
    if (handlerName === "requestAuthCode") setAuthCode(result.code);
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

          {/* Authentication Status */}
          {env === "lark" && (
            <div style={{
              marginTop: "10px",
              padding: "15px",
              background: isAuthenticated ? "#e8f5e9" : "#fff3e0",
              borderRadius: "8px",
              border: `2px solid ${isAuthenticated ? "#4caf50" : "#ff9800"}`
            }}>
              {isAuthenticated ? (
                <>
                  <div style={{ fontSize: "18px", marginBottom: "10px" }}>
                    ✅ <strong>Authenticated</strong>
                  </div>
                  {companyAccount && (
                    <div style={{ fontSize: "14px" }}>
                      <div><strong>Company Account ID:</strong> {companyAccount.id}</div>
                      <div><strong>Lark User:</strong> {companyAccount.lark_name}</div>
                      <div><strong>Email:</strong> {companyAccount.company_email}</div>
                      <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                        Linked: {new Date(companyAccount.linked_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: "16px", marginBottom: "10px" }}>
                    🔐 <strong>Not Authenticated</strong>
                  </div>
                  <button
                    onClick={simulateLarkAuth}
                    style={{
                      padding: "10px 20px",
                      fontSize: "16px",
                      background: "#1976d2",
                      color: "white",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer"
                    }}
                  >
                    🔑 Login with Lark (Demo)
                  </button>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                    Click to simulate Lark SSO authentication
                  </div>
                </>
              )}
            </div>
          )}
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

      {/* Lark-exclusive features */}
      {env === "lark" && (
        <>
          <hr style={{ margin: "20px 0" }} />
          <h2>🎯 Lark-Exclusive Features</h2>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
            These APIs are impossible in normal browsers! 🚀
          </p>

          <div style={{ marginBottom: "15px" }}>
            <button onClick={() => callHandler("getUserProfile")} style={{ margin: "5px" }}>
              👤 Get Lark User Profile
            </button>
            {userProfile && (
              <div style={{ marginTop: "10px", padding: "10px", background: "#f5f5f5", borderRadius: "5px" }}>
                {userProfile.avatarUrl && (
                  <img src={userProfile.avatarUrl} alt="Avatar" style={{ width: "50px", borderRadius: "25px", marginRight: "10px" }} />
                )}
                <div>
                  <strong>Name:</strong> {userProfile.name}
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  <strong>OpenID:</strong> {userProfile.openId}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: "15px" }}>
            <button onClick={() => callHandler("chooseContact")} style={{ margin: "5px" }}>
              👥 Choose Lark Contacts (up to 5)
            </button>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "5px" }}>
              Opens Lark's native contact picker
            </div>
            {selectedContacts && selectedContacts.length > 0 && (
              <div style={{ marginTop: "10px", padding: "10px", background: "#e3f2fd", borderRadius: "5px" }}>
                <strong>Selected {selectedContacts.length} contact(s):</strong>
                {selectedContacts.map((contact, idx) => (
                  <div key={idx} style={{ marginTop: "5px", padding: "5px", background: "white", borderRadius: "3px" }}>
                    {contact.avatar && <img src={contact.avatar} alt="" style={{ width: "30px", borderRadius: "15px", marginRight: "8px" }} />}
                    <span>{contact.name}</span>
                    <span style={{ fontSize: "11px", color: "#999", marginLeft: "8px" }}>({contact.openId})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: "15px" }}>
            <button onClick={() => callHandler("scanQRCode")} style={{ margin: "5px" }}>
              📷 Scan QR/Barcode
            </button>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "5px" }}>
              Uses Lark's native scanner
            </div>
            {qrCodeResult && (
              <div style={{ marginTop: "10px", padding: "10px", background: "#e8f5e9", borderRadius: "5px" }}>
                <strong>Scanned:</strong> {qrCodeResult}
              </div>
            )}
          </div>

          <div style={{ marginBottom: "15px" }}>
            <button onClick={() => callHandler("getChatInfo")} style={{ margin: "5px" }}>
              💬 Get Current Chat Info
            </button>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "5px" }}>
              Only works when opened from a Lark chat/bot
            </div>
            {chatInfo && (
              <div style={{ marginTop: "10px", padding: "10px", background: "#fff3e0", borderRadius: "5px" }}>
                <div><strong>Chat ID:</strong> {chatInfo.chatId}</div>
                <div><strong>Type:</strong> {chatInfo.chatType}</div>
                <div><strong>Name:</strong> {chatInfo.chatName}</div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: "15px" }}>
            <button
              onClick={() => callHandler("showToast", { message: "Lark Native Toast! 🎉" })}
              style={{ margin: "5px" }}
            >
              🔔 Show Lark Toast
            </button>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "5px" }}>
              Native Lark UI notification
            </div>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <button
              onClick={() => callHandler("requestAuthCode")}
              style={{ margin: "5px", background: "#673ab7", color: "white" }}
            >
              🔑 Test tt.requestAuthCode (Real)
            </button>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "5px" }}>
              Attempts to get auth code from Lark
            </div>
            {authCode && (
              <div style={{ marginTop: "10px", padding: "10px", background: "#e1bee7", borderRadius: "5px" }}>
                <strong>Auth Code:</strong> {authCode}
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}

export default App;
