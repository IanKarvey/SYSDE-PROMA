// Science Lab Inventory System - Main JS
// Handles all interactivity, AJAX, and UI updates

document.addEventListener('DOMContentLoaded', function () {
    // --- Utility Functions ---
    function $(selector, parent = document) {
        return parent.querySelector(selector);
    }
    function $all(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    }
    function showToast(msg, type = 'primary') {
        let toast = $('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = 'toast show toast-' + type;
        setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }
    function showModal(id) {
        $(id).classList.add('active');
    }
    function closeModal(id) {
        $(id).classList.remove('active');
    }
    $all('.close-modal').forEach(btn => {
        btn.onclick = function () {
            btn.closest('.modal').classList.remove('active');
        };
    });
    window.onclick = function (e) {
        if (e.target.classList.contains('modal')) e.target.classList.remove('active');
    };
    // --- Sidebar Navigation ---
    $all('.nav-links li').forEach(li => {
        li.onclick = function () {
            $all('.nav-links li').forEach(x => x.classList.remove('active'));
            li.classList.add('active');
            const section = li.getAttribute('data-section');
            $all('.content-section').forEach(sec => sec.classList.remove('active'));
            $('#' + section).classList.add('active');
        };
    });
    // --- Authentication State ---
    let currentUser = null;
    function updateUserUI(user) {
        currentUser = user;
        if (user) {
            $('.username').textContent = user.first_name + ' ' + user.last_name;
            $('.role').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
            $('.user-profile').style.display = '';

            // Hide/show sections based on role
            if (user.role === 'student') {
                // Show only student-accessible sections
                $all('.nav-links li').forEach(li => {
                    const section = li.getAttribute('data-section');
                    if (!['requests', 'issues'].includes(section)) {
                        li.style.display = 'none';
                    }
                });
                // Hide admin actions
                $all('.admin-only').forEach(el => el.style.display = 'none');
            } else {
                // Show all sections for admin/staff
                $all('.nav-links li').forEach(li => li.style.display = '');
                $all('.admin-only').forEach(el => el.style.display = '');
            }
        } else {
            $('.username').textContent = '';
            $('.role').textContent = '';
            $('.user-profile').style.display = 'none';
        }
    }
    // --- Auth Modals ---
    // (You can add login/register modal triggers here)
    // Example: showModal('#loginModal');
    // --- AJAX: Login/Register/Logout ---
    async function login(email, password) {
        const res = await fetch('php/auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
            credentials: 'include'
        });
        return res.json();
    }
    async function register(data) {
        const form = new FormData();
        for (let k in data) form.append(k, data[k]);
        form.append('action', 'register');
        const res = await fetch('php/auth.php', { method: 'POST', body: form, credentials: 'include' });
        return res.json();
    }
    async function logout() {
        await fetch('php/auth.php?action=logout', { credentials: 'include' });
        updateUserUI(null);
        showToast('Logged out', 'primary');
    }
    // --- Inventory ---
    async function fetchInventory() {
        const res = await fetch('php/inventory.php', { credentials: 'include' });
        const data = await res.json();
        if (data.success) renderInventoryTable(data.data);
    }
    function renderInventoryTable(items) {
        const tbody = $('#inventory .inventory-table tbody');
        tbody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>${item.category}</td>
                <td>${item.quantity}</td>
                <td class="status-${item.status.replace(/ /g, '-').toLowerCase()}">${item.status}</td>
                <td>${item.location}</td>
                <td>${item.last_checked ? item.last_checked : ''}</td>
                <td>
                    <button class="btn btn-outline btn-sm edit-item" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm delete-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        // Add event listeners for edit/delete here
    }
    // --- Requests ---
    async function fetchRequests() {
        const res = await fetch('php/request.php', { credentials: 'include' });
        const data = await res.json();
        if (data.success) renderRequestsTable(data.data);
    }
    // Hide "New Request" button for admin/staff
    function updateRequestUI() {
        if (currentUser.role === 'student') {
            $('#newRequestBtn').style.display = 'block';
        } else {
            $('#newRequestBtn').style.display = 'none';
        }
    }

    function renderRequestsTable(requests) {
        const tbody = $('#requests .requests-table tbody');
        tbody.innerHTML = '';
        requests.forEach(req => {
            const tr = document.createElement('tr');
            // Create status badge
            const statusBadge = `<span class="status-badge ${req.status.toLowerCase()}">${req.status}</span>`;
            
            // Create action buttons based on user role and status
            let actionButtons = '';
            if (currentUser.role === 'student') {
                // Students can only see status
                actionButtons = `<span class="status-${req.status.toLowerCase()}">${req.status}</span>`;
            } else {
                // Admin/staff: show approve/reject buttons for pending requests
                if (req.status === 'pending') {
                    actionButtons = `
                        <button class="btn btn-success btn-sm approve-request" data-id="${req.id}">Approve</button>
                        <button class="btn btn-danger btn-sm reject-request" data-id="${req.id}">Reject</button>
                    `;
                } else {
                    actionButtons = `<span class="status-${req.status.toLowerCase()}">${req.status}</span>`;
                }
            }

            tr.innerHTML = `
                <td>${req.id}</td>
                <td>${req.item_name}</td>
                <td>${req.first_name ? req.first_name + ' ' + req.last_name : ''}</td>
                <td>${req.date_requested}</td>
                <td>${req.needed_by}</td>
                <td>${statusBadge}</td>
                <td>${actionButtons}</td>
            `;
            tbody.appendChild(tr);
        });

        // Add event listeners for approve/reject buttons
        if (currentUser.role !== 'student') {
            $all('.approve-request').forEach(btn => {
                btn.onclick = () => updateRequestStatus(btn.dataset.id, 'approved');
            });
            
            $all('.reject-request').forEach(btn => {
                btn.onclick = () => updateRequestStatus(btn.dataset.id, 'rejected');
            });
        }
    }

    function showRequestDetails(request) {
        $('#detailRequestId').textContent = request.id;
        $('#detailItem').textContent = request.item_name;
        $('#detailRequester').textContent = `${request.first_name} ${request.last_name}`;
        $('#detailRequestDate').textContent = request.date_requested;
        $('#detailNeededBy').textContent = request.needed_by;
        $('#detailPurpose').textContent = request.purpose;
        $('#detailStatus').textContent = request.status;
        $('#detailStatus').className = `detail-value status-${request.status.toLowerCase()}`;
        
        // Show/hide action buttons based on status
        const actionButtons = $('.request-actions');
        if (request.status === 'pending') {
            actionButtons.style.display = 'flex';
        } else {
            actionButtons.style.display = 'none';
        }
        
        showModal('#requestDetailsModal');
    }

    // Add event listeners for approve/reject buttons
    $('#approveRequestBtn')?.addEventListener('click', async function() {
        const requestId = $('#detailRequestId').textContent;
        await updateRequestStatus(requestId, 'approved');
    });

    $('#rejectRequestBtn')?.addEventListener('click', async function() {
        const requestId = $('#detailRequestId').textContent;
        await updateRequestStatus(requestId, 'rejected');
    });

    async function updateRequestStatus(id, status) {
        if (!confirm(`Are you sure you want to ${status} this request?`)) return;
        
        try {
            const res = await fetch('php/request.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `id=${id}&status=${status}`,
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Request ${status} successfully`, 'success');
                fetchRequests();
            }
        } catch (error) {
            console.error('Error:', error);
            showToast(`Failed to ${status} request`, 'danger');
        }
    }
    // --- Check In/Out ---
    async function fetchCheckouts() {
        const res = await fetch('php/checkout.php', { credentials: 'include' });
        const data = await res.json();
        if (data.success) renderCheckoutsTable(data.data);
    }
    function renderCheckoutsTable(items) {
        const tbody = $('#checkinout .checkedout-table tbody');
        tbody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.item_name}</td>
                <td>${item.first_name} ${item.last_name}</td>
                <td>${item.date_out}</td>
                <td>${item.due_date}</td>
                <td class="status-${item.status}">${item.status}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    // --- Issues ---
    async function fetchIssues() {
        const res = await fetch('php/issue.php', { credentials: 'include' });
        const data = await res.json();
        if (data.success) renderIssuesTable(data.data);
    }
    function renderIssuesTable(issues) {
        if (currentUser.role === 'student') {
            // Hide issue list for students
            $('.issue-list').style.display = 'none';
            return;
        }

        // Show issue list for staff/admin
        $('.issue-list').style.display = 'block';
        const tbody = $('#issues .issues-table tbody');
        tbody.innerHTML = '';
        issues.forEach(issue => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${issue.id}</td>
                <td>${issue.item_name}</td>
                <td>${issue.type}</td>
                <td class="severity-${issue.severity}">${issue.severity}</td>
                <td>${issue.first_name ? issue.first_name + ' ' + issue.last_name : ''}</td>
                <td>${issue.date_reported}</td>
                <td class="status-${issue.status}">${issue.status}</td>
                <td>
                    <button class="btn btn-primary btn-sm resolve-issue" data-id="${issue.id}">Resolve</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        // Add event listeners for resolve here
    }
    // --- Initial Data Load ---
    fetchInventory();
    fetchRequests();
    fetchCheckouts();
    fetchIssues();
    // --- Add more event listeners and AJAX for forms, modals, etc. as needed ---
    // --- Example: Add Item Modal, Approve/Reject Request, Check In/Out, etc. ---
    // --- Example: Chart.js integration for dashboard ---

    // --- Dashboard Stat Cards Clickable ---
    function showSection(sectionId) {
        $all('.content-section').forEach(sec => sec.classList.remove('active'));
        $(sectionId).classList.add('active');
    }
    function filterInventory(status) {
        // Set filter and reload inventory
        $('#statusFilter').value = status;
        fetchInventory();
        showSection('#inventory');
    }
    function filterRequests(status) {
        // Simulate tab click for requests
        $all('#requests .tab-btn').forEach(btn => {
            if (btn.dataset.tab === status) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        // Optionally, filter table rows here
        showSection('#requests');
    }
    function showIssuesSection() {
        showSection('#issues');
    }
    $('#stat-total-items')?.addEventListener('click', () => {
        showSection('#inventory');
        $('#statusFilter').value = 'all';
        fetchInventory();
    });
    $('#stat-available-items')?.addEventListener('click', () => {
        filterInventory('available');
    });
    $('#stat-pending-requests')?.addEventListener('click', () => {
        filterRequests('pending');
    });
    $('#stat-issues-reported')?.addEventListener('click', () => {
        showIssuesSection();
    });

    // --- Notification Bell Functionality ---
    const notificationBell = $('#notificationBell');
    const notificationDropdown = $('#notificationDropdown');
    const notificationList = $('#notificationList');
    let notifications = [];
    function fetchNotifications() {
        // For demo, use recent activity + pending requests + issues
        notifications = [];
        // Recent activity (from dashboard)
        $all('.recent-activity .activity-item').forEach(item => {
            notifications.push({
                icon: item.querySelector('i')?.className || 'fas fa-info-circle',
                text: item.querySelector('.activity-text')?.textContent || '',
                time: item.querySelector('.activity-time')?.textContent || '',
                type: 'info',
                unread: true
            });
        });
        // Pending requests
        // (In real app, fetch from backend. Here, just add a sample)
        notifications.push({
            icon: 'fas fa-clock',
            text: 'You have pending equipment requests.',
            time: '',
            type: 'warning',
            unread: true
        });
        // Issues
        notifications.push({
            icon: 'fas fa-exclamation-triangle',
            text: 'New issue reported in Centrifuge #3.',
            time: '',
            type: 'danger',
            unread: true
        });
        renderNotifications();
    }
    function renderNotifications() {
        notificationList.innerHTML = '';
        let unreadCount = 0;
        notifications.forEach((notif, idx) => {
            if (notif.unread) unreadCount++;
            const li = document.createElement('li');
            li.className = notif.unread ? 'unread' : '';
            li.innerHTML = `
                <span class="notif-icon ${notif.type}"><i class="${notif.icon}"></i></span>
                <span>${notif.text}</span>
                <span style="margin-left:auto;font-size:0.85em;color:var(--text-light)">${notif.time || ''}</span>
            `;
            li.onclick = () => { li.classList.remove('unread'); notif.unread = false; updateNotificationCount(); };
            notificationList.appendChild(li);
        });
        updateNotificationCount(unreadCount);
    }
    function updateNotificationCount(count) {
        const badge = $('.notification-count');
        if (typeof count === 'undefined') count = notifications.filter(n => n.unread).length;
        badge.textContent = count;
        badge.style.display = count > 0 ? '' : 'none';
    }
    notificationBell.addEventListener('click', function (e) {
        e.stopPropagation();
        notificationBell.classList.toggle('open');
        if (notificationBell.classList.contains('open')) {
            notificationDropdown.style.display = 'block';
            fetchNotifications();
        } else {
            notificationDropdown.style.display = 'none';
        }
    });
    document.body.addEventListener('click', function (e) {
        if (!notificationBell.contains(e.target)) {
            notificationBell.classList.remove('open');
            notificationDropdown.style.display = 'none';
        }
    });
    $('#markAllReadBtn').addEventListener('click', function () {
        notifications.forEach(n => n.unread = false);
        renderNotifications();
    });

    // --- Login Front Screen Logic ---
    const loginScreen = $('#loginScreen');
    const mainApp = $('#mainApp');
    const loginForm = $('#loginForm');
    const loginRole = $('#loginRole');
    const secretIdGroup = $('#secretIdGroup');
    const secretIdInput = $('#secretId');
    // Show/hide secret ID for Lab Staff
    loginRole.addEventListener('change', function () {
        if (loginRole.value === 'staff') {
            secretIdGroup.style.display = '';
        } else {
            secretIdGroup.style.display = 'none';
            secretIdInput.value = '';
        }
    });
    // On login form submit
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const email = $('#loginEmail').value.trim();
        const password = $('#loginPassword').value;
        const role = loginRole.value;
        const secretId = secretIdInput.value;
        
        // Validate Admin Verification ID for staff role
        if (role === 'staff') {
            const validSecretId = '2023351631'; // Admin Verification ID
            if (secretId !== validSecretId) {
                showToast('Invalid Admin Verification ID', 'danger');
                secretIdInput.focus();
                return;
            }
        }
        
        // Send login AJAX
        try {
            const res = await fetch('php/auth.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&role=${encodeURIComponent(role)}`,
                credentials: 'include'
            });
            const data = await res.json();
            
            if (data.success) {
                updateUserUI(data.user);
                loginScreen.style.display = 'none';
                mainApp.style.display = '';
                showToast('Login successful', 'success');
                
                // Load all modules
                fetchInventory();
                fetchRequests();
                fetchCheckouts();
                fetchIssues();
                showSection('#dashboard');
            } else {
                showToast(data.message || 'Login failed', 'danger');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('Login failed. Please try again.', 'danger');
        }
    });
    // Hide main app until login
    mainApp.style.display = 'none';
    loginScreen.style.display = 'flex';

    // --- Logout Functionality ---
    const logoutBtn = $('#logoutBtn');
    logoutBtn.addEventListener('click', async function() {
        // Show confirmation modal
        if (confirm('Are you sure you want to logout?')) {
            // Add logging out animation
            mainApp.classList.add('logging-out');
            
            try {
                await fetch('php/auth.php?action=logout', { 
                    credentials: 'include'
                });
                
                // Wait for animation to complete
                setTimeout(() => {
                    updateUserUI(null);
                    mainApp.style.display = 'none';
                    loginScreen.style.display = 'flex';
                    mainApp.classList.remove('logging-out');
                    
                    // Reset login form
                    $('#loginEmail').value = '';
                    $('#loginPassword').value = '';
                    $('#loginRole').value = 'student';
                    $('#secretId').value = '';
                    $('#secretIdGroup').style.display = 'none';
                    
                    showToast('Logged out successfully', 'success');
                }, 500);
                
            } catch (error) {
                console.error('Logout error:', error);
                showToast('Logout failed. Please try again.', 'danger');
                mainApp.classList.remove('logging-out');
            }
        }
    });

    // Request form functionality
    const newRequestBtn = $('#newRequestBtn');
    const studentRequestForm = $('.student-request-form');
    const requestForm = $('#studentRequestForm');

    // Show/hide form
    newRequestBtn.addEventListener('click', () => {
        studentRequestForm.style.display = 'block';
        // Load available items for request
        loadAvailableItems();
    });

    $('#cancelRequestBtn').addEventListener('click', () => {
        studentRequestForm.style.display = 'none';
        requestForm.reset();
    });

    // Load available items for the dropdown
    async function loadAvailableItems() {
        try {
            const res = await fetch('php/inventory.php?status=available');
            const data = await res.json();
            const select = $('#requestItem');
            select.innerHTML = '<option value="">Choose equipment...</option>';
            data.data.forEach(item => {
                select.innerHTML += `<option value="${item.id}">${item.name}</option>`;
            });
        } catch (error) {
            console.error('Error loading items:', error);
            showToast('Failed to load available items', 'danger');
        }
    }

    // Handle form submission
    requestForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData();
        formData.append('item_id', $('#requestItem').value);
        formData.append('needed_by', $('#requestDate').value);
        formData.append('purpose', $('#requestPurpose').value);
        
        try {
            const res = await fetch('php/request.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await res.json();
            
            if (data.success) {
                showToast('Request submitted successfully', 'success');
                studentRequestForm.style.display = 'none';
                requestForm.reset();
                fetchRequests(); // Refresh the requests table
            } else {
                showToast(data.message || 'Failed to submit request', 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to submit request', 'danger');
        }
    });
});