import React from 'react';

export default function AgentProfileCard({ agent, selected, onClick }) {
  const avgTrait = Object.values(agent.personality_traits).reduce((a, b) => a + b, 0) /
                   Object.values(agent.personality_traits).length;

  return (
    <div
      className={`agent-profile-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="agent-avatar">
          {agent.name.charAt(0)}
        </div>
        <div className="agent-info">
          <h3 className="agent-name">{agent.name}</h3>
          <p className="agent-role">{agent.role}</p>
        </div>
      </div>

      <div className="card-body">
        <div className="agent-stats">
          <div className="stat-item">
            <span className="stat-label">Experience</span>
            <span className="stat-value">{agent.experience_years}y</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Projects</span>
            <span className="stat-value">{agent.projects_completed}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Skills</span>
            <span className="stat-value">{agent.skills.length}</span>
          </div>
        </div>

        <div className="agent-skills-preview">
          {agent.skills.slice(0, 3).map((skill, idx) => (
            <span key={idx} className="skill-badge">{skill}</span>
          ))}
          {agent.skills.length > 3 && (
            <span className="skill-badge more">+{agent.skills.length - 3}</span>
          )}
        </div>

        <div className="agent-availability">
          <span className={`availability-badge ${agent.availability}`}>
            {agent.availability}
          </span>
        </div>
      </div>
    </div>
  );
}
