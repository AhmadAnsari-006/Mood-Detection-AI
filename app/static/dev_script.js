// ================= DEVELOPER PORTAL CONTROLLER =================

// State variables
let currentDeveloper = null;
let currentTab = "tab-overview";
let datasetRecords = [];
let statementRecords = [];
let userRecords = [];

// Chart references to destroy/re-render cleanly
let charts = {
    accuracyTrend: null,
    emotionDist: null,
    mismatch: null
};

// Initialize page on DOM load
document.addEventListener("DOMContentLoaded", () => {
    checkDevSession();
});

// ================= AUTHENTICATION & SESSION TRACKING =================

function getDevHeaders(contentType = "application/json") {
    const headers = {};
    if (contentType) {
        headers["Content-Type"] = contentType;
    }
    const token = localStorage.getItem("dev_session_token") || sessionStorage.getItem("dev_session_token");
    if (token) {
        headers["X-Session-Token"] = token;
    }
    return headers;
}

async function checkDevSession() {
    const token = localStorage.getItem("dev_session_token") || sessionStorage.getItem("dev_session_token");
    if (!token) {
        showDevLoginScreen();
        return;
    }

    showGlobalLoader("Verifying developer access...");

    try {
        const response = await fetch("/api/auth/session", {
            method: "GET",
            headers: getDevHeaders()
        });

        hideGlobalLoader();

        if (response.ok) {
            const data = await response.json();
            if (data.user && data.user.role === "developer") {
                currentDeveloper = data.user;
                showDevDashboard(currentDeveloper);
            } else {
                showToast("Access Denied: Not a developer account.", "error");
                handleDevLogoutSilently();
            }
        } else {
            handleDevLogoutSilently();
        }
    } catch (e) {
        hideGlobalLoader();
        console.error("Developer session verification failed", e);
        showDevLoginScreen();
    }
}

function showDevDashboard(devUser) {
    document.getElementById("dev-login-container").classList.add("hidden");
    document.getElementById("dev-dashboard-container").classList.remove("hidden");

    document.getElementById("dev-display-name").innerText = devUser.fullName;
    document.getElementById("dev-display-role").innerText = "Administrator";

    // Load active tab data
    loadTabContent(currentTab);
    
    // Periodically update the queue badge count (e.g., every 30 seconds)
    updateQueueBadge();
}

function showDevLoginScreen() {
    currentDeveloper = null;
    document.getElementById("dev-dashboard-container").classList.add("hidden");
    document.getElementById("dev-login-container").classList.remove("hidden");
    document.getElementById("dev-login-form").reset();
}

async function handleDevLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById("dev-username").value.trim();
    const password = document.getElementById("dev-password").value;
    
    const submitBtn = document.getElementById("dev-signin-btn");
    setButtonLoadingState(submitBtn, true);

    try {
        const response = await fetch("/api/dev/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        setButtonLoadingState(submitBtn, false);

        if (response.ok) {
            // Keep developer token separate from normal user token to avoid session collisions
            sessionStorage.setItem("dev_session_token", data.token);
            localStorage.setItem("dev_session_token", data.token);
            
            showToast(`Developer authenticated: ${data.user.fullName}`, "success");
            currentDeveloper = data.user;
            showDevDashboard(currentDeveloper);
        } else {
            showToast(data.error || "Authentication failed.", "error");
        }
    } catch (e) {
        setButtonLoadingState(submitBtn, false);
        showToast("Error connecting to database.", "error");
    }
}

async function handleDevLogout() {
    showGlobalLoader("Signing out...");
    try {
        await fetch("/api/dev/logout", {
            method: "POST",
            headers: getDevHeaders()
        });
    } catch (e) {
        console.error("Logout request failed", e);
    }
    
    handleDevLogoutSilently();
    hideGlobalLoader();
    showToast("Signed out successfully.", "success");
}

function handleDevLogoutSilently() {
    localStorage.removeItem("dev_session_token");
    sessionStorage.removeItem("dev_session_token");
    showDevLoginScreen();
}

// ================= SIDEBAR MENU SWITCHING =================

function switchTab(tabId, menuItemElement) {
    // Update menu selection
    const items = document.querySelectorAll(".menu-item");
    items.forEach(item => item.classList.remove("active"));
    menuItemElement.classList.add("active");

    // Hide all tabs
    const tabs = document.querySelectorAll(".workspace-tab");
    tabs.forEach(tab => tab.classList.add("hidden"));

    // Show selected tab
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.remove("hidden");
    }

    currentTab = tabId;
    loadTabContent(tabId);
}

function loadTabContent(tabId) {
    if (tabId === "tab-overview") {
        loadOverviewData();
    } else if (tabId === "tab-queue") {
        loadFeedbackQueue();
    } else if (tabId === "tab-dataset") {
        loadDatasetRecords();
    } else if (tabId === "tab-statements") {
        loadStatementRecords();
    } else if (tabId === "tab-users") {
        loadUserActivityRecords();
    } else if (tabId === "tab-tools") {
        // Simple static tabs, no fetch needed
    } else if (tabId === "tab-audit") {
        loadAuditAndBackups();
    }
}

// ================= TAB 1: OVERVIEW & ANALYTICS =================

async function loadOverviewData() {
    try {
        const response = await fetch("/api/dev/analytics", {
            method: "GET",
            headers: getDevHeaders()
        });

        if (!response.ok) throw new Error("Failed to fetch analytics");

        const data = await response.json();
        
        // Populate Overview Cards
        document.getElementById("metric-users").innerText = data.overview.total_users;
        document.getElementById("metric-active").innerText = data.overview.active_users;
        document.getElementById("metric-predictions").innerText = data.overview.total_predictions;
        document.getElementById("metric-corrections").innerText = data.overview.total_corrections;
        document.getElementById("metric-accuracy").innerText = `${data.overview.accuracy_percentage}%`;
        document.getElementById("metric-dataset").innerText = data.overview.dataset_size;

        // Populate Gauge
        document.getElementById("accuracy-gauge-text").innerText = `${data.overview.accuracy_percentage}%`;
        document.getElementById("week-acc").innerText = `${data.trends.weekly_accuracy}%`;
        
        const ratio = data.overview.total_predictions > 0 
            ? ((data.overview.total_corrections / data.overview.total_predictions) * 100).toFixed(1) 
            : 0;
        document.getElementById("corr-ratio").innerText = `${ratio}%`;

        // Render Charts
        renderOverviewCharts(data);
    } catch (e) {
        showToast("Error loading analytics data.", "error");
        console.error(e);
    }
}

function renderOverviewCharts(data) {
    const HSL_CSS_PRIMARY = "#7c4dff";
    const HSL_CSS_ACCENT = "#00e5ff";
    const HSL_CSS_RED = "#ff1744";

    // 1. Accuracy Trend Chart
    const trendCtx = document.getElementById("accuracyTrendChart").getContext("2d");
    if (charts.accuracyTrend) charts.accuracyTrend.destroy();
    
    const dates = data.trends.daily_accuracy.map(d => d.date);
    const accuracies = data.trends.daily_accuracy.map(d => d.accuracy);
    const volumes = data.trends.daily_accuracy.map(d => d.total);

    charts.accuracyTrend = new Chart(trendCtx, {
        type: "line",
        data: {
            labels: dates.length > 0 ? dates : ["No Data"],
            datasets: [
                {
                    label: "Accuracy %",
                    data: accuracies.length > 0 ? accuracies : [100],
                    borderColor: HSL_CSS_ACCENT,
                    backgroundColor: "rgba(0, 229, 255, 0.1)",
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    yAxisID: "y"
                },
                {
                    label: "Feedback Count",
                    data: volumes.length > 0 ? volumes : [0],
                    borderColor: HSL_CSS_PRIMARY,
                    backgroundColor: "rgba(124, 77, 255, 0.2)",
                    borderWidth: 2,
                    type: "bar",
                    yAxisID: "y1"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: "linear",
                    position: "left",
                    min: 0,
                    max: 100,
                    grid: { color: "rgba(255,255,255,0.05)" },
                    ticks: { color: "#8a99ad" }
                },
                y1: {
                    type: "linear",
                    position: "right",
                    grid: { drawOnChartArea: false },
                    ticks: { color: "#8a99ad", stepSize: 1 }
                },
                x: {
                    grid: { color: "rgba(255,255,255,0.05)" },
                    ticks: { color: "#8a99ad" }
                }
            },
            plugins: {
                legend: { labels: { color: "#ffffff" } }
            }
        }
    });

    // 2. Emotion Distribution
    const distCtx = document.getElementById("emotionDistChart").getContext("2d");
    if (charts.emotionDist) charts.emotionDist.destroy();

    const emLabels = data.emotion_distribution.map(e => e.emotion);
    const emCounts = data.emotion_distribution.map(e => e.count);

    charts.emotionDist = new Chart(distCtx, {
        type: "doughnut",
        data: {
            labels: emLabels.length > 0 ? emLabels : ["No Data"],
            datasets: [{
                data: emCounts.length > 0 ? emCounts : [1],
                backgroundColor: [
                    "#ff1744", "#00e5ff", "#7c4dff", "#00e676", 
                    "#ffea00", "#ff9100", "#d500f9", "#3d5afe"
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "right",
                    labels: { color: "#ffffff" }
                }
            }
        }
    });

    // 3. Mismatch Matrix Chart
    const mismatchCtx = document.getElementById("mismatchChart").getContext("2d");
    if (charts.mismatch) charts.mismatch.destroy();

    const pairs = data.mismatches.map(m => m.pair);
    const counts = data.mismatches.map(m => m.count);

    charts.mismatch = new Chart(mismatchCtx, {
        type: "bar",
        data: {
            labels: pairs.length > 0 ? pairs : ["None"],
            datasets: [{
                label: "Correction Frequency",
                data: counts.length > 0 ? counts : [0],
                backgroundColor: HSL_CSS_RED,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: "rgba(255,255,255,0.05)" },
                    ticks: { color: "#8a99ad", stepSize: 1 }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: "#8a99ad" }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// ================= TAB 2: FEEDBACK REVIEW QUEUE =================

async function updateQueueBadge() {
    try {
        const response = await fetch("/api/dev/corrections/queue", {
            method: "GET",
            headers: getDevHeaders()
        });
        if (response.ok) {
            const pending = await response.json();
            const badge = document.getElementById("queue-badge");
            badge.innerText = pending.length;
            if (pending.length > 0) {
                badge.classList.add("visible");
            } else {
                badge.classList.remove("visible");
            }
        }
    } catch (e) {
        console.error("Queue badge count update failed", e);
    }
}

async function loadFeedbackQueue() {
    const queueList = document.getElementById("queue-list");
    const emptyState = document.getElementById("queue-empty");
    
    queueList.innerHTML = "";
    showGlobalLoader("Fetching review queue...");

    try {
        const response = await fetch("/api/dev/corrections/queue", {
            method: "GET",
            headers: getDevHeaders()
        });

        hideGlobalLoader();

        if (response.ok) {
            const pending = await response.json();
            
            // Update badge count
            const badge = document.getElementById("queue-badge");
            badge.innerText = pending.length;
            
            if (pending.length === 0) {
                emptyState.classList.remove("hidden");
                queueList.classList.add("hidden");
            } else {
                emptyState.classList.add("hidden");
                queueList.classList.remove("hidden");
                
                pending.forEach(item => {
                    const card = document.createElement("div");
                    card.className = "queue-card";
                    
                    const dateFormatted = new Date(item.timestamp).toLocaleString();
                    
                    card.innerHTML = `
                        <div class="card-body">
                            <p class="sentence-text">"${item.sentence}"</p>
                            <div class="mismatch-tag-wrapper">
                                <span class="mismatch-label predicted">Predicted: ${item.predictedEmotion}</span>
                                <i class="fas fa-arrow-right mismatch-arrow"></i>
                                <span class="mismatch-label corrected">Proposed: ${item.correctEmotion}</span>
                            </div>
                            <div class="card-meta">
                                <span><i class="fas fa-user"></i> ${item.username}</span>
                                <span><i class="fas fa-percentage"></i> Confidence: ${(item.confidence * 100).toFixed(1)}%</span>
                                <span><i class="fas fa-clock"></i> ${dateFormatted}</span>
                            </div>
                        </div>
                        <div class="card-footer">
                            <button onclick="approveQueueItem('${item.id}', '${item.correctEmotion}')" class="card-btn approve-btn">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button onclick="openQueueEditModal('${item.id}', '${item.sentence.replace(/'/g, "\\'")}', '${item.predictedEmotion}', '${item.correctEmotion}')" class="card-btn edit-btn">
                                <i class="fas fa-edit"></i> Edit Label
                            </button>
                            <button onclick="rejectQueueItem('${item.id}')" class="card-btn reject-btn">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        </div>
                    `;
                    queueList.appendChild(card);
                });
            }
        }
    } catch (e) {
        hideGlobalLoader();
        showToast("Error loading queue.", "error");
    }
}

async function approveQueueItem(correctionId, correctEmotion) {
    try {
        const response = await fetch("/api/dev/corrections/review", {
            method: "POST",
            headers: getDevHeaders(),
            body: JSON.stringify({
                correctionId: correctionId,
                action: "approve",
                correctEmotion: correctEmotion
            })
        });

        if (response.ok) {
            showToast("Correction approved and added to dataset.", "success");
            loadFeedbackQueue();
        } else {
            const data = await response.json();
            showToast(data.error || "Approval failed.", "error");
        }
    } catch (e) {
        showToast("Network error during approval.", "error");
    }
}

async function rejectQueueItem(correctionId) {
    if (!confirm("Are you sure you want to REJECT this user correction? This record will be excluded from dataset compiling.")) return;

    try {
        const response = await fetch("/api/dev/corrections/review", {
            method: "POST",
            headers: getDevHeaders(),
            body: JSON.stringify({
                correctionId: correctionId,
                action: "reject"
            })
        });

        if (response.ok) {
            showToast("Correction rejected.", "info");
            loadFeedbackQueue();
        } else {
            const data = await response.json();
            showToast(data.error || "Rejection failed.", "error");
        }
    } catch (e) {
        showToast("Network error during rejection.", "error");
    }
}

// Queue item edit approval modal
function openQueueEditModal(id, sentence, predicted, correct) {
    document.getElementById("queue-edit-id").value = id;
    document.getElementById("queue-edit-sentence-display").innerText = `"${sentence}"`;
    document.getElementById("queue-edit-predicted-display").innerText = predicted;
    document.getElementById("queue-edit-emotion-select").value = correct.charAt(0).toUpperCase() + correct.slice(1);
    
    document.getElementById("queue-edit-modal").classList.remove("hidden");
}

function closeQueueEditModal() {
    document.getElementById("queue-edit-modal").classList.add("hidden");
}

async function saveQueueEditApprove() {
    const id = document.getElementById("queue-edit-id").value;
    const selectedEmotion = document.getElementById("queue-edit-emotion-select").value;
    
    closeQueueEditModal();
    showGlobalLoader("Saving and approving correction...");

    try {
        const response = await fetch("/api/dev/corrections/review", {
            method: "POST",
            headers: getDevHeaders(),
            body: JSON.stringify({
                correctionId: id,
                action: "approve",
                correctEmotion: selectedEmotion
            })
        });

        hideGlobalLoader();

        if (response.ok) {
            showToast("Correction edited and approved.", "success");
            loadFeedbackQueue();
        } else {
            const data = await response.json();
            showToast(data.error || "Failed to edit and approve.", "error");
        }
    } catch (e) {
        hideGlobalLoader();
        showToast("Network error saving correction.", "error");
    }
}

// ================= TAB 3: DATASET MANAGER =================

async function loadDatasetRecords() {
    showGlobalLoader("Loading dataset entries...");
    try {
        const response = await fetch("/api/dev/dataset", {
            method: "GET",
            headers: getDevHeaders()
        });

        hideGlobalLoader();

        if (response.ok) {
            datasetRecords = await response.json();
            renderDatasetTable(datasetRecords);
        }
    } catch (e) {
        hideGlobalLoader();
        showToast("Error loading dataset.", "error");
    }
}

function renderDatasetTable(records) {
    const tbody = document.getElementById("dataset-table-body");
    tbody.innerHTML = "";

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No dataset records found.</td></tr>`;
        return;
    }

    records.forEach(item => {
        const tr = document.createElement("tr");
        const dateFormatted = item.timestamp ? new Date(item.timestamp).toLocaleString() : "N/A";
        
        tr.innerHTML = `
            <td><div class="statement-txt-cell" title="${item.sentence}">${item.sentence}</div></td>
            <td><span class="mismatch-label corrected">${item.emotion}</span></td>
            <td><span class="source-tag ${item.source}">${item.source}</span></td>
            <td>${dateFormatted}</td>
            <td>
                <button onclick="openEditModal('${item.sentence.replace(/'/g, "\\'")}', '${item.emotion}', 'dataset')" class="table-btn-action edit" title="Edit"><i class="fas fa-edit"></i></button>
                <button onclick="deleteDatasetRecord('${item.sentence.replace(/'/g, "\\'")}')" class="table-btn-action delete" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterDataset() {
    const searchVal = document.getElementById("dataset-search").value.toLowerCase();
    const emotionVal = document.getElementById("dataset-filter-emotion").value;
    const sourceVal = document.getElementById("dataset-filter-source").value;

    const filtered = datasetRecords.filter(item => {
        const matchesSearch = item.sentence.toLowerCase().includes(searchVal);
        const matchesEmotion = !emotionVal || item.emotion.toLowerCase() === emotionVal.toLowerCase();
        const matchesSource = !sourceVal || item.source.toLowerCase() === sourceVal.toLowerCase();
        return matchesSearch && matchesEmotion && matchesSource;
    });

    renderDatasetTable(filtered);
}

async function deleteDatasetRecord(sentence) {
    if (!confirm("Are you sure you want to DELETE this record from the verified training dataset?")) return;

    showGlobalLoader("Deleting record...");
    try {
        const response = await fetch("/api/dev/dataset/delete", {
            method: "POST",
            headers: getDevHeaders(),
            body: JSON.stringify({ sentence })
        });
        
        hideGlobalLoader();

        if (response.ok) {
            showToast("Dataset record deleted successfully.", "success");
            loadDatasetRecords();
        } else {
            const data = await response.json();
            showToast(data.error || "Failed to delete.", "error");
        }
    } catch (e) {
        hideGlobalLoader();
        showToast("Network error deleting record.", "error");
    }
}

async function handleDatasetImport(event) {
    const fileInput = event.target;
    const file = fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    showGlobalLoader("Uploading and parsing dataset JSON...");

    try {
        const response = await fetch("/api/dev/dataset/import", {
            method: "POST",
            headers: getDevHeaders(null), // multipart/form-data must not have content-type set manually so browser sets boundaries
            body: formData
        });

        hideGlobalLoader();
        fileInput.value = ""; // Clear input

        if (response.ok) {
            const data = await response.json();
            showToast(data.message || "Dataset imported successfully!", "success");
            loadDatasetRecords();
        } else {
            const data = await response.json();
            showToast(data.error || "Failed to import dataset.", "error");
        }
    } catch (e) {
        hideGlobalLoader();
        fileInput.value = "";
        showToast("Error connecting to server during import.", "error");
    }
}

// ================= TAB 4: USER STATEMENTS LOG =================

async function loadStatementRecords() {
    showGlobalLoader("Loading statements trail...");
    try {
        const response = await fetch("/api/dev/statements", {
            method: "GET",
            headers: getDevHeaders()
        });

        hideGlobalLoader();

        if (response.ok) {
            statementRecords = await response.json();
            renderStatementsTable(statementRecords);
        }
    } catch (e) {
        hideGlobalLoader();
        showToast("Error loading statements.", "error");
    }
}

function renderStatementsTable(records) {
    const tbody = document.getElementById("statements-table-body");
    tbody.innerHTML = "";

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No statement logs recorded.</td></tr>`;
        return;
    }

    records.forEach(item => {
        const tr = document.createElement("tr");
        
        let statusClass = "unreviewed";
        if (item.verified === true) statusClass = "verified";
        if (item.verified === false) statusClass = "corrected";

        tr.innerHTML = `
            <td><div class="statement-txt-cell" title="${item.sentence}">${item.sentence}</div></td>
            <td><span class="mismatch-label predicted">${item.predictedEmotion}</span></td>
            <td><span class="mismatch-label corrected">${item.correctEmotion}</span></td>
            <td>@${item.username}</td>
            <td><span class="status-badge ${statusClass}">${item.status}</span></td>
            <td>
                <button onclick="openEditModal('${item.id}', '${item.predictedEmotion}', 'statement', '${item.sentence.replace(/'/g, "\\'")}')" class="table-btn-action edit" title="Edit"><i class="fas fa-edit"></i></button>
                <button onclick="deleteStatementRecord('${item.id}')" class="table-btn-action delete" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterStatements() {
    const searchVal = document.getElementById("statements-search").value.toLowerCase();
    const statusVal = document.getElementById("statements-filter-status").value;

    const filtered = statementRecords.filter(item => {
        const matchesSearch = item.sentence.toLowerCase().includes(searchVal) || item.username.toLowerCase().includes(searchVal);
        
        let matchesStatus = true;
        if (statusVal === "Verified") {
            matchesStatus = item.verified === true;
        } else if (statusVal === "Corrected") {
            matchesStatus = item.verified === false;
        } else if (statusVal === "Unreviewed") {
            matchesStatus = item.verified === null;
        }

        return matchesSearch && matchesStatus;
    });

    renderStatementsTable(filtered);
}

async function deleteStatementRecord(id) {
    if (!confirm("Are you sure you want to DELETE this prediction log? Associated correction submissions will also be deleted.")) return;

    showGlobalLoader("Deleting statement log...");
    try {
        const response = await fetch("/api/dev/statements/delete", {
            method: "POST",
            headers: getDevHeaders(),
            body: JSON.stringify({ id })
        });
        
        hideGlobalLoader();

        if (response.ok) {
            showToast("Statement deleted successfully.", "success");
            loadStatementRecords();
        } else {
            const data = await response.json();
            showToast(data.error || "Failed to delete log.", "error");
        }
    } catch (e) {
        hideGlobalLoader();
        showToast("Network error deleting statement.", "error");
    }
}

// ================= TAB 5: USER ACTIVITY =================

async function loadUserActivityRecords() {
    showGlobalLoader("Loading active users status...");
    try {
        const response = await fetch("/api/dev/analytics", {
            method: "GET",
            headers: getDevHeaders()
        });

        hideGlobalLoader();

        if (response.ok) {
            const data = await response.json();
            userRecords = data.user_activity;
            renderUsersTable(userRecords);
        }
    } catch (e) {
        hideGlobalLoader();
        showToast("Error fetching activity metrics.", "error");
    }
}

function renderUsersTable(records) {
    const tbody = document.getElementById("users-table-body");
    tbody.innerHTML = "";

    records.forEach(item => {
        const tr = document.createElement("tr");
        const statusClass = item.session_status.toLowerCase(); // active / offline
        const lastAct = item.last_activity !== "Never" 
            ? new Date(item.last_activity).toLocaleString() 
            : "Never";

        tr.innerHTML = `
            <td><strong>@${item.username}</strong></td>
            <td><span class="role-tag ${item.role}">${item.role.toUpperCase()}</span></td>
            <td><span class="session-dot ${statusClass}"></span> ${item.session_status}</td>
            <td>${lastAct}</td>
            <td>${item.predictions_count}</td>
            <td>${item.corrections_count}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterUsers() {
    const val = document.getElementById("users-search").value.toLowerCase();
    const filtered = userRecords.filter(u => u.username.toLowerCase().includes(val));
    renderUsersTable(filtered);
}

// ================= TAB 6: DEVELOPER TOOLS PLACEHOLDERS =================

async function triggerDatasetCompiler() {
    showGlobalLoader("Compiling learning database...");
    try {
        const response = await fetch("/api/dev/engine/run", {
            method: "POST",
            headers: getDevHeaders()
        });

        hideGlobalLoader();

        if (response.ok) {
            const data = await response.json();
            showToast(data.message || "Dataset compiled successfully!", "success");
        } else {
            const data = await response.json();
            showToast(data.error || "Compilation failed.", "error");
        }
    } catch (e) {
        hideGlobalLoader();
        showToast("Error rebuilding verified dataset.", "error");
    }
}

// ================= TAB 7: AUDITS & BACKUPS =================

async function loadAuditAndBackups() {
    showGlobalLoader("Loading history logs & backup points...");
    try {
        // Fetch logs
        const logRes = await fetch("/api/dev/logs", { method: "GET", headers: getDevHeaders() });
        const backupRes = await fetch("/api/dev/backups", { method: "GET", headers: getDevHeaders() });
        
        hideGlobalLoader();

        if (logRes.ok && backupRes.ok) {
            const logs = await logRes.json();
            const backups = await backupRes.json();

            renderLogsTimeline(logs);
            renderBackupsTable(backups);
        }
    } catch (e) {
        hideGlobalLoader();
        showToast("Error loading security panels.", "error");
    }
}

function renderLogsTimeline(logs) {
    const container = document.getElementById("logs-list");
    container.innerHTML = "";

    if (logs.length === 0) {
        container.innerHTML = `<p class="logs-empty">No activity logs recorded yet.</p>`;
        return;
    }

    logs.forEach(log => {
        const item = document.createElement("div");
        item.className = "log-item";
        
        const timeFormatted = new Date(log.timestamp).toLocaleString();
        
        // Render details cleanly based on action
        let actionLabel = log.action.replace(/_/g, " ").toUpperCase();
        let detailsStr = JSON.stringify(log.details);
        if (log.action === "developer_login") actionLabel = "🔑 DEV LOGIN";
        if (log.action === "developer_logout") actionLabel = "🚪 DEV LOGOUT";
        if (log.action === "approve_correction") {
            actionLabel = "✅ APPROVE FEEDBACK";
            detailsStr = `Approved correct emotion '${log.details.emotion}' for text: "${log.details.sentence}"`;
        }
        if (log.action === "reject_correction") {
            actionLabel = "❌ REJECT FEEDBACK";
            detailsStr = `Rejected correction for text: "${log.details.sentence}"`;
        }
        if (log.action === "edit_dataset_record") {
            actionLabel = "✏️ EDIT TRAINING SET";
            detailsStr = `Edited sentence emotion label from '${log.details.old_emotion}' to '${log.details.new_emotion}' for sentence: "${log.details.sentence}"`;
        }
        if (log.action === "delete_dataset_record") {
            actionLabel = "🗑️ DELETE TRAINING SET RECORD";
            detailsStr = `Deleted record: "${log.details.sentence}"`;
        }
        if (log.action === "edit_statement") {
            actionLabel = "✏️ EDIT INPUT LOG";
            detailsStr = `Modified prediction content with statement ID: ${log.details.id}`;
        }
        if (log.action === "delete_statement") {
            actionLabel = "🗑️ DELETE INPUT LOG";
            detailsStr = `Deleted prediction content with statement ID: ${log.details.id}`;
        }
        if (log.action === "create_backup") {
            actionLabel = "🛡️ CREATE BACKUP";
            detailsStr = `Point-in-time snapshot directory created: ${log.details.backup_folder}`;
        }

        item.innerHTML = `
            <div class="log-meta">
                <span class="log-user"><strong>@${log.username}</strong></span>
                <span class="log-time">${timeFormatted}</span>
            </div>
            <div class="log-action">${actionLabel}</div>
            <div class="log-details">${detailsStr}</div>
        `;
        container.appendChild(item);
    });
}

function renderBackupsTable(backups) {
    const tbody = document.getElementById("backups-table-body");
    tbody.innerHTML = "";

    if (backups.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="table-empty">No backup points archived.</td></tr>`;
        return;
    }

    backups.forEach(b => {
        const tr = document.createElement("tr");
        const dateFormatted = new Date(b.created).toLocaleString();
        
        tr.innerHTML = `
            <td><strong>${b.name}</strong></td>
            <td>${dateFormatted}</td>
            <td>${b.files} database files</td>
        `;
        tbody.appendChild(tr);
    });
}

async function handleCreateBackup() {
    showGlobalLoader("Generating backup snapshot...");
    try {
        const response = await fetch("/api/dev/backup/create", {
            method: "POST",
            headers: getDevHeaders()
        });

        hideGlobalLoader();

        if (response.ok) {
            const data = await response.json();
            showToast(data.message || "Backup point created successfully!", "success");
            loadAuditAndBackups();
        } else {
            const data = await response.json();
            showToast(data.error || "Backup failed.", "error");
        }
    } catch (e) {
        hideGlobalLoader();
        showToast("Network error creating backup.", "error");
    }
}

// ================= CRUD POPUPS & MODALS =================

function openEditModal(keyId, activeLabel, editType, statementSentence = "") {
    document.getElementById("edit-record-id").value = keyId;
    document.getElementById("edit-record-type").value = editType;

    const sentenceInput = document.getElementById("edit-sentence-input");
    const labelTitle = document.getElementById("edit-label-name");
    
    // Set layout based on edit target (dataset manager directly works on sentence as primary key, statement logs use ID)
    if (editType === "dataset") {
        sentenceInput.value = keyId; // sentence is keyId
        sentenceInput.disabled = true; // primary key not editable directly to prevent constraint issues
        labelTitle.innerText = "Verified Emotion";
    } else {
        sentenceInput.value = statementSentence;
        sentenceInput.disabled = false;
        labelTitle.innerText = "Predicted Emotion";
    }

    document.getElementById("edit-emotion-select").value = activeLabel.charAt(0).toUpperCase() + activeLabel.slice(1);
    document.getElementById("edit-modal").classList.remove("hidden");
}

function closeEditModal() {
    document.getElementById("edit-modal").classList.add("hidden");
}

async function saveRecordEdit() {
    const keyId = document.getElementById("edit-record-id").value;
    const editType = document.getElementById("edit-record-type").value;
    const sentenceVal = document.getElementById("edit-sentence-input").value.trim();
    const emotionVal = document.getElementById("edit-emotion-select").value;

    if (!sentenceVal || !emotionVal) {
        showToast("Fields cannot be empty.", "error");
        return;
    }

    closeEditModal();
    showGlobalLoader("Saving changes...");

    let url = "/api/dev/dataset/edit";
    let body = { sentence: keyId, emotion: emotionVal };

    if (editType === "statement") {
        url = "/api/dev/statements/edit";
        body = { id: keyId, sentence: sentenceVal, predictedEmotion: emotionVal };
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: getDevHeaders(),
            body: JSON.stringify(body)
        });

        hideGlobalLoader();

        if (response.ok) {
            showToast("Record modified successfully.", "success");
            if (editType === "dataset") {
                loadDatasetRecords();
            } else {
                loadStatementRecords();
            }
        } else {
            const data = await response.json();
            showToast(data.error || "Update failed.", "error");
        }
    } catch (e) {
        hideGlobalLoader();
        showToast("Network error saving edits.", "error");
    }
}

// ================= TOASTS & UI UTILITIES =================

function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let iconClass = "fa-info-circle";
    if (type === "success") iconClass = "fa-check-circle";
    if (type === "error") iconClass = "fa-exclamation-circle";

    toast.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4000);
}

function showGlobalLoader(text = "Loading...") {
    document.getElementById("global-loader-text").innerText = text;
    document.getElementById("global-loader").classList.remove("hidden");
}

function hideGlobalLoader() {
    document.getElementById("global-loader").classList.add("hidden");
}

function setButtonLoadingState(button, isLoading) {
    const btnText = button.querySelector(".btn-text");
    const btnLoader = button.querySelector(".btn-loader");
    
    if (isLoading) {
        button.disabled = true;
        btnText.classList.add("hidden");
        btnLoader.classList.remove("hidden");
    } else {
        button.disabled = false;
        btnText.classList.remove("hidden");
        btnLoader.classList.add("hidden");
    }
}

function togglePasswordVisibility(inputId, iconElement) {
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput) return;

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        iconElement.classList.remove("fa-eye-slash");
        iconElement.classList.add("fa-eye");
    } else {
        passwordInput.type = "password";
        iconElement.classList.remove("fa-eye");
        iconElement.classList.add("fa-eye-slash");
    }
}
