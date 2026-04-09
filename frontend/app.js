const API_BASE = window.location.origin + '/api';
let currentUser = null;
let currentComplaints = [];

// DOM Elements
const views = document.querySelectorAll('.view');
const navButtons = document.querySelectorAll('[data-target]');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const reportForm = document.getElementById('report-form');

const btnGuest = document.getElementById('btn-guest');
const logoutBtn = document.getElementById('btn-logout');
const locationBtn = document.getElementById('btn-location');
const toastEl = document.getElementById('toast');
const btnToAdmin = document.getElementById('btn-to-admin');

// View linkers
document.getElementById('btn-to-signup').addEventListener('click', () => switchView('view-signup'));
document.getElementById('btn-to-login').addEventListener('click', () => switchView('view-auth'));

// Maps & Charts
let map = null;
let mapMarkers = [];
let catChartInstance = null;
let statChartInstance = null;

// Regex setup
const phoneRegex = /^\d{10}$/;
const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/;

// Init
function init() {
    registerEventListeners();
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        switchView('view-dashboard');
        loadComplaints();
        setupAdminBtn();
    } else {
        switchView('view-auth');
    }
}

// Navigation
function switchView(viewId) {
    // Block admin from accessing the report issue view
    if (viewId === 'view-report' && currentUser && currentUser.role === 'admin') {
        showToast('Admins cannot upload complaints.');
        return;
    }
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.target === viewId) btn.classList.add('active');
    });

    if (viewId === 'view-map') setTimeout(initMap, 100);
    if (viewId === 'view-admin') loadAdminComplaints();
    if (viewId === 'view-dashboard') loadComplaints();
    if (viewId === 'view-profile') loadProfileInfo();
    if (viewId === 'view-analytics') { setTimeout(initCharts, 100); }
}

function loadProfileInfo() {
    document.getElementById('profile-name').textContent = currentUser.name || "Guest";
    document.getElementById('profile-phone').textContent = currentUser.isGuest ? "Guest User" : currentUser.phone;
    
    // Total count for current user
    const myComplaints = currentComplaints.filter(c => c.userId === currentUser._id);
    const countEl = document.getElementById('profile-count');
    if (countEl) countEl.textContent = myComplaints.length;
    
    renderProfileComplaints(myComplaints);
}

function renderProfileComplaints(myComplaints) {
    const list = document.getElementById('profile-complaint-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (myComplaints.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 20px; color:#888; font-size: 13px;">You haven't uploaded any complaints yet.</div>`;
        return;
    }
    
    let sorted = [...myComplaints].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    sorted.forEach(c => {
        let statusClass = c.status === 'Pending' ? 'b-pending' : c.status === 'In Progress' ? 'b-inprogress' : c.status === 'Assigned' ? 'b-assigned' : 'b-resolved';
        let card = document.createElement('div');
        card.className = 'card';
        card.style.marginBottom = '12px';
        card.innerHTML = `
            <div class="card-header" style="margin-bottom: 0;">
                <div class="card-title" style="font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%;">${c.title}</div>
                <div class="badge ${statusClass}" style="zoom: 0.85;">${c.status === 'Resolved' ? 'Solved' : c.status}</div>
            </div>
            <div class="card-desc" style="font-size: 11px; margin-bottom: 0; margin-top: 5px;">${c.category} - ${new Date(c.createdAt).toLocaleDateString()}</div>
        `;
        list.appendChild(card);
    });
}

// Event Listeners
function registerEventListeners() {
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.target));
    });

    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    btnGuest.addEventListener('click', handleGuestLogin);
    
    document.getElementById('btn-admin-demo').addEventListener('click', async () => {
        await fetch(`${API_BASE}/auth/setup-admin`, {method: 'POST'});
        switchView('view-admin-login');
        document.getElementById('admin-phone').value = '8861909062'; // Hint
    });
    
    document.getElementById('btn-to-user-login').addEventListener('click', () => switchView('view-auth'));
    
    document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('admin-phone').value;
        const password = document.getElementById('admin-password').value;
        
        if (phone !== '8861909062') {
             showToast('Unauthorized Admin Mobile ID.');
             return;
        }

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });
            const data = await res.json();
            if (res.ok && data.user.role === 'admin') {
                currentUser = data.user;
                localStorage.setItem('user', JSON.stringify(currentUser));
                setupAdminBtn();
                await loadComplaints();
                switchView('view-admin');
            } else if (res.ok && data.user.role !== 'admin') {
                showToast('Not authorized as an admin.');
            } else {
                showToast(data.error);
            }
        } catch (err) {
            showToast('Server error');
        }
    });

    logoutBtn.addEventListener('click', handleLogout);
    reportForm.addEventListener('submit', handleReportSubmit);
    locationBtn.addEventListener('click', detectLocation);
    btnToAdmin.addEventListener('click', () => switchView('view-admin'));
    
    document.querySelectorAll('.filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter').forEach(f => f.classList.remove('active'));
            e.target.classList.add('active');
            renderComplaints(e.target.dataset.filter);
        });
    });
}

function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function setupAdminBtn() {
    if (currentUser && currentUser.role === 'admin') {
        btnToAdmin.style.display = 'block';
        // Hide all "Upload Complaint" FAB buttons for admin
        document.querySelectorAll('.btn-fab').forEach(btn => btn.style.display = 'none');
    } else {
        btnToAdmin.style.display = 'none';
        // Show FAB for regular users
        document.querySelectorAll('.btn-fab').forEach(btn => btn.style.display = '');
    }
}

// Validation Utilities
function validateInputs(phone, password, isSignup = false) {
    if (!phoneRegex.test(phone)) {
        showToast('Phone must be 10 digits exactly.');
        return false;
    }
    if (isSignup && !passRegex.test(password)) {
        showToast('Password needs uppercase, lowercase, special char, and 8+ length.');
        return false;
    }
    return true;
}

// Auth Logic
async function handleLogin(e) {
    e.preventDefault();
    const phone = document.getElementById('auth-phone').value;
    const password = document.getElementById('auth-password').value;
    
    if (!validateInputs(phone, password, false)) return;

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            setupAdminBtn();
            switchView('view-dashboard');
            loadComplaints();
        } else {
            showToast(data.error);
        }
    } catch (err) {
        showToast('Server error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const phone = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;
    
    if (!validateInputs(phone, password, true)) return;

    try {
        const res = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password, name })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            setupAdminBtn();
            switchView('view-dashboard');
            loadComplaints();
            showToast('Account created!');
        } else {
            showToast(data.error);
        }
    } catch (err) {
        showToast('Server error');
    }
}

async function handleGuestLogin() {
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isGuest: true })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            setupAdminBtn();
            switchView('view-dashboard');
            loadComplaints();
        }
    } catch (err) {
        showToast('Server error');
    }
}

function handleLogout() {
    localStorage.removeItem('user');
    currentUser = null;
    switchView('view-auth');
}

// Geolocation
function detectLocation() {
    locationBtn.textContent = 'Detecting...';
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                document.getElementById('report-lat').value = pos.coords.latitude;
                document.getElementById('report-lng').value = pos.coords.longitude;
                document.getElementById('location-text').textContent = 'Location Acquired ✅';
                locationBtn.textContent = '📍 Update Location';
            },
            err => {
                document.getElementById('location-text').textContent = 'Failed to get location.';
                locationBtn.textContent = '📍 Retry';
            }
        );
    } else {
        document.getElementById('location-text').textContent = 'Geolocation not supported.';
    }
}

// Report Submission
async function handleReportSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-report');
    btn.disabled = true;
    btn.textContent = 'Processing & Submitting...';

    const formData = new FormData();
    formData.append('title', document.getElementById('report-title').value);
    formData.append('description', document.getElementById('report-desc').value);
    formData.append('lat', document.getElementById('report-lat').value);
    formData.append('lng', document.getElementById('report-lng').value);
    formData.append('userId', currentUser._id);
    
    const fileInput = document.getElementById('report-image');
    if (fileInput.files[0]) formData.append('image', fileInput.files[0]);

    try {
        const res = await fetch(`${API_BASE}/complaints`, { method: 'POST', body: formData });
        if (res.ok) {
            showToast('Complaint submitted successfully!');
            reportForm.reset();
            document.getElementById('location-text').textContent = 'Not detected';
            switchView('view-dashboard');
            loadComplaints();
        } else {
            showToast('Submission failed');
        }
    } catch (err) {
        showToast('Server error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Complaint';
    }
}

// Load & Render Complaints
async function loadComplaints() {
    try {
        // Fetch ALL complaints so users can see community reports and upvote them
        const res = await fetch(`${API_BASE}/complaints`);
        currentComplaints = await res.json();
        
        const myCount = currentComplaints.filter(c => c.userId === currentUser._id).length;
        document.getElementById('complaint-count').textContent = myCount;
        
        renderComplaints(document.querySelector('.filter.active').dataset.filter);
    } catch (err) {
        console.error("Failed to load complaints");
    }
}

function renderComplaints(filter) {
    const list = document.getElementById('complaint-list');
    list.innerHTML = '';
    
    // Sort by priority logic (High first, then by upvotes, then recency)
    let sorted = [...currentComplaints].sort((a,b) => {
        if(a.priority === 'High' && b.priority !== 'High') return -1;
        if(b.priority === 'High' && a.priority !== 'High') return 1;
        
        let aVotes = a.upvotes ? a.upvotes.length : 0;
        let bVotes = b.upvotes ? b.upvotes.length : 0;
        if(aVotes !== bVotes) return bVotes - aVotes;
        
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const filtered = sorted.filter(c => {
        if (filter === 'All') {
            return c.status !== 'Resolved'; // Do not show solved out of the box
        }
        return c.status === filter;
    });
    
    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 40px; color:#888;">No complaints found.</div>`;
        return;
    }

    filtered.forEach(c => {
        let statusClass = c.status === 'Pending' ? 'b-pending' : c.status === 'In Progress' ? 'b-inprogress' : c.status === 'Assigned' ? 'b-assigned' : 'b-resolved';
        let upvotesCount = c.upvotes ? c.upvotes.length : 0;
        let commentsCount = c.comments ? c.comments.length : 0;
        let hasUpvoted = c.upvotes && c.upvotes.includes(currentUser._id);

        let card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${c.title}</div>
                <div class="badge ${statusClass}">${c.status === 'Resolved' ? 'Solved' : c.status}</div>
            </div>
            ${c.priority === 'High' ? `<div class="badge b-high" style="display:inline-block; margin-bottom:8px">Urgent</div>` : ''}
            <div class="badge" style="background:#e8f0fe; color:#1a73e8; display:inline-block; margin-bottom:8px">${c.category}</div>
            ${c.department && c.department !== 'None' ? `<div class="badge" style="background:#f3e8ff; color:#7e22ce; display:inline-block; margin-bottom:8px">🏢 Assigned: ${c.department}</div>` : ''}
            
            <div class="card-desc">${c.description}</div>
            
            ${c.imageUrl ? `<img src="${API_BASE.replace('/api','')}${c.imageUrl}" class="card-img" />` : ''}
            
            ${c.status === 'Resolved' && c.proofImageUrl ? `
            <div style="margin-top: 10px; padding: 10px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                <p style="font-size: 12px; font-weight: 600; color: #16a34a; margin-bottom: 6px;">✅ Proof of Work by Admin</p>
                <img src="${API_BASE.replace('/api','')}${c.proofImageUrl}" style="width:100%; border-radius:6px; max-height:180px; object-fit:cover;">
            </div>` : ''}
            
            <div class="card-footer">
                <div class="card-meta">📅 ${new Date(c.createdAt).toLocaleDateString()}</div>
                <div class="card-actions">
                    <button class="btn-action" onclick="openModal('${c._id}')">💬 ${commentsCount}</button>
                    <button class="btn-action ${hasUpvoted ? 'supported' : ''}" onclick="toggleUpvote('${c._id}')">
                        ${hasUpvoted ? '❤️' : '🤍'} ${upvotesCount}
                    </button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

// Modal & Advanced Features
window.openModal = function(id) {
    const comp = currentComplaints.find(c => c._id === id);
    if(!comp) return;

    document.getElementById('current-modal-id').value = id;
    document.getElementById('mc-title').textContent = comp.title;
    document.getElementById('mc-desc').textContent = comp.description;
    document.getElementById('mc-upvotes').textContent = comp.upvotes ? comp.upvotes.length : 0;

    // Render Timeline
    const tlContainer = document.getElementById('mc-timeline');
    tlContainer.innerHTML = '';
    const history = comp.statusHistory || [{status: 'Pending', timestamp: comp.createdAt}];
    
    history.forEach((h, idx) => {
        let isLast = idx === history.length - 1;
        tlContainer.innerHTML += `
            <div class="timeline-item ${isLast ? 'active' : ''}">
                <h4>${h.status === 'Assigned' ? `Routed to ${h.department}` : `Moved to ${h.status === 'Resolved' ? 'Solved' : h.status}`}</h4>
                <p>${new Date(h.timestamp).toLocaleString()}</p>
            </div>
        `;
    });

    // Proof of work image
    const existingProof = document.getElementById('mc-proof-section');
    if (existingProof) existingProof.remove();
    if (comp.proofImageUrl) {
        const proofSection = document.createElement('div');
        proofSection.id = 'mc-proof-section';
        proofSection.style.cssText = 'margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0;';
        proofSection.innerHTML = `
            <h4 style="color: #16a34a; margin-bottom: 8px; font-size: 14px;">✅ Proof of Work</h4>
            <img src="${API_BASE.replace('/api','')}${comp.proofImageUrl}" style="width:100%; border-radius:8px; max-height:200px; object-fit:cover;">
        `;
        document.getElementById('mc-timeline').after(proofSection);
    }

    // Render Comments
    const comms = document.getElementById('mc-comments');
    comms.innerHTML = '';
    if(comp.comments && comp.comments.length > 0) {
        comp.comments.forEach(cm => {
            comms.innerHTML += `
                <div class="comment">
                    <header><strong>${cm.authorName}</strong> <time>${new Date(cm.timestamp).toLocaleDateString()}</time></header>
                    <p>${cm.text}</p>
                </div>
            `;
        });
    } else {
        comms.innerHTML = '<div style="font-size:13px; color:#aaa; text-align:center;">No comments yet.</div>';
    }

    document.getElementById('complaint-modal').classList.add('open');
}

window.closeModal = function() {
    document.getElementById('complaint-modal').classList.remove('open');
}

window.toggleUpvote = async function(id) {
    try {
        await fetch(`${API_BASE}/complaints/${id}/upvote`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser._id })
        });
        // Reload all data
        await loadComplaints();
        
        // Update modal upvote count if modal is open for this complaint
        if(document.getElementById('complaint-modal').classList.contains('open') && document.getElementById('current-modal-id').value === id) {
            const comp = currentComplaints.find(c => c._id === id);
            document.getElementById('mc-upvotes').textContent = comp.upvotes ? comp.upvotes.length : 0;
        }
    } catch(e) {
        showToast('Error upvoting');
    }
}

window.postComment = async function() {
    const id = document.getElementById('current-modal-id').value;
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if(!text) return;

    try {
        await fetch(`${API_BASE}/complaints/${id}/comment`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ text, authorName: currentUser.name || 'Guest User' })
        });
        input.value = '';
        await loadComplaints();
        openModal(id); // Reload modal data
    } catch(e) {
        showToast('Error posting comment');
    }
}

// Chart.js Analytics
function initCharts() {
    const ctxCat = document.getElementById('categoryChart');
    const ctxStat = document.getElementById('statusChart');

    if (catChartInstance) catChartInstance.destroy();
    if (statChartInstance) statChartInstance.destroy();

    // Data aggregation
    let catCounts = { Road: 0, Garbage: 0, Water: 0, Electricity: 0, Streetlight: 0, Other: 0 };
    let statCounts = { Pending: 0, 'In Progress': 0, Resolved: 0 };

    currentComplaints.forEach(c => {
        if(catCounts[c.category] !== undefined) catCounts[c.category]++;
        else catCounts.Other++;

        if(statCounts[c.status] !== undefined) statCounts[c.status]++;
    });

    catChartInstance = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catCounts),
            datasets: [{
                data: Object.values(catCounts),
                backgroundColor: ['#e4717a', '#74b9ff', '#55efc4', '#ffeaa7', '#a29bfe', '#dfe6e9']
            }]
        },
        options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } }
    });

    statChartInstance = new Chart(ctxStat, {
        type: 'bar',
        data: {
            labels: Object.keys(statCounts),
            datasets: [{
                label: 'Complaints',
                data: Object.values(statCounts),
                backgroundColor: ['#fef0d9', '#e0f2fe', '#dcfce7'],
                borderColor: ['#d97706', '#0284c7', '#16a34a'],
                borderWidth: 1
            }]
        },
        options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
    });
}

// Map Initialization
function initMap() {
    if(!map) {
        map = L.map('map').setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    }
    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];
    let bounds = [];

    currentComplaints.forEach(c => {
        if (c.location && c.location.lat && c.location.lng) {
            let marker = L.marker([c.location.lat, c.location.lng]).addTo(map);
            marker.bindPopup(`<b>${c.title}</b><br>${c.category}`);
            mapMarkers.push(marker);
            bounds.push([c.location.lat, c.location.lng]);
        }
    });
    if (bounds.length > 0) map.fitBounds(bounds);
}

// Admin Logic
async function loadAdminComplaints() {
    renderAdminList(currentComplaints);
}
function renderAdminList(complaints) {
    const list = document.getElementById('admin-list');
    list.innerHTML = '';
    complaints.forEach(c => {
        let statusClass = c.status === 'Pending' ? 'b-pending' : c.status === 'In Progress' ? 'b-inprogress' : c.status === 'Assigned' ? 'b-assigned' : 'b-resolved';
        let card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${c.title} <span class="badge ${statusClass}">${c.status === 'Resolved' ? 'Solved' : c.status}</span></div>
            </div>
            <div class="card-desc"><b>${c.category}</b> - ${c.priority} Priority</div>
            <div class="admin-card-actions" style="flex-wrap: wrap;">
                <select id="status-${c._id}" onchange="toggleProofUpload('${c._id}')">
                    <option value="Pending" ${c.status==='Pending'?'selected':''}>Pending</option>
                    <option value="Assigned" ${c.status==='Assigned'?'selected':''}>Assigned</option>
                    <option value="In Progress" ${c.status==='In Progress'?'selected':''}>In Progress</option>
                    <option value="Resolved" ${c.status==='Resolved'?'selected':''}>Solved</option>
                </select>
                <select id="dept-${c._id}">
                    <option value="None" ${!c.department || c.department==='None'?'selected':''}>Unassigned</option>
                    <option value="Roads & Highways" ${c.department==='Roads & Highways'?'selected':''}>Roads & Highways</option>
                    <option value="Water Board" ${c.department==='Water Board'?'selected':''}>Water Board</option>
                    <option value="Power Grid" ${c.department==='Power Grid'?'selected':''}>Power Grid</option>
                    <option value="Sanitation" ${c.department==='Sanitation'?'selected':''}>Sanitation</option>
                </select>
                <button onclick="updateStatus('${c._id}')">Update</button>
            </div>
            <div id="proof-upload-${c._id}" style="display:${c.status==='Resolved'?'block':'none'}; margin-top: 10px; padding: 10px; background: #f0fdf4; border-radius: 8px; border: 1px dashed #16a34a;">
                <label style="font-size: 12px; font-weight: 600; color: #16a34a; display:block; margin-bottom: 6px;">📸 Upload Proof of Work (Required for Solved)</label>
                <input type="file" id="proof-img-${c._id}" accept="image/*" style="font-size: 12px; width: 100%;">
                ${c.proofImageUrl ? `<img src="${API_BASE.replace('/api','')}${c.proofImageUrl}" style="margin-top:8px; width:100%; border-radius:6px; max-height:150px; object-fit:cover;"><p style="font-size:11px; color:#16a34a; margin-top:4px;">✅ Proof already uploaded</p>` : ''}
            </div>
        `;
        list.appendChild(card);
    });
}
window.toggleProofUpload = function(id) {
    const statusEl = document.getElementById(`status-${id}`);
    const proofBox = document.getElementById(`proof-upload-${id}`);
    if (proofBox) proofBox.style.display = statusEl.value === 'Resolved' ? 'block' : 'none';
}

window.updateStatus = async function(id) {
    const newStatus = document.getElementById(`status-${id}`).value;
    const newDept = document.getElementById(`dept-${id}`).value;
    const proofInput = document.getElementById(`proof-img-${id}`);

    if (newStatus === 'Resolved' && proofInput && !proofInput.files[0]) {
        const existing = currentComplaints.find(c => c._id === id);
        if (!existing || !existing.proofImageUrl) {
            showToast('⚠️ Please upload proof of work before marking as Solved.');
            return;
        }
    }

    try {
        const formData = new FormData();
        formData.append('status', newStatus);
        formData.append('department', newDept);
        if (proofInput && proofInput.files[0]) {
            formData.append('proofImage', proofInput.files[0]);
        }

        const res = await fetch(`${API_BASE}/complaints/${id}`, {
            method: 'PUT',
            body: formData  // No Content-Type header, let browser set multipart boundary
        });
        if (res.ok) {
            showToast('✅ Status updated successfully');
            await loadComplaints();
            loadAdminComplaints();
        } else {
            showToast('Error updating status');
        }
    } catch (err){
        showToast('Error updating');
    }
}

document.addEventListener('DOMContentLoaded', init);
