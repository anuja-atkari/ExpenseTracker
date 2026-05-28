const API_URL = '/api/expenses';

// DOM Elements
const expenseForm = document.getElementById('expense-form');
const transactionList = document.getElementById('transaction-list');
const emptyStateEl = document.getElementById('empty-state');
const toastMessage = document.getElementById('toast-message');

// Stats Elements
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const totalBalanceEl = document.getElementById('total-balance');
const chartBalanceEl = document.getElementById('chart-balance');
const legendIncomeEl = document.getElementById('legend-income');
const legendExpenseEl = document.getElementById('legend-expense');

// Modal Elements
const modal = document.getElementById('transaction-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

// State
let transactionIdToDelete = null;

// Chart Instance
let balanceChart;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    updateCurrentDate();
    initChart();
    fetchTransactions();
});

// Event Listeners
openModalBtn.addEventListener('click', () => modal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
expenseForm.addEventListener('submit', handleAddTransaction);

// Delete Modal Listeners
cancelDeleteBtn.addEventListener('click', closeDeleteModal);
confirmDeleteBtn.addEventListener('click', handleConfirmDelete);

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
    if (e.target === deleteModal) closeDeleteModal();
});

// Helper: Update Date display
function updateCurrentDate() {
    const now = new Date();
    const options = { month: 'long', year: 'numeric' };
    document.getElementById('current-month').textContent = now.toLocaleDateString('en-US', options);
}

// Helper: Initialize Chart.js
function initChart() {
    const ctx = document.getElementById('balanceChart').getContext('2d');
    balanceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Income', 'Expense'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 0,
                cutout: '80%',
                borderRadius: 5
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            maintainAspectRatio: false,
            responsive: true
        }
    });
}

// Fetch all transactions from backend
async function fetchTransactions() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Failed to fetch transactions');
        
        const transactions = await response.json();
        renderDashboard(transactions);
    } catch (error) {
        console.error('Error fetching data:', error);
        showToast('Could not load data. Check backend.', 'error');
    }
}

// Main Render Function
function renderDashboard(transactions) {
    // 1. Calculate Stats
    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
        if (t.type === 'INCOME') income += t.amount;
        else expense += t.amount;
    });

    const balance = income - expense;

    // 2. Update Stats UI
    totalIncomeEl.textContent = income.toLocaleString();
    totalExpenseEl.textContent = expense.toLocaleString();
    totalBalanceEl.textContent = balance.toLocaleString();
    chartBalanceEl.textContent = balance.toLocaleString();
    legendIncomeEl.textContent = income.toLocaleString();
    legendExpenseEl.textContent = expense.toLocaleString();

    // 3. Update Chart
    balanceChart.data.datasets[0].data = [income, expense];
    // If no data, show a placeholder
    if (income === 0 && expense === 0) {
        balanceChart.data.datasets[0].data = [1, 1]; // Visual placeholder
        balanceChart.data.datasets[0].backgroundColor = ['#e2e8f0', '#e2e8f0'];
    } else {
        balanceChart.data.datasets[0].backgroundColor = ['#10b981', '#ef4444'];
    }
    balanceChart.update();

    // 4. Render Transaction List
    renderList(transactions);
}

// Render Transaction List items
function renderList(transactions) {
    transactionList.innerHTML = '';
    
    if (transactions.length === 0) {
        emptyStateEl.classList.remove('hidden');
        return;
    }
    
    emptyStateEl.classList.add('hidden');
    
    // Sort transactions by date (descending)
    const sorted = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(t => {
        const li = document.createElement('li');
        li.className = 'transaction-item';
        
        const iconClass = getCategoryIcon(t.category);
        const amountPrefix = t.type === 'INCOME' ? '+' : '-';
        const formattedAmount = `${amountPrefix}₹${t.amount.toLocaleString()}`;
        
        li.innerHTML = `
            <div class="icon-box ${t.category.toLowerCase()}">
                <i class="ph-fill ph-${iconClass}"></i>
            </div>
            <div class="item-details">
                <div class="item-title">${escapeHTML(t.title)}</div>
                <div class="item-meta">${t.category} • ${formatDate(t.date)}</div>
            </div>
            <div class="item-amount ${t.type}">${formattedAmount}</div>
            <button class="btn-delete" title="Delete" onclick="deleteTransaction(${t.id})">
                <i class="ph ph-trash"></i>
            </button>
        `;

        transactionList.appendChild(li);
    });
}

// Helper: Get Icon based on category
function getCategoryIcon(category) {
    const mapping = {
        'Food': 'hamburger',
        'Transport': 'car',
        'Salary': 'bank',
        'Entertainment': 'popcorn',
        'Bills': 'receipt',
        'Other': 'dots-three-circle'
    };
    return mapping[category] || 'question';
}

// Add new transaction
async function handleAddTransaction(e) {
    e.preventDefault();
    
    const title = document.getElementById('title').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;
    const type = document.querySelector('input[name="type"]:checked').value;

    const data = { title, amount, category, date, type };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Failed to add transaction');
        
        expenseForm.reset();
        modal.classList.add('hidden');
        showToast('Transaction added successfully!', 'success');
        fetchTransactions();
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to add transaction', 'error');
    }
}

// Delete transaction initiation
function deleteTransaction(id) {
    transactionIdToDelete = id;
    deleteModal.classList.remove('hidden');
}

// Handle actual deletion
async function handleConfirmDelete() {
    if (!transactionIdToDelete) return;
    
    try {
        const response = await fetch(`${API_URL}/${transactionIdToDelete}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete');
        
        showToast('Transaction deleted', 'success');
        closeDeleteModal();
        fetchTransactions();
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to delete transaction', 'error');
        closeDeleteModal();
    }
}

// Close delete modal
function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    transactionIdToDelete = null;
}

// Utility: Show Toast Message
function showToast(msg, type) {
    toastMessage.textContent = msg;
    toastMessage.className = `toast show ${type}`;
    setTimeout(() => {
        toastMessage.classList.remove('show');
    }, 3000);
}

// Utility: Format Date
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Utility: Escape HTML
function escapeHTML(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}
