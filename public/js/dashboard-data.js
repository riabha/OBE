/**
 * Loads real university data from /api/dashboard/overview for role dashboards.
 */
let _dashboardOverview = null;

const DashboardData = {
    async load(force = false) {
        if (_dashboardOverview && !force) return _dashboardOverview;
        _dashboardOverview = await APIManager.get('/api/dashboard/overview');
        return _dashboardOverview;
    },

    get() {
        return _dashboardOverview;
    },

    clear() {
        _dashboardOverview = null;
    },

    fmtDate(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString();
    },

    gradeColor(grade) {
        if (!grade) return 'secondary';
        const g = String(grade).toUpperCase();
        if (g.startsWith('A+') || g === 'A') return 'success';
        if (g.startsWith('A') || g.startsWith('B+')) return 'primary';
        if (g.startsWith('B')) return 'info';
        if (g.startsWith('C')) return 'warning';
        return 'danger';
    },

    statusColor(status) {
        if (status === 'Completed') return 'success';
        if (status === 'Pending') return 'warning';
        if (status === 'In Progress') return 'primary';
        return 'secondary';
    },

    performanceFromPct(pct) {
        if (pct >= 85) return 'Excellent';
        if (pct >= 70) return 'Good';
        if (pct >= 50) return 'Average';
        return 'At Risk';
    },

    performanceColor(p) {
        if (p === 'Excellent') return 'success';
        if (p === 'Good') return 'primary';
        if (p === 'Average') return 'warning';
        return 'danger';
    },

    destroyChart(chart) {
        if (chart && typeof chart.destroy === 'function') chart.destroy();
    },

    makeBarChart(canvasId, labels, data, label, colors) {
        const el = document.getElementById(canvasId);
        if (!el || typeof Chart === 'undefined') return null;
        return new Chart(el.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label,
                    data,
                    backgroundColor: colors || '#3b82f6'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    },

    makeDoughnutChart(canvasId, labels, data, colors) {
        const el = document.getElementById(canvasId);
        if (!el || typeof Chart === 'undefined') return null;
        return new Chart(el.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data, backgroundColor: colors || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    },

    makeLineChart(canvasId, labels, datasets) {
        const el = document.getElementById(canvasId);
        if (!el || typeof Chart === 'undefined') return null;
        return new Chart(el.getContext('2d'), {
            type: 'line',
            data: { labels, datasets },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    },

    async initForRole(role, onReady) {
        if (!AuthManager.requireRole(role)) return;
        try {
            const data = await DashboardData.load();
            window.__dashboardData = data;
            if (typeof onReady === 'function') onReady(data);
        } catch (err) {
            console.error('Dashboard data load failed:', err);
            NotificationManager.error('Failed to load dashboard data: ' + err.message);
        }
    }
};

window.DashboardData = DashboardData;
window.__dashboardData = null;
