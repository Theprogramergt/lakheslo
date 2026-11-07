document.addEventListener("DOMContentLoaded", () => {
    const navButtons = document.querySelectorAll(".nav-item");
    const breadcrumb = document.getElementById("breadcrumb-current");
    const sectionTitle = document.getElementById("section-title");
    const sectionDescription = document.getElementById("section-description");
    const fileInput = document.getElementById("pdf-file");
    const fileInfo = document.getElementById("file-info");
    const processButton = document.getElementById("process-button");
    const processButtonText = document.getElementById("process-button-text");
    const message = document.getElementById("message");
    const resultCard = document.getElementById("result-card");
    const resultTitle = document.getElementById("result-title");
    const resultContent = document.getElementById("result-content");
    const copyButton = document.getElementById("copy-button");
    const uploadCard = document.querySelector(".upload-card");
    const chatScreen = document.getElementById("chat-screen");
    const chatFileInput = document.getElementById("chat-file");
    const chatFileChip = document.getElementById("chat-file-chip");
    const chatFileName = document.getElementById("chat-file-name");
    const removeChatFile = document.getElementById("remove-chat-file");
    const chatMessages = document.getElementById("chat-messages");
    const chatEmptyState = document.getElementById("chat-empty-state");
    const chatQuestion = document.getElementById("chat-question");
    const chatSendButton = document.getElementById("chat-send-button");

    let selectedFile = null;
    let currentMode = "summarize";

    const modes = {
        summarize: {
            name: "Summarize PDF",
            title: "Summarize your document",
            description: "Turn lengthy PDF documents into clear, structured summaries.",
            button: "Generate Summary",
            result: "Your Document Summary"
        },
        quiz: {
            name: "Generate Quiz",
            title: "Test your knowledge",
            description: "Generate questions based on the content of your PDF document.",
            button: "Generate Quiz",
            result: "Your AI Generated Quiz"
        },
        chat: {
            name: "Chat with Document",
            title: "Chat with your document",
            description: "Ask questions and get answers based on your uploaded PDF.",
            button: "Start Chat",
            result: "Document Assistant"
        }
    };

    function updateChatLayout() {
        const isChat = currentMode === "chat";
        uploadCard.classList.toggle("hidden", isChat);
        document.getElementById("process-button").parentElement.classList.toggle("hidden", isChat);
        chatScreen.classList.toggle("hidden", !isChat);
        if (isChat) {
            updateChatSendState();
        }
    }

    // Navigation
    navButtons.forEach(button => {
        button.addEventListener("click", () => {
            const mode = button.dataset.section;

            if (!modes[mode]) return;

            currentMode = mode;

            navButtons.forEach(item => item.classList.remove("active"));
            button.classList.add("active");

            breadcrumb.textContent = modes[mode].name;
            sectionTitle.textContent = modes[mode].title;
            sectionDescription.textContent = modes[mode].description;
            processButtonText.textContent = modes[mode].button;

            resultCard.classList.add("hidden");
            message.textContent = "";
            updateChatLayout();
        });
    });

    // PDF selection
    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];

        if (!file) return;

        if (!validatePdf(file)) {
            return;
        }

        selectedFile = file;

        fileInfo.textContent =
            `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;

        processButton.disabled = false;
        showMessage("Your document is ready.", false);
        resultCard.classList.add("hidden");
    });

    chatFileInput.addEventListener("change", () => {
        const file = chatFileInput.files[0];
        if (!file || !validatePdf(file)) return;

        selectedFile = file;
        fileInput.value = "";
        chatFileName.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
        chatFileChip.classList.remove("hidden");
        chatEmptyState.classList.remove("hidden");
        showMessage("Your document is attached and ready.", false);
        updateChatSendState();
    });

    removeChatFile.addEventListener("click", () => {
        resetFile();
        chatFileInput.value = "";
        chatFileChip.classList.add("hidden");
        chatMessages.querySelectorAll(".chat-message").forEach(item => item.remove());
        chatEmptyState.classList.remove("hidden");
        updateChatSendState();
    });

    chatQuestion.addEventListener("input", updateChatSendState);
    chatQuestion.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendChatMessage();
        }
    });
    chatSendButton.addEventListener("click", sendChatMessage);

    // Process document
    processButton.addEventListener("click", async () => {
        if (!selectedFile) {
            showMessage("Please upload a PDF first.", true);
            return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("mode", currentMode);

        processButton.disabled = true;
        processButtonText.textContent = "Processing...";
        showMessage("Please wait while Lakheslo analyzes your document.", false);
        resultCard.classList.add("hidden");

        try {
            const response = await fetch("/api/process", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Something went wrong.");
            }

            resultTitle.textContent = modes[currentMode].result;
            resultContent.textContent = data.result;
            resultCard.classList.remove("hidden");

            showMessage("Your result is ready!", false);

        } catch (error) {
            showMessage(error.message || "Unable to process your document.", true);
        } finally {
            processButton.disabled = false;
            processButtonText.textContent = modes[currentMode].button;
        }
    });

    // Copy result
    copyButton.addEventListener("click", async () => {
        const text = resultContent.innerText;

        try {
            await navigator.clipboard.writeText(text);
            copyButton.textContent = "Copied!";
            setTimeout(() => {
                copyButton.textContent = "Copy result";
            }, 2000);
        } catch {
            showMessage("Unable to copy the result.", true);
        }
    });

    function showMessage(text, isError) {
        message.textContent = text;
        message.style.color = isError ? "#dc4545" : "#6658e8";
    }

    function resetFile() {
        selectedFile = null;
        fileInput.value = "";
        fileInfo.textContent = "PDF files only · Maximum size: 20 MB";
        processButton.disabled = true;
    }

    function validatePdf(file) {
        if (file.type !== "application/pdf" &&
            !file.name.toLowerCase().endsWith(".pdf")) {
            showMessage("Please select a valid PDF file.", true);
            return false;
        }

        if (file.size > 20 * 1024 * 1024) {
            showMessage("The PDF must be smaller than 20 MB.", true);
            return false;
        }

        return true;
    }

    function updateChatSendState() {
        chatSendButton.disabled = !selectedFile || !chatQuestion.value.trim();
    }

    async function sendChatMessage() {
        const question = chatQuestion.value.trim();
        if (!selectedFile || !question || chatSendButton.disabled) return;

        addChatMessage(question, "user");
        chatQuestion.value = "";
        updateChatSendState();

        const thinkingMessage = addChatMessage("Thinking...", "assistant thinking");
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("mode", "chat");
        formData.append("question", question);
        chatSendButton.disabled = true;

        try {
            const response = await fetch("/api/process", {
                method: "POST",
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Something went wrong.");
            thinkingMessage.querySelector(".message-bubble").textContent = data.result;
            thinkingMessage.classList.remove("thinking");
        } catch (error) {
            thinkingMessage.querySelector(".message-bubble").textContent =
                error.message || "Unable to answer your question.";
            thinkingMessage.classList.remove("thinking");
            thinkingMessage.classList.add("error");
        } finally {
            updateChatSendState();
        }
    }

    function addChatMessage(text, type) {
        chatEmptyState.classList.add("hidden");
        const messageElement = document.createElement("div");
        messageElement.className = `chat-message ${type}`;
        messageElement.innerHTML = `<div class="message-avatar">${type.startsWith("user") ? "E" : "✦"}</div><div class="message-bubble"></div>`;
        messageElement.querySelector(".message-bubble").textContent = text;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageElement;
    }
});
