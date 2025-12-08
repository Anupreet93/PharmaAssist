// src/components/ChatWindow.jsx
import React, { useContext, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MyContext } from "./MyContext.jsx";
import { AuthContext } from "./context/AuthContext.jsx";
import api from "./lib/api.js";
import { ScaleLoader } from "react-spinners";

/**
 * ChatWindow - main chat UI with working microphone support
 */

function ChatWindow() {
  const {
    prompt,
    setPrompt,
    reply,
    setReply,
    currThreadId,
    setCurrThreadId,
    newChat,
    setNewChat,
    prevChats,
    setPrevChats,
    allThreads,
    setAllThreads
  } = useContext(MyContext);

  const { user, signOut } = useContext(AuthContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(true);
  const [fetchingThreads, setFetchingThreads] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);

  // Speech Recognition refs
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  /* --------------------
     Initialize Speech Recognition
     -------------------- */
  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Stop after user stops speaking
        recognition.interimResults = true; // Show interim results
        recognition.lang = 'en-US';
        
        recognition.onstart = () => {
          console.log("Speech recognition started");
          setIsListening(true);
          finalTranscriptRef.current = "";
        };

        recognition.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Update the prompt with combined text
          const combinedText = finalTranscriptRef.current + finalTranscript + interimTranscript;
          setPrompt(combinedText);
          
          // Store final transcript for auto-submission
          if (finalTranscript) {
            finalTranscriptRef.current += finalTranscript + ' ';
          }
        };

        recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
          
          if (event.error === 'not-allowed') {
            alert('Microphone access denied. Please allow microphone permissions in your browser settings.');
          } else if (event.error === 'audio-capture') {
            alert('No microphone found. Please ensure a microphone is connected.');
          }
        };

        recognition.onend = () => {
          console.log("Speech recognition ended");
          setIsListening(false);
          
          // Auto-submit if we have final transcript
          if (finalTranscriptRef.current.trim()) {
            setTimeout(() => {
              getReply();
            }, 500);
          }
        };

        recognitionRef.current = recognition;
      } catch (error) {
        console.error("Failed to initialize speech recognition:", error);
        setIsSpeechSupported(false);
      }
    } else {
      console.warn("Speech recognition not supported in this browser");
      setIsSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  /* --------------------
     Toggle Microphone Function
     -------------------- */
  const toggleMicrophone = () => {
    if (!isSpeechSupported) {
      alert("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (!recognitionRef.current) {
      alert("Speech recognition not initialized. Please refresh the page.");
      return;
    }

    if (isListening) {
      // Stop listening
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("Error stopping recognition:", error);
      }
      setIsListening(false);
    } else {
      // Start listening
      try {
        // Clear previous transcript
        finalTranscriptRef.current = "";
        setPrompt("");
        recognitionRef.current.start();
      } catch (error) {
        console.error("Error starting recognition:", error);
        alert("Could not start microphone. Please ensure microphone permissions are granted.");
      }
    }
  };

  /* --------------------
     JSON helpers & parsing
     -------------------- */
  const tryParseJSON = (str) => {
    if (typeof str !== "string") return str;
    try {
      const parsed = JSON.parse(str);
      return parsed;
    } catch {
      return str;
    }
  };

  const parseMedicineData = (data) => {
    try {
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if ((data.name || data.medicine_name || data.drug_name) &&
            (data.uses || data.side_effects || data.category)) {
          return normalizeMedicineData(data);
        }
      }

      if (typeof data === 'string') {
        const parsed = tryParseJSON(data);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if ((parsed.name || parsed.medicine_name || parsed.drug_name) &&
              (parsed.uses || parsed.side_effects || parsed.category)) {
            return normalizeMedicineData(parsed);
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error parsing medicine data:", error);
      return null;
    }
  };

  const normalizeMedicineData = (data) => {
    const normalized = {
      name: data.name || data.medicine_name || data.drug_name || "Unknown Medicine",
      formulation: data.formulation || data.form || data.dosage_form || "",
      category: data.category || data.class || data.type || "",
      uses: Array.isArray(data.uses) ? data.uses :
            (data.uses ? [data.uses] : ["No uses specified"]),
      common_side_effects: Array.isArray(data.common_side_effects) ? data.common_side_effects :
                          Array.isArray(data.side_effects) ? data.side_effects :
                          (data.side_effects ? [data.side_effects] : ["No common side effects data"]),
      serious_side_effects: Array.isArray(data.serious_side_effects) ? data.serious_side_effects :
                           (data.serious_side_effects ? [data.serious_side_effects] : ["No serious side effects data"]),
      contraindications: Array.isArray(data.contraindications) ? data.contraindications :
                        (data.contraindications ? [data.contraindications] : ["None specified"]),
      safe_age_groups: Array.isArray(data.safe_age_groups) ? data.safe_age_groups :
                      (data.safe_age_groups ? [data.safe_age_groups] : ["All ages (consult doctor for children)"]),
      pregnancy_and_lactation: data.pregnancy_and_lactation ||
                              data.pregnancy_info ||
                              "Consult healthcare professional before use during pregnancy or lactation",
      storage_instructions: data.storage_instructions ||
                           data.storage ||
                           "Store at room temperature, away from moisture and heat",
      prescription_required: typeof data.prescription_required === 'boolean' ?
                            data.prescription_required :
                            (data.prescription_required === 'true' ||
                             data.prescription_required === 'yes' ||
                             data.prescription_required === 'required'),
      disclaimer: data.disclaimer ||
                  "This information is for educational purposes only. Always consult with a healthcare professional before taking any medication."
    };

    return normalized;
  };

  const normalizeChatMessages = (messages) => {
    if (!Array.isArray(messages)) return [];

    return messages.map(message => {
      const content = message.content;
      const parsedContent = tryParseJSON(content);
      const medicineData = parseMedicineData(parsedContent);

      if (medicineData) {
        return {
          ...message,
          content: null,
          medicineData: medicineData,
          isMedicineData: true
        };
      } else {
        return {
          ...message,
          content: parsedContent,
          medicineData: null,
          isMedicineData: false
        };
      }
    });
  };

  const isValidThreadId = (id) => {
    if (!id) return false;
    if (typeof id !== "string") return false;
    const trimmed = id.trim();
    if (!trimmed) return false;
    if (trimmed === "undefined" || trimmed === "null") return false;
    return true;
  };

  const fetchThreads = useCallback(async () => {
    setFetchingThreads(true);
    try {
      const res = await api.get("/api/thread");
      const data = res?.data ?? res;
      const threads = Array.isArray(data?.threads)
        ? data.threads
        : Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const history = threads
        .map(t => {
          const title = t?.title || "";
          const lastMessage = t?.messages?.[t.messages?.length - 1]?.content || "";
          return title || lastMessage;
        })
        .filter(title => title && title.trim().length > 0)
        .slice(0, 10);

      setSearchHistory(history);
      setAllThreads(threads);
    } catch (err) {
      console.error("Failed to fetch threads:", err);
      setAllThreads([]);
      setSearchHistory([]);
    } finally {
      setFetchingThreads(false);
    }
  }, [setAllThreads]);

  useEffect(() => {
    if (user?.id || user?.email) {
      fetchThreads();
    } else {
      setAllThreads([]);
      setSearchHistory([]);
    }
  }, [user?.id, user?.email, fetchThreads, setAllThreads]);

  const callChatApi = async (payload) => {
    const res = await api.post("/api/chat", payload);
    return res?.data ?? {};
  };

  const getReply = async () => {
    const text = (prompt || "").trim();
    if (!text) return;

    setLoading(true);
    setReply(null);

    if (text && !searchHistory.includes(text)) {
      setSearchHistory(prev => [text, ...prev.slice(0, 9)]);
    }

    const payload0 = { message: text };
    if (!newChat && isValidThreadId(currThreadId)) payload0.threadId = currThreadId;

    try {
      let data;
      try {
        data = await callChatApi(payload0);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          setNewChat(true);
          data = await callChatApi({ message: text });
        } else {
          throw err;
        }
      }

      if (data?.threadId && isValidThreadId(data.threadId)) {
        setCurrThreadId(data.threadId);
        setNewChat(false);
      }

      const medicineData = parseMedicineData(data?.reply || data?.data || data?.details || data?.message || data);

      if (medicineData) {
        setReply(medicineData);
        const newMessages = [
          ...prevChats,
          { role: "user", content: text, isMedicineData: false },
          { role: "assistant", content: null, medicineData: medicineData, isMedicineData: true }
        ];
        setPrevChats(newMessages);
      } else {
        const assistantReply = data?.reply || data?.message || "No response available";
        setReply(assistantReply);
        const newMessages = [
          ...prevChats,
          { role: "user", content: text, isMedicineData: false },
          { role: "assistant", content: assistantReply, medicineData: null, isMedicineData: false }
        ];
        setPrevChats(newMessages);
      }

      await fetchThreads();
    } catch (err) {
      console.error("Chat request failed:", err);
      const status = err?.response?.status;
      const body = err?.response?.data;

      let errorMessage = "Network or server error";
      if (status === 401 || status === 403) {
        errorMessage = "Authentication error. Please sign in again.";
      } else if (body && body.error) {
        errorMessage = body.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setPrevChats(prev => [
        ...prev,
        { role: "user", content: text, isMedicineData: false },
        { role: "assistant", content: `Error: ${errorMessage}`, medicineData: null, isMedicineData: false }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (threadId) => {
    if (!isValidThreadId(threadId)) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/thread/${encodeURIComponent(threadId)}`);
      const data = res?.data ?? {};
      const thread = data?.thread ?? data;
      if (!thread) {
        alert("Thread not found.");
        return;
      }

      const messages = Array.isArray(thread.messages) ? thread.messages : [];
      const normalizedMessages = normalizeChatMessages(messages);
      setPrevChats(normalizedMessages);
      setCurrThreadId(thread.threadId || threadId);
      setNewChat(false);
      setReply(null);
    } catch (err) {
      console.error("Failed to load thread:", err);
      alert("Failed to load conversation. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (prevChats.length > 0) {
      const hasUnnormalizedMessages = prevChats.some(msg =>
        msg.role === "assistant" &&
        typeof msg.content === "string" &&
        msg.content.trim().startsWith("{") &&
        msg.content.trim().endsWith("}") &&
        !msg.medicineData
      );

      if (hasUnnormalizedMessages) {
        const normalizedMessages = normalizeChatMessages(prevChats);
        setPrevChats(normalizedMessages);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    const confirmed = window.confirm("Sign out of PharmaAssist?");
    if (!confirmed) return;

    try {
      if (typeof signOut === "function") {
        await signOut();
      } else {
        try {
          localStorage.removeItem("authToken");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          delete api.defaults.headers.common["Authorization"];
        } catch (e) {
          console.warn("Fallback signOut cleanup failed:", e);
        }
      }

      setPrompt("");
      setReply(null);
      setPrevChats([]);
      setNewChat(true);
      setAllThreads([]);
      setSearchHistory([]);
      setCurrThreadId(undefined);

      setIsProfileOpen(false);
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Sign out error:", err);
      alert("Failed to sign out. See console for details.");
    }
  };

  const toggleProfile = () => setIsProfileOpen((s) => !s);
  const toggleRecent = () => setRecentOpen((s) => !s);

  // --- MedicineCard component ---
  const MedicineCard = ({ data }) => {
    if (!data || typeof data !== 'object') {
      return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-200">
          <p className="text-gray-600">Unable to display medicine information</p>
        </div>
      );
    }

    return (
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-200 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-blue-100">
          <div className="bg-blue-600 p-3 rounded-xl">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{data.name || "Unknown Medicine"}</h2>
            {data.formulation && (
              <p className="text-blue-700 font-medium">{data.formulation}</p>
            )}
            {data.category && (
              <p className="text-gray-600 text-sm mt-1">Category: {data.category}</p>
            )}
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Uses */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-blue-500 p-1 rounded">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-blue-800">Therapeutic Uses</h3>
            </div>
            <ul className="space-y-1">
              {Array.isArray(data.uses) && data.uses.length > 0 ? data.uses.map((use, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{use}</span>
                </li>
              )) : <li className="text-gray-500 text-sm">No uses specified</li>}
            </ul>
          </div>

          {/* Side Effects */}
          <div className="bg-red-50 p-4 rounded-xl border border-red-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-red-500 p-1 rounded">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="font-semibold text-red-800">Side Effects</h3>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-red-700 mb-1">Common:</h4>
                <ul className="text-sm text-gray-700">
                  {Array.isArray(data.common_side_effects) && data.common_side_effects.length > 0 ?
                    data.common_side_effects.map((effect, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>{effect}</span>
                      </li>
                    )) :
                    <li className="text-gray-500">None specified</li>
                  }
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-red-700 mb-1">Serious:</h4>
                <ul className="text-sm text-gray-700">
                  {Array.isArray(data.serious_side_effects) && data.serious_side_effects.length > 0 ?
                    data.serious_side_effects.map((effect, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-600 mt-1">•</span>
                        <span>{effect}</span>
                      </li>
                    )) :
                    <li className="text-gray-500">None specified</li>
                  }
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Contraindications */}
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
            <h3 className="font-semibold text-purple-800 mb-2 text-sm">Contraindications</h3>
            <ul className="space-y-1">
              {Array.isArray(data.contraindications) && data.contraindications.length > 0 ?
                data.contraindications.map((item, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span>{item}</span>
                  </li>
                )) :
                <li className="text-gray-500 text-sm">None specified</li>
              }
            </ul>
          </div>

          {/* Age Groups */}
          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
            <h3 className="font-semibold text-green-800 mb-2 text-sm">Safe Age Groups</h3>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(data.safe_age_groups) && data.safe_age_groups.length > 0 ?
                data.safe_age_groups.map((group, i) => (
                  <span key={i} className="bg-white text-green-700 px-3 py-1 rounded-full text-xs border border-green-200">
                    {group}
                  </span>
                )) :
                <span className="text-gray-500 text-sm">All ages</span>
              }
            </div>
          </div>

          {/* Prescription */}
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
            <h3 className="font-semibold text-orange-800 mb-2 text-sm">Prescription</h3>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${data.prescription_required ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              <span className="font-medium">
                {data.prescription_required ? 'Prescription Required' : 'Over the Counter'}
              </span>
            </div>
          </div>
        </div>

        {/* Storage & Pregnancy Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.storage_instructions && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h3 className="font-semibold text-blue-800 mb-2 text-sm">Storage Instructions</h3>
              <p className="text-sm text-gray-700">{data.storage_instructions}</p>
            </div>
          )}
          {data.pregnancy_and_lactation && (
            <div className="bg-pink-50 p-4 rounded-xl border border-pink-100">
              <h3 className="font-semibold text-pink-800 mb-2 text-sm">Pregnancy & Lactation</h3>
              <p className="text-sm text-gray-700">{data.pregnancy_and_lactation}</p>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="bg-yellow-100 p-2 rounded-lg flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-yellow-800 mb-1 text-sm">Important Disclaimer</h3>
              <p className="text-sm text-yellow-700">
                {data.disclaimer || "This information is for educational purposes only. Always consult with a healthcare professional before taking any medication."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMessageContent = (message) => {
    if (message.role === "user") {
      return <p className="font-medium">{message.content}</p>;
    } else if (message.isMedicineData && message.medicineData) {
      return <MedicineCard data={message.medicineData} />;
    } else {
      const content = message.content || "";
      const parsed = tryParseJSON(content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const medicineData = parseMedicineData(parsed);
        if (medicineData) {
          return <MedicineCard data={medicineData} />;
        }
      }
      return (
        <div className="prose prose-sm max-w-none text-gray-900">
          {content}
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white text-gray-800 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-blue-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-blue-800">PharmaAssist</h1>
                  <p className="text-sm text-blue-600 hidden sm:block">AI-Powered Medication Intelligence</p>
                </div>
              </div>
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={toggleProfile}
                aria-haspopup="true"
                aria-expanded={isProfileOpen}
                className="flex items-center gap-3 bg-white hover:bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <span className="sr-only">Open profile menu</span>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user?.name ?? "Researcher"}</p>
                  <p className="text-xs text-blue-600">{user?.email ?? "user@domain"}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-medium">
                  {user?.name ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("") : "PA"}
                </div>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-blue-200 rounded-xl shadow-lg z-20 overflow-hidden">
                  <div className="p-4 border-b border-blue-100">
                    <p className="font-medium text-gray-900">{user?.name ?? "Researcher"}</p>
                    <p className="text-sm text-blue-600">{user?.email ?? "user@domain"}</p>
                  </div>

                  <button onClick={() => alert("Account settings coming soon.")} className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 text-gray-700 transition-colors">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-sm">Account Settings</span>
                  </button>

                  <div className="border-t border-blue-100">
                    <button onClick={handleSignOut} className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 text-red-600 transition-colors">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </div>
                      <span className="text-sm">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto h-full flex flex-col">
          {/* Recent searches */}
          <div className="px-6 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Recent searches</h2>
              <div className="flex items-center gap-2">
                <button onClick={fetchThreads} className="text-xs px-2 py-1 bg-white border border-blue-100 rounded hover:bg-blue-50">
                  Refresh
                </button>
                <button onClick={toggleRecent} className="text-xs px-2 py-1 bg-white border border-blue-100 rounded hover:bg-blue-50">
                  {recentOpen ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {recentOpen && (
              <div className="mt-3 bg-white border border-blue-100 rounded-lg p-3 max-h-36 overflow-auto">
                {fetchingThreads ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="text-sm text-gray-500">Loading...</div>
                  </div>
                ) : searchHistory.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((query, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setPrompt(query);
                          setTimeout(() => getReply(), 100);
                        }}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm border border-blue-200 transition-colors"
                      >
                        {query.length > 30 ? `${query.substring(0, 30)}...` : query}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No recent searches yet. Ask about a medicine to start.</div>
                )}
              </div>
            )}
          </div>

          {/* Chat area */}
          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-6 max-w-4xl mx-auto">
              {prevChats.map((chat, idx) => (
                <div
                  key={idx}
                  className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xl rounded-2xl p-4 shadow-lg ${
                      chat.role === "user"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : (chat.isMedicineData || chat.medicineData)
                          ? "bg-transparent border-0 shadow-none w-full"
                          : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                    }`}
                  >
                    {renderMessageContent(chat)}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white max-w-xl rounded-2xl p-4 shadow-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <ScaleLoader color="#2563eb" height={16} width={2} />
                      <span className="text-sm text-gray-600">Searching medication database...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info row */}
          <div className="px-6 pb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 text-center">
                <span className="font-semibold">Important:</span> PharmaAssist provides medication information for research purposes only. Always consult healthcare professionals for medical advice.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Input Section with Enhanced Microphone */}
      <div className="bg-white border-t border-blue-200 shadow-lg">
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label htmlFor="chat-input" className="block text-sm font-medium text-gray-700 mb-2">Medication Query</label>
              <div className="relative">
                {/* Enhanced Microphone Button */}
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                  <button
                    onClick={toggleMicrophone}
                    type="button"
                    aria-pressed={isListening}
                    title={isSpeechSupported ? (isListening ? "Stop listening" : "Start voice input") : "Speech recognition not supported"}
                    className={`w-10 h-10 rounded-full flex items-center justify-center focus:outline-none transition-all duration-300 ${
                      isListening 
                        ? "bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse" 
                        : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                    }`}
                  >
                    {isListening ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Voice Listening Indicator */}
                {isListening && (
                  <div className="absolute left-14 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-1 h-4 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1 h-6 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></div>
                      <div className="w-1 h-4 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                    </div>
                    <span className="text-xs font-medium text-red-600">Listening...</span>
                  </div>
                )}

                <input
                  id="chat-input"
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && getReply()}
                  placeholder={isListening ? "Speak now..." : "Search any medicine, disease, or query..."}
                  className={`w-full bg-white text-gray-900 placeholder-gray-500 px-14 py-4 rounded-xl border-2 focus:outline-none transition-all duration-300 ${
                    isListening 
                      ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                      : 'border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                  }`}
                  aria-label="Ask about medications"
                  disabled={loading}
                />
                
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              <div className="mt-2 flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  Examples: "side effects of aspirin", "drug interactions with warfarin", "pediatric dosage for amoxicillin"
                </p>
                {!isSpeechSupported && (
                  <p className="text-xs text-amber-600">
                    <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Voice input not supported
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setPrompt("");
                  setReply(null);
                  setNewChat(true);
                  setCurrThreadId(undefined);
                  setPrevChats([]);
                }}
                className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-6 py-4 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-colors font-medium"
                disabled={loading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>New Chat</span>
              </button>

              <button
                onClick={getReply}
                disabled={loading || !prompt?.trim()}
                className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-semibold transition-colors shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <ScaleLoader color="#ffffff" height={16} width={2} />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                    <span>Search Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;