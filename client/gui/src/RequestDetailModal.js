import React, { useState } from 'react';
import { X, Info } from 'lucide-react';
import { styles } from './NetworkVisualizer.styles';

// Detail Modal Component
export function RequestDetailModal({ request, onClose }) {
  if (!request) return null;

  const timeRemaining = request.connectedAt 
    ? Math.max(0, request.demand_timeout - (Date.now() - request.connectedAt) / 1000)
    : request.demand_timeout;

  const allocated = request.allocated || {};

  const qosComparison = [
    { label: 'Uplink (Mbps)', required: request.uplink, actual: allocated.uplink },
    { label: 'Downlink (Mbps)', required: request.downlink, actual: allocated.downlink },
    { label: 'Latency (ms)', required: request.latency, actual: allocated.latency },
    { label: 'Reliability', required: request.reliability, actual: allocated.reliability },
    { label: 'CPU (cores)', required: request.cpu, actual: allocated.cpu },
    { label: 'Power (W)', required: request.power, actual: allocated.power },
  ];

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Request Details</h2>
          <button
            onClick={onClose}
            style={styles.closeButton}
            onMouseEnter={(e) => e.currentTarget.style.color = '#d1d5db'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
          >
            <X size={24} />
          </button>
        </div>

        {/* Request ID and Status */}
        <div style={styles.infoBox}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Request ID</span>
            <span style={styles.infoValue}>{request.id}</span>
          </div>
          <div style={styles.infoRowLast}>
            <span style={styles.infoLabel}>Status</span>
            <span style={{
              ...styles.infoValue,
              color: request.status === 'connected' ? '#10b981' : '#f59e0b'
            }}>
              {request.status}
            </span>
          </div>
        </div>

        {/* Source Location */}
        <h3 style={styles.sectionHeader}>Source Location</h3>
        <div style={styles.detailBox}>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>Latitude</div>
            <div style={styles.detailItemValue}>{request.lat.toFixed(4)}°</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>Longitude</div>
            <div style={styles.detailItemValue}>{request.lon.toFixed(4)}°</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>Altitude</div>
            <div style={styles.detailItemValue}>{request.alt ? `${request.alt.toFixed(1)} m` : '0 m'}</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>Priority</div>
            <div style={styles.detailItemValue}>{request.priority}</div>
          </div>
        </div>

        {/* QoS Comparison */}
        <h3 style={styles.sectionHeader}>Quality of Service</h3>
        <div style={styles.qosTable}>
          <div style={styles.qosTableHeader}>
            <div style={styles.qosTableHeaderCell}>Parameter</div>
            <div style={{...styles.qosTableHeaderCell, ...styles.qosTableHeaderCellCenter}}>Required</div>
            <div style={{...styles.qosTableHeaderCell, ...styles.qosTableHeaderCellRight}}>Actual</div>
          </div>
          {qosComparison.map((item, idx) => {
            const isSatisfied = item.actual !== undefined && 
              (item.label.includes('Latency') ? item.actual <= item.required : item.actual >= item.required);
            
            return (
              <div
                key={idx}
                style={{
                  ...styles.qosTableRow,
                  ...(isSatisfied === false ? styles.qosTableRowNotSatisfied : {})
                }}
              >
                <div style={styles.qosTableCell}>{item.label}</div>
                <div style={{...styles.qosTableCell, ...styles.qosTableCellCenter}}>
                  {item.required !== undefined ? (
                    typeof item.required === 'number' && item.required < 1
                      ? item.required.toFixed(4)
                      : item.required.toFixed(2)
                  ) : '—'}
                </div>
                <div style={{
                  ...styles.qosTableCell,
                  ...styles.qosTableCellRight,
                  ...((item.actual !== undefined) ? (
                    isSatisfied ? styles.qosTableCellSuccess : styles.qosTableCellError
                  ) : styles.qosTableCellNA)
                }}>
                  {item.actual !== undefined
                    ? (typeof item.actual === 'number' && item.actual < 1
                        ? item.actual.toFixed(4)
                        : item.actual.toFixed(2))
                    : '—'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeout and Duration */}
        <h3 style={styles.sectionHeader}>Timeout & Duration</h3>
        <div style={styles.detailBox}>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>Total Timeout</div>
            <div style={styles.detailItemValue}>
              {request.demand_timeout ? `${request.demand_timeout.toFixed(1)} s` : '—'}
            </div>
          </div>
          {request.connectedAt && (
            <div style={styles.detailItem}>
              <div style={styles.detailItemLabel}>Time Remaining</div>
              <div style={{
                ...styles.detailItemValue,
                color: timeRemaining > 10 ? '#10b981' : timeRemaining > 0 ? '#f59e0b' : '#ef4444'
              }}>
                {timeRemaining.toFixed(1)} s
              </div>
            </div>
          )}
        </div>

        {/* Allocated Path */}
        {allocated.path && (
          <>
            <h3 style={styles.sectionHeader}>Allocated Path</h3>
            <div style={styles.detailBoxFull}>
              <div style={styles.pathText}>
                {Array.isArray(allocated.path) ? allocated.path.join(' → ') : allocated.path}
              </div>
            </div>
          </>
        )}

        {/* Additional Info */}
        <h3 style={styles.sectionHeader}>Additional Information</h3>
        <div style={styles.detailBox}>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>Packet Size</div>
            <div style={styles.detailItemValue}>{request.packet_size} bytes</div>
          </div>
          <div style={styles.detailItem}>
            <div style={styles.detailItemLabel}>5G Support</div>
            <div style={styles.detailItemValue}>{request.support5G ? 'Yes' : 'No'}</div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={styles.modalCloseButton}
          onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #1d4ed8)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3b82f6, #2563eb)'}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Demo Component showing updated request card with info button
// export default function RequestCardDemo() {
//   const [selectedRequest, setSelectedRequest] = useState(null);

//   // Sample request with allocated data
//   const sampleRequest = {
//     id: 'req_a1b2c3d4',
//     type: 2,
//     lat: 22.3193,
//     lon: 114.1694,
//     alt: 500,
//     uplink: 2.5,
//     downlink: 8.0,
//     latency: 75,
//     reliability: 0.95,
//     cpu: 20,
//     power: 40,
//     packet_size: 64,
//     priority: 4,
//     demand_timeout: 120,
//     support5G: true,
//     status: 'connected',
//     connectedAt: Date.now() - 30000,
//     allocated: {
//       uplink: 2.5,
//       downlink: 7.8,
//       latency: 72,
//       reliability: 0.96,
//       cpu: 20,
//       power: 38,
//       path: ['req_a1b2c3d4', 'LEO-41', 'GS_HCM']
//     }
//   };

//   const timeRemaining = sampleRequest.connectedAt 
//     ? Math.max(0, sampleRequest.demand_timeout - (Date.now() - sampleRequest.connectedAt) / 1000)
//     : sampleRequest.demand_timeout;

//   return (
//     <div style={styles.container}>
//       <div style={styles.sidebar}>
//         <h1 style={styles.header}>Demo: Request Card</h1>
//         <div style={styles.requestsSection}>
//           <h2 style={styles.sectionTitle}>Requests (1)</h2>
//           <div style={styles.requestCard}>
//             <div style={styles.requestHeader}>
//               <div>
//                 <div style={styles.requestType}>Video : {sampleRequest.id}</div>
//                 <div style={styles.requestCoords}>
//                   {sampleRequest.lat.toFixed(2)}, {sampleRequest.lon.toFixed(2)}
//                 </div>
//               </div>
//               <span style={{...styles.statusBadge, ...styles.statusConnected}}>
//                 {sampleRequest.status}
//               </span>
//             </div>

//             <div style={styles.requestInfo}>
//               BW: {sampleRequest.uplink}/{sampleRequest.downlink} Mbps | Lat: {sampleRequest.latency}ms
//             </div>

//             <div style={styles.buttonGroup}>
//               <button
//                 onClick={() => setSelectedRequest(sampleRequest)}
//                 style={styles.infoButton}
//                 onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #1d4ed8)'}
//                 onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3b82f6, #2563eb)'}
//               >
//                 <Info size={14} />
//                 Info
//               </button>
//               <button
//                 style={styles.clearButton}
//                 onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
//                 onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
//               >
//                 Clear
//               </button>
//               {sampleRequest.status === 'connected' && sampleRequest.connectedAt && (
//                 <span style={styles.timeRemaining}>
//                   {timeRemaining.toFixed(1)}s
//                 </span>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>
//       <RequestDetailModal
//         request={selectedRequest}
//         onClose={() => setSelectedRequest(null)}
//       />
//     </div>
//   );
// }