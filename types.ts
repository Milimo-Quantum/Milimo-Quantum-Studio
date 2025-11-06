import React from 'react';

// Core Types
export interface QuantumGate {
  id: string;
  name: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  color: string;
  description: string;
  type?: 'single' | 'control';
}

export interface PlacedGate {
  instanceId: string;
  gateId: string;
  qubit: number; // Target qubit
  controlQubit?: number; // Control qubit for multi-qubit gates
  left: number; // Percentage position from left
}

// Agent-related Types
export type AgentName = 'Orchestrator' | 'Design' | 'Optimization' | 'Explanation';
export type AgentStatus = 'running' | 'completed';

export interface AgentStatusUpdate {
  agent: AgentName;
  status: AgentStatus;
  message: string;
}

// AI Communication Protocol
export interface AIAction {
  type: 'clear_circuit' | 'add_gate' | 'replace_circuit';
  payload: any;
}

export interface AIResponse {
  displayText: string;
  actions: AIAction[];
}

// UI Message Types
export interface TextMessage {
  type: 'text';
  sender: 'user' | 'ai';
  text: string;
}

export interface AgentStatusMessage {
  type: 'agent_status';
  updates: AgentStatusUpdate[];
}

export type Message = TextMessage | AgentStatusMessage;

// Simulation Types
export interface Probability {
  state: string;
  value: number;
}

export interface SimulationResult {
  probabilities: Probability[];
}
