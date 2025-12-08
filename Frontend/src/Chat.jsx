import React, { useContext, useState, useEffect } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";

function Chat() {
  const { newChat, prevChats, reply } = useContext(MyContext);
  const [latestReply, setLatestReply] = useState(null);
  const [parsedJSON, setParsedJSON] = useState(null);

  // Try to parse JSON robustly: handles pure JSON strings or text containing a JSON block
  const tryParseJSON = (val) => {
    if (!val) return null;
    if (typeof val === "object") return val;

    if (typeof val === "string") {
      const s = val.trim();

      // Quick parse if it's valid JSON
      try {
        return JSON.parse(s);
      } catch (e) {
        // try to find a JSON substring { ... }
        const first = s.indexOf("{");
        const last = s.lastIndexOf("}");
        if (first !== -1 && last !== -1 && last > first) {
          const candidate = s.slice(first, last + 1);
          try {
            return JSON.parse(candidate);
          } catch (e2) {
            // fallthrough
          }
        }
      }
    }
    return null;
  };

  // Normalize medicine object keys so UI can reliably consume them
  const normalizeMedicine = (raw) => {
    if (!raw || typeof raw !== "object") return null;

    const getArray = (x) => {
      if (!x) return [];
      if (Array.isArray(x)) return x;
      if (typeof x === "string") return [x];
      return [];
    };

    const normalized = {
      name: raw.name ?? raw.title ?? raw.medicine_name ?? null,
      formulation:
        raw.formulation ??
        raw.form ??
        raw.form_type ??
        raw.dosage_form ??
        raw.dosage ??
        null,
      category: raw.category ?? raw.type ?? raw.class ?? "N/A",
      uses: getArray(raw.uses ?? raw.indications ?? raw.purpose ?? []),
      common_side_effects:
        getArray(raw.common_side_effects ?? raw.side_effects_common ?? raw.side_effects ?? []),
      serious_side_effects:
        getArray(raw.serious_side_effects ?? raw.side_effects_serious ?? []),
      contraindications: getArray(raw.contraindications ?? raw.contra ?? raw.warnings ?? []),
      safe_age_groups: getArray(raw.safe_age_groups ?? raw.age_groups ?? raw.age ?? []),
      pregnancy_and_lactation:
        raw.pregnancy_and_lactation ?? raw.pregnancy ?? raw["pregnancy/lactation"] ?? "Varies",
      shelf_life_after_manufacture:
        raw.shelf_life_after_manufacture ?? raw.shelf_life ?? raw.shelf ?? "Varies",
      storage_instructions: raw.storage_instructions ?? raw.storage ?? "Varies",
      prescription_required:
        typeof raw.prescription_required === "boolean"
          ? raw.prescription_required
          : raw.prescription ?? false,
      disclaimer: raw.disclaimer ?? "Not a substitute for professional medical advice.",
      _raw: raw // keep raw for debugging / download
    };

    // Basic validation
    if (!normalized.name) return null;
    return normalized;
  };

  useEffect(() => {
    if (reply === null) {
      setLatestReply(null);
      setParsedJSON(null);
      return;
    }

    if (!prevChats?.length) return;

    const rawParsed = tryParseJSON(reply);
    if (rawParsed) {
      const normalized = normalizeMedicine(rawParsed);
      if (normalized) {
        console.debug("Normalized medicine:", normalized);
        setParsedJSON(normalized);
        setLatestReply(null);
        return;
      } else {
        // parsed JSON but couldn't normalize (maybe not medicine object)
        console.debug("Parsed JSON but failed normalization:", rawParsed);
      }
    }

    // Not JSON medicine → treat as plain text reply for typing animation
    setParsedJSON(null);

    const safeReply = typeof reply === "string" ? reply : JSON.stringify(reply, null, 2);
    const content = safeReply.split(" ");
    let idx = 0;
    setLatestReply(""); // reset for typing

    const interval = setInterval(() => {
      setLatestReply(content.slice(0, idx + 1).join(" "));
      idx++;
      if (idx >= content.length) clearInterval(interval);
    }, 40);

    return () => clearInterval(interval);
  }, [prevChats, reply]);

  // Medicine card (Tailwind)
  const MedicineCard = ({ data }) => {
    // Safe defaults for UI rendering
    const uses = data.uses ?? [];
    const common_side_effects = data.common_side_effects ?? [];
    const serious_side_effects = data.serious_side_effects ?? [];
    const contraindications = data.contraindications ?? [];
    const safe_age_groups = data.safe_age_groups ?? [];

    return (
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-200 space-y-4">
        {/* Header */}
        <div className="flex items-center space-x-3 pb-3 border-b border-blue-200">
          <div className="bg-blue-600 p-2 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{data.name}</h2>
            <p className="text-blue-700 font-medium">{data.formulation ?? "N/A"}</p>
          </div>
        </div>

        {/* Basic Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <span className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Category</span>
            <p className="text-gray-800 mt-1 font-medium">{data.category}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <span className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Prescription</span>
            <p className="text-gray-800 mt-1 font-medium">
              {data.prescription_required ? "Required" : "Not Required"}
            </p>
          </div>
        </div>

        {/* Uses */}
        <div className="bg-green-50 p-4 rounded-xl border border-green-200">
          <div className="flex items-center space-x-2 mb-3">
            <div className="bg-green-500 p-1 rounded">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-green-800 uppercase tracking-wide">Therapeutic Uses</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {uses.length ? uses.map((u, i) => (
              <span key={i} className="bg-white text-green-700 px-3 py-1 rounded-full text-sm border border-green-300 font-medium">
                {u}
              </span>
            )) : <span className="text-sm text-gray-600">N/A</span>}
          </div>
        </div>

        {/* Side Effects */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
            <div className="flex items-center space-x-2 mb-3">
              <div className="bg-yellow-500 p-1 rounded">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-yellow-800 uppercase tracking-wide">Common Side Effects</span>
            </div>
            <ul className="space-y-2">
              {common_side_effects.length ? common_side_effects.map((s, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-800 text-sm font-medium">{s}</span>
                </li>
              )) : <li className="text-sm text-gray-600">N/A</li>}
            </ul>
          </div>

          <div className="bg-red-50 p-4 rounded-xl border border-red-200">
            <div className="flex items-center space-x-2 mb-3">
              <div className="bg-red-500 p-1 rounded">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-red-800 uppercase tracking-wide">Serious Side Effects</span>
            </div>
            <ul className="space-y-2">
              {serious_side_effects.length ? serious_side_effects.map((s, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-800 text-sm font-medium">{s}</span>
                </li>
              )) : <li className="text-sm text-gray-600">N/A</li>}
            </ul>
          </div>
        </div>

        {/* Contraindications & Safety */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
            <div className="flex items-center space-x-2 mb-3">
              <div className="bg-purple-500 p-1 rounded">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-purple-800 uppercase tracking-wide">Contraindications</span>
            </div>
            <ul className="space-y-2">
              {contraindications.length ? contraindications.map((c, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-800 text-sm font-medium">{c}</span>
                </li>
              )) : <li className="text-sm text-gray-600">N/A</li>}
            </ul>
          </div>

          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
            <div className="flex items-center space-x-2 mb-3">
              <div className="bg-indigo-500 p-1 rounded">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-indigo-800 uppercase tracking-wide">Safe Age Groups</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {safe_age_groups.length ? safe_age_groups.map((a, i) => (
                <span key={i} className="bg-white text-indigo-700 px-3 py-1 rounded-full text-sm border border-indigo-300 font-medium">
                  {a}
                </span>
              )) : <span className="text-sm text-gray-600">N/A</span>}
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <span className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Pregnancy & Lactation</span>
            <p className="text-gray-800 mt-2 text-sm font-medium">{data.pregnancy_and_lactation}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <span className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Shelf Life</span>
            <p className="text-gray-800 mt-2 text-sm font-medium">{data.shelf_life_after_manufacture}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <span className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Storage</span>
            <p className="text-gray-800 mt-2 text-sm font-medium">{data.storage_instructions}</p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-red-50 border border-red-300 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <div className="bg-red-500 p-2 rounded-lg flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold text-red-800 uppercase tracking-wide">Important Disclaimer</span>
              <p className="text-red-700 text-sm mt-1 font-medium">{data.disclaimer}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {newChat && (
        <div className="text-center mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md mx-auto border border-blue-200">
            <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to PharmaAssist</h1>
            <p className="text-gray-600">Start a new conversation about medications</p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {prevChats?.slice(0, -1).map((chat, idx) => (
          <div key={idx} className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-xl rounded-2xl p-4 shadow-lg ${chat.role === "user" ? "bg-blue-600 text-white rounded-br-none" : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"}`}>
              {chat.role === "user" ? <p className="font-medium">{chat.content}</p> : (
                <div className="prose prose-sm max-w-none text-gray-900">
                  <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                    {chat.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {prevChats.length > 0 && (
          <>
            {parsedJSON ? (
              <div className="flex justify-start">
                <div className="max-w-4xl w-full">
                  <MedicineCard data={parsedJSON} />
                </div>
              </div>
            ) : latestReply === null ? (
              <div className="flex justify-start">
                <div className="bg-white max-w-xl rounded-2xl p-4 shadow-lg border border-gray-200">
                  <div className="prose prose-sm max-w-none text-gray-900">
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {prevChats[prevChats.length - 1].content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <div className="bg-white max-w-xl rounded-2xl p-4 shadow-lg border border-gray-200">
                  <div className="prose prose-sm max-w-none text-gray-900">
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {latestReply}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {prevChats.length === 0 && !newChat && (
          <div className="text-center py-12">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md mx-auto border border-blue-200">
              <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">PharmaAssist AI</h2>
              <p className="text-gray-600 mb-4">Your intelligent medication assistant</p>
              <p className="text-sm text-gray-500">Ask about drug information, side effects, interactions, and more</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
