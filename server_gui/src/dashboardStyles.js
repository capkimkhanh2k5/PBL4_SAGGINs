// All styles in one object
export const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(to bottom right, #111827, #1e3a8a, #111827)',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '20px',
    overflowY: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    padding: '20px',
    background: 'rgba(0, 0, 0, 0.4)',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    backdropFilter: 'blur(10px)'
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#93c5fd'
  },
  stats: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center'
  },
  statItem: {
    fontSize: '14px',
    color: '#bfdbfe',
    padding: '8px 16px',
    background: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '6px',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  mainContent: {
    maxWidth: '1600px',
    margin: '0 auto'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '20px'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(59, 130, 246, 0.3)',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  warningBanner: {
    padding: '16px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#fca5a5',
    marginBottom: '20px',
    fontSize: '14px'
  },
  tabsContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    borderBottom: '1px solid rgba(59, 130, 246, 0.3)',
    paddingBottom: '16px',
    flexWrap: 'wrap'
  },
  tabButton: {
    padding: '10px 20px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: '14px'
  },
  tabButtonActive: {
    background: 'rgba(59, 130, 246, 0.3)',
    border: '1px solid #3b82f6',
    color: '#93c5fd'
  },
  searchContainer: {
    marginBottom: '20px',
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  searchInput: {
    flex: 1,
    padding: '10px 12px',
    background: 'rgba(31, 41, 55, 0.6)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '14px'
  },
  searchCount: {
    color: '#9ca3af',
    fontSize: '12px'
  },
  tableWrapper: {
    background: 'rgba(31, 41, 55, 0.6)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    background: 'rgba(59, 130, 246, 0.1)',
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
    cursor: 'pointer',
    userSelect: 'none',
    fontWeight: '600',
    color: '#bfdbfe'
  },
  thCenter: {
    textAlign: 'center',
    padding: '12px',
    background: 'rgba(59, 130, 246, 0.1)',
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
    cursor: 'pointer',
    userSelect: 'none',
    fontWeight: '600',
    color: '#bfdbfe'
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid rgba(75, 85, 99, 0.2)',
    color: '#d1d5db',
    fontSize: '13px'
  },
  tdCenter: {
    padding: '12px',
    borderBottom: '1px solid rgba(75, 85, 99, 0.2)',
    color: '#d1d5db',
    fontSize: '13px',
    textAlign: 'center'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px'
  },
  statCard: {
    background: 'rgba(31, 41, 55, 0.6)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '8px',
    padding: '20px'
  },
  statCardTitle: {
    color: '#9ca3af',
    fontSize: '12px',
    marginBottom: '8px',
    textTransform: 'uppercase'
  },
  statCardValue: {
    color: '#93c5fd',
    fontSize: '28px',
    fontWeight: 'bold',
    margin: '0'
  },
  statCardUnit: {
    color: '#6b7280',
    fontSize: '11px',
    marginTop: '6px'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600'
  },
  statusSatisfied: {
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#10b981'
  },
  statusUnsatisfied: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444'
  },
  utilBarContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'center'
  },
  utilBarTrack: {
    width: '80px',
    height: '6px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '3px',
    overflow: 'hidden'
  },
  utilBarFill: {
    height: '100%',
    transition: 'width 0.3s ease'
  },
  utilBarText: {
    fontSize: '12px',
    fontWeight: '600',
    minWidth: '30px'
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px'
  },
  detailLabel: {
    color: '#9ca3af',
    fontSize: '11px',
    marginBottom: '4px',
    textTransform: 'uppercase'
  },
  detailValue: {
    margin: '0',
    fontWeight: '600'
  },
  detailSubtext: {
    margin: '4px 0 0 0',
    fontSize: '11px'
  },
  expandButton: {
    background: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    color: '#93c5fd',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '6px 12px',
    borderRadius: '4px',
    fontWeight: '600',
    transition: 'all 0.2s'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
    backdropFilter: 'blur(4px)'
  },
  modalContent: {
    background: 'linear-gradient(to bottom right, #1f2937, #1e3a8a)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '12px',
    maxWidth: '900px',
    maxHeight: '90vh',
    width: '100%',
    overflow: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(59, 130, 246, 0.3)',
    position: 'sticky',
    top: 0,
    background: 'rgba(31, 41, 55, 0.95)',
    backdropFilter: 'blur(10px)',
    zIndex: 1
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#93c5fd'
  },
  modalCloseButton: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: '1',
    transition: 'color 0.2s'
  },
  modalBody: {
    padding: '24px'
  },
  timeoutContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    alignItems: 'center'
  },
  timeoutText: {
    fontSize: '11px',
    color: '#9ca3af'
  },
  timeoutValue: {
    fontSize: '11px',
    color: '#bfdbfe',
    fontWeight: '600'
  },
  timeoutSection: {
    marginTop: '20px',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '6px'
  },
  timeoutSectionTitle: {
    margin: '0 0 8px 0',
    color: '#bfdbfe',
    fontSize: '12px',
    textTransform: 'uppercase'
  },
  timeoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px'
  },
  pathSection: {
    marginTop: '20px'
  },
  pathTitle: {
    margin: '0 0 12px 0',
    color: '#bfdbfe',
    fontSize: '13px',
    textTransform: 'uppercase'
  },
  pathGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px'
  },
  pathNodeCard: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '6px',
    padding: '12px',
    position: 'relative'
  },
  pathNodeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pathNodeId: {
    color: '#93c5fd',
    fontSize: '12px',
    fontWeight: '600',
    margin: '0'
  },
  pathNodeBadge: {
    color: '#6b7280',
    fontSize: '10px',
    background: 'rgba(59, 130, 246, 0.2)',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  pathNodeRole: {
    color: '#9ca3af',
    fontSize: '11px',
    margin: '4px 0 0 0'
  },
  comparisonChartContainer: {
    padding: '8px 0',
  },
  compBarWrapper: {
    marginBottom: '20px',
  },
  compBarLabel: {
    margin: '0 0 8px 0',
    fontSize: '13px',
    color: '#e5e7eb',
    fontWeight: '500',
  },
  compBarRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '5px',
  },
  compBarAgentLabel: {
    color: '#9ca3af',
    fontSize: '11px',
    width: '60px',
    paddingRight: '10px',
    textAlign: 'right',
  },
  compBarTrack: {
    flex: 1,
    height: '22px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '4px',
    position: 'relative',
    overflow: 'hidden',
  },
  compBarFill: {
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    transition: 'width 0.4s ease-out',
    borderRight: '1px solid rgba(255, 255, 255, 0.2)',
  },
  compBarRequiredLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '2px',
    background: 'rgba(245, 158, 11, 0.9)',
    boxShadow: '0 0 3px rgba(0,0,0,0.8)',
    zIndex: 1,
  },
  compBarValueText: {
    position: 'absolute',
    left: '6px',
    top: '3px',
    fontSize: '11px',
    fontWeight: '600',
    textShadow: '0 0 4px rgba(0,0,0,0.8)',
    zIndex: 2,
    color: 'white',
  },
};