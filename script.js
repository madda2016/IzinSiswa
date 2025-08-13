document.addEventListener('DOMContentLoaded', () => {
    // --- FIREBASE INITIALIZATION & UTILITIES ---
    // Mengakses instance Firebase dari objek window yang diekspos di index.html
    const db = window.db; // Firestore instance
    const auth = window.auth; // Auth instance
    const appId = window.appId; // App ID from environment

    // Firestore Collection References (dynamic based on appId and userId)
    const getStudentsColRef = (uid) => window.collection(db, `artifacts/${appId}/users/${uid}/students`);
    const getDailyQueueColRef = (uid) => window.collection(db, `artifacts/${appId}/users/${uid}/daily_queue`);
    const getDailyQueueHistoryColRef = (uid) => window.collection(db, `artifacts/${appId}/users/${uid}/daily_queue_history`);
    const getEmployeesColRef = (uid) => window.collection(db, `artifacts/${appId}/users/${uid}/employees`); // User-specific employee data
    const getPublicQueueColRef = () => window.collection(db, `artifacts/${appId}/public/data/daily_queue`); // Public queue data

    const showMessage = (title, message) => showCustomModal('message', title, message);
    const showConfirmation = (title, message, onConfirm) => showCustomModal('confirm', title, message, onConfirm);
    const hideConfirmation = () => {
        dom.confirmModal.classList.add('hidden');
        dom.confirmModal.classList.remove('flex');
        onConfirmCallback = null;
    };

    // --- STATE MANAGEMENT ---
    let loggedInEmployee = null;
    let userId = null; // Firebase Auth UID
    let selectedStudent = null;
    let onConfirmCallback = null;
    const activeDate = new Date(); // This will still represent the current day for daily queue logic
    let currentTheme = localStorage.getItem('appTheme') || 'light';
    let selectedPrintSlips = [];
    let animationFrameId = null;
    let lastTimestamp = 0;
    const scrollSpeed = 0.05;
    let publicScrollOffset = 0;

    const defaultReloadInterval = 300; // 5 menit
    let publicReloadInterval = localStorage.getItem('publicReloadInterval') ? parseInt(localStorage.getItem('publicReloadInterval'), 10) : defaultReloadInterval;
    let autoReloadIntervalId = null;
    let currentArchiveData = []; // State untuk menyimpan data riwayat yang sedang ditampilkan

    // Cached data from Firestore listeners
    let studentDatabase = [];
    let printQueue = [];
    let dailyQueueHistory = [];
    let employees = [];
    let isAuthReady = false; // To track if Firebase Auth is initialized and user state is known
    let isTodayQueueConfirmed = false;

    // --- DOM ELEMENTS ---
    const dom = {
        publicView: document.getElementById('public-view'),
        publicLoginIcon: document.getElementById('public-login-icon'),
        publicQueueCount: document.getElementById('public-queue-count'),
        publicQueueTableContainer: document.getElementById('public-queue-table-container'),
        publicRefreshButton: document.getElementById('public-refresh-button'),
        appDashboard: document.getElementById('app-dashboard'),
        logoutButton: document.getElementById('logout-button'),
        userIdDisplay: document.getElementById('user-id-display'),
        activeDateDisplay: document.getElementById('active-date-display'),
        menuDatabase: document.getElementById('menu-database'),
        submenuDatabase: document.getElementById('submenu-database'),
        fileInput: document.getElementById('csv-file-input'),
        downloadTemplateButton: document.getElementById('download-template-button'),
        importDataInput: document.getElementById('import-data-file'),
        exportDataButton: document.getElementById('export-data-button'),
        deleteDatabaseButton: document.getElementById('delete-database-button'),
        databaseInfo: document.getElementById('database-info'),
        searchFormContainer: document.getElementById('search-form-container'),
        searchForm: document.getElementById('search-form'),
        searchInput: document.getElementById('search-nama'),
        classInput: document.getElementById('kelas'),
        waliInput: document.getElementById('wali'),
        reasonSelect: document.getElementById('keterangan'),
        addButton: document.getElementById('add-button'),
        autocompleteResults: document.getElementById('autocomplete-results'),
        queueView: document.getElementById('queue-view'),
        queueTitle: document.getElementById('queue-title'),
        queueContainer: document.getElementById('queue-container'),
        resetQueueButton: document.getElementById('reset-queue-button'),
        printPdfButton: document.getElementById('print-pdf-button'),
        printSlipsButton: document.getElementById('print-slips-button'),
        manualAddModal: document.getElementById('manual-add-modal'),
        openManualAddModalBtn: document.getElementById('open-manual-add-modal'),
        closeManualAddModalBtn: document.getElementById('close-manual-add-modal-button'),
        manualAddForm: document.getElementById('manual-add-form'),
        confirmModal: document.getElementById('confirm-modal'),
        confirmTitle: document.getElementById('confirm-title'),
        confirmMessage: document.getElementById('confirm-message'),
        confirmOkBtn: document.getElementById('confirm-ok-btn'),
        confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
        closeConfirmModalBtn: document.getElementById('close-confirm-modal-button'),
        settingsModal: document.getElementById('settings-modal'),
        openSettingsModalBtn: document.getElementById('open-settings-modal'),
        closeSettingsModalBtn: document.getElementById('close-settings-modal-button'),
        themeSettingRadios: document.querySelectorAll('input[name="theme-setting"]'),
        reloadSettingContainer: document.getElementById('reload-setting-container'),
        reloadIntervalInput: document.getElementById('reload-interval-input'),
        loginFormModal: document.getElementById('login-form-modal'),
        closeLoginFormModalBtn: document.getElementById('close-login-modal-button'),
        loginForm: document.getElementById('login-form'),
        loginUsernameInput: document.getElementById('login-username'),
        loginPasswordInput: document.getElementById('login-password'),
        loginSubmitBtn: document.getElementById('login-submit-btn'),
        menuEmployeeManagement: document.getElementById('menu-employee-management'),
        submenuEmployeeManagement: document.getElementById('submenu-employee-management'),
        openEmployeeManagementModalBtn: document.getElementById('open-employee-management-modal'),
        employeeManagementModal: document.getElementById('employee-management-modal'),
        closeEmployeeManagementModalBtn: document.getElementById('close-employee-management-modal-button'),
        addEmployeeForm: document.getElementById('add-employee-form'),
        newEmployeeEmailInput: document.getElementById('new-employee-email'),
        newEmployeePasswordInput: document.getElementById('new-employee-password'),
        newEmployeeNameInput: document.getElementById('new-employee-name'),
        newEmployeeRoleSelect: document.getElementById('new-employee-role'),
        employeeTableBody: document.getElementById('employee-table-body'),
        noEmployeesMessage: document.getElementById('no-employees-message'),
        openChangePasswordModalBtn: document.getElementById('open-change-password-modal-btn'),
        changePasswordModal: document.getElementById('change-password-modal'),
        closeChangePasswordModalBtn: document.getElementById('close-change-password-modal-button'),
        changePasswordForm: document.getElementById('change-password-form'),
        currentPasswordInput: document.getElementById('current-password'),
        newPasswordInput: document.getElementById('new-password'),
        confirmNewPasswordInput: document.getElementById('confirm-new-password'),
        menuArchive: document.getElementById('menu-archive'),
        archiveView: document.getElementById('archive-view'),
        archiveStartDate: document.getElementById('archive-start-date'),
        archiveEndDate: document.getElementById('archive-end-date'),
        archiveFilterBtn: document.getElementById('archive-filter-btn'),
        printArchiveReportBtn: document.getElementById('print-archive-report-btn'),
        archiveTableBody: document.getElementById('archive-table-body'),
        noArchiveDataMessage: document.getElementById('no-archive-data-message'),
        menuTodayQueue: document.getElementById('menu-today-queue'),
    };

    // --- FIRESTORE REAL-TIME LISTENERS ---
    let unsubscribeStudents = null;
    let unsubscribeDailyQueue = null;
    let unsubscribeDailyQueueHistory = null;
    let unsubscribeEmployees = null;
    let unsubscribePublicQueue = null;

    const setupFirestoreListeners = (uid) => {
        // Hentikan listener lama jika ada
        if (unsubscribeStudents) unsubscribeStudents();
        if (unsubscribeDailyQueue) unsubscribeDailyQueue();
        if (unsubscribeDailyQueueHistory) unsubscribeDailyQueueHistory();
        if (unsubscribeEmployees) unsubscribeEmployees();

        // Listen for user's students data
        unsubscribeStudents = window.onSnapshot(getStudentsColRef(uid), (snapshot) => {
            studentDatabase = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            syncDataAndRender();
        }, (error) => console.error("Error fetching students: ", error));

        // Listen for user's daily queue data
        unsubscribeDailyQueue = window.onSnapshot(getDailyQueueColRef(uid), (snapshot) => {
            printQueue = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                    .filter(doc => {
                                        const docDate = new Date(doc.created_at);
                                        const activeDateTime = new Date(); // Compare with current date
                                        return docDate.getFullYear() === activeDateTime.getFullYear() &&
                                               docDate.getMonth() === activeDateTime.getMonth() &&
                                               docDate.getDate() === activeDateTime.getDate();
                                    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            
            // Check if today's queue has been confirmed
            const today = new Date().toLocaleDateString('en-CA');
            isTodayQueueConfirmed = dailyQueueHistory.some(entry => entry.date === today && entry.userId === uid); // Check against current userId
            
            syncDataAndRender();
        }, (error) => console.error("Error fetching daily queue: ", error));

        // Listen for user's daily queue history data
        unsubscribeDailyQueueHistory = window.onSnapshot(getDailyQueueHistoryColRef(uid), (snapshot) => {
            dailyQueueHistory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Re-evaluate isTodayQueueConfirmed after history updates
            const today = new Date().toLocaleDateString('en-CA');
            isTodayQueueConfirmed = dailyQueueHistory.some(entry => entry.date === today && entry.userId === uid);
            syncDataAndRender();
        }, (error) => console.error("Error fetching daily queue history: ", error));

        // Listen for employee data
        unsubscribeEmployees = window.onSnapshot(getEmployeesColRef(uid), (snapshot) => {
            employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            syncDataAndRender();
        }, (error) => console.error("Error fetching employees: ", error));
    };

    const setupPublicQueueListener = () => {
        if (unsubscribePublicQueue) unsubscribePublicQueue();
        unsubscribePublicQueue = window.onSnapshot(getPublicQueueColRef(), (snapshot) => {
            // Update the public queue displayed on the public view
            printQueue = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                    .filter(doc => {
                                        const docDate = new Date(doc.created_at);
                                        const currentDateTime = new Date();
                                        return docDate.getFullYear() === currentDateTime.getFullYear() &&
                                               docDate.getMonth() === currentDateTime.getMonth() &&
                                               docDate.getDate() === currentDateTime.getDate();
                                    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            renderPublicQueueTable();
        }, (error) => console.error("Error fetching public queue: ", error));
    };


    // --- UI RENDERING & DATA SYNC ---
    const syncDataAndRender = () => {
        if (!isAuthReady) return; // Ensure auth state is determined before rendering
        
        updateDatabaseInfo();
        renderQueue();
        if (!loggedInEmployee) {
            renderPublicQueueTable(); // Only render public queue if not logged in
        }
        renderEmployeesTable();
    };

    const renderQueue = () => {
        if (!dom.queueContainer || !dom.queueTitle) return;
        dom.queueContainer.innerHTML = '';
        dom.queueTitle.textContent = `Daftar Antrian (${printQueue.length} Siswa)`;
        if (printQueue.length === 0) {
            dom.queueContainer.innerHTML = `<div class="h-full flex items-center justify-center"><p class="text-base text-slate-400">Antrian kosong.</p></div>`;
            return;
        }
        const table = document.createElement('table');
        table.className = 'w-full text-sm text-left text-slate-500';
        table.innerHTML = `
            <thead class="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 dark:bg-slate-700 dark:text-slate-300">
                <tr>
                    <th scope="col" class="px-6 py-3 w-12"><input type="checkbox" id="select-all-print-slips" class="form-checkbox h-5 w-5 text-indigo-600"></th>
                    <th scope="col" class="px-6 py-3 w-12">No</th>
                    <th scope="col" class="px-6 py-3">Nama Siswa</th>
                    <th scope="col" class="px-6 py-3">Kelas</th>
                    <th scope="col" class="px-6 py-3">Orang Tua/Wali</th>
                    <th scope="col" class="px-6 py-3">Keterangan</th>
                    <th scope="col" class="px-6 py-3">Ditambahkan Oleh</th>
                    <th scope="col" class="px-6 py-3 text-center">Aksi</th>
                </tr>
            </thead>
            <tbody id="queue-table-body"></tbody>
        `;
        const tableBody = table.querySelector('#queue-table-body');
        printQueue.forEach((student, index) => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700';
            const isSelected = selectedPrintSlips.includes(index);
            // Hanya admin atau penambah entri yang bisa menghapus
            const canDelete = (loggedInEmployee && loggedInEmployee.role === 'admin') || (loggedInEmployee && student.addedByUid === loggedInEmployee.id);
            
            // Logika untuk menonaktifkan tombol "Hapus" jika antrian sudah dikonfirmasi
            const deleteDisabled = isTodayQueueConfirmed ? 'disabled' : '';
            const deleteClass = isTodayQueueConfirmed ? 'opacity-50 cursor-not-allowed' : '';
            
            row.innerHTML = `
                <td class="px-6 py-4 text-center"><input type="checkbox" data-index="${index}" class="print-slip-checkbox" ${isSelected ? 'checked' : ''}></td>
                <td class="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">${index + 1}</td>
                <td class="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">${student.name}</td>
                <td class="px-6 py-4">${student.class}</td>
                <td class="px-6 py-4">${student.wali}</td>
                <td class="px-6 py-4"><span class="font-medium text-amber-600">${student.reason}</span></td>
                <td class="px-6 py-4">${student.addedBy || '-'}</td>
                <td class="px-6 py-4 text-center">
                    <button data-id="${student.id}" data-added-by-uid="${student.addedByUid || ''}" class="remove-queue-btn text-red-500 hover:text-red-700 font-semibold ${canDelete ? '' : 'opacity-50 cursor-not-allowed'} ${deleteClass}" ${canDelete ? '' : 'disabled'} ${deleteDisabled}>Hapus</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        dom.queueContainer.appendChild(table);
        const selectAllCheckbox = document.getElementById('select-all-print-slips');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const checkboxes = document.querySelectorAll('.print-slip-checkbox');
                selectedPrintSlips = [];
                checkboxes.forEach((checkbox, index) => {
                    checkbox.checked = isChecked;
                    if (isChecked) selectedPrintSlips.push(index);
                });
            });
        }
    };

    const renderPublicQueueTable = () => {
        if (!dom.publicQueueTableContainer || !dom.publicQueueCount) return;
        dom.publicQueueTableContainer.innerHTML = '';
        dom.publicQueueCount.textContent = printQueue.length;
        if (printQueue.length === 0) {
            dom.publicQueueTableContainer.innerHTML = `<p class="text-base text-slate-400 mt-4">Belum ada siswa dalam antrian izin hari ini.</p>`;
            return;
        }
        const headerTable = document.createElement('table');
        headerTable.className = 'public-queue-table-header';
        headerTable.innerHTML = `<thead><tr><th class="px-6 py-3" style="width: 10%;">NO</th><th class="px-6 py-3" style="width: 60%;">NAMA SISWA</th><th class="px-6 py-3 text-right" style="width: 30%;">KETERANGAN</th></tr></thead>`;
        dom.publicQueueTableContainer.appendChild(headerTable);
        const newTbodyWrapper = document.createElement('div');
        newTbodyWrapper.id = 'public-queue-table-body-wrapper';
        newTbodyWrapper.className = 'public-queue-table-body-wrapper';
        const tableBody = document.createElement('table');
        tableBody.className = 'public-queue-table';
        tableBody.id = 'public-table-body-animated';
        tableBody.innerHTML = `<tbody></tbody>`;
        printQueue.forEach((student, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `<td class="px-6 py-4">${index + 1}</td><td class="px-6 py-4 font-semibold" style="text-align: left; white-space: normal; width: 60%;">${student.name}</td><td class="px-6 py-4 text-center font-bold uppercase" style="width: 30%;">${student.reason}</td>`;
            tableBody.querySelector('tbody').appendChild(row);
        });
        newTbodyWrapper.appendChild(tableBody);
        
        // Duplikasi konten untuk efek scrolling tak terbatas
        if (tableBody.clientHeight > newTbodyWrapper.clientHeight) {
            const originalContent = tableBody.innerHTML;
            tableBody.innerHTML += originalContent;
        }

        dom.publicQueueTableContainer.appendChild(newTbodyWrapper);
        startPublicQueueCarousel();
    };
    const renderEmployeesTable = () => {
        if (!dom.employeeTableBody || !dom.noEmployeesMessage) return;
        dom.employeeTableBody.innerHTML = '';
        if (employees.length === 0) {
            dom.noEmployeesMessage.classList.remove('hidden');
        } else {
            dom.noEmployeesMessage.classList.add('hidden');
            employees.forEach((emp) => {
                const row = document.createElement('tr');
                row.className = 'bg-white border-b hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700';
                row.innerHTML = `<td class="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">${emp.email}</td><td class="px-6 py-4">${emp.name}</td><td class="px-6 py-4">${emp.role === 'admin' ? 'Admin' : 'Staf'}</td><td class="px-6 py-4 text-center"><button data-uid="${emp.id}" class="delete-employee-btn text-red-500 hover:text-red-700 font-semibold">Hapus</button></td>`;
                dom.employeeTableBody.appendChild(row);
            });
        }
    };
    const updateDatabaseInfo = () => {
        dom.databaseInfo.textContent = `${studentDatabase.length} siswa di database.`;
        dom.searchInput.disabled = studentDatabase.length === 0;
        if(studentDatabase.length > 0) dom.searchInput.focus();
    };
    const updateDateDisplay = () => {
        dom.activeDateDisplay.textContent = activeDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };
    const applyTheme = (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('appTheme', theme);
        dom.themeSettingRadios.forEach(radio => radio.checked = radio.value === theme);
    };

    const renderArchiveTable = (startDate = null, endDate = null) => {
        dom.archiveTableBody.innerHTML = '';
        currentArchiveData = [];
        
        let filteredHistory = dailyQueueHistory;

        if (startDate || endDate) {
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            
            filteredHistory = dailyQueueHistory.filter(entry => {
                const entryDate = new Date(entry.date);
                if (start && end) {
                    return entryDate >= start && entryDate <= end;
                } else if (start && !end) {
                    return entryDate.toDateString() === start.toDateString();
                } else if (!start && end) {
                    return entryDate <= end;
                }
                return false;
            });
        }
        
        if (filteredHistory.length === 0) {
            dom.noArchiveDataMessage.classList.remove('hidden');
            return;
        } else {
            dom.noArchiveDataMessage.classList.add('hidden');
        }

        filteredHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

        filteredHistory.forEach(entry => {
            entry.queue.forEach(student => {
                const row = document.createElement('tr');
                row.className = 'bg-white border-b hover:bg-slate-50';
                row.innerHTML = `
                    <td class="px-6 py-4">${entry.date}</td>
                    <td class="px-6 py-4 font-semibold">${student.name}</td>
                    <td class="px-6 py-4">${student.class}</td>
                    <td class="px-6 py-4"><span class="font-medium text-amber-600">${student.reason}</span></td>
                `;
                dom.archiveTableBody.appendChild(row);
                currentArchiveData.push({ ...student, date: entry.date });
            });
        });
    };

    // --- AUTHENTICATION & DATA HANDLING ---
    const setAuthState = async (user) => {
        if (user) {
            userId = user.uid; // Set the global userId
            // Fetch user-specific employee data from Firestore
            const employeeDocRef = window.doc(getEmployeesColRef(userId), userId);
            const employeeDocSnap = await window.getDoc(employeeDocRef);

            if (employeeDocSnap.exists()) {
                loggedInEmployee = { id: employeeDocSnap.id, ...employeeDocSnap.data() };
                sessionStorage.setItem('loggedInEmployee', JSON.stringify(loggedInEmployee));
            } else {
                // If employee data not found in Firestore but user is authenticated (e.g., first login or anonymous), handle gracefully
                console.warn("No employee data found for authenticated user. Assuming staff role.");
                loggedInEmployee = { id: userId, email: user.email || 'anon@app.com', name: user.email || 'Pengguna Anonim', role: 'staff' };
                // Optionally, save this basic employee info to Firestore
                await window.setDoc(employeeDocRef, loggedInEmployee, { merge: true });
            }

            dom.publicView.classList.add('hidden');
            dom.appDashboard.classList.remove('hidden');
            dom.loginFormModal.classList.add('hidden');
            dom.userIdDisplay.textContent = loggedInEmployee.name; // Display name from Firestore
            stopPublicQueueCarousel();
            if (autoReloadIntervalId) {
                clearInterval(autoReloadIntervalId);
                autoReloadIntervalId = null;
            }
            const isAdmin = loggedInEmployee.role === 'admin';
            dom.menuDatabase.classList.toggle('hidden', !isAdmin);
            dom.menuEmployeeManagement.classList.toggle('hidden', !isAdmin);
            dom.menuArchive.classList.toggle('hidden', !isAdmin);
            dom.resetQueueButton.classList.toggle('hidden', !isAdmin);
            dom.printPdfButton.classList.toggle('hidden', !isAdmin);
            dom.openChangePasswordModalBtn.classList.remove('hidden');
            dom.reloadSettingContainer.classList.toggle('hidden', !isAdmin);
            dom.searchFormContainer.classList.remove('hidden');

            setupFirestoreListeners(userId); // Start listening to user-specific data
        } else {
            // Logged out or no user
            loggedInEmployee = null;
            userId = null;
            sessionStorage.removeItem('loggedInEmployee');
            dom.publicView.classList.remove('hidden');
            dom.appDashboard.classList.add('hidden');
            dom.loginFormModal.classList.add('hidden');
            dom.userIdDisplay.textContent = '';
            
            // Unsubscribe from user-specific listeners
            if (unsubscribeStudents) unsubscribeStudents();
            if (unsubscribeDailyQueue) unsubscribeDailyQueue();
            if (unsubscribeDailyQueueHistory) unsubscribeDailyQueueHistory();
            if (unsubscribeEmployees) unsubscribeEmployees();

            // Restart public queue auto-reload and listener
            if (!autoReloadIntervalId) {
                autoReloadIntervalId = setInterval(() => {
                    location.reload(); // Simple refresh for public view
                }, publicReloadInterval * 1000);
            }
            setupPublicQueueListener(); // Restart public queue listener
        }
        isAuthReady = true; // Mark auth state as ready
        syncDataAndRender(); // Re-render UI based on new auth state
    };

    // --- EVENT HANDLERS ---
    const handleEmployeeLogin = async (e) => {
        e.preventDefault();
        const email = dom.loginUsernameInput.value.trim();
        const password = dom.loginPasswordInput.value.trim();

        try {
            // Menggunakan fungsi signInWithEmailAndPassword yang diakses dari window
            const userCredential = await window.signInWithEmailAndPassword(auth, email, password);
            await setAuthState(userCredential.user);
            showMessage('Login Berhasil', `Selamat datang, ${loggedInEmployee.name || userCredential.user.email}!`);
        } catch (error) {
            console.error("Login failed:", error);
            let errorMessage = 'Email atau password salah. Silakan coba lagi.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessage = 'Email atau password salah. Silakan coba lagi.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Format email tidak valid.';
            } else {
                errorMessage = `Terjadi kesalahan: ${error.message}`;
            }
            showMessage('Login Gagal', errorMessage);
        }
    };

    const handleLogout = async () => {
        try {
            await window.signOut(auth);
            await setAuthState(null); // Explicitly set state to null after signOut
            showMessage('Berhasil Keluar', 'Anda telah berhasil keluar dari aplikasi.');
        } catch (error) {
            console.error("Logout failed:", error);
            showMessage('Gagal Keluar', `Terjadi kesalahan saat logout: ${error.message}`);
        }
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        if (!userId) { showMessage('Error', 'Pengguna tidak terautentikasi.'); return; }

        const newName = dom.manualAddForm.querySelector('#manual-nama').value.trim();
        const newClass = dom.manualAddModal.querySelector('#manual-kelas').value.trim();
        
        if (!newName || !newClass) {
            showMessage('Input Kosong', 'Nama dan Kelas siswa baru tidak boleh kosong.');
            return;
        }
        
        // Check for duplicate locally (optimistic check) then in Firestore
        if (studentDatabase.some(s => s.name.toLowerCase() === newName.toLowerCase())) {
            showMessage('Duplikat Siswa', 'Siswa dengan nama ini sudah ada di database.');
            return;
        }

        try {
            // Add student to current user's students collection
            await window.addDoc(getStudentsColRef(userId), {
                name: newName,
                class: newClass,
                wali: '',
                nomorHpWali: '',
                created_at: new Date().toISOString()
            });
            dom.manualAddModal.classList.add('hidden');
            dom.manualAddForm.reset();
            showMessage('Siswa Ditambahkan', `Siswa "${newName}" berhasil ditambahkan ke database.`);
        } catch (error) {
            console.error("Error adding student: ", error);
            showMessage('Error', `Gagal menambahkan siswa: ${error.message}`);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || file.name.split('.').pop().toLowerCase() !== 'xlsx') {
            showMessage('Format File Salah', 'Harap unggah file Excel dengan ekstensi .xlsx.');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const workbook = XLSX.read(new Uint8Array(event.target.result), { type: 'array' });
                const [sheetName] = workbook.SheetNames;
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false });
                if (jsonData.length < 2 || !jsonData[0].includes('Nama') || !jsonData[0].includes('Kelas')) {
                    showMessage('Header Tidak Lengkap', 'File Excel tidak memiliki kolom yang diperlukan: Nama, Kelas.');
                    e.target.value = '';
                    return;
                }
                const headers = jsonData[0];
                const studentsDataRows = jsonData.slice(1);
                const existingStudentNames = new Set(studentDatabase.map(s => s.name.toLowerCase()));
                let newStudentsToInsert = [];
                let duplicatesFound = 0;
                
                for (const row of studentsDataRows) {
                    const name = row[headers.indexOf('Nama')]?.trim();
                    const studentClass = row[headers.indexOf('Kelas')]?.trim();
                    if (name && studentClass) {
                        if (!existingStudentNames.has(name.toLowerCase())) {
                            newStudentsToInsert.push({ name, class: studentClass, wali: row[headers.indexOf('Wali')] || '', nomorHpWali: row[headers.indexOf('Nomor HP Wali')] || '', created_at: new Date().toISOString() });
                            existingStudentNames.add(name.toLowerCase()); // Add to local set to prevent immediate duplicates in this batch
                        } else {
                            duplicatesFound++;
                        }
                    }
                }

                if (newStudentsToInsert.length > 0) {
                    // Batch writes for efficiency
                    const batch = db.batch(); // Access the batch function
                    for (const student of newStudentsToInsert) {
                        const newDocRef = window.doc(getStudentsColRef(userId)); // Auto-generate new doc ID
                        batch.set(newDocRef, student);
                    }
                    await batch.commit(); // Commit the batch
                    let msg = `Berhasil mengimpor ${newStudentsToInsert.length} siswa baru.`;
                    if (duplicatesFound > 0) msg += `\n${duplicatesFound} data duplikat diabaikan.`;
                    showMessage('Impor Berhasil', msg);
                } else {
                    showMessage('Tidak Ada Siswa Valid', 'Tidak ada siswa valid yang ditemukan di file Excel untuk diimpor.');
                }
            } catch (error) {
                console.error("Error processing file upload:", error);
                showMessage('Error Membaca File', `Gagal membaca file atau mengimpor data: ${error.message}`);
            }
            e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSearchInput = (e) => {
        const query = e.target.value.toLowerCase();
        dom.autocompleteResults.innerHTML = '';
        dom.autocompleteResults.classList.toggle('hidden', query.length < 1);
        if (query.length < 1) {
            dom.classInput.value = '';
            dom.waliInput.value = '';
            selectedStudent = null;
            dom.addButton.disabled = true;
            return;
        }
        const matches = studentDatabase.filter(s => s.name.toLowerCase().includes(query)).slice(0, 10);
        if (matches.length > 0) {
            matches.forEach(match => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item p-2 hover:bg-sky-500 hover:text-white cursor-pointer dark:hover:bg-blue-700';
                item.textContent = `${match.name} (${match.class})`;
                Object.entries(match).forEach(([key, value]) => item.dataset[key] = value || '');
                dom.autocompleteResults.appendChild(item);
            });
        }
    };

    const handleAddQueue = async (e) => {
        e.preventDefault();
        if (!userId) { showMessage('Error', 'Pengguna tidak terautentikasi.'); return; }

        const { searchInput, waliInput, reasonSelect, addButton } = dom;
        const studentNameFromInput = searchInput.value.trim().toLowerCase();
        
        if (!selectedStudent || !waliInput.value.trim()) {
            showMessage('Peringatan', selectedStudent ? 'Nama Orang Tua / Wali harus diisi.' : 'Pilih siswa dari hasil pencarian terlebih dahulu.');
            return;
        }

        const isAlreadyInQueue = printQueue.some(student => {
            return student.name.toLowerCase() === studentNameFromInput;
        });

        if (isAlreadyInQueue) {
            showMessage('Duplikat Antrian', `Siswa "${searchInput.value.trim()}" sudah ada di antrian hari ini.`);
            return;
        }
        
        const newQueueEntry = {
            name: selectedStudent.name,
            class: selectedStudent.class,
            wali: waliInput.value.trim(),
            nomorHpWali: selectedStudent.nomorHpWali || '',
            reason: reasonSelect.value,
            addedBy: loggedInEmployee.name,
            addedByUid: loggedInEmployee.id, // Use Firebase UID
            created_at: new Date().toISOString()
        };

        try {
            // Add to user's daily queue
            await window.addDoc(getDailyQueueColRef(userId), newQueueEntry);
            // Add to public daily queue
            await window.addDoc(getPublicQueueColRef(), newQueueEntry);

            showMessage('Berhasil', `Siswa "${selectedStudent.name}" ditambahkan ke antrian.`);
            selectedStudent = null;
            dom.searchForm.reset();
            addButton.disabled = true;
        } catch (error) {
            console.error("Error adding to queue:", error);
            showMessage('Error', `Gagal menambahkan siswa ke antrean: ${error.message}`);
        }
    };

    const handleQueueClick = async (e) => {
        const target = e.target;
        if (target.classList.contains('remove-queue-btn')) {
            const studentIdToRemove = target.dataset.id;
            const studentAddedByUid = target.dataset.addedByUid;

            const canDelete = (loggedInEmployee && loggedInEmployee.role === 'admin') || (loggedInEmployee && studentAddedByUid === loggedInEmployee.id);
            if (!canDelete) {
                showMessage('Tidak Diizinkan', 'Anda hanya dapat menghapus entri antrian yang Anda tambahkan sendiri, kecuali Anda adalah Admin.');
                return;
            }
            if (isTodayQueueConfirmed) {
                showMessage('Tidak Diizinkan', 'Data antrian hari ini sudah dikonfirmasi, Anda tidak dapat menghapusnya.');
                return;
            }
            const studentToRemove = printQueue.find(s => s.id === studentIdToRemove);
            if (!studentToRemove) return;

            showConfirmation('Hapus Entri Antrian?', `Yakin ingin menghapus entri untuk ${studentToRemove.name}?`, async () => {
                try {
                    // Remove from user's daily queue
                    await window.deleteDoc(window.doc(getDailyQueueColRef(userId), studentIdToRemove));
                    
                    // Remove from public daily queue
                    const publicQueueQuery = window.query(getPublicQueueColRef(), 
                        window.where("name", "==", studentToRemove.name),
                        window.where("class", "==", studentToRemove.class),
                        window.where("created_at", "==", studentToRemove.created_at)
                    );
                    const publicDocs = await window.getDocs(publicQueueQuery);
                    publicDocs.forEach(async (d) => {
                        await window.deleteDoc(window.doc(getPublicQueueColRef(), d.id));
                    });

                    showMessage('Entri Dihapus', `Entri untuk ${studentToRemove.name} telah dihapus.`);
                } catch (error) {
                    console.error("Error removing from queue:", error);
                    showMessage('Error', `Gagal menghapus entri: ${error.message}`);
                }
            });
        } else if (target.classList.contains('print-slip-checkbox')) {
            const index = parseInt(target.dataset.index, 10);
            if (target.checked) {
                selectedPrintSlips.push(index);
            } else {
                selectedPrintSlips = selectedPrintSlips.filter(item => item !== index);
            }
        }
    };

    const handleThemeSettingChange = (e) => {
        currentTheme = e.target.value;
        applyTheme(currentTheme);
    };
    const handleReloadIntervalChange = (e) => {
        const newInterval = parseInt(e.target.value, 10);
        if (newInterval > 0) {
            publicReloadInterval = newInterval;
            localStorage.setItem('publicReloadInterval', publicReloadInterval);
            if (!loggedInEmployee) {
                if (autoReloadIntervalId) clearInterval(autoReloadIntervalId);
                autoReloadIntervalId = setInterval(() => {
                    location.reload();
                }, publicReloadInterval * 1000);
            }
        }
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        if (!userId) { showMessage('Error', 'Pengguna tidak terautentikasi.'); return; }

        const { newEmployeeEmailInput, newEmployeePasswordInput, newEmployeeNameInput, newEmployeeRoleSelect } = dom;
        const email = newEmployeeEmailInput.value.trim();
        const password = newEmployeePasswordInput.value.trim();
        const name = newEmployeeNameInput.value.trim();
        const role = newEmployeeRoleSelect.value;
        
        let messageTitle, messageText;

        if (!email || !password || !name) {
            messageTitle = 'Input Kosong';
            messageText = 'Semua kolom harus diisi.';
            showMessage(messageTitle, messageText);
            return;
        }

        try {
            // Menggunakan fungsi createUserWithEmailAndPassword yang diakses dari window
            const userCredential = await window.createUserWithEmailAndPassword(auth, email, password);
            const newUid = userCredential.user.uid;

            // Store employee details in Firestore
            await window.setDoc(window.doc(getEmployeesColRef(userId), newUid), {
                email,
                name,
                role,
                created_at: new Date().toISOString()
            });
            messageTitle = 'Pegawai Ditambahkan';
            messageText = `Pegawai "${name}" berhasil ditambahkan.`;
            dom.addEmployeeForm.reset();
            dom.employeeManagementModal.classList.add('hidden');
            showMessage(messageTitle, messageText);
        } catch (error) {
            console.error("Error adding employee:", error);
            if (error.code === 'auth/email-already-in-use') {
                messageTitle = 'Gagal';
                messageText = 'Email sudah terdaftar.';
            } else {
                messageTitle = 'Error';
                messageText = `Gagal menambahkan pegawai: ${error.message}`;
            }
            showMessage(messageTitle, messageText);
        }
    };

    const handleEmployeeTableClick = async (e) => {
        const target = e.target;
        if (target.classList.contains('delete-employee-btn')) {
            const employeeUidToDelete = target.dataset.uid;
            if (loggedInEmployee.id === employeeUidToDelete) {
                showMessage('Tidak Diizinkan', 'Anda tidak bisa menghapus akun Anda sendiri.');
                return;
            }
            const employeeToDelete = employees.find(u => u.id === employeeUidToDelete);
            if (!employeeToDelete) return;
            
            showConfirmation('Hapus Pegawai?', `Yakin ingin menghapus pegawai "${employeeToDelete.name}"?`, async () => {
                try {
                    // Remove employee details from Firestore
                    await window.deleteDoc(window.doc(getEmployeesColRef(userId), employeeUidToDelete));
                    showMessage('Berhasil', 'Pegawai berhasil dihapus.');
                } catch (error) {
                    console.error("Error deleting employee:", error);
                    showMessage('Error', `Gagal menghapus pegawai: ${error.message}`);
                }
            });
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        const { currentPasswordInput, newPasswordInput, confirmNewPasswordInput } = dom;

        let messageTitle, messageText;

        if (newPasswordInput.value !== confirmNewPasswordInput.value) {
            messageTitle = 'Password Tidak Cocok';
            messageText = 'Password baru dan konfirmasi password tidak cocok.';
        } else {
            const user = auth.currentUser;
            if (!user) {
                messageTitle = 'Error';
                messageText = 'Tidak ada pengguna yang login.';
            } else {
                try {
                    // Menggunakan fungsi updatePassword yang diakses dari window
                    await window.updatePassword(user, newPasswordInput.value);
                    messageTitle = 'Berhasil';
                    messageText = 'Password berhasil diganti!';
                } catch (error) {
                    console.error("Error changing password:", error);
                    if (error.code === 'auth/requires-recent-login') {
                        messageTitle = 'Gagal';
                        messageText = 'Sesi Anda sudah terlalu lama. Harap keluar dan masuk kembali untuk mengubah password.';
                    } else if (error.code === 'auth/weak-password') {
                        messageTitle = 'Password Lemah';
                        messageText = 'Password baru terlalu lemah. Harap gunakan password yang lebih kuat.';
                    } else {
                        messageTitle = 'Error';
                        messageText = `Gagal mengganti password: ${error.message}`;
                    }
                }
            }
        }
        
        dom.changePasswordModal.classList.add('hidden');
        dom.changePasswordForm.reset();
        showMessage(messageTitle, messageText);
    };

    // --- PDF GENERATION ---
    const generateSlipsPDF = () => {
        if (selectedPrintSlips.length === 0) {
            showMessage("Tidak Ada Siswa Dipilih", "Pilih setidaknya satu siswa untuk mencetak surat izin.");
            return;
        }
        const studentsToPrint = printQueue.filter((_, index) => selectedPrintSlips.includes(index));
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', margin: 0 });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const textMarginLeft = 5;
        const textMarginTop = 5;
        const lineSpacing = 3.5;
        const fontSizeHeader = 12;
        const fontSizeBody = 10;
        const signatureSpacing = 15;
        const slipsPerPage = 6;
        const globalMargin = 5;
        const totalW = pageW - globalMargin * 2;
        const totalH = pageH - globalMargin * 2;
        const panelGlobalW = totalW / 3;
        const panelGlobalH = totalH / 2;
        const drawSlip = (doc, student, index) => {
            const col = (index % slipsPerPage) % 3;
            const row = Math.floor((index % slipsPerPage) / 3);
            const x = col * panelGlobalW + globalMargin;
            const y = row * panelGlobalH + globalMargin;
            doc.setDrawColor(150, 150, 150);
            doc.rect(x, y, panelGlobalW, panelGlobalH);
            const contentX = x + textMarginLeft;
            const contentW = panelGlobalW - (textMarginLeft * 2);
            let currentY = y + textMarginTop;
            doc.setFontSize(fontSizeHeader);
            doc.setFont(undefined, 'bold');
            const title = "SURAT IJIN TIDAK MASUK SEKOLAH";
            doc.text(title, x + (panelGlobalW / 2), currentY, { align: 'center' });
            doc.setLineWidth(0.5);
            doc.line(x + 5, currentY + 1, x + panelGlobalW - 5, currentY + 1);
            currentY += lineSpacing + 8;
            doc.setFontSize(fontSizeBody);
            doc.setFont(undefined, 'normal');
            const p1 = "Surat ini menerangkan bahwa siswa tersebut dibawah ini telah diijinkan oleh orangtua/walinya untuk tidak masuk sekolah.";
            doc.text(doc.splitTextToSize(p1, contentW), contentX, currentY);
            currentY += (doc.splitTextToSize(p1, contentW).length * lineSpacing) + 6;
            doc.text("Nama", contentX, currentY);
            doc.text(`: ${student.name}`, contentX + 20, currentY);
            currentY += lineSpacing + 2;
            doc.text("Kelas", contentX, currentY);
            doc.text(`: ${student.class}`, contentX + 20, currentY);
            currentY += lineSpacing + 2;
            doc.text("Keterangan", contentX, currentY);
            doc.text(`: ${student.reason}`, contentX + 20, currentY);
            currentY += lineSpacing + 6;
            const p2 = "Mohon diteruskan kepada petugas presensi untuk dilaksanakan. Terima kasih.";
            doc.text(doc.splitTextToSize(p2, contentW), contentX, currentY);
            let signatureY = currentY + (doc.splitTextToSize(p2, contentW).length * lineSpacing) + 6;
            const formattedDate = activeDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            const signX = x + panelGlobalW - textMarginLeft;
            doc.text(`Jatirogo, ${formattedDate}`, signX, signatureY, { align: 'right' });
            signatureY += lineSpacing + 2;
            doc.text("Petugas,", signX, signatureY, { align: 'right' });
            signatureY += signatureSpacing + 2;
            doc.text("Meri Wahyudi", signX, signatureY, { align: 'right' });
        };
        studentsToPrint.forEach((student, i) => {
            if (i > 0 && i % slipsPerPage === 0) doc.addPage();
            drawSlip(doc, student, i);
        });
        doc.output('dataurlnewwindow');
    };

    // Fungsi ini sekarang juga mengkonfirmasi siswa saat laporan dicetak
    const generateReportPDF = async () => {
        if (printQueue.length === 0) {
            showMessage("Antrian Kosong", "Daftar antrian kosong. Tidak ada data untuk dicetak.");
            return;
        }
        
        const today = new Date().toLocaleDateString('en-CA');
        const studentsToArchive = [];
        
        // Filter students that are not already in today's confirmed history for this user
        printQueue.forEach(student => {
            const isDuplicate = dailyQueueHistory.some(entry => 
                entry.date === today && 
                entry.userId === userId && // Ensure it's for the current user
                entry.queue.some(q => 
                    q.name.toLowerCase() === student.name.toLowerCase() && 
                    q.class.toLowerCase() === student.class.toLowerCase()
                )
            );
            if (!isDuplicate) {
                studentsToArchive.push(student);
            }
        });

        if (studentsToArchive.length > 0) {
            try {
                // Add new history entry for the current user
                await window.addDoc(getDailyQueueHistoryColRef(userId), {
                    date: today,
                    queue: studentsToArchive,
                    userId: userId // Store userId with history entry
                });
                showMessage("Laporan Berhasil Dicetak", `Sebanyak ${studentsToArchive.length} siswa telah dikonfirmasi dan laporan telah dicetak.`);
            } catch (error) {
                console.error("Error archiving daily queue:", error);
                showMessage("Error", `Gagal mengarsipkan data antrean: ${error.message}`);
            }
        } else {
            showMessage("Duplikasi Terdeteksi", "Laporan sudah pernah dicetak untuk siswa-siswa ini hari ini. Tidak ada data baru yang diarsipkan.");
        }

        // Generate PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const tableColumn = ["No", "Nama Siswa", "Kelas", "Orang Tua/Wali", "Keterangan", "Ditambahkan Oleh"];
        const tableRows = printQueue.map((s, i) => [i + 1, s.name, s.class, s.wali, s.reason, s.addedBy || '-']);
        const formattedDate = activeDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFontSize(18);
        doc.text("Laporan Izin Siswa", pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Tanggal: ${formattedDate}`, pageWidth / 2, 22, { align: 'center' });
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [241, 245, 249], textColor: [20, 20, 20] },
            styles: { font: 'Inter', fontSize: 12 },
            margin: { top: 10, right: 10, bottom: 10, left: 10 }
        });
        doc.output('dataurlnewwindow');
    };

    const generateArchiveReportPDF = () => {
        if (currentArchiveData.length === 0) {
            showMessage("Riwayat Kosong", "Tidak ada data riwayat untuk dicetak.");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const tableColumn = ["No", "Tanggal", "Nama Siswa", "Kelas", "Keterangan"];
        const tableRows = currentArchiveData.map((s, i) => [i + 1, s.date, s.name, s.class, s.reason]);
        const pageWidth = doc.internal.pageSize.getWidth();
        
        let titleText = "Laporan Riwayat Izin Siswa";
        let dateFilterText = "";
        const startDate = dom.archiveStartDate.value;
        const endDate = dom.archiveEndDate.value;
        if (startDate && endDate) {
            dateFilterText = `(${startDate} s.d. ${endDate})`;
        } else if (startDate) {
            dateFilterText = `(Tanggal: ${startDate})`;
        }
        
        doc.setFontSize(18);
        doc.text(titleText, pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(12);
        if (dateFilterText) {
            doc.text(dateFilterText, pageWidth / 2, 22, { align: 'center' });
        }
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [241, 245, 249], textColor: [20, 20, 20] },
            styles: { font: 'Inter', fontSize: 12 },
            margin: { top: 10, right: 10, bottom: 10, left: 10 }
        });
        doc.output('dataurlnewwindow');
    };

    // --- UTILITIES ---
    const showCustomModal = (type, title, message, onConfirm = null) => {
        dom.confirmTitle.textContent = title;
        dom.confirmMessage.textContent = message;
        onConfirmCallback = onConfirm;
        dom.confirmOkBtn.textContent = type === 'message' ? 'OK' : 'Ya, Lanjutkan';
        dom.confirmOkBtn.className = `px-4 py-2 rounded-md text-sm font-medium text-white ${type === 'message' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`;
        dom.confirmCancelBtn.classList.toggle('hidden', type === 'message');
        dom.confirmModal.classList.remove('hidden');
        dom.confirmModal.classList.add('flex');
    };
    const startPublicQueueCarousel = () => {
        stopPublicQueueCarousel();
        const publicTableBodyAnimated = document.getElementById('public-table-body-animated');
        if (publicTableBodyAnimated && printQueue.length > 0) {
            setTimeout(() => {
                publicScrollOffset = 0;
                lastTimestamp = 0;
                animationFrameId = requestAnimationFrame(animatePublicQueue);
            }, 100);
        }
    };
    const stopPublicQueueCarousel = () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        publicScrollOffset = 0;
        lastTimestamp = 0;
        const publicTableBodyAnimated = document.getElementById('public-table-body-animated');
        if (publicTableBodyAnimated) {
            publicTableBodyAnimated.style.transform = `translateY(0px)`;
            // Remove duplicated content if any
            if (publicTableBodyAnimated.childElementCount > printQueue.length) {
                while (publicTableBodyAnimated.childElementCount > printQueue.length) {
                    publicTableBodyAnimated.lastElementChild.remove();
                }
            }
        }
    };
    const animatePublicQueue = (timestamp) => {
        if (!lastTimestamp) lastTimestamp = timestamp;
        const publicTableBodyAnimated = document.getElementById('public-table-body-animated');
        const tbodyWrapper = document.getElementById('public-queue-table-body-wrapper');
        if (!publicTableBodyAnimated || !tbodyWrapper || dom.publicView.classList.contains('hidden')) {
            animationFrameId = null;
            return;
        }
        const totalHeight = publicTableBodyAnimated.scrollHeight / 2; // Total height of content, assuming duplicated
        const containerHeight = tbodyWrapper.clientHeight;
        const delta = timestamp - lastTimestamp;
        if (totalHeight > containerHeight) {
            if (publicTableBodyAnimated.children.length === printQueue.length && printQueue.length > 0) {
                // Duplicate content only if it's not already duplicated
                const originalContent = publicTableBodyAnimated.innerHTML;
                publicTableBodyAnimated.innerHTML += originalContent;
            }
            publicScrollOffset = (publicScrollOffset + scrollSpeed * delta);
            if (publicScrollOffset >= totalHeight) {
                publicScrollOffset = 0; // Reset scroll if it reaches the end of the first copy
            }
            publicTableBodyAnimated.style.transform = `translateY(-${publicScrollOffset}px)`;
        } else {
            publicTableBodyAnimated.style.transform = `translateY(0px)`;
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            return;
        }
        lastTimestamp = timestamp;
        animationFrameId = requestAnimationFrame(animatePublicQueue);
    };

    // --- ARCHIVING LOGIC ---
    // This now relies on the `generateReportPDF` function to archive when a report is explicitly printed.
    // The previous daily check for archiving is removed as Firestore handles real-time state.

    // --- INITIALIZATION & EVENT LISTENERS SETUP ---
    const setupEventListeners = () => {
        dom.publicLoginIcon.addEventListener('click', () => { dom.loginFormModal.classList.remove('hidden'); dom.loginUsernameInput.focus(); });
        dom.publicRefreshButton.addEventListener('click', () => location.reload());
        dom.closeLoginFormModalBtn.addEventListener('click', () => { dom.loginFormModal.classList.add('hidden'); dom.loginForm.reset(); });
        dom.loginFormModal.addEventListener('click', (e) => e.target === dom.loginFormModal && dom.loginFormModal.classList.add('hidden'));
        dom.loginSubmitBtn.addEventListener('click', handleEmployeeLogin);
        dom.logoutButton.addEventListener('click', handleLogout);
        dom.menuDatabase.addEventListener('click', () => { dom.submenuDatabase.classList.toggle('open'); dom.menuDatabase.classList.toggle('active'); });
        dom.fileInput.addEventListener('change', handleFileUpload);
        dom.downloadTemplateButton.addEventListener('click', () => {
            const headers = ["Nama", "Kelas", "Wali", "Nomor HP Wali"];
            const ws = XLSX.utils.aoa_to_sheet([headers]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
            XLSX.writeFile(wb, "template_data_siswa.xlsx");
            showMessage('Template Diunduh', 'Template Excel "template_data_siswa.xlsx" berhasil diunduh.');
        });
        dom.exportDataButton.addEventListener('click', async () => {
            if (!userId) { showMessage('Error', 'Pengguna tidak terautentikasi.'); return; }
            try {
                // Fetch all data for export
                const studentsSnapshot = await window.getDocs(getStudentsColRef(userId));
                const studentsData = studentsSnapshot.docs.map(doc => doc.data());

                const dailyQueueSnapshot = await window.getDocs(getDailyQueueColRef(userId));
                const dailyQueueData = dailyQueueSnapshot.docs.map(doc => doc.data());

                const historySnapshot = await window.getDocs(getDailyQueueHistoryColRef(userId));
                const historyData = historySnapshot.docs.map(doc => doc.data());
                
                const employeesSnapshot = await window.getDocs(getEmployeesColRef(userId));
                const employeesData = employeesSnapshot.docs.map(doc => doc.data());

                const appData = {
                    users: employeesData,
                    students: studentsData,
                    daily_queue: dailyQueueData,
                    daily_queue_history: historyData
                };

                const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'izin_siswa_data.json';
                a.click();
                URL.revokeObjectURL(url);
                showMessage('Ekspor Berhasil', 'Data aplikasi telah diunduh.');
            } catch (error) {
                console.error("Error exporting data:", error);
                showMessage('Error Ekspor', `Gagal mengekspor data: ${error.message}`);
            }
        });
        dom.importDataInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) { showMessage('Peringatan', 'Tidak ada file yang dipilih.'); return; }
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const importedData = JSON.parse(evt.target.result);
                    if (importedData.users && importedData.students && importedData.daily_queue && importedData.daily_queue_history) {
                        showConfirmation('Impor Data?', 'Yakin ingin mengganti data lokal dengan file ini? Ini akan menimpa data Anda di server.', async () => {
                            if (!userId) { showMessage('Error', 'Pengguna tidak terautentikasi.'); return; }
                            try {
                                // Clear existing data for the current user
                                const collectionsToClear = [
                                    getStudentsColRef(userId),
                                    getDailyQueueColRef(userId),
                                    getDailyQueueHistoryColRef(userId),
                                    getEmployeesColRef(userId) // Only clear user-specific employee data if importing for this user
                                ];

                                for (const colRef of collectionsToClear) {
                                    const docsSnapshot = await window.getDocs(colRef);
                                    const batch = db.batch();
                                    docsSnapshot.docs.forEach(doc => {
                                        batch.delete(doc.ref);
                                    });
                                    await batch.commit();
                                }
                                
                                // Import new data
                                const importBatch = db.batch();
                                // Import users (employees)
                                for (const user of importedData.users) {
                                    const userDocRef = window.doc(getEmployeesColRef(userId), user.id || user.uid || crypto.randomUUID()); // Ensure doc ID for employees
                                    importBatch.set(userDocRef, user);
                                }
                                // Import students
                                for (const student of importedData.students) {
                                    const studentDocRef = window.doc(getStudentsColRef(userId), student.id || crypto.randomUUID());
                                    importBatch.set(studentDocRef, student);
                                }
                                // Import daily queue
                                for (const item of importedData.daily_queue) {
                                    const queueDocRef = window.doc(getDailyQueueColRef(userId), item.id || crypto.randomUUID());
                                    importBatch.set(queueDocRef, item);
                                }
                                // Import daily queue history
                                for (const history of importedData.daily_queue_history) {
                                    const historyDocRef = window.doc(getDailyQueueHistoryColRef(userId), history.id || crypto.randomUUID());
                                    importBatch.set(historyDocRef, history);
                                }
                                await importBatch.commit();

                                showMessage('Impor Berhasil', 'Data berhasil diimpor dan diperbarui.');
                            } catch (error) {
                                console.error("Error importing data to Firestore:", error);
                                showMessage('Error Impor', `Gagal mengimpor data ke Firestore: ${error.message}`);
                            }
                        });
                    } else {
                        showMessage('Format File Salah', 'File JSON tidak valid atau tidak memiliki struktur data yang diharapkan.');
                    }
                } catch (error) { 
                    console.error("Error parsing imported file:", error);
                    showMessage('Error Impor', `Gagal membaca file: ${error.message}`); 
                }
            };
            reader.readAsText(file);
        });
        dom.deleteDatabaseButton.addEventListener('click', () => {
            showConfirmation('Hapus Seluruh Database?', 'PERINGATAN: Aksi ini tidak bisa dibatalkan. Seluruh data siswa, antrian, dan riwayat yang Anda miliki di server akan hilang.', async () => {
                if (!userId) { showMessage('Error', 'Pengguna tidak terautentikasi.'); return; }
                try {
                    const collectionsToDelete = [
                        getStudentsColRef(userId),
                        getDailyQueueColRef(userId),
                        getDailyQueueHistoryColRef(userId),
                        getEmployeesColRef(userId)
                    ];
                    
                    for (const colRef of collectionsToDelete) {
                        const docsSnapshot = await window.getDocs(colRef);
                        const batch = db.batch();
                        docsSnapshot.docs.forEach(doc => {
                            batch.delete(doc.ref);
                        });
                        await batch.commit();
                    }
                    showMessage('Database Dihapus', 'Database siswa dan antrian telah dihapus.');
                    dom.searchInput.value = '';
                } catch (error) {
                    console.error("Error deleting database:", error);
                    showMessage('Error', `Gagal menghapus database: ${error.message}`);
                }
            });
        });
        dom.searchInput.addEventListener('input', handleSearchInput);
        dom.searchForm.addEventListener('submit', handleAddQueue);
        dom.autocompleteResults.addEventListener('click', (e) => {
            if (e.target.classList.contains('autocomplete-item')) {
                selectedStudent = { 
                    name: e.target.dataset.name, 
                    class: e.target.dataset.class, 
                    wali: e.target.dataset.wali, 
                    nomorHpWali: e.target.dataset.nomorHpWali 
                };
                dom.searchInput.value = selectedStudent.name;
                dom.classInput.value = selectedStudent.class;
                dom.waliInput.value = selectedStudent.wali || '';
                dom.autocompleteResults.classList.add('hidden');
                dom.addButton.disabled = false;
            }
        });
        document.addEventListener('click', (e) => {
            if (!dom.searchForm.contains(e.target) && dom.autocompleteResults) dom.autocompleteResults.classList.add('hidden');
        });
        dom.resetQueueButton.addEventListener('click', () => {
            showConfirmation('Hapus Data Hari Ini?', 'Yakin ingin menghapus semua data antrian hari ini? Data akan diarsipkan sebelum dihapus.', async () => {
                if (!userId) { showMessage('Error', 'Pengguna tidak terautentikasi.'); return; }
                try {
                    if (printQueue.length > 0) {
                        const today = new Date().toLocaleDateString('en-CA');
                        // Archive only if not already archived for today
                        const isAlreadyArchived = dailyQueueHistory.some(entry => entry.date === today && entry.userId === userId);
                        if (!isAlreadyArchived) {
                            await window.addDoc(getDailyQueueHistoryColRef(userId), {
                                date: today,
                                queue: printQueue,
                                userId: userId
                            });
                        }
                    }
                    // Clear user's daily queue
                    const qDocs = await window.getDocs(getDailyQueueColRef(userId));
                    const batch = db.batch();
                    qDocs.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();

                    // Clear public daily queue (only for current day's entries that were added by this user perhaps? 
                    // Or simply clear all public queue entries assuming this action clears today's public queue globally)
                    // For simplicity, we'll clear all public queue entries for today, assuming a reset means a full reset.
                    const publicQDocs = await window.getDocs(window.query(getPublicQueueColRef(), 
                        window.where("created_at", ">=", new Date(new Date().setHours(0,0,0,0)).toISOString()),
                        window.where("created_at", "<", new Date(new Date().setHours(23,59,59,999)).toISOString())
                    ));
                    const publicBatch = db.batch();
                    publicQDocs.docs.forEach(d => publicBatch.delete(d.ref));
                    await publicBatch.commit();

                    showMessage('Data Dihapus & Diarsipkan', 'Data antrian hari ini telah diarsipkan dan dihapus.');
                } catch (error) {
                    console.error("Error resetting queue:", error);
                    showMessage('Error', `Gagal mereset antrean: ${error.message}`);
                }
            });
        });
        
        dom.printPdfButton.addEventListener('click', generateReportPDF);
        dom.printSlipsButton.addEventListener('click', generateSlipsPDF);

        dom.openManualAddModalBtn.addEventListener('click', () => dom.manualAddModal.classList.remove('hidden'));
        dom.closeManualAddModalBtn.addEventListener('click', () => dom.manualAddModal.classList.add('hidden'));
        dom.manualAddModal.addEventListener('click', (e) => e.target === dom.manualAddModal && dom.manualAddModal.classList.add('hidden'));
        dom.manualAddForm.addEventListener('submit', handleAddStudent);
        dom.queueContainer.addEventListener('click', handleQueueClick);
        
        dom.confirmOkBtn.addEventListener('click', () => {
            if (typeof onConfirmCallback === 'function') {
                onConfirmCallback();
            }
            hideConfirmation();
        });
        dom.confirmCancelBtn.addEventListener('click', hideConfirmation);
        dom.closeConfirmModalBtn.addEventListener('click', hideConfirmation);
        dom.confirmModal.addEventListener('click', (e) => e.target === dom.confirmModal && hideConfirmation());

        dom.openSettingsModalBtn.addEventListener('click', () => {
            dom.settingsModal.classList.remove('hidden');
            dom.themeSettingRadios.forEach(radio => radio.checked = radio.value === currentTheme);
            
            dom.reloadSettingContainer.classList.toggle('hidden', loggedInEmployee?.role !== 'admin');
            dom.reloadIntervalInput.value = publicReloadInterval;
        });
        dom.closeSettingsModalBtn.addEventListener('click', () => dom.settingsModal.classList.add('hidden'));
        dom.settingsModal.addEventListener('click', (e) => e.target === dom.settingsModal && dom.settingsModal.classList.add('hidden'));
        dom.themeSettingRadios.forEach(radio => radio.addEventListener('change', handleThemeSettingChange));
        dom.reloadIntervalInput.addEventListener('change', handleReloadIntervalChange);
        
        dom.menuEmployeeManagement.addEventListener('click', () => { dom.submenuEmployeeManagement.classList.toggle('open'); dom.menuEmployeeManagement.classList.toggle('active'); });
        dom.openEmployeeManagementModalBtn.addEventListener('click', () => { dom.employeeManagementModal.classList.remove('hidden'); renderEmployeesTable(); dom.newEmployeeEmailInput.focus(); });
        dom.closeEmployeeManagementModalBtn.addEventListener('click', () => { dom.employeeManagementModal.classList.add('hidden'); dom.addEmployeeForm.reset(); });
        dom.employeeManagementModal.addEventListener('click', (e) => e.target === dom.employeeManagementModal && dom.employeeManagementModal.classList.add('hidden'));
        dom.addEmployeeForm.addEventListener('submit', handleAddEmployee);
        dom.employeeTableBody.addEventListener('click', handleEmployeeTableClick);
        dom.openChangePasswordModalBtn.addEventListener('click', () => { dom.changePasswordModal.classList.remove('hidden'); dom.currentPasswordInput.focus(); });
        dom.closeChangePasswordModalBtn.addEventListener('click', () => { dom.changePasswordModal.classList.add('hidden'); dom.changePasswordForm.reset(); });
        dom.changePasswordModal.addEventListener('click', (e) => e.target === dom.changePasswordModal && dom.changePasswordModal.classList.add('hidden'));
        dom.changePasswordForm.addEventListener('submit', handleChangePassword);

        // Event listeners untuk fitur riwayat baru
        dom.menuArchive.addEventListener('click', () => {
            dom.queueView.classList.add('hidden');
            dom.archiveView.classList.remove('hidden');
            dom.searchFormContainer.classList.add('hidden');
            dom.archiveStartDate.value = '';
            dom.archiveEndDate.value = '';
            renderArchiveTable();
        });
        dom.archiveFilterBtn.addEventListener('click', () => {
            const startDate = dom.archiveStartDate.value;
            const endDate = dom.archiveEndDate.value;
            renderArchiveTable(startDate, endDate);
        });
        dom.printArchiveReportBtn.addEventListener('click', generateArchiveReportPDF);

        // Event listener untuk menu 'Cari & Tambah Antrian'
        dom.menuTodayQueue.addEventListener('click', () => {
            dom.archiveView.classList.add('hidden');
            dom.queueView.classList.remove('hidden');
            dom.searchFormContainer.classList.remove('hidden');
        });
    };

    const init = async () => {
        applyTheme(currentTheme);
        updateDateDisplay();
        setupEventListeners();

        // Check for initial authentication state
        window.onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in. Fetch detailed employee data from Firestore.
                const employeeDocRef = window.doc(getEmployeesColRef(user.uid), user.uid);
                const employeeDocSnap = await window.getDoc(employeeDocRef);

                if (employeeDocSnap.exists()) {
                    await setAuthState({ id: employeeDocSnap.id, ...employeeDocSnap.data() });
                } else {
                    // This happens if a user logs in via Firebase Auth but has no entry in Firestore 'employees' collection
                    // Create a default admin user if no users exist at all in Firestore
                    const allEmployeesQuery = window.query(window.collection(db, `artifacts/${appId}/users/${user.uid}/employees`));
                    const allEmployeesSnapshot = await window.getDocs(allEmployeesQuery);
                    
                    if (allEmployeesSnapshot.empty && user.email === 'admin@app.com') {
                        await window.setDoc(employeeDocRef, { email: 'admin@app.com', name: 'Admin Sekolah', role: 'admin' });
                        await setAuthState({ id: user.uid, email: 'admin@app.com', name: 'Admin Sekolah', role: 'admin' });
                    } else if (user.isAnonymous) {
                         // If it's an anonymous user from Canvas, use a basic profile
                        await setAuthState({ id: user.uid, email: user.email || 'anonymous', name: 'Pengguna Anonim', role: 'staff' });
                    } else {
                        // For any other authenticated user without employee details, assume staff role
                        await window.setDoc(employeeDocRef, { email: user.email, name: user.email ? user.email.split('@')[0] : 'Pengguna Baru', role: 'staff' });
                        await setAuthState({ id: user.uid, email: user.email, name: user.email ? user.email.split('@')[0] : 'Pengguna Baru', role: 'staff' });
                    }
                }
            } else {
                // No user is signed in. Attempt anonymous sign-in first.
                try {
                    // Try to sign in with the Canvas provided token if available.
                    if (window.initialAuthToken) { // Menggunakan window.initialAuthToken
                        await window.signInWithCustomToken(auth, window.initialAuthToken); // Menggunakan window.signInWithCustomToken
                        // onAuthStateChanged will be triggered again with the custom token user
                    } else {
                        await window.signInAnonymously(auth); // Menggunakan window.signInAnonymously
                        // onAuthStateChanged will be triggered again with the anonymous user
                    }
                } catch (anonError) {
                    console.error("Error signing in anonymously or with custom token:", anonError);
                    // If anonymous sign-in also fails, then set state to null
                    await setAuthState(null);
                }
            }
        });
    };

    init();
});
