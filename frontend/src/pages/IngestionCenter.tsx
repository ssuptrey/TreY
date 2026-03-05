// ============================================
// INGESTION CENTER - Real Working Intake Channels
// ============================================
// CSV Import, Email Setup, WhatsApp Setup, API Configuration

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../api';

interface IngestionLog {
  id: string;
  channel: string;
  source_identifier: string;
  obligation_id: string | null;
  obligation_title?: string;
  status: string;
  error_message?: string;
  processed_at: string;
}

interface ChannelStats {
  channel: string;
  total: number;
  success: number;
  failed: number;
}

interface CSVPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  data: {
    total: number;
    success: number;
    failed: number;
    errors: string[];
    created: Array<{ id: string; title: string; row: number }>;
  };
}

const IngestionCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'csv' | 'email' | 'whatsapp' | 'api' | 'logs'>('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // CSV State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  // Logs State
  const [logs, setLogs] = useState<IngestionLog[]>([]);
  const [stats, setStats] = useState<ChannelStats[]>([]);

  // CSV Drop Zone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setCsvFile(file);
      setImportResult(null);
      setError(null);
      
      // Parse preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const lines = content.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1, 6).map(line => {
          return parseCSVRow(line);
        });
        setCsvPreview({
          headers,
          rows,
          totalRows: lines.length - 1
        });
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1
  });

  // Parse CSV row handling quoted values
  const parseCSVRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Upload CSV
  const handleCSVUpload = async () => {
    if (!csvFile) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const response = await api.post('/ingestion/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setImportResult(response.data);
      if (response.data.success) {
        setSuccess(`Successfully imported ${response.data.data.success} obligations`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import CSV');
    } finally {
      setLoading(false);
    }
  };

  // Load logs
  const loadLogs = async () => {
    try {
      const response = await api.get('/ingestion/logs');
      setLogs(response.data.data.logs);
      setStats(response.data.data.stats);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab]);

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'csv': return 'CSV';
      case 'email': return 'EM';
      case 'whatsapp': return 'WA';
      case 'api': return 'API';
      case 'forward': return 'FW';
      default: return 'IN';
    }
  };

  return (
    <div className="ingestion-center">
      <div className="ingestion-header">
        <h1>Ingestion Center</h1>
        <p className="ingestion-subtitle">Real-time complaint intake from all channels</p>
      </div>

      {/* Channel Tabs */}
      <div className="ingestion-tabs">
        <button 
          className={`tab ${activeTab === 'csv' ? 'active' : ''}`}
          onClick={() => setActiveTab('csv')}
        >
          CSV Import
        </button>
        <button 
          className={`tab ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          Email Webhook
        </button>
        <button 
          className={`tab ${activeTab === 'whatsapp' ? 'active' : ''}`}
          onClick={() => setActiveTab('whatsapp')}
        >
          WhatsApp
        </button>
        <button 
          className={`tab ${activeTab === 'api' ? 'active' : ''}`}
          onClick={() => setActiveTab('api')}
        >
          Public API
        </button>
        <button 
          className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Ingestion Logs
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && <div className="ingestion-error">{error}</div>}
      {success && <div className="ingestion-success">{success}</div>}

      {/* CSV Import Tab */}
      {activeTab === 'csv' && (
        <div className="ingestion-content">
          <div className="csv-section">
            <h2>Bulk CSV Import</h2>
            <p className="section-info">
              Upload a CSV file with complaints to create multiple obligations at once.
            </p>

            <div className="csv-format-info">
              <h3>Required CSV Format</h3>
              <table className="format-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Required</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>title</code> or <code>complaint</code> or <code>subject</code></td>
                    <td className="required">Yes</td>
                    <td>Complaint title/subject</td>
                  </tr>
                  <tr>
                    <td><code>description</code> or <code>details</code></td>
                    <td>No</td>
                    <td>Full complaint details</td>
                  </tr>
                  <tr>
                    <td><code>due_date</code> or <code>deadline</code></td>
                    <td>No</td>
                    <td>SLA deadline (YYYY-MM-DD or DD/MM/YYYY)</td>
                  </tr>
                  <tr>
                    <td><code>regulation</code> or <code>circular</code></td>
                    <td>No</td>
                    <td>Regulation reference (e.g., "RBI/2024/123")</td>
                  </tr>
                  <tr>
                    <td><code>owner_email</code></td>
                    <td>No</td>
                    <td>Email of user to assign (must exist in system)</td>
                  </tr>
                  <tr>
                    <td><code>external_id</code></td>
                    <td>No</td>
                    <td>Your reference ID for this complaint</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Drop Zone */}
            <div 
              {...getRootProps()} 
              className={`csv-dropzone ${isDragActive ? 'active' : ''} ${csvFile ? 'has-file' : ''}`}
            >
              <input {...getInputProps()} />
              {csvFile ? (
                <div className="file-info">
                  <span className="file-icon"></span>
                  <span className="file-name">{csvFile.name}</span>
                  <span className="file-size">({(csvFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : isDragActive ? (
                <p>Drop the CSV file here...</p>
              ) : (
                <div className="dropzone-content">
                  <span className="upload-icon"></span>
                  <p>Drag & drop a CSV file here, or click to select</p>
                  <span className="hint">Maximum 10MB</span>
                </div>
              )}
            </div>

            {/* CSV Preview */}
            {csvPreview && (
              <div className="csv-preview">
                <h3>Preview ({csvPreview.totalRows} rows)</h3>
                <div className="preview-table-wrapper">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        {csvPreview.headers.map((h, i) => (
                          <th key={i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci}>{cell || '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvPreview.totalRows > 5 && (
                  <p className="preview-more">... and {csvPreview.totalRows - 5} more rows</p>
                )}
              </div>
            )}

            {/* Import Button */}
            {csvFile && (
              <button 
                className="import-button"
                onClick={handleCSVUpload}
                disabled={loading}
              >
                {loading ? 'Importing...' : `Import ${csvPreview?.totalRows || 0} Obligations`}
              </button>
            )}

            {/* Import Results */}
            {importResult && (
              <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
                <h3>Import Results</h3>
                <div className="result-stats">
                  <div className="stat">
                    <span className="stat-value">{importResult.data.total}</span>
                    <span className="stat-label">Total Rows</span>
                  </div>
                  <div className="stat success">
                    <span className="stat-value">{importResult.data.success}</span>
                    <span className="stat-label">Imported</span>
                  </div>
                  <div className="stat error">
                    <span className="stat-value">{importResult.data.failed}</span>
                    <span className="stat-label">Failed</span>
                  </div>
                </div>
                
                {importResult.data.errors.length > 0 && (
                  <div className="import-errors">
                    <h4>Errors:</h4>
                    <ul>
                      {importResult.data.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Sample CSV Download */}
            <div className="sample-download">
              <a 
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                  'title,description,due_date,regulation,owner_email,external_id\n' +
                  '"Customer complaint about delayed refund","Customer ID 12345 has been waiting 30 days for refund",2024-02-15,RBI/2024/67,manager@demo.com,COMP-001\n' +
                  '"Interest calculation dispute","Customer claims interest was calculated incorrectly",2024-02-20,RBI/2024/45,operator@demo.com,COMP-002'
                )}`}
                download="sample_complaints.csv"
                className="sample-link"
              >
                Download Sample CSV
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Email Webhook Tab */}
      {activeTab === 'email' && (
        <div className="ingestion-content">
          <div className="setup-section">
            <h2>Email Webhook Configuration</h2>
            <p className="section-info">
              Configure your email service to forward incoming complaints directly to this system.
            </p>

            <div className="setup-card">
              <h3>Webhook Endpoint</h3>
              <code className="endpoint-url">
                POST {window.location.origin}/api/ingestion/email
              </code>
              <p className="endpoint-note">
                Configure this URL in your email service's inbound parse settings.
              </p>
            </div>

            <div className="provider-instructions">
              <h3>Setup Instructions</h3>
              
              <div className="provider">
                <h4>SendGrid Inbound Parse</h4>
                <ol>
                  <li>Go to SendGrid Dashboard → Settings → Inbound Parse</li>
                  <li>Click "Add Host & URL"</li>
                  <li>Enter your domain (e.g., complaints.yourdomain.com)</li>
                  <li>Set destination URL: <code>{window.location.origin}/api/ingestion/email</code></li>
                  <li>Enable "POST the raw, full MIME message"</li>
                  <li>Configure MX records as shown by SendGrid</li>
                </ol>
              </div>

              <div className="provider">
                <h4>Mailgun Routes</h4>
                <ol>
                  <li>Go to Mailgun Dashboard → Receiving → Routes</li>
                  <li>Click "Create Route"</li>
                  <li>Set filter: <code>match_recipient("complaints@yourdomain.com")</code></li>
                  <li>Set action: <code>forward("{window.location.origin}/api/ingestion/email")</code></li>
                  <li>Save and test the route</li>
                </ol>
              </div>

              <div className="provider">
                <h4>Forward-to-Create</h4>
                <p>Users can forward any email to create obligations automatically:</p>
                <code className="endpoint-url">
                  POST {window.location.origin}/api/ingestion/forward
                </code>
                <p className="endpoint-note">
                  Each user gets a unique forwarding address: <code>create+[user_token]@yourdomain.com</code>
                </p>
              </div>
            </div>

            <div className="email-format">
              <h3>Expected Payload Format</h3>
              <pre className="code-block">{`{
  "from": "customer@example.com",
  "to": "complaints@yourdomain.com",
  "subject": "Complaint about delayed service",
  "text": "Full complaint body...",
  "html": "<p>HTML version if available</p>",
  // Attachments handled via multipart form
}`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Tab */}
      {activeTab === 'whatsapp' && (
        <div className="ingestion-content">
          <div className="setup-section">
            <h2>WhatsApp Business Integration</h2>
            <p className="section-info">
              Receive customer complaints directly via WhatsApp Business API.
            </p>

            <div className="setup-card">
              <h3>Webhook Endpoints</h3>
              <div className="endpoint-group">
                <label>Verification (GET):</label>
                <code className="endpoint-url">
                  GET {window.location.origin}/api/ingestion/whatsapp
                </code>
              </div>
              <div className="endpoint-group">
                <label>Messages (POST):</label>
                <code className="endpoint-url">
                  POST {window.location.origin}/api/ingestion/whatsapp
                </code>
              </div>
            </div>

            <div className="provider-instructions">
              <h3>Setup Instructions</h3>
              
              <div className="provider">
                <h4>Meta WhatsApp Cloud API</h4>
                <ol>
                  <li>Go to Meta for Developers → Your App → WhatsApp → Configuration</li>
                  <li>Set Callback URL: <code>{window.location.origin}/api/ingestion/whatsapp</code></li>
                  <li>Set Verify Token: <code>compliance_verify_token</code> (or set WHATSAPP_VERIFY_TOKEN env var)</li>
                  <li>Subscribe to "messages" webhook field</li>
                  <li>Get your Phone Number ID and Access Token</li>
                </ol>
              </div>

              <div className="provider">
                <h4>Twilio WhatsApp</h4>
                <ol>
                  <li>Go to Twilio Console → Messaging → WhatsApp senders</li>
                  <li>Select your WhatsApp number</li>
                  <li>Under "Messaging Service", configure webhook:</li>
                  <li>Set webhook URL: <code>{window.location.origin}/api/ingestion/whatsapp</code></li>
                  <li>Set HTTP method to POST</li>
                </ol>
              </div>
            </div>

            <div className="whatsapp-format">
              <h3>Message Handling</h3>
              <ul className="feature-list">
                <li>Text messages → Obligation title + description</li>
                <li>Images → Attached as evidence automatically</li>
                <li>Documents → Attached as evidence automatically</li>
                <li>Default SLA: 7 days (configurable)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* API Tab */}
      {activeTab === 'api' && (
        <div className="ingestion-content">
          <div className="setup-section">
            <h2>Public API Integration</h2>
            <p className="section-info">
              Integrate external systems (CRM, helpdesk, custom apps) to push complaints directly.
            </p>

            <div className="setup-card">
              <h3>API Endpoint</h3>
              <code className="endpoint-url">
                POST {window.location.origin}/api/ingestion/api/complaint
              </code>
            </div>

            <div className="api-auth">
              <h3>Authentication</h3>
              <p>Include your API key in the request header:</p>
              <code className="code-block">
                X-API-Key: your_api_key_here
              </code>
              <p className="note">
                Contact your administrator to generate an API key for your organization.
              </p>
            </div>

            <div className="api-docs">
              <h3>Request Format</h3>
              <pre className="code-block">{`POST /api/ingestion/api/complaint
Content-Type: application/json
X-API-Key: your_api_key

{
  "title": "Customer complaint title",        // Required
  "description": "Full complaint details",    // Optional
  "due_date": "2024-02-15",                   // Optional (default: 15 days)
  "regulation_tag": "RBI/2024/123",           // Optional
  "source": "crm_system",                     // Optional (for tracking)
  "external_id": "TICKET-12345",              // Optional (your reference ID)
  "owner_email": "manager@yourorg.com",       // Optional (auto-assign)
  "priority": "high"                          // Optional: low, medium, high
}`}</pre>
            </div>

            <div className="api-response">
              <h3>Response Format</h3>
              <pre className="code-block">{`// Success (201)
{
  "success": true,
  "data": {
    "obligation_id": "uuid-of-created-obligation",
    "title": "Customer complaint title",
    "due_date": "2024-02-15",
    "status": "open"
  },
  "message": "Complaint created successfully"
}

// Error (400/401/500)
{
  "success": false,
  "error": "Error description"
}`}</pre>
            </div>

            <div className="api-examples">
              <h3>Example: cURL</h3>
              <pre className="code-block">{`curl -X POST ${window.location.origin}/api/ingestion/api/complaint \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your_api_key" \\
  -d '{
    "title": "Refund not processed",
    "description": "Customer waiting 30 days",
    "due_date": "2024-02-15",
    "priority": "high"
  }'`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="ingestion-content">
          <div className="logs-section">
            <h2>Ingestion Logs</h2>
            
            {/* Stats Summary */}
            <div className="logs-stats">
              {stats.map((stat) => (
                <div key={stat.channel} className="stat-card">
                  <span className="stat-icon">{getChannelIcon(stat.channel)}</span>
                  <div className="stat-details">
                    <span className="stat-channel">{stat.channel}</span>
                    <span className="stat-numbers">
                      <span className="success">{stat.success}</span> / 
                      <span className="total">{stat.total}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Logs Table */}
            <div className="logs-table-wrapper">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Channel</th>
                    <th>Source</th>
                    <th>Obligation</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="no-logs">
                        No ingestion logs yet. Import some data to see logs here.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className={`status-${log.status}`}>
                        <td className="time">
                          {new Date(log.processed_at).toLocaleString()}
                        </td>
                        <td className="channel">
                          <span className="channel-badge">
                            {getChannelIcon(log.channel)} {log.channel}
                          </span>
                        </td>
                        <td className="source" title={log.source_identifier}>
                          {log.source_identifier?.substring(0, 30)}
                          {log.source_identifier?.length > 30 ? '...' : ''}
                        </td>
                        <td className="obligation">
                          {log.obligation_title || log.obligation_id?.substring(0, 8) || '-'}
                        </td>
                        <td className="status">
                          <span className={`status-badge ${log.status}`}>
                            {log.status}
                          </span>
                          {log.error_message && (
                            <span className="error-hint" title={log.error_message}>!</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <button className="refresh-btn" onClick={loadLogs}>
              Refresh Logs
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IngestionCenter;
