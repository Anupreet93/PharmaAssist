// src/components/Sidebar.jsx
import React, { useContext, useEffect, useRef, useState, useCallback } from "react";
import { MyContext } from "./MyContext.jsx";
import { AuthContext } from "./context/AuthContext.jsx";
import api from "./lib/api.js";

/**
 * Sidebar - fetches /api/chats and displays recent queries (paginated + searchable)
 * - Tries /api/chats (new) and falls back to /api/thread (legacy) on 404.
 */

const DEFAULT_PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

function Sidebar() {
  const {
    allThreads,
    setAllThreads,
    currThreadId,
    setCurrThreadId,
    setNewChat,
    setPrevChats,
    setReply
  } = useContext(MyContext);

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [items, setItems] = useState([]);
  const [cache] = useState(() => new Map());
  const abortRef = useRef(null);
  const listRef = useRef(null);

  // Helper function to safely parse JSON strings
  const tryParseJSON = (str) => {
    if (typeof str !== "string") return str;
    try {
      const parsed = JSON.parse(str);
      return parsed;
    } catch {
      return str;
    }
  };

  // Parse and validate medicine data
  const parseMedicineData = (data) => {
    try {
      // If data is already an object with medicine structure
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        // Check for medicine-like structure
        if ((data.name || data.medicine_name || data.drug_name) && 
            (data.uses || data.side_effects || data.category)) {
          return normalizeMedicineData(data);
        }
      }
      
      // If data is a string that might be JSON
      if (typeof data === 'string') {
        const parsed = tryParseJSON(data);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          // Check for medicine-like structure in parsed JSON
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

  // Normalize medicine data to consistent format
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

  // Process chat messages to normalize content
  const normalizeChatMessages = (messages) => {
    if (!Array.isArray(messages)) return [];
    
    return messages.map(message => {
      const content = message.content || message.text || "";
      
      // Try to parse if content is a string that might be JSON
      const parsedContent = tryParseJSON(content);
      
      // Check if parsed content is medicine data
      const medicineData = parseMedicineData(parsedContent);
      
      if (medicineData) {
        return {
          ...message,
          content: null, // Don't store raw content for medicine data
          medicineData: medicineData,
          isMedicineData: true
        };
      } else {
        return {
          ...message,
          content: parsedContent, // Use parsed content (could be string or object)
          medicineData: null,
          isMedicineData: false
        };
      }
    });
  };

  // ---- Helpers to normalize backend shapes ----
  const mapChatsItems = (itemsFromServer) =>
    (Array.isArray(itemsFromServer) ? itemsFromServer : []).map((it) => ({
      id: it.id ?? it.threadId ?? it._id ?? it.id,
      title: it.title ?? it.name ?? (it.lastMessageSnippet ?? ""),
      lastMessageSnippet: it.lastMessageSnippet ?? it.snippet ?? (it.messages?.length ? it.messages[it.messages.length - 1].content : ""),
      updatedAt: it.updatedAt ?? it.updated_at ?? it.createdAt ?? it.created_at ?? new Date().toISOString()
    }));

  const mapThreadsLegacy = (threads) =>
    (Array.isArray(threads) ? threads : []).map((t) => ({
      id: t.threadId ?? t._id ?? t.id,
      title: t.title ?? (Array.isArray(t.messages) && t.messages.length ? t.messages[t.messages.length - 1].content : "New Chat"),
      lastMessageSnippet: Array.isArray(t.messages) && t.messages.length ? t.messages[t.messages.length - 1].content : "",
      updatedAt: t.updatedAt ?? t.createdAt ?? new Date().toISOString()
    }));

  // ---- Primary fetch function: calls /api/chats ----
  const fetchChatsPage = useCallback(async ({ page = 1, pageSize = DEFAULT_PAGE_SIZE, q = "", sort = "updatedAt:desc", includeSnippet = true } = {}) => {
    const cacheKey = `${page}:${pageSize}:${q}:${sort}:${includeSnippet}`;
    if (cache.has(cacheKey)) {
      const c = cache.get(cacheKey);
      setItems(c.items);
      setTotal(c.total);
      setError(null);
      setAllThreads(c.items);
      return c;
    }

    // abort previous
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch (_) {}
    }
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const res = await api.get("/api/chats", {
        params: { page, pageSize, q, sort, includeSnippet },
        signal: abortRef.current.signal
      });

      const payload = res?.data ?? {};
      const fetchedItems = mapChatsItems(payload.items ?? []);
      const fetchedTotal = typeof payload.total === "number" ? payload.total : fetchedItems.length;

      cache.set(cacheKey, { items: fetchedItems, total: fetchedTotal, fetchedAt: Date.now() });
      setItems(fetchedItems);
      setTotal(fetchedTotal);
      setAllThreads(fetchedItems);
      setError(null);

      return { items: fetchedItems, total: fetchedTotal };
    } catch (err) {
      // if server side route missing: fallback to legacy /api/thread
      const status = err?.response?.status;
      if (status === 404) {
        // throw special to indicate fallback should be used
        const fallback = await fetchThreadsLegacy({ page, pageSize, q, sort });
        return fallback;
      }

      if (err?.name === "CanceledError" || err?.message === "canceled") {
        return;
      }

      console.error("Failed to load chats:", err);
      if (status === 401 || status === 403) {
        setError("Authentication error. Please sign in again.");
      } else if (status === 429) {
        setError("Too many requests — try again in a minute.");
      } else {
        setError("Couldn't load chats. Retry?");
      }
      setItems([]);
      setAllThreads([]);
      return;
    } finally {
      setLoading(false);
    }
  }, [cache, setAllThreads]);

  // ---- Legacy fallback (calls /api/thread) ----
  const fetchThreadsLegacy = useCallback(async ({ page = 1, pageSize = DEFAULT_PAGE_SIZE, q = "", sort = "updatedAt:desc" } = {}) => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get("/api/thread", { params: { page, pageSize, q, sort } });
      // older endpoint returns { ok: true, threads } or array
      const payload = res?.data ?? {};
      const threads = payload.threads ?? payload ?? [];
      const itemsMapped = mapThreadsLegacy(threads);

      // set totals conservatively
      const totalCount = itemsMapped.length;
      setItems(itemsMapped);
      setTotal(totalCount);
      setAllThreads(itemsMapped);
      cache.clear(); // clear cache since legacy shape used
      return { items: itemsMapped, total: totalCount };
    } catch (err) {
      console.error("Legacy /api/thread fallback failed:", err);
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError("Authentication error. Please sign in again.");
      } else {
        setError("Couldn't load chats (legacy). Retry?");
      }
      setItems([]);
      setAllThreads([]);
      return;
    } finally {
      setLoading(false);
    }
  }, [cache, setAllThreads]);

  // Debounce search input -> set q
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // fetch when user, page, or q changes
  useEffect(() => {
    if (!user) {
      setItems([]);
      setAllThreads([]);
      setTotal(0);
      return;
    }
    fetchChatsPage({ page, pageSize: DEFAULT_PAGE_SIZE, q, sort: "updatedAt:desc", includeSnippet: true });
  }, [page, q, user, fetchChatsPage, setAllThreads]);

  // keyboard navigation
  useEffect(() => {
    const onKey = (ev) => {
      if (!items || items.length === 0) return;
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setSelectedIndex((s) => Math.min(items.length - 1, s + 1));
        scrollIntoView(selectedIndex + 1);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setSelectedIndex((s) => Math.max(0, s - 1));
        scrollIntoView(selectedIndex - 1);
      } else if (ev.key === "Enter") {
        if (selectedIndex >= 0 && items[selectedIndex]) openChat(items[selectedIndex].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selectedIndex]);

  const scrollIntoView = (index) => {
    const list = listRef.current;
    if (!list) return;
    const nodes = list.querySelectorAll("[data-chat-row]");
    const el = nodes[index];
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  // FIXED: open a chat: optimistic highlight + fetch messages with proper normalization
  const openChat = async (chatId) => {
    if (!chatId) return;
    setCurrThreadId(chatId);
    setNewChat(false);
    setReply(null);

    try {
      // first try new endpoint
      const res = await api.get(`/api/chats/${encodeURIComponent(chatId)}/messages`, { params: { page: 1, pageSize: 500, includeMetadata: false } });
      const payload = res?.data ?? {};
      const msgs = Array.isArray(payload.messages) ? payload.messages : [];
      // Normalize messages to parse JSON and structure medicine data
      const normalized = normalizeChatMessages(msgs.map(m => ({ role: m.role, content: m.text || m.content })));
      setPrevChats(normalized);
      // refresh list (recent order may have changed)
      fetchChatsPage({ page: 1, pageSize: DEFAULT_PAGE_SIZE, q, sort: "updatedAt:desc", includeSnippet: true });
      return;
    } catch (err) {
      // fallback to legacy messages endpoint (/api/thread/:threadId)
      const status = err?.response?.status;
      if (status === 404) {
        try {
          const res2 = await api.get(`/api/thread/${encodeURIComponent(chatId)}`);
          const payload2 = res2?.data ?? {};
          const thread = payload2.thread ?? payload2;
          const msgs = Array.isArray(thread.messages) ? thread.messages : [];
          // Normalize messages to parse JSON and structure medicine data
          const normalized = normalizeChatMessages(msgs);
          setPrevChats(normalized);
          setCurrThreadId(thread.threadId || chatId);
          setNewChat(false);
          setReply(null);
          fetchChatsPage({ page: 1, pageSize: DEFAULT_PAGE_SIZE, q, sort: "updatedAt:desc", includeSnippet: true });
          return;
        } catch (err2) {
          console.error("Failed to load legacy thread messages:", err2);
          setError("Failed to load conversation. It may have been deleted or you don't have access.");
        }
      } else if (status === 401 || status === 403) {
        setError("Authentication error. Please sign in again.");
      } else {
        setError("Failed to load conversation. Click to retry.");
      }
    }
  };

  // create new thread on server
  const createChatOnServer = async () => {
    try {
      await api.post("/api/thread", { title: "New Research Query", messages: [] });
      cache.clear();
      await fetchChatsPage({ page: 1, pageSize: DEFAULT_PAGE_SIZE, q: "", sort: "updatedAt:desc", includeSnippet: true });
      setPage(1);
    } catch (err) {
      console.error("Failed to create chat:", err);
      setError("Failed to create chat");
    }
  };

  // delete chat
  const deleteChat = async (chatId) => {
    if (!chatId) return;
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    try {
      // try new endpoint first
      await api.delete(`/api/chats/${encodeURIComponent(chatId)}`);
      cache.clear();
      await fetchChatsPage({ page: 1, pageSize: DEFAULT_PAGE_SIZE, q, sort: "updatedAt:desc", includeSnippet: true });
      if (chatId === currThreadId) {
        setPrevChats([]);
        setCurrThreadId(undefined);
        setNewChat(true);
        setReply(null);
      }
    } catch (err) {
      // fallback to legacy delete
      const status = err?.response?.status;
      if (status === 404 || status === 405) {
        try {
          await api.delete(`/api/thread/${encodeURIComponent(chatId)}`);
          cache.clear();
          await fetchChatsPage({ page: 1, pageSize: DEFAULT_PAGE_SIZE, q, sort: "updatedAt:desc", includeSnippet: true });
          if (chatId === currThreadId) {
            setPrevChats([]);
            setCurrThreadId(undefined);
            setNewChat(true);
            setReply(null);
          }
        } catch (err2) {
          console.error("Legacy delete failed:", err2);
          setError("Failed to delete conversation");
        }
      } else {
        console.error("Failed to delete chat:", err);
        setError("Failed to delete conversation");
      }
    }
  };

  // rename chat (PATCH)
  const renameChat = async (chatId) => {
    if (!chatId) return;
    const newTitle = window.prompt("New title for conversation:");
    if (!newTitle) return;
    try {
      await api.patch(`/api/chats/${encodeURIComponent(chatId)}`, { title: newTitle });
      cache.clear();
      await fetchChatsPage({ page, pageSize: DEFAULT_PAGE_SIZE, q, sort: "updatedAt:desc", includeSnippet: true });
    } catch (err) {
      // fallback to legacy rename (if you support it)
      try {
        await api.patch(`/api/thread/${encodeURIComponent(chatId)}`, { title: newTitle });
        cache.clear();
        await fetchChatsPage({ page, pageSize: DEFAULT_PAGE_SIZE, q, sort: "updatedAt:desc", includeSnippet: true });
      } catch (err2) {
        console.error("Failed to rename chat:", err2);
        setError("Failed to rename conversation");
      }
    }
  };

  const renderSkeletons = () => (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-white border border-blue-100 animate-pulse h-16">
          <div className="h-4 bg-blue-100 rounded mb-2"></div>
          <div className="h-3 bg-blue-100 rounded w-3/4"></div>
        </div>
      ))}
    </div>
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Helper to format the snippet text (avoid showing raw JSON)
  const formatSnippet = (snippet) => {
    if (!snippet || typeof snippet !== 'string') return snippet || "";
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(snippet);
      if (parsed && typeof parsed === 'object' && parsed.name) {
        return `Medicine: ${parsed.name}`;
      }
    } catch {
      // Not JSON, return as is but truncate
    }
    
    // Truncate long text
    if (snippet.length > 50) {
      return snippet.substring(0, 47) + '...';
    }
    return snippet;
  };

  return (
    <aside className="w-full sm:w-72 lg:w-80 bg-gradient-to-b from-white to-blue-50 border-r border-blue-200 text-gray-800 flex flex-col h-full shadow-xl">
      {/* Header */}
      <div className="px-6 py-6 border-b border-blue-200 bg-white">
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-blue-800">Research History</h3>
            <p className="text-sm text-blue-600">Past medication queries</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            id="chat-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search research queries..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-colors"
            aria-label="Search research queries"
          />
        </div>

        {/* New Query Button */}
        <button
          onClick={createChatOnServer}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>New Research Query</span>
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-auto px-4 py-4" ref={listRef}>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="bg-red-100 p-1.5 rounded-lg">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 mb-1">Error Loading Queries</p>
                <p className="text-sm text-red-600 mb-2">{error}</p>
                {error && error.includes("Retry") && (
                  <button 
                    onClick={() => fetchChatsPage({ page, pageSize: DEFAULT_PAGE_SIZE, q, sort: "updatedAt:desc", includeSnippet: true })} 
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Retry Now
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? renderSkeletons() : items.length === 0 ? (
          <div className="text-center py-8">
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-8 border-2 border-dashed border-blue-200">
              <svg className="w-12 h-12 text-blue-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-blue-600 font-medium mb-1">No research history yet</p>
              <p className="text-sm text-blue-500">Your medication queries will appear here</p>
            </div>
          </div>
        ) : (
          <ul role="list" className="space-y-3">
            {items.map((it, idx) => {
              const isActive = it.id === currThreadId;
              const formattedSnippet = formatSnippet(it.lastMessageSnippet);
              
              return (
                <li key={it.id}>
                  <div
                    data-chat-row
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    aria-label={`Open conversation ${it.title}`}
                    onClick={() => openChat(it.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") openChat(it.id); }}
                    className={`group relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isActive 
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 shadow-lg" 
                        : "bg-white hover:bg-blue-50 border-blue-100 hover:border-blue-300 hover:shadow-md"
                    }`}
                    style={{ outline: selectedIndex === idx ? "2px solid #3b82f6" : "none" }}
                  >
                    {/* Active Indicator */}
                    {isActive && (
                      <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                        isActive ? "bg-blue-400" : "bg-blue-100 text-blue-600"
                      }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate mb-1 ${
                          isActive ? "text-white" : "text-gray-900"
                        }`}>
                          {it.title}
                        </div>
                        <div className={`text-xs truncate mb-2 ${
                          isActive ? "text-blue-100" : "text-gray-600"
                        }`}>
                          {formattedSnippet}
                        </div>
                        <div className={`text-xs ${
                          isActive ? "text-blue-200" : "text-gray-500"
                        }`}>
                          {formatDate(it.updatedAt)}
                        </div>
                      </div>
                    </div>

                    {/* Actions (Hover) */}
                    <div className={`mt-3 flex gap-2 ${isActive ? "opacity-90" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                      <button 
                        title="Rename" 
                        onClick={(e) => { e.stopPropagation(); renameChat(it.id); }} 
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                          isActive 
                            ? "bg-blue-400 hover:bg-blue-300 text-white" 
                            : "bg-white hover:bg-blue-100 text-blue-600 border border-blue-200"
                        }`}
                      >
                        Rename
                      </button>
                      <button 
                        title="Delete" 
                        onClick={(e) => { e.stopPropagation(); deleteChat(it.id); }} 
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                          isActive 
                            ? "bg-red-400 hover:bg-red-300 text-white" 
                            : "bg-white hover:bg-red-50 text-red-600 border border-red-200"
                        }`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-blue-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-gray-700">
              Showing {items.length} of {total} queries
            </span>
          </div>
          <div className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            Page {page}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button 
            disabled={page <= 1} 
            onClick={() => setPage((p) => Math.max(1, p - 1))} 
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              page <= 1 
                ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                : "bg-blue-100 hover:bg-blue-200 text-blue-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </div>
          </button>
          <button 
            disabled={(page * DEFAULT_PAGE_SIZE) >= total} 
            onClick={() => setPage((p) => p + 1)} 
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              (page * DEFAULT_PAGE_SIZE) >= total
                ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                : "bg-blue-100 hover:bg-blue-200 text-blue-700"
            }`}
          >
            <div className="flex items-center gap-2">
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;