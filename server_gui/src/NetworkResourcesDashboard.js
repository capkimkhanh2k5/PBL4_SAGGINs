import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { styles } from './dashboardStyles';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer,
      LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip
    } from 'recharts';

export default function NetworkResourcesDashboard() {
  const [envData, setEnvData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });

  useEffect(() => {
    const fetchEnvResources = async () => {
      try {
        setError(null);
        const response = await fetch('http://localhost:8000/getenvresources');
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        const data = await response.json();
        setEnvData(data);
        setLastUpdate(new Date());
        setLoading(false);
      } catch (err) {
        console.error('Error fetching resources:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchEnvResources();
    const interval = setInterval(fetchEnvResources, 3000);
    return () => clearInterval(interval);
  }, []);

  const getResourceUtilization = (used, total) => {
    if (total === 0) return 0;
    return Math.round((used / total) * 100);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p>Loading environment resources...</p>
        </div>
      </div>
    );
  }

  if (!envData) return null;

  const satellites = envData?.nodes?.filter(n => n.type === 'satellite') || [];
  const groundStations = envData?.nodes?.filter(n => n.type === 'groundstation') || [];
  const seaStations = envData?.nodes?.filter(n => n.type === 'seastation') || [];
  const connections = envData?.connections || [];

  const getFilteredAndSortedNodes = (nodes) => {
    let filtered = nodes.filter(n => 
      n.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aVal, bVal;

      if (sortConfig.key === 'uplink_util') {
        aVal = getResourceUtilization(a.resources_used.uplink, a.resources.uplink);
        bVal = getResourceUtilization(b.resources_used.uplink, b.resources.uplink);
      } else if (sortConfig.key === 'downlink_util') {
        aVal = getResourceUtilization(a.resources_used.downlink, a.resources.downlink);
        bVal = getResourceUtilization(b.resources_used.downlink, b.resources.downlink);
      } else if (sortConfig.key === 'cpu_util') {
        aVal = getResourceUtilization(a.resources_used.cpu, a.resources.cpu);
        bVal = getResourceUtilization(b.resources_used.cpu, b.resources.cpu);
      } else if (sortConfig.key === 'power_util') {
        aVal = getResourceUtilization(a.resources_used.power, a.resources.power);
        bVal = getResourceUtilization(b.resources_used.power, b.resources.power);
      } else {
        aVal = a[sortConfig.key];
        bVal = b[sortConfig.key];
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getNodesForTab = () => {
    switch (activeTab) {
      case 'satellites':
        return getFilteredAndSortedNodes(satellites);
      case 'groundstations':
        return getFilteredAndSortedNodes(groundStations);
      case 'seastations':
        return getFilteredAndSortedNodes(seaStations);
      default:
        return [];
    }
  };

  const currentNodes = getNodesForTab();

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin-icon { animation: spin 2s linear infinite; }
        .expand-button:hover {
          background: rgba(59, 130, 246, 0.3) !important;
          border-color: #3b82f6 !important;
        }
        .modal-close-button:hover {
          color: #ffffff !important;
        }
      `}</style>

      <div style={styles.header}>
        <h1 style={styles.title}>Network Resources Dashboard</h1>
        <div style={styles.stats}>
          <div style={styles.statItem}>
            <span>Total Nodes: {envData?.nodes?.length || 0}</span>
          </div>
          <div style={styles.statItem}>
            <span>Last Update: {lastUpdate.toLocaleTimeString()}</span>
          </div>
          <RefreshCw size={20} className="spin-icon" style={{ color: '#3b82f6' }} />
        </div>
      </div>

      {error && (
        <div style={styles.warningBanner}>
          Error: {error}
        </div>
      )}

      <div style={styles.mainContent}>
        <div style={styles.tabsContainer}>
          {[
            { key: 'summary', label: 'Summary' },
            { key: 'aggregate', label: 'Aggregate Stats' },
            { key: 'satellites', label: `Satellites (${satellites.length})` },
            { key: 'groundstations', label: `Ground Stations (${groundStations.length})` },
            { key: 'seastations', label: `Sea Stations (${seaStations.length})` },
            { key: 'connections', label: `Connections (${connections.length})` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchTerm(''); }}
              style={{
                ...styles.tabButton,
                ...(activeTab === tab.key ? styles.tabButtonActive : {})
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(activeTab === 'satellites' || activeTab === 'groundstations' || activeTab === 'seastations') && (
          <div style={styles.searchContainer}>
            <Search size={18} style={{ color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search by node ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            <span style={styles.searchCount}>
              {currentNodes.length} results
            </span>
          </div>
        )}

        {activeTab === 'summary' && (
          <SummaryTab 
            satellites={satellites} 
            groundStations={groundStations} 
            seaStations={seaStations}
            connections={connections}
          />
        )}

        {activeTab === 'aggregate' && (
          <AggregateStatsTab/>
        )}

        {activeTab === 'connections' && (
          <ConnectionsTab 
            connections={connections}
            onSelectConnection={setSelectedConnection}
          />
        )}

        {(activeTab === 'satellites' || activeTab === 'groundstations' || activeTab === 'seastations') && (
          <NodesTable
            nodes={currentNodes}
            sortConfig={sortConfig}
            handleSort={handleSort}
            activeTab={activeTab}
            getResourceUtilization={getResourceUtilization}
            onSelectNode={setSelectedNode}
          />
        )}
      </div>

      {selectedNode && (
        <NodeModal
          node={selectedNode}
          activeTab={activeTab}
          getResourceUtilization={getResourceUtilization}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {selectedConnection && (
        <ConnectionModal
          connection={selectedConnection}
          onClose={() => setSelectedConnection(null)}
        />
      )}
    </div>
  );
}

function NodesTable({ nodes, sortConfig, handleSort, activeTab, getResourceUtilization, onSelectNode }) {
  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th} onClick={() => handleSort('id')}>
              ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
            </th>
            {activeTab === 'satellites' && (
              <th style={styles.th} onClick={() => handleSort('sat_type')}>
                Type {sortConfig.key === 'sat_type' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
              </th>
            )}
            <th style={styles.th}>Position</th>
            <th style={styles.thCenter} onClick={() => handleSort('uplink_util')}>
              Uplink {sortConfig.key === 'uplink_util' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
            </th>
            <th style={styles.thCenter} onClick={() => handleSort('downlink_util')}>
              Downlink {sortConfig.key === 'downlink_util' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
            </th>
            {activeTab === 'groundstations' && (
              <>
                <th style={styles.thCenter} onClick={() => handleSort('cpu_util')}>
                  CPU {sortConfig.key === 'cpu_util' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th style={styles.thCenter} onClick={() => handleSort('power_util')}>
                  Power {sortConfig.key === 'power_util' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
              </>
            )}
            <th style={styles.thCenter}>Details</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map(node => {
            const upUtil = getResourceUtilization(node.resources_used.uplink, node.resources.uplink);
            const downUtil = getResourceUtilization(node.resources_used.downlink, node.resources.downlink);
            const cpuUtil = activeTab === 'groundstations' ? getResourceUtilization(node.resources_used.cpu, node.resources.cpu) : 0;
            const powerUtil = activeTab === 'groundstations' ? getResourceUtilization(node.resources_used.power, node.resources.power) : 0;

            return (
              <tr key={node.id}>
                <td style={{ ...styles.td, fontWeight: '600', color: '#93c5fd' }}>{node.id}</td>
                {activeTab === 'satellites' && <td style={{ ...styles.td, fontSize: '12px', color: '#9ca3af' }}>{node.sat_type}</td>}
                <td style={{ ...styles.td, fontSize: '12px' }}>
                  {node.position.lat.toFixed(2)}°, {node.position.lon.toFixed(2)}°
                </td>
                <td style={styles.tdCenter}>
                  <UtilBar util={upUtil} />
                </td>
                <td style={styles.tdCenter}>
                  <UtilBar util={downUtil} />
                </td>
                {activeTab === 'groundstations' && (
                  <>
                    <td style={styles.tdCenter}>
                      <UtilBar util={cpuUtil} />
                    </td>
                    <td style={styles.tdCenter}>
                      <UtilBar util={powerUtil} />
                    </td>
                  </>
                )}
                <td style={styles.tdCenter}>
                  <button
                    onClick={() => onSelectNode(node)}
                    style={styles.expandButton}
                    className="expand-button"
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NodeModal({ node, activeTab, getResourceUtilization, onClose }) {
  const upUtil = getResourceUtilization(node.resources_used.uplink, node.resources.uplink);
  const downUtil = getResourceUtilization(node.resources_used.downlink, node.resources.downlink);
  const cpuUtil = activeTab === 'groundstations' ? getResourceUtilization(node.resources_used.cpu, node.resources.cpu) : 0;
  const powerUtil = activeTab === 'groundstations' ? getResourceUtilization(node.resources_used.power, node.resources.power) : 0;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{node.id} - Details</h3>
          <button 
            onClick={onClose} 
            style={styles.modalCloseButton}
            className="modal-close-button"
          >
            <X size={24} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.detailsGrid}>
            <div>
              <p style={styles.detailLabel}>Position</p>
              <p style={{ color: '#d1d5db', margin: '0', fontSize: '13px' }}>
                {node.position.lat.toFixed(4)}°, {node.position.lon.toFixed(4)}°
              </p>
              {node.position.alt && (
                <p style={{ color: '#9ca3af', margin: '4px 0 0 0', fontSize: '11px' }}>
                  Altitude: {(node.position.alt / 1000).toFixed(1)} km
                </p>
              )}
            </div>
            <ResourceDetail label="Uplink" used={node.resources_used.uplink} total={node.resources.uplink} unit="Mbps" util={upUtil} />
            <ResourceDetail label="Downlink" used={node.resources_used.downlink} total={node.resources.downlink} unit="Mbps" util={downUtil} />
            {activeTab === 'groundstations' && (
              <>
                <ResourceDetail label="CPU" used={node.resources_used.cpu} total={node.resources.cpu} unit="cores" util={cpuUtil} />
                <ResourceDetail label="Power" used={node.resources_used.power} total={node.resources.power} unit="W" util={powerUtil} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UtilBar({ util }) {
  const color = util < 50 ? '#10b981' : util < 75 ? '#f59e0b' : '#ef4444';
  return (
    <div style={styles.utilBarContainer}>
      <div style={styles.utilBarTrack}>
        <div style={{
          ...styles.utilBarFill,
          width: `${Math.min(util, 100)}%`,
          background: color
        }} />
      </div>
      <span style={{ ...styles.utilBarText, color }}>
        {util}%
      </span>
    </div>
  );
}

function ResourceDetail({ label, used, total, unit, util }) {
  const color = util < 50 ? '#10b981' : util < 75 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <p style={styles.detailLabel}>{label}</p>
      <p style={{ ...styles.detailValue, color }}>
        {used.toFixed(2)} / {total.toFixed(2)} {unit}
      </p>
      <p style={{ ...styles.detailSubtext, color }}>
        {util}% utilized
      </p>
    </div>
  );
}

function SummaryTab({ satellites, groundStations, seaStations, connections }) {
  const allNodes = [...satellites, ...groundStations, ...seaStations];
  
  const avgUplink = allNodes.length > 0 
    ? (allNodes.reduce((sum, n) => sum + n.resources_used.uplink, 0) / allNodes.length).toFixed(2)
    : 0;
  const avgDownlink = allNodes.length > 0
    ? (allNodes.reduce((sum, n) => sum + n.resources_used.downlink, 0) / allNodes.length).toFixed(2)
    : 0;

  const totalUplink = allNodes.reduce((sum, n) => sum + n.resources_used.uplink, 0).toFixed(2);
  const totalDownlink = allNodes.reduce((sum, n) => sum + n.resources_used.downlink, 0).toFixed(2);
  
  const gsAvgCpu = groundStations.length > 0
    ? (groundStations.reduce((sum, n) => sum + n.resources_used.cpu, 0) / groundStations.length).toFixed(2)
    : 0;
  const gsAvgPower = groundStations.length > 0
    ? (groundStations.reduce((sum, n) => sum + n.resources_used.power, 0) / groundStations.length).toFixed(2)
    : 0;

  const satisfiedConnections = connections.filter(conn => {
    const upSat = conn.uplink_allocated >= conn.uplink_required;
    const downSat = conn.downlink_allocated >= conn.downlink_required;
    const latSat = conn.latency_actual <= conn.latency_required;
    const relSat = conn.reliability_actual >= conn.reliability_required;
    return upSat && downSat && latSat && relSat;
  }).length;

  return (
    <div style={styles.summaryGrid}>
      <StatCard title="Total Nodes" value={allNodes.length} unit="nodes" />
      <StatCard title="Satellites" value={satellites.length} unit="LEO/MEO/GEO" />
      <StatCard title="Ground Stations" value={groundStations.length} unit="stations" />
      <StatCard title="Sea Stations" value={seaStations.length} unit="stations" />
      <StatCard title="Active Connections" value={connections.length} unit="requests" />
      <StatCard 
        title="QoS Satisfied" 
        value={`${satisfiedConnections}/${connections.length}`} 
        unit={`(${connections.length > 0 ? Math.round(satisfiedConnections / connections.length * 100) : 0}%)`}
      />
      <StatCard title="Avg Uplink" value={avgUplink} unit="Mbps" />
      <StatCard title="Avg Downlink" value={avgDownlink} unit="Mbps" />
      <StatCard title="Total Uplink Used" value={totalUplink} unit="Mbps" />
      <StatCard title="Total Downlink Used" value={totalDownlink} unit="Mbps" />
      <StatCard title="Avg GS CPU" value={gsAvgCpu} unit="cores" />
      <StatCard title="Avg GS Power" value={gsAvgPower} unit="W" />
    </div>
  );
}

function StatCard({ title, value, unit, style, align = 'left' }) {
  return (
    <div style={{
                  ...styles.statCard,
                   ...style,
                   ...(align === 'center' && {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    })
                   }}>
      <p style={styles.statCardTitle}>{title}</p>
      <p style={styles.statCardValue}>{value}</p>
      <p style={styles.statCardUnit}>{unit}</p>
    </div>
  );
}

function ConnectionsTab({ connections, onSelectConnection }) {
  const ServiceTypeNames = {
    1: 'Voice', 2: 'Video', 3: 'Data', 4: 'IoT',
    5: 'Streaming', 6: 'Bulk Transfer', 7: 'Control', 8: 'Emergency'
  };

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Request ID</th>
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Source</th>
            <th style={styles.thCenter}>Priority</th>
            <th style={styles.thCenter}>Timeout</th>
            <th style={styles.thCenter}>Status</th>
            <th style={styles.thCenter}>Details</th>
          </tr>
        </thead>
        <tbody>
          {connections.map((conn, idx) => {
            const upSat = conn.uplink_allocated >= conn.uplink_required;
            const downSat = conn.downlink_allocated >= conn.downlink_required;
            const latSat = conn.latency_actual <= conn.latency_required;
            const relSat = conn.reliability_actual >= conn.reliability_required;
            const allSat = upSat && downSat && latSat && relSat;

            return (
              <tr key={idx}>
                <td style={{ ...styles.td, fontWeight: '600', color: '#93c5fd' }}>{conn.id}</td>
                <td style={styles.td}>{ServiceTypeNames[conn.type] || 'Unknown'}</td>
                <td style={styles.td}>
                  {conn.source_location.lat.toFixed(2)}°, {conn.source_location.lon.toFixed(2)}°
                </td>
                <td style={{ ...styles.tdCenter, fontWeight: '600', color: '#93c5fd' }}>
                  {conn.priority}
                </td>
                <td style={styles.tdCenter}>
                  <div style={styles.timeoutContainer}>
                    <span style={styles.timeoutText}>
                      Demand: {conn.timeout_demand?.toFixed(1) || 'N/A'}s
                    </span>
                    <span style={styles.timeoutValue}>
                      Real: {conn.real_timeout?.toFixed(1) || 'N/A'}s
                    </span>
                  </div>
                </td>
                <td style={styles.tdCenter}>
                  <span style={{
                    ...styles.statusBadge,
                    ...(allSat ? styles.statusSatisfied : styles.statusUnsatisfied)
                  }}>
                    {allSat ? '✓ Satisfied' : '✗ Unsatisfied'}
                  </span>
                </td>
                <td style={styles.tdCenter}>
                  <button
                    onClick={() => onSelectConnection(conn)}
                    style={styles.expandButton}
                    className="expand-button"
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConnectionModal({ connection, onClose }) {
  const [envData, setEnvData] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/getenvresources')
      .then(r => r.json())
      .then(data => setEnvData(data))
      .catch(err => console.error('Error fetching node data:', err));
  }, []);

  const upSat = connection.uplink_allocated >= connection.uplink_required;
  const downSat = connection.downlink_allocated >= connection.downlink_required;
  const latSat = connection.latency_actual <= connection.latency_required;
  const relSat = connection.reliability_actual >= connection.reliability_required;
  const cpuSat = connection.cpu_allocated >= connection.cpu_required;
  const powerSat = connection.power_allocated >= connection.power_required;


  const disQoS = connection.dis_QoS;

  const disupSat = disQoS?.uplink >= connection.uplink_required;
  const disdownSat = disQoS?.downlink >= connection.downlink_required;
  const dislatSat = disQoS?.latency <= connection.latency_required;
  const disrelSat = disQoS?.reliability >= connection.reliability_required;
  const discpuSat = disQoS?.cpu >= connection.cpu_required;
  const dispowerSat = disQoS?.power >= connection.power_required;



  
  const getNodeData = (nodeId) => {
    if (!envData || !envData.nodes) return null;
    return envData.nodes.find(n => n.id === nodeId);
  };

  const getResourceUtilization = (used, total) => {
    if (total === 0) return 0;
    return Math.round((used / total) * 100);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>QoS Details for {connection.id}</h3>
          <button 
            onClick={onClose} 
            style={styles.modalCloseButton}
            className="modal-close-button"
          >
            <X size={24} />
          </button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.detailsGrid}>
            <QoSDetail label="Uplink" required={connection.uplink_required} allocated={connection.uplink_allocated} unit="Mbps" isSatisfied={upSat} 
              dijkstraValue={disQoS?.uplink} />
            <QoSDetail label="Downlink" required={connection.downlink_required} allocated={connection.downlink_allocated} unit="Mbps" isSatisfied={downSat} 
              dijkstraValue={disQoS?.downlink} />
            <QoSDetail label="Latency" required={connection.latency_required} allocated={connection.latency_actual} unit="ms" isSatisfied={latSat} 
              dijkstraValue={disQoS?.latency} />
            <QoSDetail label="Reliability" required={connection.reliability_required} allocated={connection.reliability_actual} unit="" isSatisfied={relSat} 
              dijkstraValue={disQoS?.reliability} />
            <QoSDetail label="CPU" required={connection.cpu_required} allocated={connection.cpu_allocated} unit="cores" isSatisfied={cpuSat} 
              dijkstraValue={disQoS?.cpu} />
            <QoSDetail label="Power" required={connection.power_required} allocated={connection.power_allocated} unit="W" isSatisfied={powerSat} 
              dijkstraValue={disQoS?.power} />
          </div>

          <div style={styles.timeoutSection}>
            <h5 style={styles.timeoutSectionTitle}>
              Timeout Information
            </h5>
            <div style={styles.timeoutGrid}>
              <div>
                <p style={{ color: '#9ca3af', fontSize: '11px', margin: '0 0 4px 0' }}>Demand Timeout</p>
                <p style={{ color: '#93c5fd', fontSize: '14px', fontWeight: '600', margin: '0' }}>
                  {connection.timeout_demand?.toFixed(2) || 'N/A'} s
                </p>
              </div>
              <div>
                <p style={{ color: '#9ca3af', fontSize: '11px', margin: '0 0 4px 0' }}>Real Timeout</p>
                <p style={{ color: '#93c5fd', fontSize: '14px', fontWeight: '600', margin: '0' }}>
                  {connection.real_timeout?.toFixed(2) || 'N/A'} s
                </p>
              </div>
              <div>
                <p style={{ color: '#9ca3af', fontSize: '11px', margin: '0 0 4px 0' }}>Direct Sat Support</p>
                <p style={{ color: '#93c5fd', fontSize: '14px', fontWeight: '600', margin: '0' }}>
                  {connection.direct_sat_support ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </div>

          {/* Agent Path */}
          {connection.path && connection.path.length > 0 && (
            <div style={styles.pathSection}>
              <h5 style={styles.pathTitle}>
                Path ({connection.path.length} nodes): {connection.path.join(' → ')}
              </h5>
              <div style={styles.pathGrid}>
                {connection.path.map((nodeId, idx) => {
                  const nodeData = getNodeData(nodeId);
                  return (
                    <PathNodeInfoWithResources
                      key={`${nodeId}-${idx}`}
                      nodeId={nodeId}
                      index={idx}
                      totalNodes={connection.path.length}
                      nodeData={nodeData}
                      getResourceUtilization={getResourceUtilization}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Dijkstra Path */}
          {disQoS && connection.dis_path && connection.dis_path.length > 0 && (
            <div style={styles.pathSection}>
              <h5 style={styles.pathTitle}>
                Dijkstra path ({connection.dis_path.length} nodes): {connection.dis_path.join(' → ')}
              </h5>
              <p style={{...styles.detailLabel, fontSize: '11px', color: '#9ca3af', margin: '0 0 16px 0'}}>
                (Dijkstra execution time: {disQoS.dijkstra_time?.toFixed(4) || 'N/A'}s)
              </p>
              
              <div style={styles.pathGrid}>
                {connection.dis_path.map((nodeId, idx) => {
                  const nodeData = getNodeData(nodeId);
                  return (
                    <PathNodeInfoWithResources
                      key={`dijkstra-${nodeId}-${idx}`}
                      nodeId={nodeId}
                      index={idx}
                      totalNodes={connection.dis_path.length}
                      nodeData={nodeData}
                      getResourceUtilization={getResourceUtilization}
                    />
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Table compare per request */}
          <div style={styles.pathSection}>

            <h5 style={styles.pathTitle}>
              Table Compare QoS Per Request
            </h5>

            <div style={styles.comparisonChartContainer}>
              <QoSComparisonChart 
                label = "Uplink"
                unit = "Mbps"
                required = {connection.uplink_required}
                allocated = {connection.uplink_allocated}
                isSatisfied = {upSat}
                disAllocated = {disQoS?.uplink}
                disSatisfied = {disupSat}
              />
              
              <QoSComparisonChart
                label = "Downlink"
                unit = "Mbps"
                required = {connection.downlink_required}
                allocated = {connection.downlink_allocated}
                isSatisfied = {downSat}
                disAllocated = {disQoS?.downlink}
                disSatisfied = {disdownSat}
              />
              
              <QoSComparisonChart
                label = "Latency"
                unit = "ms"
                required = {connection.latency_required}
                allocated = {connection.latency_actual}
                isSatisfied = {latSat}
                disAllocated = {disQoS?.latency}
                disSatisfied = {dislatSat}
              />

              <QoSComparisonChart
                label = "Reliability"
                unit = ""
                required = {connection.reliability_required}
                allocated = {connection.reliability_actual}
                isSatisfied = {relSat}
                disAllocated = {disQoS?.reliability}
                disSatisfied = {disrelSat}
              />

              <QoSComparisonChart
                label = "CPU"
                unit = "cores"
                required = {connection.cpu_required}
                allocated = {connection.cpu_allocated}
                isSatisfied = {cpuSat}
                disAllocated = {disQoS?.cpu}
                disSatisfied = {discpuSat}
              />

              <QoSComparisonChart
                label = "Power"
                unit = "W"
                required = {connection.power_required}
                allocated = {connection.power_allocated}
                isSatisfied = {powerSat}
                disAllocated = {disQoS?.power}
                disSatisfied = {dispowerSat}
              />

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QoSComparisonChart({ label, unit, required, allocated, isSatisfied, disAllocated, disSatisfied }) {
  //handle variable 'undefined' or 'null'
  const safeAllocated = allocated ?? 0;
  const safeRequired = required ?? 0;
  const safeDisAllocated = disAllocated ?? 0;

  const requiredPosPercent = 80;

  //max chart
  let scaleMax;
  if(safeRequired > 0){
    scaleMax = safeRequired / (requiredPosPercent / 100);
  }
  else{
    scaleMax = Math.max(safeAllocated, safeRequired, safeDisAllocated, 1);
  }

  const width = (safeAllocated / scaleMax) * 100;
  const disWidth = (safeDisAllocated / scaleMax) * 100;

  // request finish line
  const requiredLineLeft = safeRequired > 0 ? requiredPosPercent : -100;
  
  const color = isSatisfied ? '#10b981' : '#ef4444';
  const disColor = disSatisfied ? '#10b981' : '#ef4444';

  const text = `${safeAllocated.toFixed(2)} ${unit} (${isSatisfied ? '✓' : '✗'})`;
  const disText = disAllocated !== undefined ? `${safeDisAllocated.toFixed(2)} ${unit} (${disSatisfied ? '✓' : '✗'})` : 'N/A';

  return (
    <div style={styles.compBarWrapper}>

      <p style={styles.compBarLabel}>
        {label} <span style={{color: '#f59e0b'}}> (Required: {required.toFixed(2)} {unit}) </span>
      </p>

      {/* Char for Agent */}
      <div style={styles.compBarRow}>
        <span style={styles.compBarAgentLabel}>Agent AI</span>
        
        <div style={styles.compBarTrack}>
          <div style={{...styles.compBarFill, width: `${width}%`, background: color}}/>
          <div style={{...styles.compBarRequiredLine, left: `${requiredLineLeft}%`}}/>
          <span style={{...styles.compBarValueText, color: `white`}}> {text} </span>
        </div>

      </div>

      {/* Chart for Dijkstra */}
      <div style={styles.compBarRow}>
        <span style={styles.compBarAgentLabel}>Dijkstra</span>

        <div style={styles.compBarTrack}>
          <div style={{...styles.compBarFill, width: `${disWidth}%`, background: disColor}} />
          <div style={{...styles.compBarRequiredLine, left: `${requiredLineLeft}%`}} />
          <span style={{...styles.compBarValueText, color: 'white'}}> {disText} </span>
        </div>

      </div>
    </div>
  );
}
      



function QoSDetail({ label, required, allocated, unit, isSatisfied, dijkstraValue }) {
  const color = isSatisfied ? '#10b981' : '#ef4444';
  return (
    <div>
      <p style={styles.detailLabel}>{label}</p>
      <p style={{ color: '#d1d5db', margin: '0', fontSize: '13px' }}>
        Required: <span style={{ color: '#93c5fd', fontWeight: '600' }}>{required.toFixed(2)}</span> {unit}
      </p>
      <p style={{ color, margin: '4px 0 0 0', fontSize: '13px', fontWeight: '600' }}>
        Allocated: {allocated.toFixed(2)} {unit}
      </p>
      {dijkstraValue !== undefined && (
        <p style={{ color:'#bfdbfe', margin:'2px 0 0 0', fontSize:'11px', fontStyle:'italic' }}>
          Dijkstra: {dijkstraValue.toFixed(2)} {unit}
        </p>
      )}
      <p style={{ color, margin: '4px 0 0 0', fontSize: '11px' }}>
        {isSatisfied ? '✓ Satisfied' : '✗ Unsatisfied'}
      </p>
    </div>
  );
}

function PathNodeInfoWithResources({ nodeId, index, totalNodes, nodeData, getResourceUtilization }) {
  if (!nodeData) {
    return (
      <div style={styles.pathNodeCard}>
        <div style={styles.pathNodeHeader}>
          <p style={styles.pathNodeId}>{nodeId}</p>
          <span style={styles.pathNodeBadge}>#{index + 1}</span>
        </div>
        <p style={styles.pathNodeRole}>
          {index === 0 ? 'Source' : index === totalNodes - 1 ? 'Destination' : 'Hop'}
        </p>
        <p style={{ color: '#9ca3af', fontSize: '10px', margin: '8px 0 0 0' }}>
          Loading resources...
        </p>
      </div>
    );
  }

  const upUtil = getResourceUtilization(nodeData.resources_used.uplink, nodeData.resources.uplink);
  const downUtil = getResourceUtilization(nodeData.resources_used.downlink, nodeData.resources.downlink);

  return (
    <div style={styles.pathNodeCard}>
      <div style={styles.pathNodeHeader}>
        <p style={styles.pathNodeId}>{nodeId}</p>
        <span style={styles.pathNodeBadge}>#{index + 1}</span>
      </div>
      <p style={styles.pathNodeRole}>
        {index === 0 ? 'Hop' : index === totalNodes - 1 ? 'Destination' : 'Hop'}
      </p>
      
      <p style={{ color: '#9ca3af', fontSize: '10px', margin: '8px 0 4px 0', textTransform: 'uppercase' }}>
        Type: {nodeData.type}
      </p>

      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <div style={{ marginBottom: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>Uplink</span>
            <span style={{ fontSize: '10px', color: upUtil < 75 ? '#10b981' : '#f59e0b', fontWeight: '600' }}>
              {upUtil}%
            </span>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${upUtil}%`,
              height: '100%',
              background: upUtil < 75 ? '#10b981' : '#f59e0b',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        <div style={{ marginBottom: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>Downlink</span>
            <span style={{ fontSize: '10px', color: downUtil < 75 ? '#10b981' : '#f59e0b', fontWeight: '600' }}>
              {downUtil}%
            </span>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${downUtil}%`,
              height: '100%',
              background: downUtil < 75 ? '#10b981' : '#f59e0b',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {nodeData.type === 'groundstation' && (
          <>
            <div style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>CPU</span>
                <span style={{ fontSize: '10px', color: '#93c5fd', fontWeight: '600' }}>
                  {getResourceUtilization(nodeData.resources_used.cpu, nodeData.resources.cpu)}%
                </span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  width: `${getResourceUtilization(nodeData.resources_used.cpu, nodeData.resources.cpu)}%`,
                  height: '100%',
                  background: '#93c5fd',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>Power</span>
                <span style={{ fontSize: '10px', color: '#93c5fd', fontWeight: '600' }}>
                  {getResourceUtilization(nodeData.resources_used.power, nodeData.resources.power)}%
                </span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  width: `${getResourceUtilization(nodeData.resources_used.power, nodeData.resources.power)}%`,
                  height: '100%',
                  background: '#93c5fd',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Component Card comprate Agent & Dijkstra Result
function ComparisonCard({ title, unit, agentValue, dijkstraValue, lowerIsBetter = false, precision = 2 }) {
  const agentVal = parseFloat(agentValue);
  const dijkstraVal = parseFloat(dijkstraValue);
  
  let agentColor = '#d1d5db';
  let dijkstraColor = '#d1d5db';

  if (!isNaN(agentVal) && !isNaN(dijkstraVal) && agentVal !== dijkstraVal) {
    if (lowerIsBetter) {
      agentColor = agentVal < dijkstraVal ? '#10b981' : '#ef4444'; // Green if lower
      dijkstraColor = dijkstraVal < agentVal ? '#10b981' : '#ef4444';
    } 
    else { 
      agentColor = agentVal > dijkstraVal ? '#10b981' : '#ef4444'; // Green if higher
      dijkstraColor = dijkstraVal > agentVal ? '#10b981' : '#ef4444';
    }
  }

  return (
    <div style={{...styles.statCard, gridColumn: 'span 2'}}>
      <p style={styles.statCardTitle}>{title}</p>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '12px' }}>

        {/* Phần của Agent */}

        <div>
          <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Agent</p>
          <p style={{ ...styles.statCardValue, margin: 0, color: agentColor }}>
            {isNaN(agentVal) ? 'N/A' : agentVal.toFixed(precision)}
            <span style={{ fontSize: '16px', marginLeft: '4px' }}>{unit}</span>
          </p>
        </div>

        {/* Phần của Dijkstra */}

        <div>
          <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Dijkstra</p>
          <p style={{ ...styles.statCardValue, margin: 0, color: dijkstraColor }}>
            {isNaN(dijkstraVal) ? 'N/A' : dijkstraVal.toFixed(precision)}
            <span style={{ fontSize: '16px', marginLeft: '4px' }}>{unit}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function AggregateStatsTab() {
  const [stats, setStats] = useState(null);
  const [timeData, setTimeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      //Fetch 1 -> Aggregate
      const response = await fetch('http://localhost:8000/get_aggregate_stats');
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      const data = await response.json();
      setStats(data);

      //Fetch 2 -> Time Series
      const timeResponse = await fetch('http://localhost:8000/get_time_series_stats');
      if (!timeResponse.ok) throw new Error(`Failed to fetch: ${timeResponse.status}`);
      const timeData = await timeResponse.json();
      setTimeData(timeData);

      setLoading(false);
    } catch (err) {
      console.error('Error fetching aggregate stats:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Support Normalize
  const safeNormalize = (a, b) => {
    if (b === 0 || b === null || typeof b === 'undefined') return 0;
    if (a === 0 || a === null || typeof a === 'undefined') return 0;
    return Math.min((a / b) * 100, 100); 
  };

  // NORMALIZE


  // Chỉ số "CÀNG THẤP CÀNG TỐT"
  const normalizeLower = (agentVal, dijkstraVal) => {
    const minVal = Math.min(agentVal, dijkstraVal);
    if (minVal === 0 && agentVal === 0 && dijkstraVal === 0) {
      return { agent: 100, dijkstra: 100 };
    }
    return {
      agent: safeNormalize(minVal, agentVal), 
      dijkstra: safeNormalize(minVal, dijkstraVal),
    };
  };

  // Chỉ số "CÀNG CAO CÀNG TỐT"
  const normalizeHigher = (agentVal, dijkstraVal) => {
    const maxVal = Math.max(agentVal, dijkstraVal);
    return {
      agent: safeNormalize(agentVal, maxVal),
      dijkstra: safeNormalize(dijkstraVal, maxVal),
    };
  };

  let chartData = [];
  if (stats) {
    const successScores = normalizeHigher(stats.agent_success_rate, stats.dijkstra_success_rate);
    const latencyScores = normalizeLower(stats.agent_avg_latency, stats.dijkstra_avg_latency);
    const hopsScores = normalizeLower(stats.agent_avg_hops, stats.dijkstra_avg_hops);
    const uplinkScores = normalizeHigher(stats.agent_avg_uplink, stats.dijkstra_avg_uplink);
    const downlinkScores = normalizeHigher(stats.agent_avg_downlink, stats.dijkstra_avg_downlink);
    const reliabilityScores = normalizeHigher(stats.agent_avg_reliability, stats.dijkstra_avg_reliability);
    const cpuScores = normalizeHigher(stats.agent_avg_cpu, stats.dijkstra_avg_cpu);
    const powerScores = normalizeHigher(stats.agent_avg_power, stats.dijkstra_avg_power);

    chartData = [
      { subject: 'Success Rate', agent: successScores.agent, dijkstra: successScores.dijkstra, fullMark: 100 },
      { subject: 'Avg. Latency', agent: latencyScores.agent, dijkstra: latencyScores.dijkstra, fullMark: 100 },
      { subject: 'Avg. Hops', agent: hopsScores.agent, dijkstra: hopsScores.dijkstra, fullMark: 100 },
      { subject: 'Uplink', agent: uplinkScores.agent, dijkstra: uplinkScores.dijkstra, fullMark: 100 },
      { subject: 'Downlink', agent: downlinkScores.agent, dijkstra: downlinkScores.dijkstra, fullMark: 100 },
      { subject: 'Reliability', agent: reliabilityScores.agent, dijkstra: reliabilityScores.dijkstra, fullMark: 100 },
      { subject: 'CPU', agent: cpuScores.agent, dijkstra: cpuScores.dijkstra, fullMark: 100 },
      { subject: 'Power', agent: powerScores.agent, dijkstra: powerScores.dijkstra, fullMark: 100 },
    ];
  }

  if (loading && !stats) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p>Loading aggregate statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.warningBanner}>
        Error loading stats: {error}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid rgba(59, 130, 246, 0.2)'}}>
        <h2 style={{...styles.title, fontSize: '20px', margin: 0}}>
          Aggregate Statistics
        </h2>

        <button onClick={fetchStats} style={styles.expandButton} className="expand-button">
          <RefreshCw size={16} style={{ marginRight: '8px', ...(!loading && { animation: 'none' }) }} className={loading ? 'spin-icon' : ''} />
          Refresh
        </button>
      </div>

      {/* === RADAR CHART === */}
      <div style={{ height: 400, marginBottom: '24px', marginTop: '24px', background: 'rgba(31, 41, 55, 0.6)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid stroke="rgba(59, 130, 246, 0.3)" />
            <PolarAngleAxis dataKey="subject" stroke="#bfdbfe" fontSize={13} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(59, 130, 246, 0.3)" fontSize={10} />

            {/* Agent */}
            <Radar 
              name="Agent AI" 
              dataKey="agent" 
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.25}
              strokeWidth={2}
            />

            {/* Dijkstra */}
            <Radar 
              name="Dijkstra" 
              dataKey="dijkstra" 
              stroke="#ef4444"  
              fill="#ef4444"    
              fillOpacity={0.25}
              strokeWidth={2}
            />
            {/* Chú thích */}
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* === LINE CHART === */}
      {timeData && timeData.length > 0 && (
        <div style={{ height: 300, marginBottom: '24px', background: 'rgba(31, 41, 55, 0.6)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px' }}>
          <h5 style={{...styles.pathTitle, margin: '0 0 16px 0', fontSize: '14px', color: '#e5e7eb'}}>
            Request Win Rate Over Time (Per 50 Requests)
          </h5>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={timeData}
              margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59, 130, 246, 0.2)" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ 
                  background: 'rgba(31, 41, 55, 0.9)', 
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px'
                }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend wrapperStyle={{paddingTop: '20px'}} />
              
              <Line type="monotone" dataKey="agent_win_rate" name="Agent Wins" stroke="#10b981" strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 3 }}/>
              <Line type="monotone" dataKey="dijkstra_win_rate" name="Dijkstra Wins" stroke="#ef4444" strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 3 }}/>
              <Line type="monotone" dataKey="draw_rate" name="Draws" stroke="#9ca3af" strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 3 }}/>
              
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{marginTop: '-8px', marginBottom: '24px'}}>
          <div style={{...styles.summaryGrid, gridTemplateColumns: 'repeat(3, 1fr)'}}>
              <StatCard 
                  title="Overall Agent Win Rate" 
                  value={stats.overall_agent_win_rate?.toFixed(2) ?? 'N/A'} 
                  unit="%" 
              />
               <StatCard 
                  title="Overall Dijkstra Win Rate" 
                  value={stats.overall_dijkstra_win_rate?.toFixed(2) ?? 'N/A'} 
                  unit="%" 
              />
               <StatCard 
                  title="Overall Draw Rate" 
                  value={stats.overall_draw_rate?.toFixed(2) ?? 'N/A'} 
                  unit="%" 
              />
          </div>
      </div>
      
      {/* Các thẻ so sánh chi tiết */}
      <div style={{ gridColumn: '1 / -1', marginTop: '16px', marginBottom: '-8px' }}>
          <h5 style={{...styles.pathTitle, fontSize: '14px', color: '#e5e7eb'}}>AGGREGATE QOS PERFORMANCE</h5>
        </div>

      <div style={{...styles.summaryGrid, marginTop: '24px'}}>
        <StatCard
          title="Total Requests Processed"
          value={stats.total_requests.toLocaleString() ?? 'N/A'}
          unit="REQUESTS"
          style={{ gridColumn: '1 / -1' }}
          align='center'
        />

        <ComparisonCard
          title="QoS Success Rate"
          unit="%"
          agentValue={stats.agent_success_rate}
          dijkstraValue={stats.dijkstra_success_rate}
          lowerIsBetter={false}
          precision={2}
        />
        
        <ComparisonCard
          title="Average Latency"
          unit="ms"
          agentValue={stats.agent_avg_latency}
          dijkstraValue={stats.dijkstra_avg_latency}
          lowerIsBetter={true}
          precision={2}
        />
        
        <ComparisonCard
          title="Average Hops"
          unit="hops"
          agentValue={stats.agent_avg_hops}
          dijkstraValue={stats.dijkstra_avg_hops}
          lowerIsBetter={true}
          precision={2}
        />

        <ComparisonCard
          title="Average Uplink"
          unit="Mbps"
          agentValue={stats.agent_avg_uplink}
          dijkstraValue={stats.dijkstra_avg_uplink}
          lowerIsBetter={false}
          precision={2}
        />

        <ComparisonCard
          title="Average Downlink"
          unit="Mbps"
          agentValue={stats.agent_avg_downlink}
          dijkstraValue={stats.dijkstra_avg_downlink}
          lowerIsBetter={false}
          precision={2}
        />

        <ComparisonCard
          title="Average Reliability"
          unit=""
          agentValue={stats.agent_avg_reliability}
          dijkstraValue={stats.dijkstra_avg_reliability}
          lowerIsBetter={false}
          precision={2} 
        />

        <ComparisonCard
          title="Average CPU"
          unit="cores"
          agentValue={stats.agent_avg_cpu}
          dijkstraValue={stats.dijkstra_avg_cpu}
          lowerIsBetter={false}
          precision={2}
        />

        <ComparisonCard
          title="Average Power"
          unit="W"
          agentValue={stats.agent_avg_power}
          dijkstraValue={stats.dijkstra_avg_power}
          lowerIsBetter={false}
          precision={2}
        />

        <div style={{ gridColumn: '1 / -1', marginTop: '16px', marginBottom: '-8px' }}>
          <h5 style={{...styles.pathTitle, fontSize: '14px', color: '#e5e7eb'}}>RESOURCE ALLOCATION CONSISTENCY (STD DEV)</h5>
        </div>

        {/* Lower is Better (Càng thấp càng tốt/nhất quán) */}
        <ComparisonCard
          title="Uplink Allocation Consistency (Std Dev)"
          unit="Mbps"
          agentValue={stats.agent_alloc_uplink_stddev}
          dijkstraValue={stats.dijkstra_alloc_uplink_stddev}
          lowerIsBetter={true}
          precision={2}
        />
        <ComparisonCard
          title="Downlink Allocation Consistency (Std Dev)"
          unit="Mbps"
          agentValue={stats.agent_alloc_downlink_stddev}
          dijkstraValue={stats.dijkstra_alloc_downlink_stddev}
          lowerIsBetter={true}
          precision={2}
        />
        <ComparisonCard
          title="CPU Allocation Consistency (Std Dev)"
          unit="cores"
          agentValue={stats.agent_alloc_cpu_stddev}
          dijkstraValue={stats.dijkstra_alloc_cpu_stddev}
          lowerIsBetter={true}
          precision={2}
        />
        <ComparisonCard
          title="Power Allocation Consistency (Std Dev)"
          unit="W"
          agentValue={stats.agent_alloc_power_stddev}
          dijkstraValue={stats.dijkstra_alloc_power_stddev}
          lowerIsBetter={true}
          precision={2}
        />
      </div>
    </div>
  );
}