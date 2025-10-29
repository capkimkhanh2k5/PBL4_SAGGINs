const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    background: 'linear-gradient(to bottom right, #111827, #1e3a8a, #111827)',
    color: 'white',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  sidebar: {
    width: '320px',
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(12px)',
    padding: '16px',
    overflowY: 'auto',
    borderRight: '1px solid rgba(59, 130, 246, 0.3)'
  },
  header: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#93c5fd'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: '#bfdbfe',
    fontWeight: '600'
  },
  select: {
    width: '100%',
    padding: '8px',
    background: '#111827',
    borderRadius: '4px',
    border: '1px solid rgba(59, 130, 246, 0.5)',
    color: 'white',
    fontSize: '14px'
  },
  checkboxContainer: {
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    transition: 'color 0.2s'
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer'
  },
  requestsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#bfdbfe'
  },
  requestCard: {
    background: 'rgba(31, 41, 55, 0.5)',
    padding: '12px',
    borderRadius: '4px',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  requestHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px'
  },
  requestType: {
    fontWeight: 'bold',
    fontSize: '14px'
  },
  requestCoords: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  statusBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: '600'
  },
  statusConnected: {
    background: '#059669',
    color: '#ffffff'
  },
  statusPending: {
    background: '#d97706',
    color: '#ffffff'
  },
  requestInfo: {
    fontSize: '12px',
    color: '#d1d5db',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(75, 85, 99, 0.3)',
    borderTop: '1px solid rgba(75, 85, 99, 0.3)',
    paddingTop: '8px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  infoButton: {
    flex: 1,
    padding: '8px 12px',
    background: 'linear-gradient(to right, #3b82f6, #2563eb)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px'
  },
  clearButton: {
    flex: 1,
    padding: '8px 12px',
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px'
  },
  timeRemaining: {
    fontSize: '12px',
    color: '#9ca3af',
    paddingLeft: '8px',
    whiteSpace: 'nowrap'
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
  },
  modalContent: {
    background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '24px',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)'
  },
  modalTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: '600'
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: '28px',
    cursor: 'pointer',
    padding: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s'
  },
  infoBox: {
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  infoRowLast: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  infoLabel: {
    color: '#9ca3af',
    fontSize: '12px'
  },
  infoValue: {
    color: '#3b82f6',
    fontSize: '12px',
    fontWeight: '500'
  },
  sectionHeader: {
    color: '#e5e7eb',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
    marginTop: '16px'
  },
  detailBox: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '16px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  detailBoxFull: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '16px'
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column'
  },
  detailItemLabel: {
    color: '#9ca3af',
    fontSize: '11px',
    marginBottom: '4px'
  },
  detailItemValue: {
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '500'
  },
  qosTable: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '6px',
    overflow: 'hidden',
    marginBottom: '16px'
  },
  qosTableHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    borderBottom: '1px solid rgba(75, 85, 99, 0.3)',
    padding: '10px 12px',
    background: 'rgba(59, 130, 246, 0.1)'
  },
  qosTableHeaderCell: {
    color: '#9ca3af',
    fontSize: '11px',
    fontWeight: '600'
  },
  qosTableHeaderCellCenter: {
    textAlign: 'center'
  },
  qosTableHeaderCellRight: {
    textAlign: 'right'
  },
  qosTableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    borderBottom: '1px solid rgba(75, 85, 99, 0.2)',
    padding: '10px 12px',
    alignItems: 'center'
  },
  qosTableRowNotSatisfied: {
    background: 'rgba(239, 68, 68, 0.05)'
  },
  qosTableCell: {
    color: '#d1d5db',
    fontSize: '12px'
  },
  qosTableCellCenter: {
    textAlign: 'center',
    color: '#9ca3af'
  },
  qosTableCellRight: {
    textAlign: 'right',
    fontWeight: '500'
  },
  qosTableCellSuccess: {
    color: '#10b981'
  },
  qosTableCellError: {
    color: '#ef4444'
  },
  qosTableCellNA: {
    color: '#6b7280'
  },
  pathText: {
    color: '#d1d5db',
    fontSize: '12px',
    wordBreak: 'break-all',
    lineHeight: '1.6'
  },
  modalCloseButton: {
    width: '100%',
    marginTop: '16px',
    padding: '10px 16px',
    background: 'linear-gradient(to right, #3b82f6, #2563eb)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  inputGroup: {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginBottom: '16px'
  },
  input: {
    width: '100%',
    padding: '8px',
    background: 'rgba(31, 41, 55, 0.7)',
    borderRadius: '4px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    color: 'white',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  button: {
    width: '100%',
    background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    color: 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
  },
  pathsSection: {
    marginBottom: '24px'
  },
  pathCard: {
    background: 'rgba(31, 41, 55, 0.5)',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '8px',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  pathHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pathId: {
    fontWeight: 'bold',
    fontSize: '14px'
  },
  pathNodes: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  pathButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontWeight: '600'
  },
  pathButtonActive: {
    background: '#059669'
  },
  pathButtonInactive: {
    background: '#4b5563'
  },
  visualizerContainer: {
    flex: '1',
    position: 'relative'
  },
  canvas: {
    width: '100%',
    height: '100%'
  },
  legend: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(12px)',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  legendTitle: {
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#bfdbfe'
  },
  legendItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '14px'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  legendDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%'
  },
  controls: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(12px)',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    fontSize: '12px',
    color: '#d1d5db'
  },
};

export { styles };