import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [location, setLocation] = useState(null);
  const [picturePath, setPicturePath] = useState(null);
  const [flashlightStatus, setFlashlightStatus] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [env, setEnv] = useState(null);

  // Lark-specific states
  const [authCode, setAuthCode] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [networkType, setNetworkType] = useState(null);
  const [clipboardContent, setClipboardContent] = useState(null);
  const [accelerometerData, setAccelerometerData] = useState(null);

  // Auth demo state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [companyAccount, setCompanyAccount] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);

  const [logs, setLogs] = useState([]);

  const addLog = (content, type = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      content
    }]);
  };

  const log = (message, data = null) => {
    let type = 'info';
    if (typeof message === 'string') {
      if (message.includes('✅')) type = 'success';
      if (message.includes('❌')) type = 'error';
      if (message.includes('⚠️')) type = 'warning';
    }

    if (data) {
      addLog({ message, data }, type);
    } else {
      addLog(message, type);
    }
  };

  const error = (...args) => {
    const message = args.map(a => (typeof a === "object" ? JSON.stringify(a, null, 2) : a)).join(" ");
    addLog(message, 'error');
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

          // Check if we need to authenticate (Web App) or if it's Mini Program
          // For Web App, we MUST call tt.config
          try {
            log("⚙️ Requesting JSAPI config signature...");
            const response = await fetch(`/api/lark-config?url=${encodeURIComponent(window.location.href)}`);
            const data = await response.json();

            if (data.error) {
              throw new Error(data.error);
            }

            log("✅ Got signature, calling tt.config...");

            window.tt.config({
              appId: data.appId,
              timestamp: data.timestamp,
              nonceStr: data.nonceStr,
              signature: data.signature,
              jsApiList: [
                'getSystemInfo',
                'getNetworkType',
                'chooseChat',
                'vibrateShort',
                'setClipboardData',
                'makePhoneCall',
                'showToast',
                'requestAuthCode'
              ]
            });

            window.tt.ready(() => {
              log("✅ Feishu SDK (tt) Config Ready!");
              setEnv("lark");
            });

            window.tt.error((err) => {
              error("❌ Feishu SDK Config Error:", err);
            });

          } catch (err) {
            error("❌ Failed to configure Lark SDK:", err);
            // Fallback to allowing it, maybe it's Mini Program
            setEnv("lark");
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

  // Real Lark Authentication
  const loginWithRealLark = () => {
    log("🔑 Starting real Lark authentication...");

    if (!window.tt || !window.tt.requestAuthCode) {
      error("❌ window.tt.requestAuthCode not available");
      log("ℹ️ Are you running inside Lark?");
      return;
    }

    log(`Current URL: ${window.location.href}`);
    log(" Calling tt.requestAuthCode() ...");

    window.tt.requestAuthCode({
      appId: import.meta.env.VITE_LARK_APP_ID,
      redirect_uri: window.location.href,
      success: async (res) => {
        log(`✅ Got REAL auth code: ${res.code}`);
        setAuthCode(res.code);

        log("⏳ Exchanging code with backend...");

        try {
          const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: res.code })
          });

          const data = await response.json();

          if (data.error) {
            throw new Error(data.error);
          }

          log("✅ Backend verified code & returned user:", data);

          const companyUser = {
            id: Date.now(), // Mock ID
            company_email: data.email || "No Email",
            lark_user_id: data.open_id,
            lark_name: data.name,
            lark_avatar: data.avatar_url,
            linked_at: new Date().toISOString()
          };

          // Mark as authenticated with real data
          setIsAuthenticated(true);
          setCompanyAccount(companyUser);

          log("🎉 Login complete!");
        } catch (err) {
          error("❌ Backend exchange failed:", err.message || err);
        }
      },
      fail: (err) => {
        error("❌ Auth failed:", err);
        log("ℹ️ Make sure your app is trusted in Lark Console");
      }
    });
  };

  const sendMessage = async () => {
    if (!companyAccount || !companyAccount.lark_user_id) return;

    log("📤 Sending message...");
    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receive_id: companyAccount.lark_user_id,
          content: 'Hello from React App!',
          receive_id_type: 'open_id'
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      log("✅ Message sent! Check your Lark chat.");
      // Show toast if in Lark
      if (window.tt && window.tt.showToast) {
        window.tt.showToast({ title: "Message sent! 📨", icon: "success" });
      }
    } catch (err) {
      error("❌ Failed to send message:", err.message || JSON.stringify(err));
    }
  };




  const pickChat = () => {
    log("💬 Picking a chat...");
    if (window.tt && window.tt.chooseChat) {
      window.tt.chooseChat({
        allowCreateGroup: false,
        multiSelect: false,
        ignoreSelf: true,
        selectType: 1, // 0: all, 1: chat, 2: user
        success: (res) => {
          log("✅ Chat selected:", res);
          // Note: The response structure depends on the SDK version, usually res.data or res itself
          // Assuming res contains the chat info directly or inside data
          const chat = res.data ? res.data[0] : res[0];
          if (chat) {
            setSelectedChat({
              id: chat.chatId || chat.id,
              name: chat.name || "Unknown Chat"
            });
            log(`✅ Selected Chat ID: ${chat.chatId || chat.id}`);
          }
        },
        fail: (err) => {
          error("❌ Failed to pick chat:", err);
        }
      });
    } else {
      error("❌ tt.chooseChat not available");
    }
  };

  const sendToChat = async () => {
    if (!selectedChat) return;

    log(`📤 Sending to Group: ${selectedChat.name}...`);
    try {
      const res = await fetch('http://localhost:3001/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receive_id: selectedChat.id,
          receive_id_type: 'chat_id',
          content: "Hello Group! 👋 This is a test message from the React App."
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      log("✅ Group message sent!");
      if (window.tt && window.tt.showToast) {
        window.tt.showToast({ title: "Group msg sent! 📨", icon: "success" });
      }
    } catch (err) {
      error("❌ Failed to send group message:", err);
    }
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
          case "getSystemInfo":
            log("📱 Getting System Info...");
            window.tt.getSystemInfo({
              success: (res) => {
                log("✅ System Info received:", res);
                handleResult(handlerName, res);
              },
              fail: (err) => {
                error("❌ Failed to get system info:", err);
              }
            });
            break;

          case "getNetworkType":
            log("📶 Getting Network Type...");
            window.tt.getNetworkType({
              success: (res) => {
                log("✅ Network Type received:", res.networkType);
                handleResult(handlerName, { networkType: res.networkType });
              },
              fail: (err) => {
                error("❌ Failed to get network type:", err);
              }
            });
            break;

          case "vibrateShort":
            log("📳 Vibrating (Short)...");
            window.tt.vibrateShort({
              success: () => {
                log("✅ Vibrate success");
              },
              fail: (err) => {
                error("❌ Vibrate failed:", err);
              }
            });
            break;

          case "setClipboardData":
            log("📋 Setting Clipboard Data...");
            window.tt.setClipboardData({
              data: "Hello from Lark Demo!",
              success: () => {
                log("✅ Clipboard set successfully");
                window.tt.getClipboardData({
                  success: (res) => {
                    log("✅ Verified clipboard content:", res.data);
                    handleResult(handlerName, { data: res.data });
                  }
                });
              },
              fail: (err) => {
                error("❌ Failed to set clipboard:", err);
              }
            });
            break;

          case "makePhoneCall":
            log("📞 Making Phone Call...");
            window.tt.makePhoneCall({
              phoneNumber: "1234567890",
              success: () => {
                log("✅ Phone call initiated");
              },
              fail: (err) => {
                error("❌ Failed to make phone call:", err);
              }
            });
            break;

          case "showActionSheet":
            log("📋 Showing Action Sheet...");
            window.tt.showActionSheet({
              itemList: ["Option A", "Option B", "Option C"],
              success: (res) => {
                log("✅ Action Sheet selection:", res.tapIndex);
                handleResult(handlerName, { index: res.tapIndex });
              },
              fail: (err) => {
                error("❌ Action Sheet failed:", err);
              }
            });
            break;

          case "showModal":
            log("💬 Showing Modal...");
            window.tt.showModal({
              title: "Interactive Modal",
              content: "Do you want to proceed with this action?",
              confirmText: "Yes, Go!",
              cancelText: "No, Wait",
              success: (res) => {
                if (res.confirm) {
                  log("✅ User clicked CONFIRM");
                } else if (res.cancel) {
                  log("🚫 User clicked CANCEL");
                }
                handleResult(handlerName, res);
              },
              fail: (err) => {
                error("❌ Modal failed:", err);
              }
            });
            break;

          case "startAccelerometer":
            log("� Starting Accelerometer...");
            window.tt.startAccelerometer({
              success: () => {
                log("✅ Accelerometer started");
                window.tt.onAccelerometerChange((res) => {
                  // Update state directly for live view
                  setAccelerometerData(res);
                });
              },
              fail: (err) => {
                error("❌ Failed to start accelerometer:", err);
              }
            });
            break;

          case "stopAccelerometer":
            log("🛑 Stopping Accelerometer...");
            window.tt.stopAccelerometer({
              success: () => {
                log("✅ Accelerometer stopped");
                setAccelerometerData(null);
              },
              fail: (err) => {
                error("❌ Failed to stop accelerometer:", err);
              }
            });
            break;

          case "showToast":
            log("�🔔 Showing Lark native toast...");
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
                appId: process.env.LARK_APP_ID,
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
    if (handlerName === "requestAuthCode") setAuthCode(result.code);
    if (handlerName === "getSystemInfo") setSystemInfo(result);
    if (handlerName === "getNetworkType") setNetworkType(result.networkType);
    if (handlerName === "setClipboardData") setClipboardContent(result.data);
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
                      <button
                        onClick={sendMessage}
                        style={{
                          marginTop: "10px",
                          padding: "8px 16px",
                          fontSize: "14px",
                          background: "#009688",
                          color: "white",
                          border: "none",
                          borderRadius: "5px",
                          cursor: "pointer"
                        }}
                      >
                        📨 Send Me a Message
                      </button>

                      <hr style={{ margin: "15px 0", borderColor: "#eee" }} />

                      <div style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "10px" }}>
                        👥 Group Chat Demo
                      </div>

                      <button
                        onClick={pickChat}
                        style={{
                          padding: "8px 16px",
                          fontSize: "14px",
                          background: "#607d8b",
                          color: "white",
                          border: "none",
                          borderRadius: "5px",
                          cursor: "pointer",
                          marginRight: "10px"
                        }}
                      >
                        💬 Pick a Chat
                      </button>

                      {selectedChat && (
                        <div style={{ marginTop: "10px", padding: "10px", background: "#eceff1", borderRadius: "5px" }}>
                          <div><strong>Selected:</strong> {selectedChat.name}</div>
                          <div style={{ fontSize: "10px", color: "#666" }}>ID: {selectedChat.id}</div>
                          <button
                            onClick={sendToChat}
                            style={{
                              marginTop: "8px",
                              padding: "6px 12px",
                              fontSize: "12px",
                              background: "#ff5722",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer"
                            }}
                          >
                            🚀 Send Hello to Group
                          </button>
                        </div>
                      )}

                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: "16px", marginBottom: "10px" }}>
                    🔐 <strong>Not Authenticated</strong>
                  </div>
                  <button
                    onClick={loginWithRealLark}
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
                    🔑 Login with Lark (Real)
                  </button>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                    Calls window.tt.requestAuthCode()
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Debug logs at the top for visibility */}
      {/* Debug logs at the top for visibility */}
      <div style={{
        marginTop: "15px",
        marginBottom: "20px",
        background: "#1e1e1e",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #333",
        boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
      }}>
        <div style={{
          padding: "10px 15px",
          background: "#2d2d2d",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <h3 style={{ color: "#fff", margin: 0, fontSize: "14px" }}>🐛 Debug Logs</h3>
          <button
            onClick={() => setLogs([])}
            style={{
              background: "transparent",
              border: "1px solid #666",
              color: "#aaa",
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "11px",
              cursor: "pointer"
            }}
          >
            Clear
          </button>
        </div>

        <div style={{
          maxHeight: "400px",
          overflowY: "auto",
          padding: "10px",
          fontFamily: "Monaco, Consolas, monospace",
          fontSize: "12px"
        }}>
          {logs.length === 0 ? (
            <div style={{ color: "#666", textAlign: "center", padding: "20px" }}>
              No logs yet...
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} style={{
                marginBottom: "8px",
                borderBottom: "1px solid #333",
                paddingBottom: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#666", fontSize: "10px" }}>[{log.timestamp}]</span>
                  {log.type === 'error' && <span style={{ color: "#ff5252", fontWeight: "bold" }}>ERROR</span>}
                  {log.type === 'success' && <span style={{ color: "#69f0ae", fontWeight: "bold" }}>SUCCESS</span>}
                  {log.type === 'warning' && <span style={{ color: "#ffd740", fontWeight: "bold" }}>WARN</span>}
                </div>

                <div style={{
                  color: log.type === 'error' ? '#ff8a80' :
                    log.type === 'success' ? '#b9f6ca' :
                      log.type === 'warning' ? '#ffe57f' : '#e0e0e0',
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  maxWidth: "100%",
                  paddingLeft: "10px"
                }}>
                  {typeof log.content === 'object' ? (
                    <pre style={{
                      margin: 0,
                      background: "#00000030",
                      padding: "8px",
                      borderRadius: "4px",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere"
                    }}>
                      {JSON.stringify(log.content, null, 2)}
                    </pre>
                  ) : (
                    log.content
                  )}
                </div>
              </div>
            ))
          )}
        </div>
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
            <button onClick={() => callHandler("getSystemInfo")} style={{ margin: "5px" }}>
              📱 Get System Info
            </button>
            {systemInfo && (
              <div style={{ marginTop: "10px", padding: "10px", background: "#f5f5f5", borderRadius: "5px", fontSize: "12px" }}>
                <pre>{JSON.stringify(systemInfo, null, 2)}</pre>
              </div>
            )}
          </div>

          <div style={{ marginBottom: "15px" }}>
            <button onClick={() => callHandler("getNetworkType")} style={{ margin: "5px" }}>
              📶 Get Network Type
            </button>
            {networkType && (
              <div style={{ marginTop: "10px", padding: "10px", background: "#e3f2fd", borderRadius: "5px" }}>
                <strong>Network:</strong> {networkType}
              </div>
            )}
          </div>

          <div style={{ marginBottom: "15px" }}>
            <button onClick={() => callHandler("vibrateShort")} style={{ margin: "5px" }}>
              📳 Vibrate (Short)
            </button>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <button onClick={() => callHandler("setClipboardData")} style={{ margin: "5px" }}>
              📋 Set Clipboard ("Hello...")
            </button>
            {clipboardContent && (
              <div style={{ marginTop: "10px", padding: "10px", background: "#fff3e0", borderRadius: "5px" }}>
                <strong>Clipboard verified:</strong> {clipboardContent}
              </div>
            )}
          </div>

          <div style={{ marginBottom: "15px" }}>
            <button onClick={() => callHandler("makePhoneCall")} style={{ margin: "5px" }}>
              📞 Make Phone Call (1234567890)
            </button>
          </div>

          <hr style={{ margin: "20px 0" }} />
          <h3>🎮 Interactive Features</h3>

          <div style={{ marginBottom: "15px" }}>
            <button onClick={() => callHandler("showActionSheet")} style={{ margin: "5px" }}>
              📑 Show Action Sheet
            </button>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <button onClick={() => callHandler("showModal")} style={{ margin: "5px" }}>
              💬 Show Modal Alert
            </button>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button onClick={() => callHandler("startAccelerometer")} style={{ margin: "5px", background: "#4caf50", color: "white" }}>
                ▶️ Start Accelerometer
              </button>
              <button onClick={() => callHandler("stopAccelerometer")} style={{ margin: "5px", background: "#f44336", color: "white" }}>
                ⏹️ Stop
              </button>
            </div>
            {accelerometerData && (
              <div style={{ marginTop: "10px", padding: "10px", background: "#263238", color: "#80cbc4", borderRadius: "5px", fontFamily: "monospace" }}>
                <div>X: {accelerometerData.x.toFixed(2)}</div>
                <div>Y: {accelerometerData.y.toFixed(2)}</div>
                <div>Z: {accelerometerData.z.toFixed(2)}</div>
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
