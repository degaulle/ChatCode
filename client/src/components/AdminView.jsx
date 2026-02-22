import React, { useState, useEffect } from 'react';
import AgentProfileCard from './AgentProfileCard.jsx';
import CompatibilityGraph from './CompatibilityGraph.jsx';

export default function AdminView({ onBack }) {
  const [agents, setAgents] = useState([]);
  const [compatibilityMatrix, setCompatibilityMatrix] = useState({});
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'graph'

  useEffect(() => {
    fetchAgentProfiles();
  }, []);

  const fetchAgentProfiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/agents');
      if (!response.ok) throw new Error('Failed to fetch agent profiles');
      const data = await response.json();
      setAgents(data.agents || []);
      setCompatibilityMatrix(data.compatibility_matrix || {});
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching agent profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCompatibilityScore = (agentId1, agentId2) => {
    if (agentId1 === agentId2) return 1.0;
    return compatibilityMatrix[agentId1]?.[agentId2] || 0;
  };

  if (loading) {
    return (
      <div className="admin-view">
        <div className="admin-header">
          <button className="btn back-btn" onClick={onBack}>← Back</button>
          <h1>Agent Admin View</h1>
        </div>
        <div className="loading">Loading agent profiles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-view">
        <div className="admin-header">
          <button className="btn back-btn" onClick={onBack}>← Back</button>
          <h1>Agent Admin View</h1>
        </div>
        <div className="error">Error: {error}</div>
        <button className="btn" onClick={fetchAgentProfiles}>Retry</button>
      </div>
    );
  }

  return (
    <div className="admin-view">
      <div className="admin-header">
        <button className="btn back-btn" onClick={onBack}>← Back</button>
        <h1>Agent Admin View</h1>
        <div className="view-mode-toggle">
          <button
            className={`btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            List View
          </button>
          <button
            className={`btn ${viewMode === 'graph' ? 'active' : ''}`}
            onClick={() => setViewMode('graph')}
          >
            Graph View
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="admin-content">
          <div className="agent-list-panel">
            <h2>Agent Profiles ({agents.length})</h2>
            <div className="agent-list">
              {agents.map((agent) => (
                <AgentProfileCard
                  key={agent.id}
                  agent={agent}
                  selected={selectedAgent?.id === agent.id}
                  onClick={() => setSelectedAgent(agent)}
                />
              ))}
            </div>
          </div>

          {selectedAgent && (
            <div className="agent-details-panel">
              <h2>Agent Details</h2>
              <div className="agent-details">
                <div className="detail-section">
                  <h3>{selectedAgent.name}</h3>
                  <p className="role">{selectedAgent.role}</p>
                  <p className="experience">{selectedAgent.experience_years} years experience</p>
                  <p className="availability">Availability: {selectedAgent.availability}</p>
                  <p className="projects">Projects completed: {selectedAgent.projects_completed}</p>
                </div>

                <div className="detail-section">
                  <h4>Skills</h4>
                  <div className="skills-list">
                    {selectedAgent.skills.map((skill, idx) => (
                      <span key={idx} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Personality Traits</h4>
                  <div className="traits-list">
                    {Object.entries(selectedAgent.personality_traits).map(([trait, value]) => (
                      <div key={trait} className="trait-item">
                        <span className="trait-name">{trait.replace('_', ' ')}</span>
                        <div className="trait-bar">
                          <div
                            className="trait-fill"
                            style={{ width: `${value * 100}%` }}
                          />
                        </div>
                        <span className="trait-value">{(value * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Compatibility with Other Agents</h4>
                  <div className="compatibility-list">
                    {agents
                      .filter((a) => a.id !== selectedAgent.id)
                      .map((agent) => {
                        const score = getCompatibilityScore(selectedAgent.id, agent.id);
                        return (
                          <div key={agent.id} className="compatibility-item">
                            <span className="agent-name">{agent.name}</span>
                            <div className="compatibility-bar">
                              <div
                                className="compatibility-fill"
                                style={{
                                  width: `${score * 100}%`,
                                  backgroundColor: score > 0.8 ? '#4caf50' : score > 0.6 ? '#ff9800' : '#f44336',
                                }}
                              />
                            </div>
                            <span className="compatibility-value">{(score * 100).toFixed(0)}%</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="admin-content-graph">
          <CompatibilityGraph
            agents={agents}
            compatibilityMatrix={compatibilityMatrix}
            onNodeClick={setSelectedAgent}
            selectedAgent={selectedAgent}
          />
        </div>
      )}
    </div>
  );
}
