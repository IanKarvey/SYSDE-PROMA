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

            // Add role-based body class for CSS styling
            document.body.className = document.body.className.replace(/user-\w+/g, '');
            document.body.classList.add(`user-${user.role}`);

            // Enhanced role-based UI management
            if (user.role === 'student') {
                // STUDENT ROLE CONFIGURATION

                // Show only student-accessible sections
                $all('.nav-links li').forEach(li => {
                    const section = li.getAttribute('data-section');
                    if (['dashboard', 'requests', 'checkinout', 'issues'].includes(section)) {
                        li.style.display = '';
                    } else {
                        li.style.display = 'none';
                    }
                });

                // Hide "Add Item" button for students
                const addItemBtn = $('#addItemBtn');
                if (addItemBtn) addItemBtn.style.display = 'none';

                // Show "New Request" button for students
                const newRequestBtn = $('#newRequestBtn');
                if (newRequestBtn) newRequestBtn.style.display = 'block';

                // Keep "My Requests" header for students
                const requestsHeader = $('#requests h1');
                if (requestsHeader) requestsHeader.textContent = 'My Requests';

                // Show check-in/out section for students (self-service)
                const checkinoutNav = $('[data-section="checkinout"]');
                if (checkinoutNav) checkinoutNav.style.display = '';

                // Hide admin actions
                $all('.admin-only').forEach(el => el.style.display = 'none');

            } else if (user.role === 'admin' || user.role === 'staff') {
                // ADMIN/STAFF ROLE CONFIGURATION

                // Show all sections including check-in/out for admin/staff
                $all('.nav-links li').forEach(li => {
                    // Show all sections for admin/staff (including checkinout)
                    li.style.display = '';
                });

                // Show "Add Item" button for admin/staff
                const addItemBtn = $('#addItemBtn');
                if (addItemBtn) addItemBtn.style.display = 'flex';

                // Hide "New Request" button for admin/staff (they manage, not create)
                const newRequestBtn = $('#newRequestBtn');
                if (newRequestBtn) newRequestBtn.style.display = 'none';

                // Change "My Requests" to "All Requests" for admin/staff
                const requestsHeader = $('#requests h1');
                if (requestsHeader) requestsHeader.textContent = 'All Requests';

                // Show admin-specific features
                $all('.admin-only').forEach(el => el.style.display = '');

            } else {
                // Default fallback for unknown roles
                $all('.nav-links li').forEach(li => li.style.display = '');
                $all('.admin-only').forEach(el => el.style.display = 'none');
            }

            // Update authorization code field requirements
            updateAuthCodeRequirements(user.role);
        } else {
            $('.username').textContent = '';
            $('.role').textContent = '';
            $('.user-profile').style.display = 'none';
        }
    }

    // Update authorization code field requirements based on user role
    function updateAuthCodeRequirements(role) {
        const authCodeInput = $('#authorizationCode');
        if (authCodeInput) {
            if (role === 'student') {
                authCodeInput.required = true;
                authCodeInput.placeholder = 'Required: Enter 8-character code';
            } else {
                authCodeInput.required = false;
                authCodeInput.placeholder = 'Optional: Enter 8-character code';
            }
        }
    }

    // --- Back Button Navigation ---
    let navigationHistory = [];
    let currentSection = '#dashboard';

    function showSection(sectionId) {
        // Add current section to history if different
        if (currentSection !== sectionId) {
            navigationHistory.push(currentSection);
            currentSection = sectionId;
        }

        // Update UI
        $all('.content-section').forEach(sec => sec.classList.remove('active'));
        $(sectionId).classList.add('active');

        // Show/hide back button
        const backBtn = $('#backBtn');
        if (backBtn) {
            if (navigationHistory.length > 0 && sectionId !== '#dashboard') {
                backBtn.style.display = 'flex';
            } else {
                backBtn.style.display = 'none';
            }
        }
    }

    // Back button functionality
    $('#backBtn')?.addEventListener('click', () => {
        if (navigationHistory.length > 0) {
            const previousSection = navigationHistory.pop();
            currentSection = previousSection;

            $all('.content-section').forEach(sec => sec.classList.remove('active'));
            $(previousSection).classList.add('active');

            // Hide back button if we're back to dashboard or no more history
            const backBtn = $('#backBtn');
            if (backBtn && (navigationHistory.length === 0 || previousSection === '#dashboard')) {
                backBtn.style.display = 'none';
            }
        }
    });
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
    let currentPage = 1;
    let itemsPerPage = 10;

    async function fetchInventory(page = 1) {
        currentPage = page;
        const search = $('#searchInventory')?.value || '';
        const category = $('#categoryFilter')?.value || 'all';
        const status = $('#statusFilter')?.value || 'all';

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (category !== 'all') params.append('category', category);
        if (status !== 'all') params.append('status', status);
        params.append('page', page);
        params.append('limit', itemsPerPage);

        console.log('Fetching inventory with params:', params.toString());

        try {
            const res = await fetch(`php/inventory.php?${params.toString()}`, { credentials: 'include' });
            console.log('Response status:', res.status, res.statusText);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();
            console.log('Inventory data received:', data);

            if (data.success) {
                renderInventoryTable(data.data);
                updatePaginationControls(data.pagination);
            } else {
                console.error('API returned error:', data.message);
                showToast(data.message || 'Failed to fetch inventory', 'danger');
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
            showToast('Failed to fetch inventory: ' + error.message, 'danger');
        }
    }

    function updatePaginationControls(pagination) {
        const paginationDiv = $('.pagination');
        const prevBtn = $('#prevPage');
        const nextBtn = $('#nextPage');
        const pageInfo = $('.page-info');

        if (!paginationDiv || !prevBtn || !nextBtn || !pageInfo) return;

        // Update page info
        if (pagination.total_items === 0) {
            pageInfo.textContent = 'No items found';
        } else {
            pageInfo.textContent = `Showing ${pagination.start_item}-${pagination.end_item} of ${pagination.total_items} items`;
        }

        // Show/hide pagination controls based on total pages
        if (pagination.total_pages <= 1) {
            paginationDiv.style.display = 'none';
        } else {
            paginationDiv.style.display = 'flex';

            // Update Previous button
            prevBtn.disabled = !pagination.has_previous;
            prevBtn.style.opacity = pagination.has_previous ? '1' : '0.5';
            prevBtn.style.cursor = pagination.has_previous ? 'pointer' : 'not-allowed';

            // Update Next button
            nextBtn.disabled = !pagination.has_next;
            nextBtn.style.opacity = pagination.has_next ? '1' : '0.5';
            nextBtn.style.cursor = pagination.has_next ? 'pointer' : 'not-allowed';
        }
    }

    function showAddItemConfirmation(formData) {
        // Extract form data for display
        const name = formData.get('name');
        const category = formData.get('category');
        const quantity = formData.get('quantity');
        const location = formData.get('location');
        const description = formData.get('description');
        const imageFile = formData.get('image');

        const confirmationHTML = `
            <div class="confirmation-details">
                <h4>Confirm Add Item</h4>
                <p>Are you sure you want to add this item to the inventory?</p>
                <div class="item-details">
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Category:</strong> ${category}</p>
                    <p><strong>Quantity:</strong> ${quantity}</p>
                    <p><strong>Location:</strong> ${location}</p>
                    <p><strong>Description:</strong> ${description || 'None'}</p>
                    <p><strong>Image:</strong> ${imageFile && imageFile.name ? imageFile.name : 'None'}</p>
                </div>
            </div>
        `;

        // Create confirmation modal
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal active';
        confirmModal.id = 'addItemConfirmModal';
        confirmModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Confirm Add Item</h3>
                </div>
                <div class="modal-body">
                    ${confirmationHTML}
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" id="cancelAddItem">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirmAddItem">Confirm Add</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        // Add event listeners
        $('#cancelAddItem').addEventListener('click', () => {
            document.body.removeChild(confirmModal);
        });

        $('#confirmAddItem').addEventListener('click', async () => {
            document.body.removeChild(confirmModal);
            await addInventoryItem(formData);
        });
    }

    async function addInventoryItem(formData) {
        // Enhanced add inventory with duplicate detection by name only
        const name = formData.get('name');
        const quantity = parseInt(formData.get('quantity'));

        // Check for name-based duplicates before submission
        const duplicates = await checkForDuplicateItem(name);

        if (duplicates.length > 0) {
            const userChoice = await showDuplicateConfirmation(duplicates, quantity);

            if (userChoice === 'cancel') {
                showToast('Operation cancelled', 'info');
                return;
            } else if (userChoice === 'add_to_existing') {
                // User wants to add to existing item - let backend handle this
                // The backend will detect exact match and update quantity
            } else if (userChoice === 'create_separate') {
                // User wants to create separate item - continue with normal creation
                // No special handling needed, just proceed
            }
        }

        try {
            const res = await fetch('php/inventory.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                if (data.action === 'updated') {
                    showToast(data.message, 'success');
                } else {
                    showToast('Item added successfully', 'success');
                }
                closeModal('#addItemModal');
                fetchInventory(currentPage); // Refresh current page
                $('#addItemForm').reset();
            } else {
                showToast(data.message || 'Failed to add item', 'danger');
            }
        } catch (error) {
            console.error('Error adding item:', error);
            showToast('Failed to add item', 'danger');
        }
    }

    // Enhanced duplicate detection for inventory items - check by name only
    async function checkForDuplicateItem(name) {
        try {
            const res = await fetch(`php/inventory.php?action=check_duplicate&name=${encodeURIComponent(name)}`, {
                credentials: 'include'
            });
            const data = await res.json();
            return data.success ? data.duplicates : [];
        } catch (error) {
            console.error('Error checking for duplicates:', error);
            return [];
        }
    }

    // Enhanced duplicate confirmation dialog with multiple options
    function showDuplicateConfirmation(duplicates, newQuantity) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';

            // Create list of existing items
            const duplicatesList = duplicates.map(dup =>
                `<div class="duplicate-item">
                    <strong>${dup.name}</strong> - ${dup.category} - ${dup.location} (${dup.quantity} units)
                </div>`
            ).join('');

            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Duplicate Item Name Detected</h3>
                        <button class="close-modal-btn" type="button">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="duplicate-info">
                            <p><strong>Item with this name already exists:</strong></p>
                            ${duplicatesList}
                        </div>
                        <div class="duplicate-question">
                            <p>What would you like to do?</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-success add-to-existing" type="button">
                            <i class="fas fa-plus"></i> Add to Existing Item
                        </button>
                        <button class="btn btn-primary create-separate" type="button">
                            <i class="fas fa-copy"></i> Create as Separate Item
                        </button>
                        <button class="btn btn-outline cancel-action" type="button">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Handle events
            const closeBtn = modal.querySelector('.close-modal-btn');
            const addToExistingBtn = modal.querySelector('.add-to-existing');
            const createSeparateBtn = modal.querySelector('.create-separate');
            const cancelBtn = modal.querySelector('.cancel-action');

            const cleanup = () => {
                modal.remove();
            };

            closeBtn.onclick = () => {
                cleanup();
                resolve('cancel');
            };

            addToExistingBtn.onclick = () => {
                cleanup();
                resolve('add_to_existing');
            };

            createSeparateBtn.onclick = () => {
                cleanup();
                resolve('create_separate');
            };

            cancelBtn.onclick = () => {
                cleanup();
                resolve('cancel');
            };

            // Close on outside click
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve('cancel');
                }
            };
        });
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
                    ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff') ? `
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
        if (currentUser && currentUser.role === 'student') {
            $('#newRequestBtn').style.display = 'block';
        } else {
            $('#newRequestBtn').style.display = 'none';
        }
    }

    // Create authorization code display for requests table
    function createAuthCodeDisplay(req) {
        if (!req.authorization_code) {
            return '<span class="no-auth-code">-</span>';
        }

        const statusClass = req.code_status ? req.code_status.toLowerCase() : 'unknown';
        const isExpired = req.code_expired;
        const timeRemaining = req.time_remaining;

        let statusIndicator = '';
        let timeInfo = '';

        // Create status indicator
        switch (req.code_status) {
            case 'active':
                statusIndicator = isExpired ?
                    '<span class="auth-status expired">Expired</span>' :
                    '<span class="auth-status active">Active</span>';
                if (timeRemaining && !isExpired) {
                    timeInfo = `<small class="time-remaining">${timeRemaining} left</small>`;
                }
                break;
            case 'used':
                statusIndicator = '<span class="auth-status used">Used</span>';
                if (req.code_used_at) {
                    timeInfo = `<small class="used-date">Used: ${formatDate(req.code_used_at)}</small>`;
                }
                break;
            case 'expired':
                statusIndicator = '<span class="auth-status expired">Expired</span>';
                break;
            case 'cancelled':
                statusIndicator = '<span class="auth-status cancelled">Cancelled</span>';
                break;
            default:
                statusIndicator = '<span class="auth-status unknown">Unknown</span>';
        }

        // For students: show code with copy functionality if active
        if (currentUser && currentUser.role === 'student') {
            if (req.code_status === 'active' && !isExpired) {
                return `
                    <div class="auth-code-cell">
                        <div class="auth-code-value clickable" onclick="copyAuthCode('${req.authorization_code}')" title="Click to copy">
                            <i class="fas fa-key"></i>
                            <span class="code-text">${req.authorization_code}</span>
                            <i class="fas fa-copy copy-icon"></i>
                        </div>
                        ${statusIndicator}
                        ${timeInfo}
                    </div>
                `;
            } else {
                return `
                    <div class="auth-code-cell">
                        <div class="auth-code-value">
                            <i class="fas fa-key"></i>
                            <span class="code-text">${req.authorization_code}</span>
                        </div>
                        ${statusIndicator}
                        ${timeInfo}
                    </div>
                `;
            }
        }
        // For admin/staff: show code with status and admin actions
        else if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')) {
            let adminActions = '';
            if (req.code_status === 'active' && !isExpired) {
                adminActions = `
                    <div class="auth-admin-actions">
                        <button class="btn btn-xs btn-outline" onclick="copyAuthCode('${req.authorization_code}')" title="Copy code">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-xs btn-warning" onclick="cancelAuthCode('${req.authorization_code}')" title="Cancel code">
                            <i class="fas fa-ban"></i>
                        </button>
                    </div>
                `;
            }

            return `
                <div class="auth-code-cell admin">
                    <div class="auth-code-value">
                        <i class="fas fa-key"></i>
                        <span class="code-text">${req.authorization_code}</span>
                    </div>
                    ${statusIndicator}
                    ${timeInfo}
                    ${adminActions}
                </div>
            `;
        }

        return '<span class="no-auth-code">-</span>';
    }

    // Copy authorization code from table
    window.copyAuthCode = async function(code) {
        try {
            await navigator.clipboard.writeText(code);
            showToast(`Authorization code ${code} copied to clipboard`, 'success');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast(`Authorization code ${code} copied to clipboard`, 'success');
        }
    };

    // Cancel authorization code (admin only)
    window.cancelAuthCode = async function(code) {
        if (!confirm(`Are you sure you want to cancel authorization code ${code}?`)) {
            return;
        }

        try {
            const res = await fetch('php/authorization.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'cancel_code',
                    code: code,
                    reason: 'Cancelled by admin from requests table'
                }),
                credentials: 'include'
            });

            const data = await res.json();

            if (data.success) {
                showToast(`Authorization code ${code} cancelled successfully`, 'success');
                fetchRequests(); // Refresh the table
            } else {
                showToast(data.message || 'Failed to cancel authorization code', 'danger');
            }
        } catch (error) {
            console.error('Error cancelling authorization code:', error);
            showToast('Failed to cancel authorization code', 'danger');
        }
    };

    function renderRequestsTable(requests) {
        const tbody = $('#requests .requests-table tbody');
        tbody.innerHTML = '';
        requests.forEach(req => {
            const tr = document.createElement('tr');
            // Create status badge
            const statusBadge = `<span class="status-badge ${req.status.toLowerCase()}">${req.status}</span>`;
            
            // Create action buttons based on user role and status
            let actionButtons = '';
            if (currentUser && currentUser.role === 'student') {
                // Students can only see status
                actionButtons = `<span class="status-${req.status.toLowerCase()}">${req.status}</span>`;
            } else if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')) {
                // Admin/staff: show approve/reject buttons for pending requests
                if (req.status === 'pending') {
                    actionButtons = `
                        <button class="btn btn-success btn-sm approve-request" data-id="${req.id}">Approve</button>
                        <button class="btn btn-danger btn-sm reject-request" data-id="${req.id}">Reject</button>
                    `;
                } else {
                    actionButtons = `<span class="status-${req.status.toLowerCase()}">${req.status}</span>`;
                }
            } else {
                // No user logged in - show status only
                actionButtons = `<span class="status-${req.status.toLowerCase()}">${req.status}</span>`;
            }

            // Add cancel button for students on their own pending requests
            if (currentUser && currentUser.role === 'student' && req.status === 'pending' && req.user_id === currentUser.id) {
                actionButtons = `<button class="btn btn-danger btn-sm cancel-request" data-id="${req.id}">Cancel</button>`;
            }

            // Create authorization code display
            const authCodeDisplay = createAuthCodeDisplay(req);

            tr.innerHTML = `
                <td>${req.id}</td>
                <td>${req.item_name}</td>
                <td>${req.quantity || 1}</td>
                <td>${req.first_name ? req.first_name + ' ' + req.last_name : ''}</td>
                <td>${req.date_requested}</td>
                <td>${req.needed_by}</td>
                <td>${statusBadge}</td>
                <td>${authCodeDisplay}</td>
                <td>${actionButtons}</td>
            `;
            tbody.appendChild(tr);
        });

        // Add event listeners for approve/reject buttons
        if (currentUser && currentUser.role !== 'student') {
            $all('.approve-request').forEach(btn => {
                btn.onclick = () => updateRequestStatus(btn.dataset.id, 'approved');
            });

            $all('.reject-request').forEach(btn => {
                btn.onclick = () => updateRequestStatus(btn.dataset.id, 'rejected');
            });
        }

        // Add event listeners for cancel buttons (students)
        $all('.cancel-request').forEach(btn => {
            btn.onclick = () => cancelRequest(btn.dataset.id);
        });
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
            console.log(`Updating request ${id} to status: ${status}`); // Debug log

            const res = await fetch('php/request.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `id=${id}&status=${status}`,
                credentials: 'include'
            });

            console.log('Response status:', res.status); // Debug log

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            console.log('Response data:', data); // Debug log

            if (data.success) {
                showToast(data.message || `Request ${status} successfully`, 'success');
                fetchRequests();
                closeModal('#requestDetailsModal');

                // Refresh dashboard statistics
                triggerDashboardUpdate();
            } else {
                showToast(data.message || `Failed to ${status} request`, 'danger');
            }
        } catch (error) {
            console.error('Error updating request status:', error);
            showToast(`Failed to ${status} request: ${error.message}`, 'danger');
        }
    }

    async function cancelRequest(id) {
        if (!confirm('Are you sure you want to cancel this request?')) return;

        try {
            const res = await fetch('php/request.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `id=${id}&status=cancelled`,
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast('Request cancelled successfully', 'success');
                fetchRequests();
            } else {
                showToast(data.message || 'Failed to cancel request', 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to cancel request', 'danger');
        }
    }

    // Contact User functionality
    function showContactUserModal(userId, userName) {
        $('#contactUserId').value = userId;
        $('#contactUserName').value = userName;
        $('#contactSubject').value = '';
        $('#contactMessage').value = '';
        showModal('#contactUserModal');
    }

    async function sendContactMessage() {
        const userId = $('#contactUserId').value;
        const subject = $('#contactSubject').value;
        const message = $('#contactMessage').value;

        if (!subject || !message.trim()) {
            showToast('Please select a subject and enter a message', 'warning');
            return;
        }

        try {
            const res = await fetch('php/contact.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `user_id=${userId}&subject=${encodeURIComponent(subject)}&message=${encodeURIComponent(message)}`,
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast('Message sent successfully', 'success');
                closeModal('#contactUserModal');
            } else {
                showToast(data.message || 'Failed to send message', 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to send message', 'danger');
        }
    }
    // --- Check In/Out ---
    async function fetchCheckouts() {
        const res = await fetch('php/checkout.php', { credentials: 'include' });
        const data = await res.json();
        if (data.success) renderCheckoutsTable(data.data);
    }

    // Initialize check-in/out forms based on user role
    function initializeCheckInOutForms() {
        if (!currentUser) return;

        const checkoutUserField = $('#checkoutUser');
        const checkoutUserGroup = checkoutUserField?.closest('.form-group');

        if (currentUser.role === 'student') {
            // For students: hide user selection field and auto-select themselves
            if (checkoutUserGroup) {
                checkoutUserGroup.style.display = 'none';
            }
            if (checkoutUserField) {
                checkoutUserField.value = currentUser.id;
            }

            // Update form labels for student self-service
            const checkoutTitle = $('#checkinout .checkinout-form h3');
            if (checkoutTitle && checkoutTitle.textContent === 'Check Out Equipment') {
                checkoutTitle.textContent = 'Check Out Equipment (Self-Service)';
            }

            const checkinTitle = $('#checkinout .checkinout-form:nth-child(2) h3');
            if (checkinTitle && checkinTitle.textContent === 'Check In Equipment') {
                checkinTitle.textContent = 'Check In Equipment (Self-Service)';
            }

        } else if (currentUser.role === 'admin' || currentUser.role === 'staff') {
            // For admin/staff: show user selection field for managing others' checkouts
            if (checkoutUserGroup) {
                checkoutUserGroup.style.display = '';
            }

            // Populate user dropdown for admin/staff
            populateUserDropdown();
        }

        // Populate available items dropdown for all users
        populateAvailableItemsDropdown();

        // Populate check-in items dropdown
        populateCheckinItemsDropdown();
    }

    // Populate available items dropdown from inventory
    async function populateAvailableItemsDropdown() {
        try {
            const res = await fetch('php/checkout.php?action=available_items', {
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                const checkoutItemField = $('#checkoutItem');
                if (checkoutItemField) {
                    checkoutItemField.innerHTML = '<option value="">Select an item</option>';
                    data.data.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.id;
                        option.textContent = `${item.name} - ${item.category} - ${item.location} (${item.quantity} available)`;
                        option.dataset.quantity = item.quantity;
                        option.dataset.location = item.location;
                        checkoutItemField.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error populating available items:', error);
        }
    }

    // Populate check-in items dropdown with user's checked out items
    async function populateCheckinItemsDropdown() {
        try {
            const res = await fetch('php/checkout.php?action=user_checkouts', {
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                const checkinItemField = $('#checkinItem');
                if (checkinItemField) {
                    checkinItemField.innerHTML = '<option value="">Select an item to check in</option>';
                    data.data.forEach(checkout => {
                        const option = document.createElement('option');
                        option.value = checkout.id;
                        option.textContent = `${checkout.item_name} - ${checkout.category} - ${checkout.location} (Due: ${checkout.due_date})`;
                        option.dataset.itemId = checkout.item_id;
                        option.dataset.dueDate = checkout.due_date;
                        checkinItemField.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error populating check-in items:', error);
        }
    }

    // Populate user dropdown for admin/staff
    async function populateUserDropdown() {
        try {
            const res = await fetch('php/users.php', { credentials: 'include' });
            const data = await res.json();

            if (data.success) {
                const checkoutUserField = $('#checkoutUser');
                if (checkoutUserField) {
                    checkoutUserField.innerHTML = '<option value="">Select a user</option>';
                    data.data.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = `${user.first_name} ${user.last_name} (${user.role})`;
                        checkoutUserField.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error populating user dropdown:', error);
        }
    }

    // Process checkout form submission
    async function processCheckoutForm() {
        try {
            const itemId = $('#checkoutItem').value;
            const userId = $('#checkoutUser').value || currentUser.id;
            const dueDate = $('#checkoutDate').value;
            const notes = $('#checkoutNotes').value;
            const authCode = $('#authorizationCode').value.trim().toUpperCase();

            if (!itemId || !dueDate) {
                showToast('Please select an item and due date', 'danger');
                return;
            }

            // MANDATORY AUTHORIZATION CODE CHECK FOR STUDENTS
            if (currentUser && currentUser.role === 'student') {
                if (!authCode) {
                    showToast('Authorization code is required for student checkouts. Please enter a valid authorization code from an approved request.', 'danger');
                    $('#authorizationCode').focus();
                    return;
                }
            }

            // If authorization code is provided, use the authorization API
            if (authCode) {
                const authData = {
                    action: 'use_code',
                    code: authCode,
                    notes: notes
                };

                const res = await fetch('php/authorization.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(authData),
                    credentials: 'include'
                });

                const data = await res.json();

                if (data.success) {
                    showToast('Equipment checked out successfully using authorization code', 'success');

                    // Clear form
                    $('#checkoutItem').value = '';
                    $('#checkoutDate').value = '';
                    $('#checkoutNotes').value = '';
                    $('#authorizationCode').value = '';
                    clearAuthCodeValidation();

                    // Refresh data
                    await Promise.all([
                        fetchCheckouts(),
                        populateAvailableItemsDropdown(),
                        populateCheckinItemsDropdown()
                    ]);

                    // Trigger dashboard update
                    triggerDashboardUpdate();
                } else {
                    showToast(data.message || 'Authorization code checkout failed', 'danger');
                }
            } else {
                // Regular checkout without authorization code
                const checkoutData = {
                    action: 'checkout',
                    item_id: itemId,
                    user_id: userId,
                    due_date: dueDate,
                    notes: notes
                };

                const res = await fetch('php/checkout.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(checkoutData),
                    credentials: 'include'
                });

                const data = await res.json();

                if (data.success) {
                    showToast(data.message, 'success');

                    // Clear form
                    $('#checkoutItem').value = '';
                    $('#checkoutDate').value = '';
                    $('#checkoutNotes').value = '';

                    // Refresh data
                    await Promise.all([
                        fetchCheckouts(),
                        populateAvailableItemsDropdown(),
                        populateCheckinItemsDropdown()
                    ]);

                    // Trigger dashboard update
                    triggerDashboardUpdate();
                } else {
                    showToast(data.message || 'Checkout failed', 'danger');
                }
            }
        } catch (error) {
            console.error('Checkout error:', error);
            showToast('Failed to process checkout', 'danger');
        }
    }

    // Process check-in form submission
    async function processCheckinForm() {
        try {
            const checkoutId = $('#checkinItem').value;
            const condition = $('#checkinCondition').value;
            const notes = $('#checkinNotes').value;

            if (!checkoutId) {
                showToast('Please select an item to check in', 'danger');
                return;
            }

            const checkinData = {
                action: 'checkin',
                checkout_id: checkoutId,
                condition: condition,
                notes: notes
            };

            const res = await fetch('php/checkout.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(checkinData),
                credentials: 'include'
            });

            const data = await res.json();

            if (data.success) {
                showToast(data.message, 'success');

                // Clear form
                $('#checkinItem').value = '';
                $('#checkinCondition').value = 'excellent';
                $('#checkinNotes').value = '';

                // Refresh data
                await Promise.all([
                    fetchCheckouts(),
                    populateAvailableItemsDropdown(),
                    populateCheckinItemsDropdown()
                ]);

                // Trigger dashboard update
                triggerDashboardUpdate();
            } else {
                showToast(data.message || 'Check-in failed', 'danger');
            }
        } catch (error) {
            console.error('Check-in error:', error);
            showToast('Failed to process check-in', 'danger');
        }
    }

    // Global function for check-in button in table
    window.checkInItem = async function(checkoutId) {
        try {
            const checkinData = {
                action: 'checkin',
                checkout_id: checkoutId,
                condition: 'good',
                notes: 'Checked in via table action'
            };

            const res = await fetch('php/checkout.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(checkinData),
                credentials: 'include'
            });

            const data = await res.json();

            if (data.success) {
                showToast(data.message, 'success');

                // Refresh data
                await Promise.all([
                    fetchCheckouts(),
                    populateAvailableItemsDropdown(),
                    populateCheckinItemsDropdown()
                ]);

                // Trigger dashboard update
                triggerDashboardUpdate();
            } else {
                showToast(data.message || 'Check-in failed', 'danger');
            }
        } catch (error) {
            console.error('Check-in error:', error);
            showToast('Failed to process check-in', 'danger');
        }
    };

    // Authorization code validation
    async function validateAuthorizationCode() {
        try {
            const code = $('#authorizationCode').value.trim().toUpperCase();

            if (!code) {
                showToast('Please enter an authorization code', 'warning');
                return;
            }

            // Show loading state
            const validateBtn = $('#validateCodeBtn');
            const originalText = validateBtn.textContent;
            validateBtn.textContent = 'Validating...';
            validateBtn.disabled = true;

            const res = await fetch(`php/authorization.php?action=validate_code&code=${encodeURIComponent(code)}`, {
                credentials: 'include'
            });

            const data = await res.json();

            if (data.success) {
                // Auto-fill form with validated code data
                const codeData = data.data;

                // Set item
                const itemSelect = $('#checkoutItem');
                if (itemSelect) {
                    // Find and select the item
                    for (let option of itemSelect.options) {
                        if (option.value == codeData.item_id) {
                            option.selected = true;
                            break;
                        }
                    }
                }

                // Set user (for admin/staff)
                const userSelect = $('#checkoutUser');
                if (userSelect && userSelect.style.display !== 'none') {
                    for (let option of userSelect.options) {
                        if (option.value == codeData.user_id) {
                            option.selected = true;
                            break;
                        }
                    }
                } else if (userSelect) {
                    userSelect.value = codeData.user_id;
                }

                // Set due date
                const dateField = $('#checkoutDate');
                if (dateField && codeData.due_date) {
                    dateField.value = codeData.due_date;
                }

                // Add notes about authorization
                const notesField = $('#checkoutNotes');
                if (notesField) {
                    const authNote = `Authorization Code: ${code} (Request #${codeData.request_id})`;
                    notesField.value = notesField.value ? notesField.value + '\n' + authNote : authNote;
                }

                // Show success state
                showAuthCodeValidation(true, `Valid code for ${codeData.item_name} - expires ${new Date(codeData.expires_at).toLocaleString()}`);
                showToast(`Authorization code validated for ${codeData.item_name}`, 'success');

            } else {
                showAuthCodeValidation(false, data.message);
                showToast(data.message, 'danger');
            }

        } catch (error) {
            console.error('Authorization code validation error:', error);
            showAuthCodeValidation(false, 'Failed to validate authorization code');
            showToast('Failed to validate authorization code', 'danger');
        } finally {
            // Reset button state
            const validateBtn = $('#validateCodeBtn');
            validateBtn.textContent = 'Validate';
            validateBtn.disabled = false;
        }
    }

    // Show authorization code validation state
    function showAuthCodeValidation(isValid, message) {
        const authSection = $('.authorization-code-section');
        const helpText = authSection?.querySelector('.form-help');

        if (helpText) {
            helpText.textContent = message;
            helpText.className = isValid ? 'form-help success' : 'form-help error';
        }

        const codeInput = $('#authorizationCode');
        if (codeInput) {
            codeInput.className = isValid ? 'valid' : 'invalid';
        }
    }

    // Clear authorization code validation state
    function clearAuthCodeValidation() {
        const authSection = $('.authorization-code-section');
        const helpText = authSection?.querySelector('.form-help');

        if (helpText) {
            helpText.textContent = 'Enter your authorization code from an approved request to auto-fill the form';
            helpText.className = 'form-help';
        }

        const codeInput = $('#authorizationCode');
        if (codeInput) {
            codeInput.className = '';
        }
    }

    // Show authorization code validation state
    function showAuthCodeValidation(isValid, message) {
        const authSection = $('.authorization-code-section');
        const helpText = authSection?.querySelector('.form-help');

        if (helpText) {
            helpText.textContent = message;
            helpText.className = isValid ? 'form-help success' : 'form-help error';
        }

        const codeInput = $('#authorizationCode');
        if (codeInput) {
            codeInput.className = isValid ? 'valid' : 'invalid';
        }
    }

    // Fetch user's authorization codes
    async function fetchUserAuthorizationCodes() {
        try {
            const res = await fetch('php/authorization.php?action=my_codes', {
                credentials: 'include'
            });

            const data = await res.json();

            if (data.success) {
                displayAuthorizationCodes(data.data);
                updateAuthCodesTab(data.count);
            } else {
                console.error('Failed to fetch authorization codes:', data.message);
                displayAuthorizationCodes([]);
                updateAuthCodesTab(0);
            }
        } catch (error) {
            console.error('Error fetching authorization codes:', error);
            displayAuthorizationCodes([]);
            updateAuthCodesTab(0);
        }
    }

    // Display authorization codes in the tab
    function displayAuthorizationCodes(codes) {
        const authCodesList = $('#authCodesList');
        const noAuthCodes = $('#noAuthCodes');

        if (!authCodesList) return;

        if (codes.length === 0) {
            authCodesList.style.display = 'none';
            if (noAuthCodes) noAuthCodes.style.display = 'block';
            return;
        }

        authCodesList.style.display = 'grid';
        if (noAuthCodes) noAuthCodes.style.display = 'none';

        authCodesList.innerHTML = codes.map(code => createAuthCodeCard(code)).join('');

        // Add event listeners for copy buttons and actions
        authCodesList.querySelectorAll('.copy-code-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const codeValue = e.target.closest('.auth-code-card').dataset.code;
                copyToClipboard(codeValue);
            });
        });

        authCodesList.querySelectorAll('.use-code-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const codeValue = e.target.closest('.auth-code-card').dataset.code;
                useAuthorizationCodeFromTab(codeValue);
            });
        });
    }

    // Create authorization code card HTML
    function createAuthCodeCard(code) {
        const now = new Date();
        const expiresAt = new Date(code.expires_at);
        const isExpired = expiresAt < now;
        const timeRemaining = getTimeRemaining(expiresAt);
        const statusClass = code.status.toLowerCase();

        return `
            <div class="auth-code-card status-${statusClass}" data-code="${code.code}">
                <div class="auth-code-header">
                    <div class="auth-code-value">
                        <span>${code.code}</span>
                        ${code.status === 'active' ? `
                            <button class="copy-code-btn" title="Copy code">
                                <i class="fas fa-copy"></i>
                            </button>
                        ` : ''}
                    </div>
                    <span class="auth-code-status ${statusClass}">${code.status}</span>
                </div>

                <div class="auth-code-details">
                    <div class="auth-code-detail">
                        <span class="auth-code-detail-label">Equipment</span>
                        <span class="auth-code-detail-value">${code.item_name}</span>
                    </div>
                    <div class="auth-code-detail">
                        <span class="auth-code-detail-label">Request ID</span>
                        <span class="auth-code-detail-value">#${code.request_id}</span>
                    </div>
                    <div class="auth-code-detail">
                        <span class="auth-code-detail-label">Quantity</span>
                        <span class="auth-code-detail-value">${code.request_quantity} unit(s)</span>
                    </div>
                    <div class="auth-code-detail">
                        <span class="auth-code-detail-label">Generated</span>
                        <span class="auth-code-detail-value">${formatDate(code.created_at)}</span>
                    </div>
                </div>

                ${code.status === 'active' ? `
                    <div class="auth-code-expiry ${isExpired ? 'expired' : (timeRemaining.hours < 6 ? 'warning' : '')}">
                        <i class="fas fa-clock"></i>
                        ${isExpired ? 'Expired' : `Expires in ${timeRemaining.text}`}
                        (${formatDateTime(code.expires_at)})
                    </div>
                ` : ''}

                ${code.status === 'used' && code.used_at ? `
                    <div class="auth-code-detail">
                        <span class="auth-code-detail-label">Used On</span>
                        <span class="auth-code-detail-value">${formatDateTime(code.used_at)}</span>
                    </div>
                ` : ''}

                <div class="auth-code-actions">
                    ${code.status === 'active' && !isExpired ? `
                        <button class="btn btn-primary btn-sm use-code-btn">
                            <i class="fas fa-arrow-right"></i> Use for Checkout
                        </button>
                    ` : ''}
                    ${code.status === 'active' ? `
                        <button class="btn btn-outline btn-sm copy-code-btn">
                            <i class="fas fa-copy"></i> Copy Code
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Get time remaining until expiry
    function getTimeRemaining(expiresAt) {
        const now = new Date();
        const diff = expiresAt - now;

        if (diff <= 0) {
            return { text: 'Expired', hours: 0, minutes: 0, seconds: 0 };
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 0) {
            return {
                text: `${hours}h ${minutes}m ${seconds}s`,
                hours: hours,
                minutes: minutes,
                seconds: seconds
            };
        } else if (minutes > 0) {
            return {
                text: `${minutes}m ${seconds}s`,
                hours: 0,
                minutes: minutes,
                seconds: seconds
            };
        } else {
            return {
                text: `${seconds}s`,
                hours: 0,
                minutes: 0,
                seconds: seconds
            };
        }
    }

    // Copy code to clipboard
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast(`Authorization code ${text} copied to clipboard`, 'success');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast(`Authorization code ${text} copied to clipboard`, 'success');
        }
    }

    // Use authorization code from tab (navigate to checkout)
    function useAuthorizationCodeFromTab(code) {
        // Navigate to checkout section
        showSection('#checkinout');

        // Fill in the authorization code
        const authCodeInput = $('#authorizationCode');
        if (authCodeInput) {
            authCodeInput.value = code;
            // Trigger validation
            setTimeout(() => {
                validateAuthorizationCode();
            }, 500);
        }

        showToast(`Navigated to checkout with code ${code}`, 'info');
    }

    // Update authorization codes tab visibility and badge
    function updateAuthCodesTab(count) {
        const authCodesTab = $('#authCodesTab');
        const authCodesBadge = $('#authCodesBadge');

        if (authCodesTab && currentUser && currentUser.role === 'student') {
            if (count > 0) {
                authCodesTab.style.display = 'flex';
                if (authCodesBadge) {
                    authCodesBadge.textContent = count;
                }
            } else {
                authCodesTab.style.display = 'none';
            }
        }
    }

    function renderCheckoutsTable(items) {
        const tbody = $('#checkinout .checkedout-table tbody');
        tbody.innerHTML = '';

        // Filter items based on user role
        let filteredItems = items;
        if (currentUser && currentUser.role === 'student') {
            // Students see only their own checkouts
            filteredItems = items.filter(item => item.user_id === currentUser.id);
        }
        // Admin/staff see all checkouts (no filtering)

        if (filteredItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666; font-style: italic;">No checkouts found</td></tr>';
            return;
        }

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.item_name}</td>
                <td>${item.first_name} ${item.last_name}</td>
                <td>${item.date_out}</td>
                <td>${item.due_date}</td>
                <td><span class="status-${item.status.toLowerCase()}">${item.status}</span></td>
                <td>
                    ${item.status === 'checked_out' ?
                        `<button class="btn btn-sm btn-primary" onclick="checkInItem(${item.id})">Check In</button>` :
                        '<span class="text-muted">Returned</span>'
                    }
                </td>
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
                if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')) {
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
        if (currentUser && currentUser.role === 'student') {
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
    // Note: Data will be loaded after user authentication is established
    // See login success handler and checkExistingSession function
    // --- Add more event listeners and AJAX for forms, modals, etc. as needed ---
    // --- Example: Add Item Modal, Approve/Reject Request, Check In/Out, etc. ---
    // --- Example: Chart.js integration for dashboard ---

    // --- Real-Time Dashboard Statistics ---
    // Enhanced dashboard statistics with real-time data from integrated systems
    async function updateDashboardStats() {
        try {
            // Show loading indicators
            const statCards = $all('.stat-card .stat-value');
            statCards.forEach(card => {
                if (card) {
                    card.style.opacity = '0.5';
                    card.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                }
            });

            // Fetch comprehensive statistics from dedicated dashboard API
            const res = await fetch('php/dashboard.php?action=statistics', {
                credentials: 'include'
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();

            if (data.success) {
                const stats = data.data;
                const userRole = data.user_role;

                // Update main dashboard cards with real-time quantity-based data
                updateStatCard('#stat-total-items', stats.total_items || 0);
                updateStatCard('#stat-available-items', stats.available_items || 0);
                updateStatCard('#stat-pending-requests', stats.pending_requests || 0);
                updateStatCard('#stat-issues-reported', stats.issues_reported || 0);

                // Update additional statistics based on role
                if (userRole === 'student') {
                    // Student-specific statistics
                    updateStatCard('#stat-my-requests', stats.my_requests || 0);
                    updateStatCard('#stat-my-checkouts', stats.my_checkouts || 0);
                    updateStatCard('#stat-my-issues', stats.my_issues || 0);
                } else if (userRole === 'admin' || userRole === 'staff') {
                    // Admin/staff statistics - mix of quantity and count based metrics
                    updateStatCard('#stat-current-checkouts', stats.current_checkouts || 0);
                    updateStatCard('#stat-overdue-checkouts', stats.overdue_checkouts || 0);
                    updateStatCard('#stat-low-stock-items', stats.low_stock_items || 0);
                    updateStatCard('#stat-critical-issues', stats.critical_issues || 0);
                    updateStatCard('#stat-total-users', stats.total_users || 0);
                    updateStatCard('#stat-checkouts-today', stats.checkouts_today || 0);
                    updateStatCard('#stat-approved-today', stats.approved_today || 0);

                    // Additional quantity-based statistics for admin
                    updateStatCard('#stat-total-equipment-types', stats.total_equipment_types || 0);
                    updateStatCard('#stat-available-equipment-types', stats.available_equipment_types || 0);
                    updateStatCard('#stat-total-units-checked-out', stats.total_units_checked_out || 0);
                }

                // Update dashboard timestamp
                const timestampElement = $('#dashboard-last-updated');
                if (timestampElement) {
                    timestampElement.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
                }

                console.log('Dashboard statistics updated successfully:', stats);
            } else {
                throw new Error(data.message || 'Failed to fetch dashboard statistics');
            }

        } catch (error) {
            console.error('Error updating dashboard stats:', error);
            // Reset loading indicators on error
            const statCards = $all('.stat-card .stat-value');
            statCards.forEach(card => {
                if (card) {
                    card.style.opacity = '1';
                    card.innerHTML = '0';
                }
            });
            // Don't show error toast for background updates to avoid spam
        }
    }

    function updateStatCard(selector, value) {
        const card = $(selector + ' .stat-value');
        if (card) {
            // Animate the update
            card.style.opacity = '0.5';
            setTimeout(() => {
                card.innerHTML = value;
                card.style.opacity = '1';

                // Add pulse animation for visual feedback
                card.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    card.style.transform = 'scale(1)';
                }, 200);
            }, 100);
        }
    }

    // Trigger dashboard update after key operations
    function triggerDashboardUpdate() {
        // Immediate update after user actions
        setTimeout(() => {
            updateDashboardStats();
        }, 500); // Small delay to allow database operations to complete
    }

    // Auto-refresh dashboard every 30 seconds
    let dashboardRefreshInterval;

    function startDashboardAutoRefresh() {
        // Clear existing interval
        if (dashboardRefreshInterval) {
            clearInterval(dashboardRefreshInterval);
        }

        // Update immediately
        updateDashboardStats();

        // Set up auto-refresh every 30 seconds
        dashboardRefreshInterval = setInterval(() => {
            updateDashboardStats();
        }, 30000);
    }

    function stopDashboardAutoRefresh() {
        if (dashboardRefreshInterval) {
            clearInterval(dashboardRefreshInterval);
            dashboardRefreshInterval = null;
        }
    }

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

        // Send login AJAX (using simplified auth for debugging)
        try {
            const res = await fetch('php/auth_simple.php', {
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

                // Initialize reports dropdown for admin/staff
                if (data.user.role === 'admin' || data.user.role === 'staff') {
                    populateReportItemDropdown();
                }

                // Start dashboard auto-refresh
                startDashboardAutoRefresh();

                // Start announcements auto-refresh
                startAnnouncementAutoRefresh();

                // Initialize check-in/out forms for role-based access
                initializeCheckInOutForms();

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
    // Check for existing session on page load
    async function checkExistingSession() {
        try {
            const res = await fetch('php/auth_simple.php?action=check_session', {
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success && data.user) {
                // User is already logged in
                updateUserUI(data.user);
                loginScreen.style.display = 'none';
                mainApp.style.display = '';

                // Load all modules now that user is authenticated
                fetchInventory();
                fetchRequests();
                fetchCheckouts();
                fetchIssues();

                // Initialize reports dropdown for admin/staff
                if (data.user.role === 'admin' || data.user.role === 'staff') {
                    populateReportItemDropdown();
                }

                // Start dashboard auto-refresh
                startDashboardAutoRefresh();

                // Start announcements auto-refresh
                startAnnouncementAutoRefresh();

                // Initialize check-in/out forms for role-based access
                initializeCheckInOutForms();

                showSection('#dashboard');
            } else {
                // No existing session, show login screen
                mainApp.style.display = 'none';
                loginScreen.style.display = 'flex';
            }
        } catch (error) {
            console.error('Session check error:', error);
            // On error, show login screen
            mainApp.style.display = 'none';
            loginScreen.style.display = 'flex';
        }
    }

    // Check session on page load
    checkExistingSession();

    // --- Global Search Functionality ---
    let searchTimeout;
    const globalSearchInput = $('#globalSearch');
    const globalSearchResults = $('#globalSearchResults');

    async function performGlobalSearch(query) {
        if (!query.trim()) {
            globalSearchResults.style.display = 'none';
            return;
        }

        try {
            // Search inventory
            const inventoryRes = await fetch(`php/inventory.php?search=${encodeURIComponent(query)}&limit=5`, {
                credentials: 'include'
            });
            const inventoryData = await inventoryRes.json();

            // Search requests
            const requestsRes = await fetch(`php/request.php?search=${encodeURIComponent(query)}&limit=5`, {
                credentials: 'include'
            });
            const requestsData = await requestsRes.json();

            // Search users (admin/staff only)
            let usersData = { success: false, data: [] };
            if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')) {
                const usersRes = await fetch(`php/users.php?search=${encodeURIComponent(query)}&limit=5`, {
                    credentials: 'include'
                });
                usersData = await usersRes.json();
            }

            displaySearchResults(inventoryData.data || [], requestsData.data || [], usersData.data || []);

        } catch (error) {
            console.error('Search error:', error);
        }
    }

    function displaySearchResults(inventory, requests, users) {
        const inventoryResults = $('#inventoryResults .results-list');
        const requestResults = $('#requestResults .results-list');
        const userResults = $('#userResults .results-list');

        // Clear previous results
        inventoryResults.innerHTML = '';
        requestResults.innerHTML = '';
        userResults.innerHTML = '';

        // Display inventory results
        if (inventory.length > 0) {
            inventory.forEach(item => {
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                resultItem.innerHTML = `
                    <div class="result-item-title">${item.name}</div>
                    <div class="result-item-subtitle">${item.category} - ${item.location}</div>
                `;
                resultItem.onclick = () => {
                    showSection('#inventory');
                    globalSearchResults.style.display = 'none';
                    globalSearchInput.value = '';
                };
                inventoryResults.appendChild(resultItem);
            });
        } else {
            inventoryResults.innerHTML = '<div class="result-item">No inventory items found</div>';
        }

        // Display request results
        if (requests.length > 0) {
            requests.forEach(request => {
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                resultItem.innerHTML = `
                    <div class="result-item-title">Request #${request.id}</div>
                    <div class="result-item-subtitle">${request.item_name} - ${request.status}</div>
                `;
                resultItem.onclick = () => {
                    showSection('#requests');
                    globalSearchResults.style.display = 'none';
                    globalSearchInput.value = '';
                };
                requestResults.appendChild(resultItem);
            });
        } else {
            requestResults.innerHTML = '<div class="result-item">No requests found</div>';
        }

        // Display user results (admin/staff only)
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')) {
            if (users.length > 0) {
                users.forEach(user => {
                    const resultItem = document.createElement('div');
                    resultItem.className = 'result-item';
                    resultItem.innerHTML = `
                        <div class="result-item-title">${user.first_name} ${user.last_name}</div>
                        <div class="result-item-subtitle">${user.email} - ${user.role}</div>
                    `;
                    resultItem.onclick = () => {
                        showSection('#users');
                        globalSearchResults.style.display = 'none';
                        globalSearchInput.value = '';
                    };
                    userResults.appendChild(resultItem);
                });
            } else {
                userResults.innerHTML = '<div class="result-item">No users found</div>';
            }
            $('#userResults').style.display = 'block';
        } else {
            $('#userResults').style.display = 'none';
        }

        globalSearchResults.style.display = 'block';
    }

    // Global search event listeners
    globalSearchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performGlobalSearch(e.target.value);
        }, 300);
    });

    $('#globalSearchBtn')?.addEventListener('click', () => {
        performGlobalSearch(globalSearchInput.value);
    });

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.global-search')) {
            globalSearchResults.style.display = 'none';
        }
    });

    // --- Date Picker Functionality ---
    function setDateRange(type) {
        const startDate = $('#startDate');
        const endDate = $('#endDate');
        const today = new Date();

        switch (type) {
            case 'today':
                const todayStr = today.toISOString().split('T')[0];
                startDate.value = todayStr;
                endDate.value = todayStr;
                break;
            case 'week':
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                startDate.value = weekStart.toISOString().split('T')[0];
                endDate.value = weekEnd.toISOString().split('T')[0];
                break;
            case 'month':
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                startDate.value = monthStart.toISOString().split('T')[0];
                endDate.value = monthEnd.toISOString().split('T')[0];
                break;
        }
    }

    // Date picker event listeners
    $('#setTodayBtn')?.addEventListener('click', () => setDateRange('today'));
    $('#setWeekBtn')?.addEventListener('click', () => setDateRange('week'));
    $('#setMonthBtn')?.addEventListener('click', () => setDateRange('month'));

    // Announcement event listeners
    $('#addAnnouncementBtn')?.addEventListener('click', () => {
        openModal('#addAnnouncementModal');
    });

    $('#addAnnouncementForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('action', 'create');
        formData.append('title', $('#announcementTitle').value);
        formData.append('content', $('#announcementContent').value);
        formData.append('target_role', $('#announcementTargetRole').value);
        formData.append('priority', $('#announcementPriority').value);

        await createAnnouncement(formData);
    });

    // Checkout form event listener
    $('#checkoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await processCheckoutForm();
    });

    // Check-in form event listener
    $('#checkinBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await processCheckinForm();
    });

    // Authorization code validation event listener
    $('#validateCodeBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await validateAuthorizationCode();
    });

    // Auto-validate authorization code on input
    $('#authorizationCode')?.addEventListener('input', (e) => {
        const code = e.target.value.toUpperCase();
        e.target.value = code;

        // Clear previous validation state
        clearAuthCodeValidation();

        // Auto-validate if code is 8 characters
        if (code.length === 8) {
            setTimeout(() => validateAuthorizationCode(), 500);
        }
    });

    // Tab switching functionality
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            switchTab(targetTab);
        });
    });

    // Switch between tabs
    function switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });

        const targetContent = $(`#${tabName}-content`);
        if (targetContent) {
            targetContent.style.display = 'block';
        }

        // Load data for authorization codes tab
        if (tabName === 'authorization-codes') {
            fetchUserAuthorizationCodes();
        }

        // Load data for current requests tab
        if (tabName === 'current-requests') {
            fetchRequests();
        }
    }

    // --- Reports Enhancement ---
    async function populateReportItemDropdown() {
        try {
            const res = await fetch('php/inventory.php?limit=1000', { // Get all items
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                const dropdown = $('#reportItem');
                if (dropdown) {
                    // Clear existing options except "All Items"
                    dropdown.innerHTML = '<option value="">All Items</option>';

                    // Add all inventory items
                    data.data.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.id;
                        option.textContent = `${item.name} - ${item.category} - ${item.location} (${item.quantity} available)`;
                        dropdown.appendChild(option);
                    });

                    // Make dropdown searchable
                    makeDropdownSearchable(dropdown);
                }
            }
        } catch (error) {
            console.error('Error populating report item dropdown:', error);
        }
    }

    // Make dropdown searchable
    function makeDropdownSearchable(selectElement) {
        const wrapper = document.createElement('div');
        wrapper.className = 'searchable-dropdown-wrapper';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'dropdown-search';
        searchInput.placeholder = 'Search items...';

        const dropdownContainer = document.createElement('div');
        dropdownContainer.className = 'dropdown-options';
        dropdownContainer.style.display = 'none';

        // Store original options
        const originalOptions = Array.from(selectElement.options);

        // Create dropdown options
        originalOptions.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'dropdown-option';
            optionDiv.textContent = option.textContent;
            optionDiv.dataset.value = option.value;

            optionDiv.onclick = () => {
                selectElement.value = option.value;
                searchInput.value = option.textContent;
                dropdownContainer.style.display = 'none';

                // Trigger change event
                selectElement.dispatchEvent(new Event('change'));
            };

            dropdownContainer.appendChild(optionDiv);
        });

        // Search functionality
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const options = dropdownContainer.querySelectorAll('.dropdown-option');

            options.forEach(option => {
                const text = option.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    option.style.display = 'block';
                } else {
                    option.style.display = 'none';
                }
            });
        });

        // Show/hide dropdown
        searchInput.addEventListener('focus', () => {
            dropdownContainer.style.display = 'block';
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                dropdownContainer.style.display = 'none';
            }
        });

        // Replace original select with searchable version
        selectElement.style.display = 'none';
        wrapper.appendChild(searchInput);
        wrapper.appendChild(dropdownContainer);
        selectElement.parentNode.insertBefore(wrapper, selectElement);
    }

    // --- Real-Time Announcements System ---
    async function fetchAnnouncements() {
        try {
            const res = await fetch('php/announcements.php', {
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                displayAnnouncements(data.data);
                updateAnnouncementsBanner(data.data);
            }
        } catch (error) {
            console.error('Error fetching announcements:', error);
        }
    }

    function displayAnnouncements(announcements) {
        const container = $('.announcements-list');
        if (!container) return;

        if (announcements.length === 0) {
            container.innerHTML = '<div class="no-announcements">No announcements at this time.</div>';
            return;
        }

        container.innerHTML = announcements.map(announcement => `
            <div class="announcement-card priority-${announcement.priority}">
                <div class="announcement-header">
                    <h4>${announcement.title}</h4>
                    <div class="announcement-meta">
                        <span class="priority-badge priority-${announcement.priority}">${announcement.priority.toUpperCase()}</span>
                        <span class="target-badge">${announcement.target_role === 'all' ? 'All Users' : announcement.target_role.charAt(0).toUpperCase() + announcement.target_role.slice(1)}</span>
                        <span class="date">${new Date(announcement.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="announcement-content">
                    <p>${announcement.content}</p>
                </div>
                <div class="announcement-actions">
                    ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff') ? `
                        <button class="btn btn-outline btn-sm edit-announcement" data-id="${announcement.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm delete-announcement" data-id="${announcement.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Add event listeners for edit/delete buttons
        container.querySelectorAll('.edit-announcement').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                editAnnouncement(id);
            });
        });

        container.querySelectorAll('.delete-announcement').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                deleteAnnouncement(id);
            });
        });
    }

    function updateAnnouncementsBanner(announcements) {
        const banner = $('#announcementsBanner');
        if (!banner) return;

        // Filter high priority and urgent announcements
        const importantAnnouncements = announcements.filter(a =>
            a.priority === 'high' || a.priority === 'urgent'
        );

        if (importantAnnouncements.length === 0) {
            banner.style.display = 'none';
            return;
        }

        banner.style.display = 'block';
        banner.innerHTML = importantAnnouncements.map(announcement => `
            <div class="announcement-banner-item priority-${announcement.priority}">
                <div class="banner-content">
                    <i class="fas fa-bullhorn"></i>
                    <strong>${announcement.title}:</strong> ${announcement.content}
                </div>
                <button class="banner-dismiss" data-id="${announcement.id}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        // Add dismiss functionality
        banner.querySelectorAll('.banner-dismiss').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                dismissAnnouncement(id);
            });
        });
    }

    async function dismissAnnouncement(id) {
        try {
            const res = await fetch('php/announcements.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `action=dismiss&announcement_id=${id}`,
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                fetchAnnouncements(); // Refresh announcements
            }
        } catch (error) {
            console.error('Error dismissing announcement:', error);
        }
    }

    async function createAnnouncement(formData) {
        try {
            const res = await fetch('php/announcements.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                showToast('Announcement created successfully', 'success');
                closeModal('#addAnnouncementModal');
                fetchAnnouncements();
                $('#addAnnouncementForm').reset();
            } else {
                showToast(data.message || 'Failed to create announcement', 'danger');
            }
        } catch (error) {
            console.error('Error creating announcement:', error);
            showToast('Failed to create announcement', 'danger');
        }
    }

    function editAnnouncement(id) {
        // For now, just show a message - can be enhanced later
        showToast('Edit functionality coming soon', 'info');
    }

    async function deleteAnnouncement(id) {
        if (!confirm('Are you sure you want to delete this announcement?')) return;

        try {
            const res = await fetch('php/announcements.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `id=${id}`,
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                showToast('Announcement deleted successfully', 'success');
                fetchAnnouncements();
            } else {
                showToast(data.message || 'Failed to delete announcement', 'danger');
            }
        } catch (error) {
            console.error('Error deleting announcement:', error);
            showToast('Failed to delete announcement', 'danger');
        }
    }

    // Auto-refresh announcements every 60 seconds
    let announcementRefreshInterval;

    function startAnnouncementAutoRefresh() {
        fetchAnnouncements(); // Initial load

        announcementRefreshInterval = setInterval(() => {
            fetchAnnouncements();
        }, 60000); // 60 seconds
    }

    function stopAnnouncementAutoRefresh() {
        if (announcementRefreshInterval) {
            clearInterval(announcementRefreshInterval);
            announcementRefreshInterval = null;
        }
    }

    // Initialize report item dropdown when page loads
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')) {
        populateReportItemDropdown();
    }

    // Contact user form handler
    $('#contactUserForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await sendContactMessage();
    });

    // Close modal handlers for new modals
    $('.close-modal-btn')?.addEventListener('click', () => {
        closeModal('#contactUserModal');
    });

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

    // Professional close button handler
    $('.close-modal-btn')?.addEventListener('click', () => {
        closeModal('#addItemModal');
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

        // Show confirmation dialog instead of directly adding
        showAddItemConfirmation(formData);
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
    $('#searchInventory')?.addEventListener('input', debounce(() => fetchInventory(1), 300));
    $('#categoryFilter')?.addEventListener('change', () => fetchInventory(1));
    $('#statusFilter')?.addEventListener('change', () => fetchInventory(1));

    // Pagination Event Handlers
    $('#prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            fetchInventory(currentPage - 1);
        }
    });

    $('#nextPage')?.addEventListener('click', () => {
        fetchInventory(currentPage + 1);
    });

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
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')) {
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

    // Initialize checkout tabs functionality
    initializeCheckoutTabs();

// Initialize checkout tabs system
function initializeCheckoutTabs() {
    const tabButtons = document.querySelectorAll('.checkout-tabs .tab-btn');
    const tabContents = document.querySelectorAll('.checkout-tabs ~ .tab-content');

    // Add click event listeners to tab buttons
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));

            // Add active class to clicked button
            button.classList.add('active');

            // Hide all tab contents
            tabContents.forEach(content => {
                content.style.display = 'none';
            });

            // Show target tab content
            const targetContent = document.getElementById(targetTab + '-content');
            if (targetContent) {
                targetContent.style.display = 'block';
            }

            // Initialize tab-specific functionality
            if (targetTab === 'request-equipment') {
                loadAvailableItemsForRequest();
                setMinimumDateForRequest();
            } else if (targetTab === 'checkout-equipment') {
                // Checkout tab functionality already exists
            } else if (targetTab === 'checkin-equipment') {
                loadCheckedOutItemsForReturn();
            }
        });
    });

    // Initialize the first tab
    if (tabButtons.length > 0) {
        tabButtons[0].click();
    }
}

// Load available items for request dropdown
async function loadAvailableItemsForRequest() {
    try {
        const res = await fetch('php/inventory.php?status=available');
        const data = await res.json();
        const select = $('#requestItem');

        if (select && data.success) {
            select.innerHTML = '<option value="">Choose equipment...</option>';
            data.data.forEach(item => {
                select.innerHTML += `<option value="${item.id}">${item.name} - ${item.category} (${item.quantity} available)</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading items:', error);
        showToast('Failed to load available items', 'danger');
    }
}

// Set minimum date for request form
function setMinimumDateForRequest() {
    const dateInput = $('#requestDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        if (!dateInput.value) {
            dateInput.value = today;
        }
    }
}

// Load checked out items for return dropdown
async function loadCheckedOutItemsForReturn() {
    try {
        const res = await fetch('php/checkout.php');
        const data = await res.json();
        const select = $('#checkinItem');

        if (select && data.success) {
            select.innerHTML = '<option value="">Select an item to return...</option>';

            // Filter for items checked out by current user or all items for admin/staff
            const userCheckouts = data.data.filter(checkout => {
                if (currentUser.role === 'admin' || currentUser.role === 'staff') {
                    return checkout.status === 'checked_out';
                } else {
                    return checkout.status === 'checked_out' && checkout.user_id == currentUser.id;
                }
            });

            userCheckouts.forEach(checkout => {
                const dueDate = new Date(checkout.due_date).toLocaleDateString();
                select.innerHTML += `<option value="${checkout.id}">${checkout.item_name} (Due: ${dueDate})</option>`;
            });

            if (userCheckouts.length === 0) {
                select.innerHTML = '<option value="">No items to return</option>';
            }
        }
    } catch (error) {
        console.error('Error loading checked out items:', error);
        showToast('Failed to load checked out items', 'danger');
    }
}

    // Equipment Request Form submission (in checkout section)
    $('#equipmentRequestForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const itemId = $('#requestItem').value;
        const quantity = parseInt($('#requestQuantity').value);
        const neededBy = $('#requestDate').value;
        const purpose = $('#requestPurpose').value.trim();

        // Validation
        if (!itemId || !quantity || !neededBy || !purpose) {
            showToast('Please fill in all required fields', 'danger');
            return;
        }

        if (purpose.length < 10) {
            showToast('Purpose must be at least 10 characters long', 'danger');
            return;
        }

        if (quantity < 1 || quantity > 10) {
            showToast('Quantity must be between 1 and 10', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('item_id', itemId);
        formData.append('quantity', quantity);
        formData.append('needed_by', neededBy);
        formData.append('purpose', purpose);

        try {
            const res = await fetch('php/request.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                showToast('Equipment request submitted successfully! You will receive an authorization code once approved.', 'success');
                $('#equipmentRequestForm').reset();

                // Set minimum date to today for next request
                const today = new Date().toISOString().split('T')[0];
                $('#requestDate').min = today;

                // Refresh requests data
                fetchRequests();

                // Show success message with guidance
                setTimeout(() => {
                    showToast('Your request is now visible in the My Requests section. You will receive an authorization code once approved by lab staff.', 'info');
                }, 2000);
            } else {
                showToast(data.message || 'Failed to submit request', 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to submit request', 'danger');
        }
    });

    // Initialize authorization codes for students
    if (currentUser && currentUser.role === 'student') {
        fetchUserAuthorizationCodes();
    }

    // Clear Transaction History button event listener
    $('#clearHistoryBtn')?.addEventListener('click', showClearHistoryModal);
});

// Clear Transaction History functionality
async function showClearHistoryModal() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('Admin access required', 'danger');
        return;
    }

    try {
        // Get transaction statistics first
        const statsRes = await fetch('php/admin_tools.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_transaction_stats'
            }),
            credentials: 'include'
        });

        const statsData = await statsRes.json();

        if (!statsData.success) {
            showToast('Failed to load transaction statistics', 'danger');
            return;
        }

        const stats = statsData.data;

        // Create confirmation modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.id = 'clearHistoryModal';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Clear Transaction History</h3>
                    <button class="close-modal-btn" type="button">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="transaction-stats">
                        <h4>Current Transaction Statistics</h4>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-number">${stats.total_requests}</span>
                                <span class="stat-label">Total Requests</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">${stats.total_checkouts}</span>
                                <span class="stat-label">Total Checkouts</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">${stats.total_auth_codes}</span>
                                <span class="stat-label">Total Auth Codes</span>
                            </div>
                        </div>

                        <h5>Active Transactions (Will be Preserved)</h5>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-number" style="color: #28a745;">${stats.active_requests}</span>
                                <span class="stat-label">Active Requests</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number" style="color: #28a745;">${stats.active_checkouts}</span>
                                <span class="stat-label">Active Checkouts</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number" style="color: #28a745;">${stats.active_auth_codes}</span>
                                <span class="stat-label">Active Auth Codes</span>
                            </div>
                        </div>

                        <h5>Historical Data (Will be Deleted)</h5>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-number" style="color: #dc3545;">${stats.historical_requests}</span>
                                <span class="stat-label">Historical Requests</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number" style="color: #dc3545;">${stats.historical_checkouts}</span>
                                <span class="stat-label">Historical Checkouts</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number" style="color: #dc3545;">${stats.historical_auth_codes}</span>
                                <span class="stat-label">Historical Auth Codes</span>
                            </div>
                        </div>
                    </div>

                    <div class="warning-section">
                        <h5><i class="fas fa-exclamation-triangle"></i> Important Information</h5>
                        <ul>
                            <li><strong>This action will permanently delete all historical transaction records</strong></li>
                            <li>Active transactions (pending/approved requests, checked-out items, active authorization codes) will be preserved</li>
                            <li>All ID sequences will be reset to start from 1</li>
                            <li>After clearing, the next new request will have ID #1 (not #${stats.max_request_id + 1})</li>
                            <li>This operation cannot be undone</li>
                            <li>All data will be logged for audit purposes</li>
                        </ul>
                    </div>

                    <div style="margin: 1rem 0;">
                        <label style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" id="confirmClearHistory" required>
                            <span>I understand that this action will permanently delete historical data and cannot be undone</span>
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="confirmation-actions">
                        <button class="btn btn-outline" id="cancelClearHistory">Cancel</button>
                        <button class="btn danger-btn" id="confirmClearHistoryBtn" disabled>
                            <i class="fas fa-trash-alt"></i> Clear Transaction History
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const closeBtn = modal.querySelector('.close-modal-btn');
        const cancelBtn = modal.querySelector('#cancelClearHistory');
        const confirmBtn = modal.querySelector('#confirmClearHistoryBtn');
        const checkbox = modal.querySelector('#confirmClearHistory');

        const cleanup = () => {
            modal.remove();
        };

        // Enable/disable confirm button based on checkbox
        checkbox.addEventListener('change', () => {
            confirmBtn.disabled = !checkbox.checked;
        });

        closeBtn.onclick = cleanup;
        cancelBtn.onclick = cleanup;

        confirmBtn.onclick = async () => {
            if (!checkbox.checked) {
                showToast('Please confirm that you understand the consequences', 'warning');
                return;
            }

            cleanup();
            await executeClearHistory();
        };

        // Close on outside click
        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup();
            }
        };

    } catch (error) {
        console.error('Error showing clear history modal:', error);
        showToast('Failed to load transaction statistics', 'danger');
    }
}

async function executeClearHistory() {
    try {
        // Show loading toast
        showToast('Clearing transaction history...', 'info');

        const res = await fetch('php/admin_tools.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'clear_transaction_history'
            }),
            credentials: 'include'
        });

        const data = await res.json();

        if (data.success) {
            showToast(`Transaction history cleared successfully! Preserved ${data.data.preserved_requests} requests, ${data.data.preserved_checkouts} checkouts, and ${data.data.preserved_auth_codes} authorization codes. New IDs will start from ${data.data.new_id_start}.`, 'success');

            // Refresh all relevant data
            await Promise.all([
                fetchRequests(),
                fetchCheckouts(),
                updateDashboardStats()
            ]);

            // Refresh authorization codes for students
            if (currentUser && currentUser.role === 'student') {
                fetchUserAuthorizationCodes();
            }
        } else {
            showToast(data.message || 'Failed to clear transaction history', 'danger');
        }

    } catch (error) {
        console.error('Error clearing transaction history:', error);
        showToast('Failed to clear transaction history', 'danger');
    }
}