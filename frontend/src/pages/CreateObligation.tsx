// ============================================
// CREATE OBLIGATION PAGE
// ============================================
// ENFORCEMENT: Blocks save if owner or SLA is missing

import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { obligationsAPI, usersAPI } from '../api';

interface FormData {
  title: string;
  description: string;
  regulationTag: string;
  ownerId: string;
  slaDueDate: string;
}

interface User {
  id: string;
  name: string;
  role: string;
}

const CreateObligation: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    regulationTag: '',
    ownerId: '',
    slaDueDate: ''
  });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [violations, setViolations] = useState<string[]>([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async (): Promise<void> => {
    try {
      const response = await usersAPI.list();
      setUsers(response.data.data || []);
    } catch (err) {
      setError('Failed to load users');
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    // Clear violations when user makes changes
    setViolations([]);
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!formData.title.trim()) {
      errors.push('Title is required');
    }
    
    if (!formData.ownerId) {
      errors.push('Owner is required. Every obligation must have exactly ONE owner.');
    }
    
    if (!formData.slaDueDate) {
      errors.push('SLA due date is required. Every obligation must have a fixed SLA.');
    } else {
      const dueDate = new Date(formData.slaDueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate <= today) {
        errors.push('SLA due date must be in the future');
      }
    }
    
    return errors;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setViolations([]);

    // Client-side validation (same rules as server)
    const errors = validateForm();
    if (errors.length > 0) {
      setViolations(errors);
      return;
    }

    setLoading(true);

    try {
      const obligationData: any = {
        title: formData.title,
        description: formData.description,
        ownerId: formData.ownerId,
        dueDate: formData.slaDueDate,
        regulationTag: formData.regulationTag
      };
      const response = await obligationsAPI.create(obligationData);
      navigate(`/obligations/${response.data.data?.id}`);
    } catch (err: any) {
      if (err.response?.data?.violations) {
        setViolations(err.response.data.violations);
      } else {
        setError(err.response?.data?.message || 'Failed to create obligation');
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate minimum date (tomorrow)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div>
      <div className="page-header">
        <h1>Create Obligation</h1>
      </div>

      {/* Enforcement notice */}
      <div className="alert alert-info" style={{ marginBottom: '24px' }}>
        <strong>ENFORCEMENT RULES:</strong>
        <ul style={{ margin: '8px 0 0 20px' }}>
          <li>Every obligation must have exactly ONE owner</li>
          <li>Every obligation must have a fixed SLA date</li>
          <li>Once created, the obligation cannot be deleted</li>
          <li>All actions are logged in the audit trail</li>
        </ul>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      
      {violations.length > 0 && (
        <div className="alert alert-error">
          <strong>ENFORCEMENT VIOLATION:</strong>
          <ul style={{ margin: '8px 0 0 20px' }}>
            {violations.map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>
              Title <span className="required">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Submit monthly compliance report"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Detailed description of the compliance obligation..."
            />
          </div>

          <div className="form-group">
            <label>Regulation Tag</label>
            <input
              type="text"
              name="regulationTag"
              value={formData.regulationTag}
              onChange={handleChange}
              placeholder="e.g., RBI/2023-24/XX, SEBI Circular..."
            />
            <p className="help-text">
              Free text reference. This system does NOT interpret regulations.
            </p>
          </div>

          <div className="detail-grid">
            <div className="form-group">
              <label>
                Owner <span className="required">*</span>
              </label>
              <select
                name="ownerId"
                value={formData.ownerId}
                onChange={handleChange}
                required
              >
                <option value="">-- Select Owner --</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
              <p className="help-text">
                Every obligation must have exactly ONE owner who is accountable.
              </p>
            </div>

            <div className="form-group">
              <label>
                SLA Due Date <span className="required">*</span>
              </label>
              <input
                type="date"
                name="slaDueDate"
                value={formData.slaDueDate}
                onChange={handleChange}
                min={minDateStr}
                required
              />
              <p className="help-text">
                Must be a future date. Cannot be changed after creation (only extended).
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Obligation'}
            </button>
            <Link to="/obligations" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateObligation;
