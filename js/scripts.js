const fileInput = document.getElementById("file-input");
const uploadIdle = document.getElementById("upload-idle");
const uploadActive = document.getElementById("upload-active");
const uploadStatus = document.getElementById("upload-status");
const docNameEl = document.getElementById("doc-name");
const docMetaEl = document.getElementById("doc-meta");
const changeDocBtn = document.getElementById("change-doc-btn");

const chatSection = document.getElementById("chat-section");
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const questionInput = document.getElementById("question-input");
const usageIndicator = document.getElementById("usage-indicator");

let documentId = null;

function setUploadStatus(message, isError = false) {
    uploadStatus.textContent = message;
    uploadStatus.classList.toggle("is-error", isError);
}

function resetChat() {
    chatLog.innerHTML = `<p class="chat-empty">the page is open — what would you like to ask it?</p>`;
}

function appendMessage({ role, text, isError = false, sources = null }) {
    const empty = chatLog.querySelector(".chat-empty");
    if (empty) empty.remove();

    const el = document.createElement("div");
    el.className = `message ${role}${isError ? " is-error" : ""}`;
    el.textContent = text;

    if (sources && sources.length) {
        const details = document.createElement("details");
        details.className = "sources";
        const summary = document.createElement("summary");
        summary.textContent = `${sources.length} source excerpt${sources.length > 1 ? "s" : ""}`;
        details.appendChild(summary);
        sources.forEach((s) => {
            const div = document.createElement("div");
            div.className = "source-item";
            div.textContent = s;
            details.appendChild(div);
        });
        el.appendChild(details);
    }

    chatLog.appendChild(el);
    chatLog.scrollTop = chatLog.scrollHeight;
    return el;
}

async function refreshUsage() {
    try {
        const res = await fetch("/api/usage");
        const data = await res.json();
        usageIndicator.textContent = `${data.remaining} / ${data.limit} questions left today`;
    } catch {
        usageIndicator.textContent = "";
    }
}

fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    setUploadStatus("uploading and embedding...");

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch("/api/documents", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "upload failed.");
        }

        documentId = data.documentId;
        docNameEl.textContent = data.name;
        docMetaEl.textContent = `${data.chunkCount} chunk${data.chunkCount === 1 ? "" : "s"} indexed`;

        uploadIdle.hidden = true;
        uploadActive.hidden = false;
        setUploadStatus("");

        chatSection.hidden = false;
        resetChat();
        questionInput.focus();
        refreshUsage();
    } catch (error) {
        setUploadStatus(`error: ${error.message}`, true);
    } finally {
        fileInput.value = "";
    }
});

changeDocBtn.addEventListener("click", () => {
    documentId = null;
    uploadIdle.hidden = false;
    uploadActive.hidden = true;
    chatSection.hidden = true;
    setUploadStatus("");
});

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = questionInput.value.trim();
    if (!question || !documentId) return;

    appendMessage({ role: "user", text: question });
    questionInput.value = "";
    questionInput.disabled = true;

    const pending = appendMessage({ role: "assistant pending", text: "thinking..." });

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId, question }),
        });
        const data = await res.json();

        pending.remove();

        if (!res.ok) {
            appendMessage({ role: "assistant", text: data.error || "something went wrong.", isError: true });
        } else {
            appendMessage({ role: "assistant", text: data.answer, sources: data.sources });
        }

        refreshUsage();
    } catch (error) {
        pending.remove();
        appendMessage({ role: "assistant", text: `error: ${error.message}`, isError: true });
    } finally {
        questionInput.disabled = false;
        questionInput.focus();
    }
});

resetChat();
