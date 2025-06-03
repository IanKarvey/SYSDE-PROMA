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
        const search = $('#searchInventory')?.value || '';
        const category = $('#categoryFilter')?.value || 'all';
        const status = $('#statusFilter')?.value || 'all';

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (category !== 'all') params.append('category', category);
        if (status !== 'all') params.append('status', status);

        const res = await fetch(`php/inventory.php?${params.toString()}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) renderInventoryTable(data.data);
    }

    async function addInventoryItem(formData) {
        try {
            const res = await fetch('php/inventory.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast('Item added successfully', 'success');
                closeModal('#addItemModal');
                fetchInventory();
                $('#addItemForm').reset();
            } else {
                showToast(data.message || 'Failed to add item', 'danger');
            }
        } catch (error) {
            console.error('Error adding item:', error);
            showToast('Failed to add item', 'danger');
        }
    }

    async function editInventoryItem(itemId) {
        try {
            // Fetch item details
            const res = await fetch(`php/inventory.php?id=${itemId}`, { credentials: 'include' });
            const data = await res.json();
            if (data.success && data.item) {
                populateEditForm(data.item);
                showModal('#editItemModal');
            } else {
                showToast('Failed to load item details', 'danger');
            }
        } catch (error) {
            console.error('Error fetching item:', error);
            showToast('Failed to load item details', 'danger');
        }
    }

    async function deleteInventoryItem(itemId) {
        if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            return;
        }

        try {
            const res = await fetch('php/inventory.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `id=${itemId}`,
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast('Item deleted successfully', 'success');
                fetchInventory();
            } else {
                showToast(data.message || 'Failed to delete item', 'danger');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast('Failed to delete item', 'danger');
        }
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
                <td><span class="status-badge ${item.status.replace(/ /g, '-').toLowerCase()}">${item.status}</span></td>
                <td>${item.location}</td>
                <td>${item.last_checked ? new Date(item.last_checked).toLocaleDateString() : 'Never'}</td>
                <td>
                    ${currentUser.role === 'admin' || currentUser.role === 'staff' ? `
                        <button class="btn btn-outline btn-sm edit-item" data-id="${item.id}" title="Edit Item">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm delete-item" data-id="${item.id}" title="Delete Item">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add event listeners for edit/delete buttons
        $all('.edit-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.closest('button').dataset.id;
                editInventoryItem(itemId);
            });
        });

        $all('.delete-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.closest('button').dataset.id;
                deleteInventoryItem(itemId);
            });
        });
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

    async function loadAvailableItemsForIssues() {
        try {
            const res = await fetch('php/inventory.php', { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                const issueItemSelect = $('#issueItem');
                issueItemSelect.innerHTML = '<option value="">Select an item</option>';
                data.data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = `${item.name} - ${item.location}`;
                    issueItemSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading items for issues:', error);
        }
    }

    async function submitIssueReport() {
        const itemId = $('#issueItem').value;
        const type = $('#issueType').value;
        const severity = $('#issueSeverity').value;
        const description = $('#issueDescription').value;
        const imageFile = $('#issueImage').files[0];

        if (!itemId || !description.trim()) {
            showToast('Please select an item and provide a description', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('item_id', itemId);
        formData.append('type', type);
        formData.append('severity', severity);
        formData.append('description', description);
        formData.append('date_reported', new Date().toISOString().split('T')[0]);

        if (imageFile) {
            formData.append('image', imageFile);
        }

        try {
            const res = await fetch('php/issue.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                showToast('Issue reported successfully', 'success');
                // Reset form
                $('#issueItem').value = '';
                $('#issueType').value = 'damage';
                $('#issueSeverity').value = 'low';
                $('#issueDescription').value = '';
                $('#issueImage').value = '';
                // Refresh issues if admin/staff
                if (currentUser.role === 'admin' || currentUser.role === 'staff') {
                    fetchIssues();
                }
            } else {
                showToast(data.message || 'Failed to submit issue report', 'danger');
            }
        } catch (error) {
            console.error('Error submitting issue:', error);
            showToast('Failed to submit issue report', 'danger');
        }
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

    // On login form submit
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const email = $('#loginEmail').value.trim();
        const password = $('#loginPassword').value;

        if (!email || !password) {
            showToast('Please enter both email and password', 'danger');
            return;
        }

        // Show loading state
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        submitBtn.disabled = true;

        // Send login AJAX
        try {
            const res = await fetch('php/auth.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                updateUserUI(data.user);
                loginScreen.style.display = 'none';
                mainApp.style.display = '';
                showToast(`Welcome back, ${data.user.first_name}!`, 'success');

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
            showToast('Login failed. Please check your connection and try again.', 'danger');
        } finally {
            // Reset button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
    // Hide main app until login
    mainApp.style.display = 'none';
    loginScreen.style.display = 'flex';

    // --- Inventory Management Event Handlers ---
    function populateEditForm(item) {
        $('#editItemId').value = item.id;
        $('#editItemName').value = item.name;
        $('#editItemCategory').value = item.category;
        $('#editItemQuantity').value = item.quantity;
        $('#editItemStatus').value = item.status;
        $('#editItemLocation').value = item.location;
        $('#editItemDescription').value = item.description || '';
    }

    // Add Item Form Handler
    $('#addItemBtn')?.addEventListener('click', () => {
        showModal('#addItemModal');
    });

    $('#addItemForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('name', $('#itemName').value);
        formData.append('category', $('#itemCategory').value);
        formData.append('quantity', $('#itemQuantity').value);
        formData.append('location', $('#itemLocation').value);
        formData.append('description', $('#itemDescription').value);

        const imageFile = $('#itemImage').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        await addInventoryItem(formData);
    });

    // Edit Item Form Handler
    $('#editItemForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemId = $('#editItemId').value;
        const formData = new URLSearchParams();
        formData.append('id', itemId);
        formData.append('name', $('#editItemName').value);
        formData.append('category', $('#editItemCategory').value);
        formData.append('quantity', $('#editItemQuantity').value);
        formData.append('status', $('#editItemStatus').value);
        formData.append('location', $('#editItemLocation').value);
        formData.append('description', $('#editItemDescription').value);

        try {
            const res = await fetch('php/inventory.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString(),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast('Item updated successfully', 'success');
                closeModal('#editItemModal');
                fetchInventory();
            } else {
                showToast(data.message || 'Failed to update item', 'danger');
            }
        } catch (error) {
            console.error('Error updating item:', error);
            showToast('Failed to update item', 'danger');
        }
    });

    // Search and Filter Handlers
    $('#searchInventory')?.addEventListener('input', debounce(fetchInventory, 300));
    $('#categoryFilter')?.addEventListener('change', fetchInventory);
    $('#statusFilter')?.addEventListener('change', fetchInventory);

    // --- Issue Reporting Event Handlers ---
    $('#submitIssueBtn')?.addEventListener('click', submitIssueReport);

    // Load items when issues section is accessed
    document.addEventListener('DOMContentLoaded', () => {
        loadAvailableItemsForIssues();
        loadAvailableItems(); // For request form
    });

    // --- PDF and QR Code Functions ---
    async function generateReceipt(type, referenceId) {
        try {
            const formData = new FormData();
            formData.append('action', 'generate_receipt');
            formData.append('type', type);
            formData.append('reference_id', referenceId);

            const res = await fetch('php/pdf_generator.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                // Show QR code modal
                $('#qrDisplay').innerHTML = `
                    <div class="qr-code-display">
                        <h4>QR Code: ${data.qr_code}</h4>
                        <div class="qr-code-text">${data.qr_code}</div>
                        <p>Save this code for verification</p>
                    </div>
                `;

                // Store receipt HTML for printing
                window.receiptHTML = data.receipt_html;
                showModal('#qrCodeModal');

                showToast('Receipt generated successfully', 'success');
            } else {
                showToast(data.message || 'Failed to generate receipt', 'danger');
            }
        } catch (error) {
            console.error('Error generating receipt:', error);
            showToast('Failed to generate receipt', 'danger');
        }
    }

    function printReceipt() {
        if (window.receiptHTML) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(window.receiptHTML);
            printWindow.document.close();
            printWindow.focus();
        } else {
            showToast('No receipt to print', 'warning');
        }
    }

    function downloadQRCode(qrCode) {
        // Create a simple text file with the QR code
        const element = document.createElement('a');
        const file = new Blob([`QR Code: ${qrCode}\nGenerated: ${new Date().toLocaleString()}`], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = `qr_code_${qrCode}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    // --- Student History Functions ---
    async function loadStudentHistory(studentId, filters = {}) {
        try {
            const params = new URLSearchParams();
            if (studentId) params.append('student_id', studentId);
            if (filters.dateFrom) params.append('date_from', filters.dateFrom);
            if (filters.dateTo) params.append('date_to', filters.dateTo);
            if (filters.status && filters.status !== 'all') params.append('status', filters.status);

            const res = await fetch(`php/student_history.php?${params.toString()}`, {
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                displayStudentHistory(data);
            } else {
                showToast(data.message || 'Failed to load student history', 'danger');
            }
        } catch (error) {
            console.error('Error loading student history:', error);
            showToast('Failed to load student history', 'danger');
        }
    }

    function displayStudentHistory(data) {
        // Display student info
        $('#studentInfo').innerHTML = `
            <div class="student-card">
                <h4>${data.student.first_name} ${data.student.last_name}</h4>
                <p>Email: ${data.student.email}</p>
                <p>Department: ${data.student.department || 'N/A'}</p>
            </div>
        `;

        // Display statistics
        $('#historyStats').innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-number">${data.stats.total_requests}</span>
                    <span class="stat-label">Total Requests</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${data.stats.pending_requests}</span>
                    <span class="stat-label">Pending</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${data.stats.total_checkouts}</span>
                    <span class="stat-label">Total Checkouts</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${data.stats.current_checkouts}</span>
                    <span class="stat-label">Current</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${data.stats.total_issues}</span>
                    <span class="stat-label">Issues Reported</span>
                </div>
            </div>
        `;

        // Store data for tab switching
        window.studentHistoryData = data;

        // Show requests by default
        showHistoryTab('requests');
    }

    function showHistoryTab(tabName) {
        // Update tab buttons
        $all('.history-tabs .tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        const data = window.studentHistoryData;
        if (!data) return;

        let content = '';

        switch (tabName) {
            case 'requests':
                content = generateRequestsTable(data.requests);
                break;
            case 'checkouts':
                content = generateCheckoutsTable(data.checkouts);
                break;
            case 'issues':
                content = generateIssuesTable(data.issues);
                break;
            case 'activities':
                content = generateActivitiesTable(data.activities);
                break;
        }

        $('#historyContent').innerHTML = content;
    }

    function generateRequestsTable(requests) {
        if (!requests.length) return '<p>No requests found.</p>';

        return `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Item</th>
                        <th>Date Requested</th>
                        <th>Needed By</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${requests.map(req => `
                        <tr>
                            <td>${req.id}</td>
                            <td>${req.item_name}</td>
                            <td>${req.date_requested}</td>
                            <td>${req.needed_by}</td>
                            <td><span class="status-badge ${req.status}">${req.status}</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="generateReceipt('request', ${req.id})">
                                    <i class="fas fa-receipt"></i> Receipt
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function generateCheckoutsTable(checkouts) {
        if (!checkouts.length) return '<p>No checkouts found.</p>';

        return `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Item</th>
                        <th>Date Out</th>
                        <th>Due Date</th>
                        <th>Date In</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${checkouts.map(checkout => `
                        <tr>
                            <td>${checkout.id}</td>
                            <td>${checkout.item_name}</td>
                            <td>${checkout.date_out}</td>
                            <td>${checkout.due_date}</td>
                            <td>${checkout.date_in || 'Not returned'}</td>
                            <td><span class="status-badge ${checkout.status}">${checkout.status}</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="generateReceipt('checkout', ${checkout.id})">
                                    <i class="fas fa-receipt"></i> Receipt
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function generateIssuesTable(issues) {
        if (!issues.length) return '<p>No issues found.</p>';

        return `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Severity</th>
                        <th>Date Reported</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${issues.map(issue => `
                        <tr>
                            <td>${issue.id}</td>
                            <td>${issue.item_name}</td>
                            <td>${issue.type}</td>
                            <td><span class="severity-${issue.severity}">${issue.severity}</span></td>
                            <td>${issue.date_reported}</td>
                            <td><span class="status-badge ${issue.status}">${issue.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function generateActivitiesTable(activities) {
        if (!activities.length) return '<p>No activities found.</p>';

        return `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Action</th>
                        <th>Description</th>
                        <th>Item</th>
                    </tr>
                </thead>
                <tbody>
                    ${activities.map(activity => `
                        <tr>
                            <td>${new Date(activity.created_at).toLocaleDateString()}</td>
                            <td>${activity.action}</td>
                            <td>${activity.description}</td>
                            <td>${activity.item_name || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Debounce function for search
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- Event Handlers for New Features ---

    // QR Code Modal Event Handlers
    $('#printReceiptBtn')?.addEventListener('click', printReceipt);
    $('#downloadQRBtn')?.addEventListener('click', () => {
        const qrCode = $('#qrDisplay .qr-code-text')?.textContent;
        if (qrCode) {
            downloadQRCode(qrCode);
        }
    });

    // Student History Modal Event Handlers
    $('#filterHistoryBtn')?.addEventListener('click', () => {
        const filters = {
            dateFrom: $('#historyDateFrom').value,
            dateTo: $('#historyDateTo').value,
            status: $('#historyStatus').value
        };
        const studentId = window.currentStudentId;
        if (studentId) {
            loadStudentHistory(studentId, filters);
        }
    });

    // History Tab Event Handlers
    $all('.history-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showHistoryTab(btn.dataset.tab);
        });
    });

    // Add "View History" buttons to user management (for admin/staff)
    function addViewHistoryButtons() {
        if (currentUser.role === 'admin' || currentUser.role === 'staff') {
            $all('.users-table tbody tr').forEach(row => {
                const userId = row.dataset.userId;
                if (userId) {
                    const actionsCell = row.querySelector('td:last-child');
                    if (actionsCell && !actionsCell.querySelector('.view-history-btn')) {
                        const historyBtn = document.createElement('button');
                        historyBtn.className = 'btn btn-sm btn-outline view-history-btn';
                        historyBtn.innerHTML = '<i class="fas fa-history"></i> History';
                        historyBtn.onclick = () => {
                            window.currentStudentId = userId;
                            loadStudentHistory(userId);
                            showModal('#studentHistoryModal');
                        };
                        actionsCell.appendChild(historyBtn);
                    }
                }
            });
        }
    }

    // Update request table to include receipt generation buttons
    function updateRequestsTableWithReceipts() {
        $all('.requests-table tbody tr').forEach(row => {
            const requestId = row.dataset.requestId;
            if (requestId) {
                const actionsCell = row.querySelector('td:last-child');
                if (actionsCell && !actionsCell.querySelector('.receipt-btn')) {
                    const receiptBtn = document.createElement('button');
                    receiptBtn.className = 'btn btn-sm btn-outline receipt-btn';
                    receiptBtn.innerHTML = '<i class="fas fa-receipt"></i>';
                    receiptBtn.title = 'Generate Receipt';
                    receiptBtn.onclick = () => generateReceipt('request', requestId);
                    actionsCell.appendChild(receiptBtn);
                }
            }
        });
    }

    // Update checkout table to include receipt generation buttons
    function updateCheckoutTableWithReceipts() {
        $all('.checkedout-table tbody tr').forEach(row => {
            const checkoutId = row.dataset.checkoutId;
            if (checkoutId) {
                const actionsCell = row.querySelector('td:last-child');
                if (actionsCell && !actionsCell.querySelector('.receipt-btn')) {
                    const receiptBtn = document.createElement('button');
                    receiptBtn.className = 'btn btn-sm btn-outline receipt-btn';
                    receiptBtn.innerHTML = '<i class="fas fa-receipt"></i>';
                    receiptBtn.title = 'Generate Receipt';
                    receiptBtn.onclick = () => generateReceipt('checkout', checkoutId);
                    actionsCell.appendChild(receiptBtn);
                }
            }
        });
    }

    // Initialize new features when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        // Set up observers for dynamic content
        const observer = new MutationObserver(() => {
            addViewHistoryButtons();
            updateRequestsTableWithReceipts();
            updateCheckoutTableWithReceipts();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });

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